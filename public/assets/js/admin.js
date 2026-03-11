import {
  apiRequest,
  escapeHtml,
  formatDateTime,
  getOrderStatusClass,
  getRedirectTarget,
  setStatus,
} from './lib/common.js';

const state = {
  settings: null,
  categories: [],
  items: [],
  orders: [],
  pendingCategoryId: null,
  pendingOrderId: null,
};

const elements = {};

function cacheElements() {
  elements.loginView = document.getElementById('adminLoginView');
  elements.controlView = document.getElementById('adminControlView');
  elements.panelLinks = document.getElementById('adminPanelLinks');
  elements.loginForm = document.getElementById('adminLoginForm');
  elements.username = document.getElementById('adminUsername');
  elements.password = document.getElementById('adminPassword');
  elements.loginError = document.getElementById('adminLoginError');
  elements.logoutButton = document.getElementById('adminLogout');
  elements.tabs = Array.from(document.querySelectorAll('.admin-tab[data-panel]'));
  elements.panels = Array.from(document.querySelectorAll('.admin-panel-section'));
  elements.pauseButton = document.getElementById('pauseOnlineOrders');
  elements.resumeButton = document.getElementById('resumeOnlineOrders');
  elements.ordersControlStatus = document.getElementById('ordersControlStatus');
  elements.ordersOpenTime = document.getElementById('ordersOpenTime');
  elements.ordersCloseTime = document.getElementById('ordersCloseTime');
  elements.saveOrdersSchedule = document.getElementById('saveOrdersSchedule');
  elements.ordersScheduleStatus = document.getElementById('ordersScheduleStatus');
  elements.ordersList = document.getElementById('adminOrdersList');
  elements.ordersStatus = document.getElementById('adminOrdersStatus');
  elements.addCategoryForm = document.getElementById('adminAddCategoryForm');
  elements.newCategoryName = document.getElementById('adminNewCategoryName');
  elements.categoryEditor = document.getElementById('adminCategoryEditor');
  elements.categoryStatus = document.getElementById('adminCategoryStatus');
  elements.addMenuForm = document.getElementById('adminAddMenuForm');
  elements.newMenuCategory = document.getElementById('adminNewCategory');
  elements.newMenuPrice = document.getElementById('adminNewPrice');
  elements.newMenuTitle = document.getElementById('adminNewTitle');
  elements.newMenuIngredients = document.getElementById('adminNewIngredients');
  elements.menuEditor = document.getElementById('adminMenuEditor');
  elements.menuStatus = document.getElementById('adminMenuStatus');
  elements.saveAllButton = document.getElementById('adminSaveAll');
  elements.saveAllStatus = document.getElementById('adminSaveAllStatus');
  elements.categoryRemoveModal = document.getElementById('adminCategoryRemoveModal');
  elements.categoryRemoveMessage = document.getElementById('adminCategoryRemoveMessage');
  elements.categoryRemoveForm = document.getElementById('adminCategoryRemoveForm');
  elements.categoryRemovePassword = document.getElementById('adminCategoryRemovePassword');
  elements.categoryRemoveError = document.getElementById('adminCategoryRemoveError');
  elements.cancelCategoryRemove = document.getElementById('cancelAdminCategoryRemove');
  elements.closeCategoryRemove = document.getElementById('closeAdminCategoryRemoveModal');
  elements.orderRemoveModal = document.getElementById('adminOrderRemoveModal');
  elements.orderRemoveMessage = document.getElementById('adminOrderRemoveMessage');
  elements.orderRemoveForm = document.getElementById('adminOrderRemoveForm');
  elements.cancelOrderRemove = document.getElementById('cancelAdminOrderRemove');
  elements.closeOrderRemove = document.getElementById('closeAdminOrderRemoveModal');
}

function showAuthenticatedView(isAuthenticated) {
  elements.loginView.hidden = isAuthenticated;
  elements.controlView.hidden = !isAuthenticated;
  elements.panelLinks.hidden = !isAuthenticated;

  if (!isAuthenticated) {
    elements.username.value = '';
    elements.password.value = '';
    elements.username.focus();
  }
}

function activatePanel(panelName) {
  const panelIdMap = {
    schedule: 'adminSchedulePanel',
    orders: 'adminOrdersPanel',
    menu: 'adminMenuPanel',
    categories: 'adminCategoriesPanel',
  };

  elements.tabs.forEach((tab) => {
    const active = tab.dataset.panel === panelName;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });

  elements.panels.forEach((panel) => {
    panel.hidden = panel.id !== panelIdMap[panelName];
  });
}

