CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS items (
  id BIGSERIAL PRIMARY KEY,
  seller_id BIGINT NOT NULL REFERENCES users(id),
  title VARCHAR(140) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(40) NOT NULL CHECK (category IN ('Tops','Dresses','Bottoms','Outerwear','Shoes','Accessories')),
  size VARCHAR(20) NOT NULL,
  brand VARCHAR(80),
  condition VARCHAR(30) NOT NULL CHECK (condition IN ('Like New','Very Good','Good','Fair')),
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  image_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE','SOLD')),
  buyer_id BIGINT REFERENCES users(id),
  sold_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((status = 'AVAILABLE' AND buyer_id IS NULL AND sold_at IS NULL) OR (status = 'SOLD' AND buyer_id IS NOT NULL AND sold_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS listings (
  id BIGSERIAL PRIMARY KEY,
  seller_id BIGINT NOT NULL REFERENCES users(id),
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  listing_type VARCHAR(10) NOT NULL CHECK (listing_type IN ('SINGLE','BUNDLE')),
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SOLD','UNAVAILABLE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listing_items (
  listing_id BIGINT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  item_id BIGINT NOT NULL REFERENCES items(id),
  PRIMARY KEY (listing_id, item_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  buyer_id BIGINT NOT NULL REFERENCES users(id),
  listing_id BIGINT NOT NULL REFERENCES listings(id),
  total_cents INTEGER NOT NULL CHECK (total_cents > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'PLACED' CHECK (status IN ('PLACED','SHIPPED','DELIVERED','CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id BIGINT NOT NULL REFERENCES items(id),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents > 0),
  PRIMARY KEY (order_id, item_id),
  UNIQUE (item_id)
);

CREATE INDEX IF NOT EXISTS idx_items_status_category ON items(status, category);
CREATE INDEX IF NOT EXISTS idx_items_seller ON items(seller_id);
CREATE INDEX IF NOT EXISTS idx_listings_status_created ON listings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_items_item ON listing_items(item_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_created ON orders(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_item ON order_items(item_id);
