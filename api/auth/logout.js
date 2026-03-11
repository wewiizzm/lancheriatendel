import { clearSessionCookie } from '../_lib/auth.js';
import { assertMethod, handleApiError, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  try {
    assertMethod(req, ['POST']);
    sendJson(
      res,
      200,
      { authenticated: false },
      { 'Set-Cookie': clearSessionCookie() }
    );
  } catch (error) {
    handleApiError(res, error);
  }
}
