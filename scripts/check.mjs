import fs from 'node:fs';
import path from 'node:path';

const requiredPaths = [
  'package.json',
  'vercel.json',
  '.env.example',
  'public/index.html',
  'public/admin.html',
  'public/balcao.html',
  'public/cozinha.html',
  'public/style.css',
  'public/assets/js/index.js',
  'public/assets/js/admin.js',
  'public/assets/js/balcao.js',
  'public/assets/js/cozinha.js',
  'api/auth/login.js',
  'api/auth/logout.js',
  'api/auth/session.js',
  'api/public/bootstrap.js',
  'api/public/orders.js',
  'api/admin/bootstrap.js',
  'api/admin/categories.js',
  'api/admin/items.js',
  'api/admin/orders.js',
  'api/admin/settings.js',
  'api/counter/orders.js',
  'api/kitchen/orders.js',
  'supabase/migrations/001_initial_schema.sql'
];

const missing = requiredPaths.filter((entry) => !fs.existsSync(path.resolve(entry)));

if (missing.length > 0) {
  console.error('Missing required files:');
  for (const entry of missing) {
    console.error('- ' + entry);
  }
  process.exit(1);
}

console.log('Project structure check passed.');
