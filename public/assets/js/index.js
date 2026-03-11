import {
  apiRequest,
  escapeHtml,
  formatCurrency,
  setStatus,
} from './lib/common.js';

const state = {
  categories: [],
  items: [],
  settings: null,
  activeFilter: 'todos',
  cartItems: [],
};

const elements = {};

function cacheElements() {
  elements.filters = document.getElementById('filters');
  elements.menu = document.getElementById('menu');
  elements.ordersScheduleBadge = document.getElementById('ordersScheduleBadge');
  elements.ordersPausedBanner = document.getElementById('ordersPausedBanner');
  elements.ordersOnlineBanner = document.getElementById('ordersOnlineBanner');
  elements.orderModal = document.getElementById('orderModal');
  elements.closeModal = document.getElementById('closeModal');
  elements.modalPrice = document.getElementById('modalPrice');
  elements.itemSelect = document.getElementById('itemSelect');
  elements.itemQuantity = document.getElementById('itemQuantity');
  elements.addItemButton = document.getElementById('addItemButton');
  elements.cartItems = document.getElementById('cartItems');
  elements.cartEmpty = document.getElementById('cartEmpty');
  elements.orderForm = document.getElementById('orderForm');
  elements.pickupTime = document.getElementById('pickupTime');
  elements.orderNotes = document.getElementById('orderNotes');
  elements.customerName = document.getElementById('customerName');
  elements.orderTotal = document.getElementById('orderTotal');
  elements.orderFormStatus = document.getElementById('orderFormStatus');
  elements.submitOnlineOrder = document.getElementById('submitOnlineOrder');
}

function getVisibleItems() {
  if (state.activeFilter === 'todos') {
    return state.items;
  }

  return state.items.filter((item) => item.categorySlug === state.activeFilter);
}

function renderFilters() {
  const filters = [{ slug: 'todos', name: 'Todos' }, ...state.categories];
  elements.filters.innerHTML = filters
    .map(
      (filter) => `
        <button
          type="button"
          class="filter-btn ${filter.slug === state.activeFilter ? 'active' : ''}"
          data-filter="${escapeHtml(filter.slug)}"
        >
          ${escapeHtml(filter.name)}
        </button>
      `
    )
    .join('');
}

function renderMenu() {
  const visibleItems = getVisibleItems();

  if (visibleItems.length === 0) {
    elements.menu.innerHTML = `
      <article class="item">
        <div class="content">
          <span class="tag">Aviso</span>
          <h2>Nenhum item disponivel</h2>
          <p class="item-ingredients">Ainda nao existem itens cadastrados para este filtro.</p>
        </div>
      </article>
    `;
    return;
  }

  elements.menu.innerHTML = visibleItems
    .map(
      (item) => `
        <article class="item" data-item-id="${escapeHtml(item.id)}" data-category="${escapeHtml(item.categorySlug)}">
          <div class="content">
            <span class="tag">${escapeHtml(item.categoryName)}</span>
            <h2>${escapeHtml(item.title)}</h2>
            <p class="item-ingredients">${escapeHtml(item.description)}</p>
            <div class="price-row">
              <span class="price">${escapeHtml(item.priceFormatted)}</span>
              <button
                type="button"
                class="order"
                data-action="open-order"
                data-item-id="${escapeHtml(item.id)}"
                ${state.settings?.acceptsOrders ? '' : 'disabled'}
              >
                Pedir agora
              </button>
            </div>
          </div>
        </article>
      `
    )
    .join('');
}

function updateAvailabilityUi() {
  const settings = state.settings;
  if (!settings) {
    return;
  }

  elements.ordersScheduleBadge.textContent =
    `Pedidos online: ${settings.onlineOpenTime} as ${settings.onlineCloseTime}`;

  elements.ordersPausedBanner.hidden = settings.acceptsOrders;
  elements.ordersOnlineBanner.hidden = !settings.acceptsOrders;
}

function populateItemSelect() {
  elements.itemSelect.innerHTML = state.items
    .map(
      (item) => `
        <option value="${escapeHtml(item.id)}">
          ${escapeHtml(item.categoryName)} - ${escapeHtml(item.title)} (${escapeHtml(item.priceFormatted)})
        </option>
      `
    )
    .join('');
}

function getItemById(itemId) {
  return state.items.find((item) => item.id === itemId) || null;
}

