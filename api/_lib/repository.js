import crypto from 'node:crypto';
import { validateAdminPassword } from './auth.js';
import { ensureDatabaseReady, supabaseAdmin, withPgClient } from './db.js';
import { getEnv } from './env.js';
import { HttpError } from './http.js';

const PRICE_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const STATUS_LABELS = {
  pending: 'Na fila',
  preparing: 'Em preparo',
  ready: 'Pronto',
  archived: 'Arquivado',
};

const SOURCE_LABELS = {
  online: 'Online',
  counter: 'Balcao',
};

const SERVICE_MODE_LABELS = {
  pickup: 'Retirada',
  table: 'Mesa',
};

function unwrap(result, fallbackMessage) {
  if (result.error) {
    console.error(result.error);

    if (result.error.code === '23505') {
      throw new HttpError(409, 'A record with the same unique value already exists.');
    }

    if (result.error.code === '23503' || result.error.code === '22P02') {
      throw new HttpError(400, 'Invalid reference or malformed value in the request.');
    }

    throw new HttpError(500, fallbackMessage);
  }

  return result.data;
}

function formatCurrency(valueInCents) {
  return PRICE_FORMATTER.format(valueInCents / 100);
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function assertNonEmptyString(value, fieldName) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    throw new HttpError(400, `${fieldName} is required.`);
  }

  return normalized;
}

function assertValidTime(value, fieldName) {
  const normalized = String(value || '').trim();

  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(normalized)) {
    throw new HttpError(400, `${fieldName} must use HH:MM format.`);
  }

  return normalized;
}

function parsePrice(value) {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  const normalized = String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  if (!normalized) {
    throw new HttpError(400, 'Price is required.');
  }

  const numericValue = Number(normalized);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new HttpError(400, 'Invalid price value.');
  }

  return Math.round(numericValue * 100);
}

function getNowTimeInTimezone() {
  const { businessTimezone } = getEnv();
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: businessTimezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  return formatter.format(new Date());
}

function isWithinSchedule(nowTime, openTime, closeTime) {
  if (openTime === closeTime) {
    return true;
  }

  if (openTime < closeTime) {
    return nowTime >= openTime && nowTime < closeTime;
  }

  return nowTime >= openTime || nowTime < closeTime;
}

function mapSettings(row) {
  const localTime = getNowTimeInTimezone();
  const withinSchedule = isWithinSchedule(localTime, row.online_open_time, row.online_close_time);
  const acceptsOrders = withinSchedule && !row.online_orders_paused;

  return {
    whatsappNumber: row.whatsapp_number,
    onlineOrdersPaused: row.online_orders_paused,
    onlineOpenTime: row.online_open_time,
    onlineCloseTime: row.online_close_time,
    localTime,
    isWithinSchedule: withinSchedule,
    acceptsOrders,
  };
}

function mapCategory(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    position: row.position,
    isActive: row.is_active,
  };
}

function mapItem(row, categoryMap = new Map()) {
  const category = categoryMap.get(row.category_id) || null;

  return {
    id: row.id,
    categoryId: row.category_id,
    categorySlug: category?.slug || '',
    categoryName: category?.name || '',
    title: row.title,
    description: row.description,
    priceCents: row.price_cents,
    priceFormatted: formatCurrency(row.price_cents),
    position: row.position,
    isHidden: row.is_hidden,
  };
}

function mapOrderItem(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    categoryName: row.category_name,
    priceCents: row.price_cents,
    priceFormatted: formatCurrency(row.price_cents),
    quantity: row.quantity,
    itemNotes: row.item_notes || '',
    position: row.position,
  };
}