function renderSettings() {
  if (!state.settings) {
    return;
  }

  elements.ordersOpenTime.value = state.settings.onlineOpenTime;
  elements.ordersCloseTime.value = state.settings.onlineCloseTime;
  elements.ordersControlStatus.textContent = state.settings.onlineOrdersPaused
    ? 'Pedidos online em espera.'
    : 'Pedidos online liberados.';
  elements.ordersScheduleStatus.textContent =
    `Horario atual: ${state.settings.onlineOpenTime} as ${state.settings.onlineCloseTime}.`;
  elements.pauseButton.disabled = state.settings.onlineOrdersPaused;
  elements.resumeButton.disabled = !state.settings.onlineOrdersPaused;
}

function renderCategoryOptions() {
  elements.newMenuCategory.innerHTML = state.categories
    .filter((category) => category.isActive)
    .map(
      (category) => `
        <option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>
      `
    )
    .join('');
}

function renderCategories() {
  if (state.categories.length === 0) {
    elements.categoryEditor.innerHTML = '';
    setStatus(elements.categoryStatus, 'Nenhuma categoria cadastrada ainda.');
    return;
  }

  elements.categoryEditor.innerHTML = state.categories
    .map(
      (category) => `
        <article class="admin-item-editor" data-category-id="${escapeHtml(category.id)}">
          <div class="admin-item-head">
            <div>
              <p class="admin-item-title">${escapeHtml(category.name)}</p>
              <p class="admin-item-meta">Slug: ${escapeHtml(category.slug)}</p>
            </div>
          </div>
          <div class="admin-editor-grid">
            <label class="field">
              <span>Nome</span>
              <input type="text" data-field="name" value="${escapeHtml(category.name)}" />
            </label>
            <label class="field">
              <span>Posicao</span>
              <input type="number" data-field="position" value="${escapeHtml(category.position)}" />
            </label>
            <label class="field">
              <span>Ativo</span>
              <select data-field="isActive">
                <option value="true" ${category.isActive ? 'selected' : ''}>Sim</option>
                <option value="false" ${category.isActive ? '' : 'selected'}>Nao</option>
              </select>
            </label>
          </div>
          <div class="admin-editor-actions">
            <button type="button" class="owner-toggle" data-action="save-category">Salvar</button>
            <button type="button" class="owner-toggle" data-action="delete-category">Remover</button>
          </div>
        </article>
      `
    )
    .join('');

  setStatus(elements.categoryStatus, 'Categorias carregadas.');
}

function renderMenuItems() {
  if (state.items.length === 0) {
    elements.menuEditor.innerHTML = '';
    setStatus(elements.menuStatus, 'Nenhum item cadastrado ainda.');
    return;
  }

  const categoryOptions = state.categories
    .map(
      (category) => `
        <option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>
      `
    )
    .join('');

  elements.menuEditor.innerHTML = state.items
    .map(
      (item) => `
        <article class="admin-item-editor" data-item-id="${escapeHtml(item.id)}">
          <div class="admin-item-head">
            <div>
              <p class="admin-item-title">${escapeHtml(item.title)}</p>
              <p class="admin-item-meta">${escapeHtml(item.categoryName)} • ${escapeHtml(item.priceFormatted)}</p>
            </div>
          </div>
          <div class="admin-editor-grid">
            <label class="field">
              <span>Nome</span>
              <input type="text" data-field="title" value="${escapeHtml(item.title)}" />
            </label>
            <label class="field">
              <span>Preco</span>
              <input type="text" data-field="price" value="${escapeHtml((item.priceCents / 100).toFixed(2).replace('.', ','))}" />
            </label>
            <label class="field">
              <span>Categoria</span>
              <select data-field="categoryId">${categoryOptions}</select>
            </label>
            <label class="field">
              <span>Posicao</span>
              <input type="number" data-field="position" value="${escapeHtml(item.position)}" />
            </label>
            <label class="field">
              <span>Visivel</span>
              <select data-field="isHidden">
                <option value="false" ${item.isHidden ? '' : 'selected'}>Sim</option>
                <option value="true" ${item.isHidden ? 'selected' : ''}>Nao</option>
              </select>
            </label>
            <label class="field">
              <span>Ingredientes</span>
              <textarea rows="3" data-field="description">${escapeHtml(item.description)}</textarea>
            </label>
          </div>
          <div class="admin-editor-actions">
            <button type="button" class="owner-toggle" data-action="save-item">Salvar</button>
            <button type="button" class="owner-toggle" data-action="delete-item">Remover</button>
          </div>
        </article>
      `
    )
    .join('');

  elements.menuEditor.querySelectorAll('[data-item-id]').forEach((article) => {
    const item = state.items.find((entry) => entry.id === article.dataset.itemId);
    const select = article.querySelector('[data-field="categoryId"]');
    if (item && select) {
      select.value = item.categoryId;
    }
  });

  setStatus(elements.menuStatus, 'Itens carregados.');
}

