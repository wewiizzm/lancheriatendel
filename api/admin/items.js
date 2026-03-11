import { requireSession } from '../_lib/auth.js';
import { createItem, deleteItem, updateItem } from '../_lib/repository.js';
import { assertMethod, handleApiError, readJson, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  try {
    assertMethod(req, ['POST', 'PUT', 'DELETE']);
    requireSession(req);
    const body = await readJson(req);

    if (req.method === 'POST') {
      sendJson(res, 201, await createItem(body));
      return;
    }

    if (req.method === 'PUT') {
      sendJson(res, 200, await updateItem(body));
      return;
    }

    sendJson(res, 200, await deleteItem(body));
  } catch (error) {
    handleApiError(res, error);
  }
}
