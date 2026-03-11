import { requireSession } from '../_lib/auth.js';
import { updateSettings } from '../_lib/repository.js';
import { assertMethod, handleApiError, readJson, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  try {
    assertMethod(req, ['PATCH']);
    requireSession(req);
    const body = await readJson(req);
    const payload = await updateSettings(body);
    sendJson(res, 200, payload);
  } catch (error) {
    handleApiError(res, error);
  }
}