function renderOrders() {
  if (state.orders.length === 0) {
    elements.ordersList.innerHTML = '';
    elements.ordersStatus.textContent = 'Nenhum pedido recebido ainda.';
    return;
  }

  elements.ordersStatus.textContent = `${state.orders.length} pedido(s) ativo(s).`;

  elements.ordersList.innerHTML = state.orders
    .map((order) => {
      const actions = [];

      if (order.status === 'pending') {
        actions.push('<button type="button" class="owner-toggle admin-order-toggle" data-action="set-status" data-status="preparing">Colocar em preparo</button>');
      }

      if (order.status === 'preparing') {
        actions.push('<button type="button" class="owner-toggle admin-order-toggle" data-action="set-status" data-status="ready">Marcar pronto</button>');
      }

      if (order.status === 'ready') {
        actions.push('<button type="button" class="owner-toggle admin-order-toggle" data-action="archive-order">Arquivar</button>');
      }

      return `
        <article class="admin-order-card" data-order-id="${escapeHtml(order.id)}">
          <div class="admin-order-head">
            <div>
              <strong>${escapeHtml(order.code)}</strong>
              <p class="admin-order-meta">
                ${escapeHtml(order.sourceLabel)} • ${escapeHtml(order.serviceModeLabel)} • ${escapeHtml(formatDateTime(order.createdAt))}
              </p>
            </div>
            <span class="admin-order-badge ${getOrderStatusClass(order.status)}">${escapeHtml(order.statusLabel)}</span>
          </div>
          <div class="admin-order-status-row">
            <span>${escapeHtml(order.customerName)}</span>
            <strong>${escapeHtml(order.totalFormatted)}</strong>
          </div>
          <div class="admin-order-items">
            ${order.items
              .map(
                (item) => `
                  <div class="admin-order-item">
                    <span class="admin-order-item-title">${escapeHtml(item.quantity)}x ${escapeHtml(item.title)}</span>
                    <span class="admin-order-item-copy">${escapeHtml(item.categoryName)}</span>
                    ${item.itemNotes ? `<p class="admin-order-notes">${escapeHtml(item.itemNotes)}</p>` : ''}
                  </div>
                `
              )
              .join('')}
          </div>
          ${order.generalNotes ? `<p class="admin-order-notes">${escapeHtml(order.generalNotes)}</p>` : ''}
          <div class="admin-order-actions">${actions.join('')}</div>
        </article>
      `;
    })
    .join('');
}

async function loadDashboard() {
  const payload = await apiRequest('/api/admin/bootstrap');
  state.settings = payload.settings;
  state.categories = payload.categories;
  state.items = payload.items;
  state.orders = payload.orders;
  renderSettings();
  renderCategoryOptions();
  renderCategories();
  renderMenuItems();
  renderOrders();
}

async function saveCategory(article) {
  return apiRequest('/api/admin/categories', {
    method: 'PUT',
    body: {
      id: article.dataset.categoryId,
      name: article.querySelector('[data-field="name"]').value,
      position: Number(article.querySelector('[data-field="position"]').value),
      isActive: article.querySelector('[data-field="isActive"]').value === 'true',
    },
  });
}

async function saveItem(article) {
  return apiRequest('/api/admin/items', {
    method: 'PUT',
    body: {
      id: article.dataset.itemId,
      title: article.querySelector('[data-field="title"]').value,
      price: article.querySelector('[data-field="price"]').value,
      categoryId: article.querySelector('[data-field="categoryId"]').value,
      position: Number(article.querySelector('[data-field="position"]').value),
      isHidden: article.querySelector('[data-field="isHidden"]').value === 'true',
      description: article.querySelector('[data-field="description"]').value,
    },
  });
}

