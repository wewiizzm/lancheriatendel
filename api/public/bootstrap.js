import { getPublicBootstrap } from '../_lib/repository.js';
import { assertMethod, handleApiError, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  try {
    assertMethod(req, ['GET']);
    const payload = await getPublicBootstrap();
    sendJson(res, 200, payload);
  } catch (error) {
    handleApiError(res, error);
  }
}
