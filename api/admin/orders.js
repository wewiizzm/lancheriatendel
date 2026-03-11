import { requireSession } from '../_lib/auth.js';
import { listOrders, updateOrder } from '../_lib/repository.js';
import { assertMethod, handleApiError, readJson, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  try {
    assertMethod(req, ['GET', 'PATCH']);
    requireSession(req);

    if (req.method === 'GET') {
      sendJson(res, 200, await listOrders({ includeArchived: false, limit: 100 }));
      return;
    }

    const body = await readJson(req);
    sendJson(res, 200, await updateOrder(body));
  } catch (error) {
    handleApiError(res, error);
  }
}
