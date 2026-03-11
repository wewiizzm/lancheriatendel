import { ensureDatabaseReady } from './_lib/db.js';
import { getEnv } from './_lib/env.js';
import { assertMethod, handleApiError, sendJson } from './_lib/http.js';

export default async function handler(req, res) {
  try {
    assertMethod(req, ['GET']);
    await ensureDatabaseReady();
    const env = getEnv();

    sendJson(res, 200, {
      ok: true,
      service: 'tendel-api',
      database: 'ready',
      env: {
        supabaseUrlConfigured: Boolean(env.supabaseUrl),
        supabaseAnonKeyConfigured: Boolean(env.supabaseAnonKey),
        supabaseServiceRoleKeyConfigured: Boolean(env.supabaseServiceRoleKey),
        databaseUrlConfigured: Boolean(env.databaseUrl),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    handleApiError(res, error);
  }
}
