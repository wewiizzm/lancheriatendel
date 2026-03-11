import {
  apiRequest,
  ensureAuthenticatedOrRedirect,
  escapeHtml,
  formatCurrency,
  showToast,
} from './lib/common.js';

const state = {
  items: [],
  draftItems: [],
};

const elements = {};

function cacheElements() {
  elements.form = document.getElementById('counterOrderForm');
  elements.customerName = document.getElementById('counterCustomerName');
  elements.customerPhone = document.getElementById('counterCustomerPhone');
  elements.serviceIdentityNote = document.getElementById('counterServiceIdentityNote');
  elements.tableFieldWrap = document.getElementById('tableFieldWrap');
  elements.tableReference = document.getElementById('counterTableReference');
  elements.itemsList = document.getElementById('counterItemsList');
  elements.addItemButton = document.getElementById('addCounterItem');
  elements.generalNotes = document.getElementById('counterGeneralNotes');
  elements.itemsCount = document.getElementById('counterItemsCount');
  elements.summaryCustomerName = document.getElementById('summaryCustomerName');
  elements.summaryCustomerPhone = document.getElementById('summaryCustomerPhone');
  elements.summaryServiceMode = document.getElementById('summaryServiceMode');
  elements.summaryTableReference = document.getElementById('summaryTableReference');
  elements.summaryItemsBadge = document.getElementById('summaryItemsBadge');
  elements.summaryList = document.getElementById('counterSummaryList');
  elements.summaryGeneralNotes = document.getElementById('summaryGeneralNotes');
  elements.confirmationPanel = document.getElementById('counterConfirmationPanel');
  elements.confirmationStatus = document.getElementById('counterConfirmationStatus');
  elements.confirmButton = document.getElementById('confirmCounterOrderButton');
  elements.itemTemplate = document.getElementById('counterItemTemplate');
  elements.toast = document.getElementById('counterToast');
}

function getSelectedServiceMode() {
  return document.querySelector('input[name="serviceMode"]:checked')?.value || 'pickup';
}

function createDraftItem() {
  return {
    key: crypto.randomUUID(),
    menuItemId: state.items[0]?.id || '',
    quantity: 1,
    itemNotes: '',
  };
}

function getMenuItem(itemId) {
  return state.items.find((entry) => entry.id === itemId) || null;
}

function buildSelectOptions(selectedId) {
  return state.items
    .map(
      (item) => `
        <option value="${escapeHtml(item.id)}" ${item.id === selectedId ? 'selected' : ''}>
          ${escapeHtml(item.categoryName)} - ${escapeHtml(item.title)} (${escapeHtml(item.priceFormatted)})
        </option>
      `
    )
    .join('');
}

function renderDraftItems() {
  elements.itemsList.innerHTML = '';

  state.draftItems.forEach((draftItem, index) => {
    const fragment = elements.itemTemplate.content.cloneNode(true);
    const article = fragment.querySelector('.counter-item-card');
    const currentItem = getMenuItem(draftItem.menuItemId) || state.items[0] || null;
    const select = fragment.querySelector('.counter-item-select');
    const quantityInput = fragment.querySelector('.counter-item-quantity');
    const notesInput = fragment.querySelector('.counter-item-notes');
    const title = fragment.querySelector('.counter-item-title');
    const meta = fragment.querySelector('.counter-item-meta');
    const ingredients = fragment.querySelector('.counter-item-ingredients');
    const indexLabel = fragment.querySelector('.counter-item-index');

    article.dataset.itemKey = draftItem.key;
    select.innerHTML = buildSelectOptions(currentItem?.id || '');
    quantityInput.value = String(draftItem.quantity);
    notesInput.value = draftItem.itemNotes;
    title.textContent = currentItem?.title || 'Item indisponivel';
    meta.textContent = currentItem ? `${currentItem.categoryName} • ${currentItem.priceFormatted}` : 'Selecione um item';
    ingredients.textContent = currentItem?.description || 'Os detalhes do item aparecem aqui apos a selecao.';
    indexLabel.textContent = `Item ${index + 1}`;

    elements.itemsList.appendChild(fragment);
  });
}

