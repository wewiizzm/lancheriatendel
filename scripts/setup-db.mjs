import { ensureDatabaseReady } from '../api/_lib/db.js';

await ensureDatabaseReady();
console.log('Database bootstrap completed successfully.');
