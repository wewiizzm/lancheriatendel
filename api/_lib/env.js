const REQUIRED_ENV_NAMES = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD',
  'SESSION_SECRET',
];

let cachedEnv;

function requireEnv(name) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

export function getEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  for (const name of REQUIRED_ENV_NAMES) {
    requireEnv(name);
  }

  const sessionSecret = requireEnv('SESSION_SECRET');

  if (sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters long.');
  }

  cachedEnv = {
    supabaseUrl: requireEnv('SUPABASE_URL'),
    supabaseAnonKey: requireEnv('SUPABASE_ANON_KEY'),
    supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    databaseUrl: requireEnv('DATABASE_URL'),
    adminUsername: requireEnv('ADMIN_USERNAME'),
    adminPassword: requireEnv('ADMIN_PASSWORD'),
    sessionSecret,
    whatsappNumber: (process.env.WHATSAPP_NUMBER || '').trim(),
    businessTimezone: (process.env.BUSINESS_TIMEZONE || 'America/Sao_Paulo').trim(),
  };

  return cachedEnv;
}
