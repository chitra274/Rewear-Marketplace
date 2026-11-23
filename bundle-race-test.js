import 'dotenv/config';
import pg from 'pg';
const base = process.env.API_URL || 'http://localhost:4000';
const singleId = process.env.INDIVIDUAL_LISTING_ID;
const bundleId = process.env.BUNDLE_LISTING_ID;
if (!singleId || !bundleId) throw new Error('Set INDIVIDUAL_LISTING_ID and BUNDLE_LISTING_ID for two listings sharing at least one physical item.');
const login = await fetch(`${base}/api/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:'buyer@rewear.local',password:'RewearDemo123!'}) });
if (!login.ok) throw new Error(`Login failed: ${login.status}`);
const {token}=await login.json();
const [single,bundle]=await Promise.all([singleId,bundleId].map(id=>fetch(`${base}/api/orders/${id}/purchase`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:'{}'})));
console.log('Individual listing response:',single.status);
console.log('Bundle listing response:',bundle.status);
const statuses=[single.status,bundle.status].sort((a,b)=>a-b);
if (!(statuses[0]===201&&statuses[1]===409)) { console.error('FAIL: expected one 201 and one 409.'); process.exitCode=1; }
else console.log('PASS: overlapping purchase paths competed; exactly one won.');
const {Pool}=pg; const pool=new Pool({connectionString:process.env.DATABASE_URL});
try { const result=await pool.query('SELECT COUNT(*)::int AS orders FROM orders WHERE listing_id = ANY($1::bigint[])',[ [singleId,bundleId] ]); console.log('Orders created for the two competing listings:',result.rows[0].orders); if(result.rows[0].orders!==1) process.exitCode=1; }
finally { await pool.end(); }