function mapOrder(row) {
  const items = [...(row.order_items || [])]
    .sort((left, right) => left.position - right.position)
    .map(mapOrderItem);

  return {
    id: row.id,
    code: row.code,
    source: row.source,
    sourceLabel: SOURCE_LABELS[row.source] || row.source,
    serviceMode: row.service_mode,
    serviceModeLabel: SERVICE_MODE_LABELS[row.service_mode] || row.service_mode,
    customerName: row.customer_name,
    customerPhone: row.customer_phone || '',
    tableReference: row.table_reference || '',
    pickupTime: row.pickup_time || '',
    generalNotes: row.general_notes || '',
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] || row.status,
    totalCents: row.total_cents,
    totalFormatted: formatCurrency(row.total_cents),
    whatsappMessage: row.whatsapp_message || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    items,
  };
}

async function getSettingsRow() {
  await ensureDatabaseReady();
  const result = await supabaseAdmin
    .from('restaurant_settings')
    .select('*')
    .eq('id', 1)
    .single();

  return unwrap(result, 'Failed to load restaurant settings.');
}

async function getCategoriesRows({ activeOnly = false } = {}) {
  await ensureDatabaseReady();
  let query = supabaseAdmin
    .from('menu_categories')
    .select('*')
    .order('position', { ascending: true })
    .order('name', { ascending: true });

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  return unwrap(await query, 'Failed to load categories.');
}

async function getItemRows({ visibleOnly = false } = {}) {
  await ensureDatabaseReady();
  let query = supabaseAdmin
    .from('menu_items')
    .select('*')
    .order('position', { ascending: true })
    .order('title', { ascending: true });

  if (visibleOnly) {
    query = query.eq('is_hidden', false);
  }

  return unwrap(await query, 'Failed to load menu items.');
}

async function buildMenuPayload({ activeCategoriesOnly, visibleItemsOnly }) {
  const [categoriesRows, itemsRows] = await Promise.all([
    getCategoriesRows({ activeOnly: activeCategoriesOnly }),
    getItemRows({ visibleOnly: visibleItemsOnly }),
  ]);

  const categories = categoriesRows.map(mapCategory);
  const categoryMap = new Map(categoriesRows.map((row) => [row.id, row]));

  const items = itemsRows
    .filter((row) => {
      const category = categoryMap.get(row.category_id);
      return category && (!activeCategoriesOnly || category.is_active);
    })
    .map((row) => mapItem(row, categoryMap));

  return { categories, items };
}

function buildWhatsAppMessage(order) {
  const lines = [
    `Pedido ${order.code}`,
    `Cliente: ${order.customerName}`,
    `Atendimento: ${order.serviceModeLabel}`,
  ];

  if (order.tableReference) {
    lines.push(`Mesa: ${order.tableReference}`);
  }

  if (order.pickupTime) {
    lines.push(`Horario: ${order.pickupTime}`);
  }

  lines.push('');
  lines.push('Itens:');

  for (const item of order.items) {
    lines.push(`- ${item.quantity}x ${item.title}`);
    if (item.itemNotes) {
      lines.push(`  Obs: ${item.itemNotes}`);
    }
  }

  if (order.generalNotes) {
    lines.push('');
    lines.push(`Observacoes: ${order.generalNotes}`);
  }

  lines.push('');
  lines.push(`Total: ${order.totalFormatted}`);

  return lines.join('\n');
}

function buildWhatsAppUrl(number, message) {
  const digits = String(number || '').replace(/\D/g, '');

  if (!digits) {
    return null;
  }

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function createOrderCode(source) {
  const prefix = source === 'online' ? 'ONL' : 'BAL';
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  const code = Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
  return `${prefix}-${code}`;
}

function normalizeOrderPayload(source, payload) {
  const customerName = assertNonEmptyString(payload.customerName, 'Customer name');
  const pickupTime = payload.pickupTime ? assertValidTime(payload.pickupTime, 'Pickup time') : '';
  const generalNotes = String(payload.generalNotes || '').trim();
  const customerPhone = String(payload.customerPhone || '').trim();
  const serviceMode = source === 'counter'
    ? (payload.serviceMode === 'table' ? 'table' : 'pickup')
    : 'pickup';
  const tableReference = serviceMode === 'table'
    ? assertNonEmptyString(payload.tableReference, 'Table reference')
    : '';

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new HttpError(400, 'At least one item is required.');
  }

  const items = payload.items.map((item, index) => {
    const menuItemId = assertNonEmptyString(item.menuItemId, `Item ${index + 1}`);
    const quantity = Number(item.quantity);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new HttpError(400, `Item ${index + 1} has an invalid quantity.`);
    }

    return {
      menuItemId,
      quantity,
      itemNotes: String(item.itemNotes || '').trim(),
      position: index + 1,
    };
  });

  return {
    customerName,
    pickupTime,
    generalNotes,
    customerPhone,
    serviceMode,
    tableReference,
    items,
  };
}

