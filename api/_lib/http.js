export class HttpError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function sendJson(res, statusCode, payload, headers = {}) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  for (const [headerName, headerValue] of Object.entries(headers)) {
    res.setHeader(headerName, headerValue);
  }

  res.end(JSON.stringify(payload));
}

export function sendNoContent(res, headers = {}) {
  res.statusCode = 204;

  for (const [headerName, headerValue] of Object.entries(headers)) {
    res.setHeader(headerName, headerValue);
  }

  res.end();
}

export function assertMethod(req, allowedMethods) {
  if (allowedMethods.includes(req.method)) {
    return;
  }

  throw new HttpError(405, `Method ${req.method} is not allowed for this endpoint.`, {
    allow: allowedMethods,
  });
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (typeof req.body === 'string') {
    return req.body ? JSON.parse(req.body) : {};
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim();

  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new HttpError(400, 'Invalid JSON body.');
  }
}

export function getRequestUrl(req) {
  return new URL(req.url, 'https://tendel.local');
}

export function handleApiError(res, error) {
  if (error instanceof HttpError) {
    const headers = {};

    if (error.statusCode === 405 && error.details?.allow) {
      headers.Allow = error.details.allow.join(', ');
    }

    const payload = { error: error.message };

    if (error.details && error.statusCode !== 405) {
      payload.details = error.details;
    }

    sendJson(res, error.statusCode, payload, headers);
    return;
  }

  console.error(error);
  sendJson(res, 500, { error: 'Internal server error.' });
}