function openCategoryRemoveModal(categoryId) {
  const category = state.categories.find((entry) => entry.id === categoryId);
  state.pendingCategoryId = categoryId;
  elements.categoryRemoveMessage.textContent = category
    ? `Deseja remover o menu "${category.name}"? Os itens ligados a ele tambem serao removidos.`
    : 'Deseja remover esta categoria?';
  elements.categoryRemovePassword.value = '';
  elements.categoryRemoveError.hidden = true;
  elements.categoryRemoveModal.setAttribute('aria-hidden', 'false');
}

function closeCategoryRemoveModal() {
  state.pendingCategoryId = null;
  elements.categoryRemoveModal.setAttribute('aria-hidden', 'true');
}

function openOrderArchiveModal(orderId) {
  const order = state.orders.find((entry) => entry.id === orderId);
  state.pendingOrderId = orderId;
  elements.orderRemoveMessage.textContent = order
    ? `Deseja arquivar o pedido ${order.code}?`
    : 'Deseja arquivar este pedido?';
  elements.orderRemoveModal.setAttribute('aria-hidden', 'false');
}

function closeOrderArchiveModal() {
  state.pendingOrderId = null;
  elements.orderRemoveModal.setAttribute('aria-hidden', 'true');
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  elements.loginError.hidden = true;

  try {
    await apiRequest('/api/auth/login', {
      method: 'POST',
      body: {
        username: elements.username.value,
        password: elements.password.value,
      },
    });

    const redirectTarget = getRedirectTarget('admin.html');
    if (redirectTarget !== 'admin.html') {
      window.location.href = redirectTarget;
      return;
    }

    showAuthenticatedView(true);
    activatePanel('schedule');
    await loadDashboard();
  } catch {
    elements.loginError.hidden = false;
    elements.password.value = '';
    elements.password.focus();
  }
}

async function handleSaveAll() {
  elements.saveAllButton.disabled = true;
  setStatus(elements.saveAllStatus, 'Salvando alteracoes...');

  try {
    const categoryArticles = Array.from(elements.categoryEditor.querySelectorAll('[data-category-id]'));
    for (const article of categoryArticles) {
      await saveCategory(article);
    }

    const itemArticles = Array.from(elements.menuEditor.querySelectorAll('[data-item-id]'));
    for (const article of itemArticles) {
      await saveItem(article);
    }

    await loadDashboard();
    setStatus(elements.saveAllStatus, 'Alteracoes salvas com sucesso.');
  } catch (error) {
    setStatus(elements.saveAllStatus, error.message, { error: true });
  } finally {
    elements.saveAllButton.disabled = false;
  }
}

