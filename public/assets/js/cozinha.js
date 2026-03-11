import {
  apiRequest,
  createElementFromHtml,
  ensureAuthenticatedOrRedirect,
  escapeHtml,
  formatDateTime,
  showToast,
} from './lib/common.js';

const state = {
  orders: [],
};

const elements = {};

function cacheElements() {
  elements.pendingList = document.getElementById('pendingOrdersList');
  elements.preparingList = document.getElementById('preparingOrdersList');
  elements.readyList = document.getElementById('readyOrdersList');
  elements.pendingMetric = document.getElementById('pendingMetric');
  elements.preparingMetric = document.getElementById('preparingMetric');
  elements.readyMetric = document.getElementById('readyMetric');
  elements.totalMetric = document.getElementById('totalMetric');
  elements.pendingCountBadge = document.getElementById('pendingCountBadge');
  elements.preparingCountBadge = document.getElementById('preparingCountBadge');
  elements.readyCountBadge = document.getElementById('readyCountBadge');
  elements.refreshButton = document.getElementById('refreshKitchenOrders');
  elements.archiveReadyButton = document.getElementById('archiveReadyOrders');
  elements.kitchenLastSyncLabel = document.getElementById('kitchenLastSyncLabel');
  elements.kitchenSyncStatus = document.getElementById('kitchenSyncStatus');
  elements.toast = document.getElementById('kitchenToast');
}

function createOrderCard(order) {
  const actionButtons = [];

  if (order.status === 'pending') {
    actionButtons.push('<button type="button" class="kitchen-action-button is-primary" data-action="set-status" data-status="preparing">Iniciar preparo</button>');
  }

  if (order.status === 'preparing') {
    actionButtons.push('<button type="button" class="kitchen-action-button is-primary" data-action="set-status" data-status="ready">Marcar pronto</button>');
  }

  if (order.status === 'ready') {
    actionButtons.push('<button type="button" class="kitchen-action-button" data-action="archive-order">Arquivar</button>');
  }

  return createElementFromHtml(`
    <article class="kitchen-order-card is-${escapeHtml(order.status)}" data-order-id="${escapeHtml(order.id)}">
      <div class="kitchen-order-top">
        <div>
          <p class="kitchen-order-title">${escapeHtml(order.code)}</p>
          <p class="kitchen-order-subtitle">${escapeHtml(order.customerName)}</p>
        </div>
        <div class="kitchen-order-tags">
          <span class="kitchen-order-tag ${order.source === 'online' ? 'is-online' : 'is-balcao'}">${escapeHtml(order.sourceLabel)}</span>
          <span class="kitchen-order-source-tag">${escapeHtml(order.serviceModeLabel)}</span>
        </div>
      </div>
      <div class="kitchen-order-meta">
        <span>${escapeHtml(formatDateTime(order.createdAt))}</span>
        <strong>${escapeHtml(order.totalFormatted)}</strong>
      </div>
      <div class="kitchen-items">
        ${order.items
          .map(
            (item) => `
              <div class="kitchen-item-row">
                <div class="kitchen-item-head">
                  <strong>${escapeHtml(item.quantity)}x ${escapeHtml(item.title)}</strong>
                  <span class="kitchen-item-category">${escapeHtml(item.categoryName)}</span>
                </div>
                ${item.itemNotes ? `<p class="kitchen-item-notes">${escapeHtml(item.itemNotes)}</p>` : ''}
              </div>
            `
          )
          .join('')}
      </div>
      ${order.generalNotes ? `
        <div class="kitchen-notes">
          <span class="kitchen-notes-label">Observacoes</span>
          <p class="kitchen-notes-value">${escapeHtml(order.generalNotes)}</p>
        </div>
      ` : ''}
      <div class="kitchen-order-footer">${actionButtons.join('')}</div>
    </article>
  `);
}

