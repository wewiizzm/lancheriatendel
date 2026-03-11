import { createSessionCookie, validateAdminCredentials } from '../_lib/auth.js';
import { assertMethod, handleApiError, readJson, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  try {
    assertMethod(req, ['POST']);
    const body = await readJson(req);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');

    if (!validateAdminCredentials(username, password)) {
      sendJson(res, 401, { error: 'Invalid username or password.' });
      return;
    }

    sendJson(
      res,
      200,
      {
        authenticated: true,
        user: { username },
      },
      { 'Set-Cookie': createSessionCookie(username) }
    );
  } catch (error) {
    handleApiError(res, error);
  }
}
