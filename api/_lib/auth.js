import crypto from 'node:crypto';
import { getEnv } from './env.js';
import { HttpError } from './http.js';

const COOKIE_NAME = 'tendel_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function toBase64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

function signPayload(encodedPayload) {
  const { sessionSecret } = getEnv();
  return crypto
    .createHmac('sha256', sessionSecret)
    .update(encodedPayload)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function safeEquals(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parseCookies(req) {
  const rawCookieHeader = req.headers.cookie || '';
  const cookies = {};

  for (const chunk of rawCookieHeader.split(';')) {
    const [name, ...rest] = chunk.trim().split('=');

    if (!name) {
      continue;
    }

    cookies[name] = decodeURIComponent(rest.join('=') || '');
  }

  return cookies;
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  if (options.path) {
    parts.push(`Path=${options.path}`);
  }

  if (options.httpOnly) {
    parts.push('HttpOnly');
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  if (options.secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function validateAdminCredentials(username, password) {
  const env = getEnv();
  return safeEquals(username.trim(), env.adminUsername) && safeEquals(password, env.adminPassword);
}

export function validateAdminPassword(password) {
  const env = getEnv();
  return safeEquals(password, env.adminPassword);
}

export function createSessionCookie(username) {
  const payload = {
    sub: username,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);
  const token = `${encodedPayload}.${signature}`;

  return serializeCookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie() {
  return serializeCookie(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export function getSession(req) {
  const cookies = parseCookies(req);
  const rawToken = cookies[COOKIE_NAME];

  if (!rawToken) {
    return null;
  }

  const [encodedPayload, signature] = rawToken.split('.');

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);

  if (!safeEquals(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload));

    if (!payload?.sub || !payload?.exp) {
      return null;
    }

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      username: payload.sub,
      expiresAt: payload.exp,
    };
  } catch {
    return null;
  }
}

export function requireSession(req) {
  const session = getSession(req);

  if (!session) {
    throw new HttpError(401, 'Authentication required.');
  }

  return session;
}
