import fs from 'node:fs/promises';
import { pool } from '../src/db/pool.js';
const sql = await fs.readFile(new URL('../src/db/schema.sql', import.meta.url), 'utf8');
await pool.query(sql);
console.log('ReWear database schema created successfully.');
await pool.end();
