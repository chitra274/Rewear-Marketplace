import bcrypt from 'bcryptjs';
import { pool } from '../src/db/pool.js';

const categories = ['Tops','Dresses','Bottoms','Outerwear','Shoes','Accessories'];
const sizes = ['XS','S','M','L','XL','UK 6','UK 8','UK 10','UK 12'];
const conditions = ['Like New','Very Good','Good','Fair'];
const image = 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&q=80';
try {
  const passwordHash = await bcrypt.hash('RewearDemo123!', 12);
  await pool.query(`INSERT INTO users(name,email,password_hash) VALUES
    ('Demo Seller','seller@rewear.local',$1),('Demo Buyer','buyer@rewear.local',$1)
    ON CONFLICT(email) DO NOTHING`, [passwordHash]);
  const seller = (await pool.query("SELECT id FROM users WHERE email='seller@rewear.local'")).rows[0].id;
  const existing = await pool.query('SELECT COUNT(*)::int AS count FROM items');
  if (existing.rows[0].count === 0) {
    for (let batch = 0; batch < 50; batch++) {
      await pool.query('BEGIN');
      try {
        for (let j = 0; j < 100; j++) {
          const n = batch * 100 + j + 1;
          const category = categories[n % categories.length];
          const item = await pool.query(`INSERT INTO items(seller_id,title,description,category,size,brand,condition,price_cents,image_url)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,price_cents`, [seller, `${category} thrift find ${n}`, 'A pre-loved piece in lovely wearable condition. Carefully checked before listing.', category, sizes[n % sizes.length], 'ReWear Vintage', conditions[n % conditions.length], 1200 + (n % 30) * 275, image]);
          const listing = await pool.query(`INSERT INTO listings(seller_id,title,description,listing_type,price_cents)
            VALUES($1,$2,$3,'SINGLE',$4) RETURNING id`, [seller, `${category} thrift find ${n}`, 'A unique pre-loved fashion find.', item.rows[0].price_cents]);
          await pool.query('INSERT INTO listing_items(listing_id,item_id) VALUES($1,$2)', [listing.rows[0].id,item.rows[0].id]);
        }
        await pool.query('COMMIT');
      } catch (e) { await pool.query('ROLLBACK'); throw e; }
      console.log(`Seeded ${(batch + 1) * 100} of 5000 items`);
    }
    // A small three-piece bundle example. The items also have their own single listings.
    const bundleItems = [];
    for (const [i, title] of ['Vintage floral dress','Black evening dress','Pink summer dress'].entries()) {
      const item = await pool.query(`INSERT INTO items(seller_id,title,description,category,size,brand,condition,price_cents,image_url)
        VALUES($1,$2,$3,'Dresses','M','ReWear Vintage','Very Good',$4,$5) RETURNING id`, [seller,title,'A carefully checked pre-loved dress.',3000 + i * 500,image]);
      const single = await pool.query(`INSERT INTO listings(seller_id,title,description,listing_type,price_cents) VALUES($1,$2,$3,'SINGLE',$4) RETURNING id`, [seller,title,'A unique pre-loved dress.',3000 + i * 500]);
      await pool.query('INSERT INTO listing_items(listing_id,item_id) VALUES($1,$2)', [single.rows[0].id,item.rows[0].id]);
      bundleItems.push(item.rows[0]);
    }
    const bundle = await pool.query(`INSERT INTO listings(seller_id,title,description,listing_type,price_cents) VALUES($1,'Three-dress vintage bundle','Three coordinated pre-loved dresses at a bundle price.','BUNDLE',7500) RETURNING id`, [seller]);
    for (const item of bundleItems) await pool.query('INSERT INTO listing_items(listing_id,item_id) VALUES($1,$2)', [bundle.rows[0].id,item.id]);
    console.log(`Created bundle listing ${bundle.rows[0].id}`);
  } else {
    console.log(`Database already contains ${existing.rows[0].count} items; skipping item seed.`);
  }
  const raceItem = await pool.query("SELECT l.id FROM listings l JOIN users u ON u.id=l.seller_id WHERE u.email='seller@rewear.local' AND l.status='ACTIVE' AND l.listing_type='SINGLE' ORDER BY l.id LIMIT 1");
  console.log('\nDemo accounts: seller@rewear.local / RewearDemo123! and buyer@rewear.local / RewearDemo123!');
  console.log(`Use RACE_LISTING_ID=${raceItem.rows[0]?.id ?? 'choose-an-active-single-listing'} for the concurrency test.`);
} finally { await pool.end(); }