export async function getPublicBootstrap() {
  const [settingsRow, menuPayload] = await Promise.all([
    getSettingsRow(),
    buildMenuPayload({ activeCategoriesOnly: true, visibleItemsOnly: true }),
  ]);

  return {
    settings: mapSettings(settingsRow),
    categories: menuPayload.categories,
    items: menuPayload.items,
  };
}

export async function getAdminBootstrap() {
  const [settingsRow, menuPayload, orders] = await Promise.all([
    getSettingsRow(),
    buildMenuPayload({ activeCategoriesOnly: false, visibleItemsOnly: false }),
    listOrders({ includeArchived: false, limit: 100 }),
  ]);

  return {
    settings: mapSettings(settingsRow),
    categories: menuPayload.categories,
    items: menuPayload.items,
    orders,
  };
}

export async function listOrders({ includeArchived = false, limit = 100 } = {}) {
  await ensureDatabaseReady();
  let query = supabaseAdmin
    .from('orders')
    .select(`
      id,
      code,
      source,
      service_mode,
      customer_name,
      customer_phone,
      table_reference,
      pickup_time,
      general_notes,
      status,
      total_cents,
      whatsapp_message,
      created_at,
      updated_at,
      archived_at,
      order_items (
        id,
        title,
        description,
        category_name,
        price_cents,
        quantity,
        item_notes,
        position
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!includeArchived) {
    query = query.is('archived_at', null);
  }

  const rows = unwrap(await query, 'Failed to load orders.');
  return rows.map(mapOrder);
}

export async function updateSettings(payload) {
  const patch = {
    updated_at: new Date().toISOString(),
  };

  if (payload.onlineOrdersPaused !== undefined) {
    patch.online_orders_paused = Boolean(payload.onlineOrdersPaused);
  }

  if (payload.onlineOpenTime !== undefined) {
    patch.online_open_time = assertValidTime(payload.onlineOpenTime, 'Opening time');
  }

  if (payload.onlineCloseTime !== undefined) {
    patch.online_close_time = assertValidTime(payload.onlineCloseTime, 'Closing time');
  }

  const result = await supabaseAdmin
    .from('restaurant_settings')
    .update(patch)
    .eq('id', 1)
    .select('*')
    .single();

  return mapSettings(unwrap(result, 'Failed to update restaurant settings.'));
}

async function getUniqueCategorySlug(baseValue) {
  const baseSlug = slugify(baseValue) || 'categoria';
  const result = await supabaseAdmin
    .from('menu_categories')
    .select('slug')
    .like('slug', `${baseSlug}%`);

  const rows = unwrap(result, 'Failed to validate category slug.');
  const usedSlugs = new Set(rows.map((row) => row.slug));

  if (!usedSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  while (usedSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}

export async function createCategory(payload) {
  const name = assertNonEmptyString(payload.name, 'Category name');
  const slug = await getUniqueCategorySlug(payload.slug || name);
  const position = Number.isFinite(Number(payload.position)) ? Number(payload.position) : Date.now();

  const result = await supabaseAdmin
    .from('menu_categories')
    .insert({
      slug,
      name,
      position,
      is_active: payload.isActive !== false,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  return mapCategory(unwrap(result, 'Failed to create category.'));
}

export async function updateCategory(payload) {
  const id = assertNonEmptyString(payload.id, 'Category id');
  const patch = {
    updated_at: new Date().toISOString(),
  };

  if (payload.name !== undefined) {
    patch.name = assertNonEmptyString(payload.name, 'Category name');
  }

  if (payload.position !== undefined) {
    patch.position = Number(payload.position) || 0;
  }

  if (payload.isActive !== undefined) {
    patch.is_active = Boolean(payload.isActive);
  }

  const result = await supabaseAdmin
    .from('menu_categories')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  return mapCategory(unwrap(result, 'Failed to update category.'));
}

export async function deleteCategory(payload) {
  const id = assertNonEmptyString(payload.id, 'Category id');
  const password = assertNonEmptyString(payload.password, 'Password');

  if (!validateAdminPassword(password)) {
    throw new HttpError(401, 'Invalid admin password.');
  }

  const result = await supabaseAdmin
    .from('menu_categories')
    .delete()
    .eq('id', id)
    .select('id')
    .single();

  return unwrap(result, 'Failed to delete category.');
}

export async function createItem(payload) {
  const categoryId = assertNonEmptyString(payload.categoryId, 'Category');
  const title = assertNonEmptyString(payload.title, 'Item title');
  const description = assertNonEmptyString(payload.description, 'Item description');
  const priceCents = parsePrice(payload.price);
  const position = Number.isFinite(Number(payload.position)) ? Number(payload.position) : Date.now();

  const result = await supabaseAdmin
    .from('menu_items')
    .insert({
      category_id: categoryId,
      title,
      description,
      price_cents: priceCents,
      position,
      is_hidden: Boolean(payload.isHidden),
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  const row = unwrap(result, 'Failed to create menu item.');
  const categoriesRows = await getCategoriesRows();
  return mapItem(row, new Map(categoriesRows.map((entry) => [entry.id, entry])));
}

export async function updateItem(payload) {
  const id = assertNonEmptyString(payload.id, 'Item id');
  const patch = {
    updated_at: new Date().toISOString(),
  };

  if (payload.categoryId !== undefined) {
    patch.category_id = assertNonEmptyString(payload.categoryId, 'Category');
  }

  if (payload.title !== undefined) {
    patch.title = assertNonEmptyString(payload.title, 'Item title');
  }

  if (payload.description !== undefined) {
    patch.description = assertNonEmptyString(payload.description, 'Item description');
  }

  if (payload.price !== undefined) {
    patch.price_cents = parsePrice(payload.price);
  }

  if (payload.position !== undefined) {
    patch.position = Number(payload.position) || 0;
  }

  if (payload.isHidden !== undefined) {
    patch.is_hidden = Boolean(payload.isHidden);
  }

  const result = await supabaseAdmin
    .from('menu_items')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  const row = unwrap(result, 'Failed to update menu item.');
  const categoriesRows = await getCategoriesRows();
  return mapItem(row, new Map(categoriesRows.map((entry) => [entry.id, entry])));
}

export async function deleteItem(payload) {
  const id = assertNonEmptyString(payload.id, 'Item id');
  const result = await supabaseAdmin
    .from('menu_items')
    .delete()
    .eq('id', id)
    .select('id')
    .single();

  return unwrap(result, 'Failed to delete menu item.');
}

function assertOnlineOrdersAvailable(settings) {
  if (!settings.acceptsOrders) {
    throw new HttpError(409, 'Online ordering is unavailable right now.');
  }
}

export async function createOrder(source, payload) {
  const normalizedPayload = normalizeOrderPayload(source, payload);
  const settings = mapSettings(await getSettingsRow());

  if (source === 'online') {
    assertOnlineOrdersAvailable(settings);
  }

  return withPgClient(async (client) => {
    const itemIds = normalizedPayload.items.map((item) => item.menuItemId);
    const itemsResult = await client.query(
      `
        select
          menu_items.id,
          menu_items.title,
          menu_items.description,
          menu_items.price_cents,
          menu_categories.name as category_name,
          menu_categories.is_active
        from menu_items
        inner join menu_categories on menu_categories.id = menu_items.category_id
        where menu_items.id = any($1::uuid[])
          and menu_items.is_hidden = false
      `,
      [itemIds]
    );

    const availableItems = new Map(itemsResult.rows.map((row) => [row.id, row]));

    for (const item of normalizedPayload.items) {
      const currentMenuItem = availableItems.get(item.menuItemId);

      if (!currentMenuItem || !currentMenuItem.is_active) {
        throw new HttpError(400, 'One or more selected items are unavailable.');
      }
    }

    const orderItems = normalizedPayload.items.map((item) => {
      const currentMenuItem = availableItems.get(item.menuItemId);
      return {
        menuItemId: currentMenuItem.id,
        title: currentMenuItem.title,
        description: currentMenuItem.description,
        categoryName: currentMenuItem.category_name,
        priceCents: currentMenuItem.price_cents,
        quantity: item.quantity,
        itemNotes: item.itemNotes,
        position: item.position,
      };
    });

    const totalCents = orderItems.reduce(
      (accumulator, item) => accumulator + item.priceCents * item.quantity,
      0
    );

    await client.query('begin');

    try {
      const orderInsert = await client.query(
        `
          insert into orders (
            code,
            source,
            service_mode,
            customer_name,
            customer_phone,
            table_reference,
            pickup_time,
            general_notes,
            status,
            total_cents,
            created_at,
            updated_at
          )
          values (
            $1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, timezone('utc', now()), timezone('utc', now())
          )
          returning *
        `,
        [
          createOrderCode(source),
          source,
          normalizedPayload.serviceMode,
          normalizedPayload.customerName,
          normalizedPayload.customerPhone || null,
          normalizedPayload.tableReference || null,
          normalizedPayload.pickupTime || null,
          normalizedPayload.generalNotes || null,
          totalCents,
        ]
      );

      const orderRow = orderInsert.rows[0];

      for (const item of orderItems) {
        await client.query(
          `
            insert into order_items (
              order_id,
              menu_item_id,
              title,
              description,
              category_name,
              price_cents,
              quantity,
              item_notes,
              position
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [
            orderRow.id,
            item.menuItemId,
            item.title,
            item.description,
            item.categoryName,
            item.priceCents,
            item.quantity,
            item.itemNotes || null,
            item.position,
          ]
        );
      }

      await client.query('commit');

      const mappedOrder = mapOrder({
        ...orderRow,
        order_items: orderItems.map((item, index) => ({
          id: `temp-${index + 1}`,
          title: item.title,
          description: item.description,
          category_name: item.categoryName,
          price_cents: item.priceCents,
          quantity: item.quantity,
          item_notes: item.itemNotes || null,
          position: index + 1,
        })),
      });

      const whatsappMessage = buildWhatsAppMessage(mappedOrder);
      const updateResult = await supabaseAdmin
        .from('orders')
        .update({
          whatsapp_message: whatsappMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderRow.id)
        .select(`
          id,
          code,
          source,
          service_mode,
          customer_name,
          customer_phone,
          table_reference,
          pickup_time,
          general_notes,
          status,
          total_cents,
          whatsapp_message,
          created_at,
          updated_at,
          archived_at,
          order_items (
            id,
            title,
            description,
            category_name,
            price_cents,
            quantity,
            item_notes,
            position
          )
        `)
        .single();

      const order = mapOrder(unwrap(updateResult, 'Failed to finalize order.'));

      return {
        order,
        whatsappUrl: buildWhatsAppUrl(settings.whatsappNumber, order.whatsappMessage),
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  });
}

export async function updateOrder(payload) {
  const id = assertNonEmptyString(payload.id, 'Order id');
  const action = assertNonEmptyString(payload.action, 'Action');

  if (action === 'archive') {
    const result = await supabaseAdmin
      .from('orders')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    return unwrap(result, 'Failed to archive order.');
  }

  const status = assertNonEmptyString(payload.status, 'Status');

  if (!STATUS_LABELS[status] || status === 'archived') {
    throw new HttpError(400, 'Invalid order status.');
  }

  const result = await supabaseAdmin
    .from('orders')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  return unwrap(result, 'Failed to update order.');
}