function renderColumn(element, orders, emptyTitle, emptyCopy) {
  element.innerHTML = '';

  if (orders.length === 0) {
    element.innerHTML = `
      <article class="kitchen-empty-card">
        <strong>${escapeHtml(emptyTitle)}</strong>
        <p>${escapeHtml(emptyCopy)}</p>
      </article>
    `;
    return;
  }

  orders.forEach((order) => {
    element.appendChild(createOrderCard(order));
  });
}

function renderOrders() {
  const pendingOrders = state.orders.filter((order) => order.status === 'pending');
  const preparingOrders = state.orders.filter((order) => order.status === 'preparing');
  const readyOrders = state.orders.filter((order) => order.status === 'ready');

  elements.pendingMetric.textContent = String(pendingOrders.length);
  elements.preparingMetric.textContent = String(preparingOrders.length);
  elements.readyMetric.textContent = String(readyOrders.length);
  elements.totalMetric.textContent = String(state.orders.length);
  elements.pendingCountBadge.textContent = String(pendingOrders.length);
  elements.preparingCountBadge.textContent = String(preparingOrders.length);
  elements.readyCountBadge.textContent = String(readyOrders.length);

  renderColumn(elements.pendingList, pendingOrders, 'Sem pedidos na fila', 'Novos pedidos aparecerao aqui.');
  renderColumn(elements.preparingList, preparingOrders, 'Nada em preparo', 'Quando iniciar um pedido ele vira para esta coluna.');
  renderColumn(elements.readyList, readyOrders, 'Nenhum pedido pronto', 'Pedidos finalizados aparecerao aqui.');
}

async function loadOrders(showFeedback = false) {
  state.orders = await apiRequest('/api/kitchen/orders');
  renderOrders();
  elements.kitchenLastSyncLabel.textContent = new Date().toLocaleTimeString('pt-BR');
  elements.kitchenSyncStatus.textContent = 'Sincronizacao automatica ativa';

  if (showFeedback) {
    showToast(elements.toast, 'Painel atualizado.');
  }
}

async function updateOrder(orderId, action, status) {
  await apiRequest('/api/kitchen/orders', {
    method: 'PATCH',
    body: { id: orderId, action, status },
  });
  await loadOrders(false);
}

function bindEvents() {
  elements.refreshButton.addEventListener('click', () => {
    loadOrders(true).catch((error) => showToast(elements.toast, error.message, { error: true }));
  });

  elements.archiveReadyButton.addEventListener('click', async () => {
    try {
      const readyOrders = state.orders.filter((order) => order.status === 'ready');
      for (const order of readyOrders) {
        await updateOrder(order.id, 'archive');
      }
      showToast(elements.toast, 'Pedidos prontos arquivados.');
    } catch (error) {
      showToast(elements.toast, error.message, { error: true });
    }
  });

  [elements.pendingList, elements.preparingList, elements.readyList].forEach((column) => {
    column.addEventListener('click', async (event) => {
      const actionTarget = event.target.closest('[data-action]');
      const article = event.target.closest('[data-order-id]');

      if (!actionTarget || !article) {
        return;
      }

      try {
        if (actionTarget.dataset.action === 'archive-order') {
          await updateOrder(article.dataset.orderId, 'archive');
        } else {
          await updateOrder(article.dataset.orderId, 'status', actionTarget.dataset.status);
        }
      } catch (error) {
        showToast(elements.toast, error.message, { error: true });
      }
    });
  });
}

async function init() {
  const session = await ensureAuthenticatedOrRedirect('cozinha.html');
  if (!session) {
    return;
  }

  cacheElements();
  bindEvents();
  await loadOrders(false);

  window.setInterval(() => {
    loadOrders(false).catch(() => {
      elements.kitchenSyncStatus.textContent = 'Falha ao sincronizar automaticamente';
    });
  }, 15000);
}

window.addEventListener('DOMContentLoaded', () => {
  init().catch((error) => {
    showToast(document.getElementById('kitchenToast'), error.message, { error: true, duration: 4000 });
  });
});
