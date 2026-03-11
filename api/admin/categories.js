import { requireSession } from '../_lib/auth.js';
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from '../_lib/repository.js';
import { assertMethod, handleApiError, readJson, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  try {
    assertMethod(req, ['POST', 'PUT', 'DELETE']);
    requireSession(req);
    const body = await readJson(req);

    if (req.method === 'POST') {
      sendJson(res, 201, await createCategory(body));
      return;
    }

    if (req.method === 'PUT') {
      sendJson(res, 200, await updateCategory(body));
      return;
    }

    sendJson(res, 200, await deleteCategory(body));
  } catch (error) {
    handleApiError(res, error);
  }
}
