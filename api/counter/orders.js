import { requireSession } from '../_lib/auth.js';
import { createOrder } from '../_lib/repository.js';
import { assertMethod, handleApiError, readJson, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  try {
    assertMethod(req, ['POST']);
    requireSession(req);
    const body = await readJson(req);
    sendJson(res, 201, await createOrder('counter', body));
  } catch (error) {
    handleApiError(res, error);
  }
}