function bindEvents() {
  elements.loginForm.addEventListener('submit', handleLoginSubmit);

  elements.logoutButton.addEventListener('click', async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    showAuthenticatedView(false);
  });

  elements.tabs.forEach((tab) => {
    tab.addEventListener('click', () => activatePanel(tab.dataset.panel));
  });

  elements.pauseButton.addEventListener('click', async () => {
    state.settings = await apiRequest('/api/admin/settings', {
      method: 'PATCH',
      body: { onlineOrdersPaused: true },
    });
    renderSettings();
  });

  elements.resumeButton.addEventListener('click', async () => {
    state.settings = await apiRequest('/api/admin/settings', {
      method: 'PATCH',
      body: { onlineOrdersPaused: false },
    });
    renderSettings();
  });

  elements.saveOrdersSchedule.addEventListener('click', async () => {
    try {
      state.settings = await apiRequest('/api/admin/settings', {
        method: 'PATCH',
        body: {
          onlineOpenTime: elements.ordersOpenTime.value,
          onlineCloseTime: elements.ordersCloseTime.value,
        },
      });
      renderSettings();
      setStatus(elements.ordersScheduleStatus, 'Horario salvo com sucesso.');
    } catch (error) {
      setStatus(elements.ordersScheduleStatus, error.message, { error: true });
    }
  });

  elements.addCategoryForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await apiRequest('/api/admin/categories', {
        method: 'POST',
        body: { name: elements.newCategoryName.value },
      });
      elements.addCategoryForm.reset();
      await loadDashboard();
      setStatus(elements.categoryStatus, 'Categoria adicionada com sucesso.');
    } catch (error) {
      setStatus(elements.categoryStatus, error.message, { error: true });
    }
  });

  elements.addMenuForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await apiRequest('/api/admin/items', {
        method: 'POST',
        body: {
          categoryId: elements.newMenuCategory.value,
          title: elements.newMenuTitle.value,
          price: elements.newMenuPrice.value,
          description: elements.newMenuIngredients.value,
        },
      });
      elements.addMenuForm.reset();
      await loadDashboard();
      setStatus(elements.menuStatus, 'Item adicionado com sucesso.');
    } catch (error) {
      setStatus(elements.menuStatus, error.message, { error: true });
    }
  });

  elements.categoryEditor.addEventListener('click', async (event) => {
    const actionTarget = event.target.closest('[data-action]');
    const article = event.target.closest('[data-category-id]');

    if (!actionTarget || !article) {
      return;
    }

    if (actionTarget.dataset.action === 'save-category') {
      try {
        await saveCategory(article);
        await loadDashboard();
        setStatus(elements.categoryStatus, 'Categoria salva com sucesso.');
      } catch (error) {
        setStatus(elements.categoryStatus, error.message, { error: true });
      }
      return;
    }

    if (actionTarget.dataset.action === 'delete-category') {
      openCategoryRemoveModal(article.dataset.categoryId);
    }
  });

  elements.menuEditor.addEventListener('click', async (event) => {
    const actionTarget = event.target.closest('[data-action]');
    const article = event.target.closest('[data-item-id]');

    if (!actionTarget || !article) {
      return;
    }

    if (actionTarget.dataset.action === 'save-item') {
      try {
        await saveItem(article);
        await loadDashboard();
        setStatus(elements.menuStatus, 'Item salvo com sucesso.');
      } catch (error) {
        setStatus(elements.menuStatus, error.message, { error: true });
      }
      return;
    }

    if (actionTarget.dataset.action === 'delete-item') {
      try {
        await apiRequest('/api/admin/items', {
          method: 'DELETE',
          body: { id: article.dataset.itemId },
        });
        await loadDashboard();
        setStatus(elements.menuStatus, 'Item removido com sucesso.');
      } catch (error) {
        setStatus(elements.menuStatus, error.message, { error: true });
      }
    }
  });

  elements.ordersList.addEventListener('click', async (event) => {
    const actionTarget = event.target.closest('[data-action]');
    const article = event.target.closest('[data-order-id]');

    if (!actionTarget || !article) {
      return;
    }

    if (actionTarget.dataset.action === 'set-status') {
      await apiRequest('/api/admin/orders', {
        method: 'PATCH',
        body: {
          id: article.dataset.orderId,
          action: 'status',
          status: actionTarget.dataset.status,
        },
      });
      await loadDashboard();
      return;
    }

    if (actionTarget.dataset.action === 'archive-order') {
      openOrderArchiveModal(article.dataset.orderId);
    }
  });

  elements.categoryRemoveForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      await apiRequest('/api/admin/categories', {
        method: 'DELETE',
        body: {
          id: state.pendingCategoryId,
          password: elements.categoryRemovePassword.value,
        },
      });
      closeCategoryRemoveModal();
      await loadDashboard();
      setStatus(elements.categoryStatus, 'Categoria removida com sucesso.');
    } catch (error) {
      elements.categoryRemoveError.hidden = false;
      elements.categoryRemoveError.textContent = error.message;
    }
  });

  elements.orderRemoveForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      await apiRequest('/api/admin/orders', {
        method: 'PATCH',
        body: {
          id: state.pendingOrderId,
          action: 'archive',
        },
      });
      closeOrderArchiveModal();
      await loadDashboard();
    } catch (error) {
      setStatus(elements.ordersStatus, error.message, { error: true });
    }
  });

  elements.cancelCategoryRemove.addEventListener('click', closeCategoryRemoveModal);
  elements.closeCategoryRemove.addEventListener('click', closeCategoryRemoveModal);
  elements.cancelOrderRemove.addEventListener('click', closeOrderArchiveModal);
  elements.closeOrderRemove.addEventListener('click', closeOrderArchiveModal);
  elements.saveAllButton.addEventListener('click', handleSaveAll);
}

async function init() {
  cacheElements();
  bindEvents();

  const session = await apiRequest('/api/auth/session');

  if (!session.authenticated) {
    showAuthenticatedView(false);
    activatePanel('schedule');
    return;
  }

  showAuthenticatedView(true);
  activatePanel('schedule');
  await loadDashboard();
}

window.addEventListener('DOMContentLoaded', () => {
  init().catch((error) => {
    const loginError = document.getElementById('adminLoginError');
    if (loginError) {
      loginError.hidden = false;
      loginError.textContent = error.message;
    }
  });
});