function renderSummary() {
  const serviceMode = getSelectedServiceMode();
  const customerName = elements.customerName.value.trim() || 'Aguardando preenchimento';
  const customerPhone = elements.customerPhone.value.trim();
  const tableReference = elements.tableReference.value.trim();
  const generalNotes = elements.generalNotes.value.trim();

  elements.summaryCustomerName.textContent = customerName;
  elements.summaryCustomerPhone.hidden = !customerPhone;
  elements.summaryCustomerPhone.textContent = customerPhone;
  elements.summaryServiceMode.textContent = serviceMode === 'table' ? 'Mesa' : 'Retirada';
  elements.summaryTableReference.textContent =
    serviceMode === 'table' && tableReference ? `Mesa ${tableReference}` : 'Sem mesa vinculada';
  elements.summaryGeneralNotes.textContent = generalNotes || 'Nenhuma observacao informada.';

  const summaryItems = state.draftItems
    .map((draftItem) => {
      const item = getMenuItem(draftItem.menuItemId);
      if (!item) {
        return null;
      }

      return `
        <article class="counter-summary-item">
          <div class="counter-summary-item-head">
            <strong>${escapeHtml(draftItem.quantity)}x ${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(formatCurrency(item.priceCents * draftItem.quantity))}</span>
          </div>
          <p class="counter-summary-item-meta">${escapeHtml(item.categoryName)}</p>
          ${draftItem.itemNotes ? `<p class="counter-summary-item-notes">${escapeHtml(draftItem.itemNotes)}</p>` : ''}
        </article>
      `;
    })
    .filter(Boolean);

  elements.summaryItemsBadge.textContent = String(summaryItems.length);
  elements.summaryList.innerHTML = summaryItems.length
    ? summaryItems.join('')
    : '<p class="counter-empty-state">Adicione os itens para visualizar o pedido.</p>';
  elements.itemsCount.textContent = `${summaryItems.length} item(ns)`;
}

function updateServiceModeUi() {
  const isTable = getSelectedServiceMode() === 'table';
  elements.tableFieldWrap.hidden = !isTable;
  elements.serviceIdentityNote.hidden = !isTable;
  if (!isTable) {
    elements.tableReference.value = '';
  }
  renderSummary();
}

function validateDraftOrder() {
  if (!elements.customerName.value.trim()) {
    throw new Error('Informe o nome do cliente.');
  }

  if (getSelectedServiceMode() === 'table' && !elements.tableReference.value.trim()) {
    throw new Error('Informe o numero da mesa.');
  }

  if (state.draftItems.length === 0) {
    throw new Error('Adicione ao menos um item.');
  }
}

function resetOrder() {
  elements.form.reset();
  document.querySelector('input[name="serviceMode"][value="pickup"]').checked = true;
  state.draftItems = [createDraftItem()];
  renderDraftItems();
  updateServiceModeUi();
  renderSummary();
  elements.confirmationPanel.hidden = true;
  elements.confirmButton.disabled = true;
}

async function submitCounterOrder() {
  validateDraftOrder();
  elements.confirmButton.disabled = true;
  elements.confirmationStatus.textContent = 'Enviando pedido para a cozinha...';

  try {
    const payload = await apiRequest('/api/counter/orders', {
      method: 'POST',
      body: {
        customerName: elements.customerName.value.trim(),
        customerPhone: elements.customerPhone.value.trim(),
        serviceMode: getSelectedServiceMode(),
        tableReference: elements.tableReference.value.trim(),
        generalNotes: elements.generalNotes.value.trim(),
        items: state.draftItems.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          itemNotes: item.itemNotes,
        })),
      },
    });

    showToast(elements.toast, `Pedido ${payload.order.code} enviado para a cozinha.`);
    resetOrder();
  } catch (error) {
    elements.confirmationStatus.textContent = error.message;
    showToast(elements.toast, error.message, { error: true });
  } finally {
    elements.confirmButton.disabled = false;
  }
}

