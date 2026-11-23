import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const itemSchema = z.object({ title: z.string().trim().min(2).max(140), description: z.string().trim().min(5).max(3000), category: z.enum(['Tops','Dresses','Bottoms','Outerwear','Shoes','Accessories']), size: z.string().trim().min(1).max(20), brand: z.string().trim().max(80).optional().default(''), condition: z.enum(['Like New','Very Good','Good','Fair']), price: z.coerce.number().positive().max(1000000), imageUrl: z.string().url().optional().or(z.literal('')) });
const listingSchema = z.object({ title: z.string().trim().min(2).max(160), description: z.string().trim().min(5).max(3000), items: z.array(itemSchema).min(1).max(10), bundlePrice: z.coerce.number().positive().max(1000000).optional() });

const listingSelect = `SELECT l.id,l.seller_id,l.title,l.description,l.listing_type,l.price_cents,l.status,l.created_at,u.name AS seller_name,
  COALESCE(json_agg(json_build_object('id',i.id,'title',i.title,'category',i.category,'size',i.size,'brand',i.brand,'condition',i.condition,'price_cents',i.price_cents,'image_url',i.image_url,'status',i.status)) FILTER (WHERE i.id IS NOT NULL),'[]') AS items
  FROM listings l JOIN users u ON u.id=l.seller_id JOIN listing_items li ON li.listing_id=l.id JOIN items i ON i.id=li.item_id`;

router.get('/', async (req, res, next) => {
  try {
    const { q = '', category = '', size = '', condition = '', minPrice = '', maxPrice = '', type = '' } = req.query;
    const values = []; const where = [`l.status='ACTIVE'`, `i.status='AVAILABLE'`];
    const add = (sql, value) => { values.push(value); where.push(sql.replace('?', `$${values.length}`)); };
    if (q) { values.push(`%${String(q).slice(0,80)}%`); const n = values.length; where.push(`(l.title ILIKE $${n} OR l.description ILIKE $${n} OR i.title ILIKE $${n})`); }
    if (category) add('i.category = ?', String(category));
    if (size) add('i.size = ?', String(size));
    if (condition) add('i.condition = ?', String(condition));
    if (minPrice !== '' && Number.isFinite(Number(minPrice))) add('l.price_cents >= ?', Math.round(Number(minPrice) * 100));
    if (maxPrice !== '' && Number.isFinite(Number(maxPrice))) add('l.price_cents <= ?', Math.round(Number(maxPrice) * 100));
    if (type && ['SINGLE','BUNDLE'].includes(String(type).toUpperCase())) add('l.listing_type = ?', String(type).toUpperCase());
    const limit = Math.min(Math.max(Number(req.query.limit) || 60, 1), 100);
    const sql = `${listingSelect} WHERE ${where.join(' AND ')} GROUP BY l.id,u.name ORDER BY l.created_at DESC LIMIT ${limit}`;
    const result = await pool.query(sql, values);
    res.json({ listings: result.rows });
  } catch (err) { next(err); }
});

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(`${listingSelect} WHERE l.seller_id=$1 GROUP BY l.id,u.name ORDER BY l.created_at DESC`, [req.user.id]);
    res.json({ listings: result.rows });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(`${listingSelect} WHERE l.id=$1 GROUP BY l.id,u.name`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'LISTING_NOT_FOUND', message: 'Listing not found.' });
    res.json({ listing: result.rows[0] });
  } catch (err) { next(err); }
});

router.post('/', requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const data = listingSchema.parse(req.body);
    const isBundle = data.items.length > 1;
    if (!isBundle && data.bundlePrice) return res.status(400).json({ error: 'INVALID_BUNDLE_PRICE', message: 'Bundle price is only used for multiple items.' });
    await client.query('BEGIN');
    const itemRows = [];
    for (const item of data.items) {
      const created = await client.query(`INSERT INTO items(seller_id,title,description,category,size,brand,condition,price_cents,image_url)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,price_cents`, [req.user.id,item.title,item.description,item.category,item.size,item.brand || null,item.condition,Math.round(item.price*100),item.imageUrl || null]);
      itemRows.push(created.rows[0]);
    }
    const total = itemRows.reduce((sum, item) => sum + Number(item.price_cents), 0);
    const listingPrice = isBundle ? Math.round((data.bundlePrice ?? total / 100) * 100) : total;
    // When a seller creates a bundle, also publish each constituent item as a single-item listing.
    // All of these listings point to the same physical item rows, so only one purchase path can win.
    if (isBundle) {
      for (let index = 0; index < itemRows.length; index++) {
        const singleListing = await client.query(`INSERT INTO listings(seller_id,title,description,listing_type,price_cents)
          VALUES($1,$2,$3,'SINGLE',$4) RETURNING id`, [req.user.id,data.items[index].title,data.items[index].description,itemRows[index].price_cents]);
        await client.query('INSERT INTO listing_items(listing_id,item_id) VALUES($1,$2)', [singleListing.rows[0].id,itemRows[index].id]);
      }
    }
    const listing = await client.query(`INSERT INTO listings(seller_id,title,description,listing_type,price_cents) VALUES($1,$2,$3,$4,$5) RETURNING *`, [req.user.id,data.title,data.description,isBundle ? 'BUNDLE' : 'SINGLE',listingPrice]);
    for (const item of itemRows) await client.query('INSERT INTO listing_items(listing_id,item_id) VALUES($1,$2)', [listing.rows[0].id,item.id]);
    await client.query('COMMIT');
    res.status(201).json({ listing: listing.rows[0] });
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

export default router;
