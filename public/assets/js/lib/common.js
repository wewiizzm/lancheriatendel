const CURRENCY_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const ALLOWED_REDIRECTS = new Set(['admin.html', 'balcao.html', 'cozinha.html', 'index.html']);

export async function apiRequest(path, options = {}) {
  const requestOptions = {
    method: options.method || 'GET',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  };

  if (options.body !== undefined) {
    requestOptions.headers['Content-Type'] = 'application/json';
    requestOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(path, requestOptions);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(payload?.error || `Request failed with status ${response.status}.`);
    error.status = response.status;
    error.details = payload?.details;
    throw error;
  }

  return payload;
}

export function formatCurrency(valueInCents) {
  return CURRENCY_FORMATTER.format(valueInCents / 100);
}

export function formatDateTime(value) {
  return DATE_TIME_FORMATTER.format(new Date(value));
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function setStatus(element, message, options = {}) {
  if (!element) {
    return;
  }

  if (!message) {
    element.hidden = true;
    element.textContent = '';
    element.classList.remove('is-error');
    return;
  }

  element.hidden = false;
  element.textContent = message;
  element.classList.toggle('is-error', Boolean(options.error));
}

export function showToast(element, message, options = {}) {
  if (!element) {
    return;
  }

  element.hidden = false;
  element.textContent = message;
  element.classList.add('is-visible');
  element.classList.toggle('is-error', Boolean(options.error));

  window.clearTimeout(element._toastTimer);
  element._toastTimer = window.setTimeout(() => {
    element.hidden = true;
    element.classList.remove('is-visible');
    element.classList.remove('is-error');
  }, options.duration || 2800);
}

export function getRedirectTarget(fallback = 'admin.html') {
  const redirect = new URLSearchParams(window.location.search).get('redirect') || '';
  const normalized = redirect.replace(/^\//, '');
  return ALLOWED_REDIRECTS.has(normalized) ? normalized : fallback;
}

export async function ensureAuthenticatedOrRedirect(currentPage) {
  const session = await apiRequest('/api/auth/session');

  if (!session.authenticated) {
    window.location.href = `admin.html?redirect=${encodeURIComponent(currentPage)}`;
    return null;
  }

  return session;
}

export function createElementFromHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

export function getOrderStatusClass(status) {
  if (status === 'pending') {
    return 'is-pending';
  }

  if (status === 'ready') {
    return 'is-ready';
  }

  return '';
}
