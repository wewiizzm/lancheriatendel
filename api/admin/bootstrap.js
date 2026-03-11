import { requireSession } from '../_lib/auth.js';
import { getAdminBootstrap } from '../_lib/repository.js';
import { assertMethod, handleApiError, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  try {
    assertMethod(req, ['GET']);
    requireSession(req);
    const payload = await getAdminBootstrap();
    sendJson(res, 200, payload);
  } catch (error) {
    handleApiError(res, error);
  }
}
