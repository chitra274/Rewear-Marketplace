import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/:listingId/purchase', requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const listingResult = await client.query('SELECT id,seller_id,price_cents,status,listing_type FROM listings WHERE id=$1', [req.params.listingId]);
    if (!listingResult.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'LISTING_NOT_FOUND', message: 'This listing does not exist.' }); }
    const listing = listingResult.rows[0];
    if (String(listing.seller_id) === String(req.user.id)) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'CANNOT_BUY_OWN_ITEM', message: 'You cannot purchase your own listing.' }); }
    if (listing.status !== 'ACTIVE') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'LISTING_UNAVAILABLE', message: 'This listing is no longer available.' }); }

    const itemResult = await client.query('SELECT i.id,i.seller_id,i.status,i.price_cents FROM listing_items li JOIN items i ON i.id=li.item_id WHERE li.listing_id=$1 ORDER BY i.id ASC', [listing.id]);
    const items = itemResult.rows;
    if (!items.length) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'EMPTY_LISTING', message: 'This listing has no purchasable items.' }); }
    if (items.some(item => String(item.seller_id) !== String(listing.seller_id))) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'INVALID_LISTING', message: 'Listing ownership is inconsistent.' }); }

    if (listing.listing_type === 'SINGLE') {
      // One atomic conditional state transition. No application-level lock is needed.
      const claim = await client.query(`UPDATE items SET status='SOLD',buyer_id=$2,sold_at=NOW()
        WHERE id=$1 AND status='AVAILABLE' AND seller_id=$3 RETURNING id`, [items[0].id,req.user.id,listing.seller_id]);
      if (claim.rowCount !== 1) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'ITEM_ALREADY_SOLD', message: 'Sorry, this item has just been sold.' }); }
    } else {
      // Lock physical items, not listing rows. Sorting IDs gives overlapping bundles a consistent lock order.
      const ids = items.map(item => Number(item.id)).sort((a,b) => a-b);
      const locked = await client.query('SELECT id,status FROM items WHERE id = ANY($1::bigint[]) ORDER BY id ASC FOR UPDATE', [ids]);
      if (locked.rowCount !== ids.length || locked.rows.some(item => item.status !== 'AVAILABLE')) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'BUNDLE_UNAVAILABLE', message: 'At least one item in this bundle is no longer available. No items were purchased.' });
      }
      const claimed = await client.query(`UPDATE items SET status='SOLD',buyer_id=$2,sold_at=NOW()
        WHERE id = ANY($1::bigint[]) AND status='AVAILABLE' RETURNING id`, [ids,req.user.id]);
      if (claimed.rowCount !== ids.length) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'BUNDLE_UNAVAILABLE', message: 'The bundle could not be claimed in full. No items were purchased.' }); }
    }

    const orderResult = await client.query('INSERT INTO orders(buyer_id,listing_id,total_cents) VALUES($1,$2,$3) RETURNING id,buyer_id,listing_id,total_cents,status,created_at', [req.user.id,listing.id,listing.price_cents]);
    const order = orderResult.rows[0];
    for (const item of items) await client.query('INSERT INTO order_items(order_id,item_id,unit_price_cents) VALUES($1,$2,$3)', [order.id,item.id,item.price_cents]);
    await client.query(`UPDATE listings l SET status = CASE WHEN l.id=$1 THEN 'SOLD' ELSE 'UNAVAILABLE' END
      WHERE l.id IN (SELECT li.listing_id FROM listing_items li WHERE li.item_id = ANY($2::bigint[])) AND l.status='ACTIVE'`, [listing.id,items.map(item => item.id)]);
    await client.query('COMMIT');
    res.status(201).json({ message: 'Purchase successful.', order: { ...order, items } });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    next(err);
  } finally { client.release(); }
});

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT o.id,o.total_cents,o.status,o.created_at,l.title AS listing_title,
      COALESCE(json_agg(json_build_object('id',i.id,'title',i.title,'category',i.category,'size',i.size,'image_url',i.image_url)) FILTER (WHERE i.id IS NOT NULL),'[]') AS items
      FROM orders o JOIN listings l ON l.id=o.listing_id JOIN order_items oi ON oi.order_id=o.id JOIN items i ON i.id=oi.item_id
      WHERE o.buyer_id=$1 GROUP BY o.id,l.title ORDER BY o.created_at DESC`, [req.user.id]);
    res.json({ orders: result.rows });
  } catch (err) { next(err); }
});

export default router;
