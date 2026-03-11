import { createOrder } from '../_lib/repository.js';
import { assertMethod, handleApiError, readJson, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  try {
    assertMethod(req, ['POST']);
    const body = await readJson(req);
    const payload = await createOrder('online', body);
    sendJson(res, 201, payload);
  } catch (error) {
    handleApiError(res, error);
  }
}
