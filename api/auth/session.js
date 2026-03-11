import { getSession } from '../_lib/auth.js';
import { assertMethod, handleApiError, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  try {
    assertMethod(req, ['GET']);
    const session = getSession(req);

    sendJson(res, 200, {
      authenticated: Boolean(session),
      user: session ? { username: session.username } : null,
    });
  } catch (error) {
    handleApiError(res, error);
  }
}
