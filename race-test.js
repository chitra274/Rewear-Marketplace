import 'dotenv/config';
import pg from 'pg';
const base = process.env.API_URL || 'http://localhost:4000';
const listingId = process.env.RACE_LISTING_ID;
if (!listingId) throw new Error('Set RACE_LISTING_ID to an AVAILABLE single listing before running the test.');
const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email: 'buyer@rewear.local', password: 'RewearDemo123!' }) });
if (!login.ok) throw new Error(`Login failed: ${login.status} ${await login.text()}`);
const { token } = await login.json();
const responses = await Promise.all(Array.from({ length: 50 }, () => fetch(`${base}/api/orders/${listingId}/purchase`, { method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: '{}' })));
const counts = responses.reduce((acc, response) => { acc[response.status] = (acc[response.status] || 0) + 1; return acc; }, {});
console.log('HTTP status counts:', { '201': counts[201] || 0, '409': counts[409] || 0, '500': counts[500] || 0 });
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let orderCount = -1;
try { const result = await pool.query('SELECT COUNT(*)::int AS count FROM orders WHERE listing_id=$1', [listingId]); orderCount = result.rows[0].count; }
finally { await pool.end(); }
console.log('Order rows for this listing:', orderCount);
const passed = counts[201] === 1 && counts[409] === 49 && (counts[500] || 0) === 0 && orderCount === 1;
console.log(passed ? 'PASS: one request won; 49 conflicted; exactly one order exists.' : 'FAIL: unexpected concurrency result.');
if (!passed) process.exitCode = 1;