function bindEvents() {
  elements.addItemButton.addEventListener('click', () => {
    state.draftItems.push(createDraftItem());
    renderDraftItems();
    renderSummary();
  });

  elements.itemsList.addEventListener('click', (event) => {
    const article = event.target.closest('[data-item-key]');
    const draftItem = state.draftItems.find((entry) => entry.key === article?.dataset.itemKey);

    if (!article || !draftItem) {
      return;
    }

    const action = event.target.closest('[data-action]')?.dataset.action;

    if (action === 'remove-item') {
      state.draftItems = state.draftItems.filter((entry) => entry.key !== draftItem.key);
      if (state.draftItems.length === 0) {
        state.draftItems = [createDraftItem()];
      }
      renderDraftItems();
      renderSummary();
      return;
    }

    if (action === 'decrease-qty') {
      draftItem.quantity = Math.max(1, draftItem.quantity - 1);
      renderDraftItems();
      renderSummary();
      return;
    }

    if (action === 'increase-qty') {
      draftItem.quantity += 1;
      renderDraftItems();
      renderSummary();
    }
  });

  elements.itemsList.addEventListener('change', (event) => {
    const article = event.target.closest('[data-item-key]');
    const draftItem = state.draftItems.find((entry) => entry.key === article?.dataset.itemKey);

    if (!article || !draftItem) {
      return;
    }

    if (event.target.classList.contains('counter-item-select')) {
      draftItem.menuItemId = event.target.value;
      renderDraftItems();
      renderSummary();
      return;
    }

    if (event.target.classList.contains('counter-item-quantity')) {
      draftItem.quantity = Math.max(1, Number(event.target.value) || 1);
      renderSummary();
    }
  });

  elements.itemsList.addEventListener('input', (event) => {
    const article = event.target.closest('[data-item-key]');
    const draftItem = state.draftItems.find((entry) => entry.key === article?.dataset.itemKey);

    if (!article || !draftItem) {
      return;
    }

    if (event.target.classList.contains('counter-item-notes')) {
      draftItem.itemNotes = event.target.value;
      renderSummary();
      return;
    }

    if (event.target.classList.contains('counter-item-quantity')) {
      draftItem.quantity = Math.max(1, Number(event.target.value) || 1);
      renderSummary();
    }
  });

  document.querySelectorAll('input[name="serviceMode"]').forEach((input) => {
    input.addEventListener('change', updateServiceModeUi);
  });

  elements.customerName.addEventListener('input', renderSummary);
  elements.customerPhone.addEventListener('input', renderSummary);
  elements.tableReference.addEventListener('input', renderSummary);
  elements.generalNotes.addEventListener('input', renderSummary);

  elements.form.addEventListener('submit', (event) => {
    event.preventDefault();

    try {
      validateDraftOrder();
      elements.confirmationPanel.hidden = false;
      elements.confirmButton.disabled = false;
      elements.confirmationStatus.textContent = 'Revise os dados acima antes de confirmar o envio definitivo.';
    } catch (error) {
      showToast(elements.toast, error.message, { error: true });
    }
  });

  elements.confirmButton.addEventListener('click', submitCounterOrder);
}

async function init() {
  const session = await ensureAuthenticatedOrRedirect('balcao.html');
  if (!session) {
    return;
  }

  cacheElements();
  bindEvents();

  const payload = await apiRequest('/api/public/bootstrap');
  state.items = payload.items;
  state.draftItems = [createDraftItem()];
  renderDraftItems();
  updateServiceModeUi();
  renderSummary();
}

window.addEventListener('DOMContentLoaded', () => {
  init().catch((error) => {
    showToast(document.getElementById('counterToast'), error.message, { error: true, duration: 4000 });
  });
});