function renderCart() {
  if (state.cartItems.length === 0) {
    elements.cartItems.innerHTML = '';
    elements.cartEmpty.hidden = false;
    elements.orderTotal.textContent = 'Valor total: R$ 0,00';
    elements.modalPrice.textContent = 'Adicione um ou mais itens.';
    return;
  }

  elements.cartEmpty.hidden = true;

  elements.cartItems.innerHTML = state.cartItems
    .map(
      (cartItem, index) => `
        <div class="cart-item">
          <div>
            <strong>${escapeHtml(cartItem.title)}</strong>
            <p>${escapeHtml(cartItem.quantity)}x ${escapeHtml(cartItem.priceFormatted)}</p>
          </div>
          <button type="button" class="remove-item" data-remove-index="${index}">Remover</button>
        </div>
      `
    )
    .join('');

  const totalCents = state.cartItems.reduce(
    (sum, cartItem) => sum + cartItem.priceCents * cartItem.quantity,
    0
  );

  elements.modalPrice.textContent = `${state.cartItems.length} item(ns) no pedido.`;
  elements.orderTotal.textContent = `Valor total: ${formatCurrency(totalCents)}`;
}

function addItemToCart(itemId, quantity) {
  const item = getItemById(itemId);

  if (!item) {
    return;
  }

  state.cartItems.push({
    menuItemId: item.id,
    title: item.title,
    priceCents: item.priceCents,
    priceFormatted: item.priceFormatted,
    quantity,
  });

  renderCart();
}

function openModalWithItem(itemId) {
  state.cartItems = [];
  addItemToCart(itemId, 1);
  elements.itemSelect.value = itemId;
  elements.itemQuantity.value = '1';
  setStatus(elements.orderFormStatus, '');
  elements.orderModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeModal() {
  elements.orderModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

async function submitOrder(event) {
  event.preventDefault();

  if (state.cartItems.length === 0) {
    setStatus(elements.orderFormStatus, 'Adicione ao menos um item ao pedido.', { error: true });
    return;
  }

  elements.submitOnlineOrder.disabled = true;
  setStatus(elements.orderFormStatus, 'Enviando pedido...');

  try {
    const payload = await apiRequest('/api/public/orders', {
      method: 'POST',
      body: {
        customerName: elements.customerName.value.trim(),
        pickupTime: elements.pickupTime.value,
        generalNotes: elements.orderNotes.value.trim(),
        items: state.cartItems.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
        })),
      },
    });

    setStatus(elements.orderFormStatus, `Pedido ${payload.order.code} criado com sucesso.`);

    if (payload.whatsappUrl) {
      window.open(payload.whatsappUrl, '_blank', 'noopener');
    }

    elements.orderForm.reset();
    state.cartItems = [];
    renderCart();
    window.setTimeout(closeModal, 500);
  } catch (error) {
    setStatus(elements.orderFormStatus, error.message, { error: true });
  } finally {
    elements.submitOnlineOrder.disabled = false;
  }
}

function bindEvents() {
  elements.filters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');

    if (!button) {
      return;
    }

    state.activeFilter = button.dataset.filter;
    renderFilters();
    renderMenu();
  });

  elements.menu.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="open-order"]');

    if (!button || !state.settings?.acceptsOrders) {
      return;
    }

    openModalWithItem(button.dataset.itemId);
  });

  elements.addItemButton.addEventListener('click', () => {
    addItemToCart(elements.itemSelect.value, Math.max(1, Number(elements.itemQuantity.value) || 1));
  });

  elements.cartItems.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-index]');

    if (!button) {
      return;
    }

    state.cartItems.splice(Number(button.dataset.removeIndex), 1);
    renderCart();
  });

  elements.closeModal.addEventListener('click', closeModal);

  elements.orderModal.addEventListener('click', (event) => {
    if (event.target === elements.orderModal) {
      closeModal();
    }
  });

  elements.orderForm.addEventListener('submit', submitOrder);
}

async function init() {
  cacheElements();
  bindEvents();

  try {
    const payload = await apiRequest('/api/public/bootstrap');
    state.categories = payload.categories;
    state.items = payload.items;
    state.settings = payload.settings;

    renderFilters();
    renderMenu();
    populateItemSelect();
    updateAvailabilityUi();
    renderCart();
  } catch (error) {
    elements.menu.innerHTML = `
      <article class="item">
        <div class="content">
          <span class="tag">Erro</span>
          <h2>Nao foi possivel carregar o cardapio</h2>
          <p class="item-ingredients">${escapeHtml(error.message)}</p>
        </div>
      </article>
    `;
  }
}

window.addEventListener('DOMContentLoaded', init);
