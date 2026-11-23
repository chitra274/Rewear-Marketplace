# ReWear — Online Thrift Marketplace

ReWear is a full-stack marketplace for pre-owned fashion. Users can list individual clothing items or create a bundle. When a bundle is created, each physical item is also published as an individual listing. All purchase paths point to the same physical `items` rows, so an item can only be sold once.

## Technology

- Frontend: React 18, Vite, React Router, plain CSS
- Backend: Node.js, Express
- Database: PostgreSQL
- Authentication: bcrypt password hashing + JWT
- Validation: Zod
- API/concurrency testing: Postman and Node's built-in `fetch`

## Requirements

Install Node.js 18+ and PostgreSQL 14+.

## 1. Create the database

Open PostgreSQL / pgAdmin and create a database named `rewear`.

## 2. Configure the backend

```bash
cd server
npm install
```

Copy `.env.example` to `.env` and edit `DATABASE_URL` and `JWT_SECRET`.

Example local connection string:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/rewear
JWT_SECRET=use_a_long_random_secret_value_at_least_32_characters
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
```

Create the tables and indexes:

```bash
npm run setup
```

Load demo accounts and at least 5,000 sample physical items/listings:

```bash
npm run seed
```

Start the API:

```bash
npm run dev
```

API health check: http://localhost:4000/api/health

## 3. Configure the frontend

Open a second terminal:

```bash
cd client
npm install
```

Copy `.env.example` to `.env` if you want to change the API URL. Then:

```bash
npm run dev
```

Open http://localhost:5173.

## Demo accounts

- Seller: `seller@rewear.local`
- Buyer: `buyer@rewear.local`
- Password for both: `RewearDemo123!`

Change these demo credentials before deploying anywhere public. This project is a local academic prototype; it does not process real payments or upload images. Sellers can provide an image URL.

## Database design

- `users`: buyer/seller accounts
- `items`: the physical clothing items; this table is the source of truth for availability
- `listings`: the sale paths (single item or bundle)
- `listing_items`: many-to-many relationship between listings and physical items
- `orders`: successful purchase headers
- `order_items`: physical items captured by each order

A bundle listing and its individual listings reference the same physical item rows. The database's `items.status` value prevents a physical item from being sold twice. `order_items.item_id` is also unique as a second integrity guard.

## Purchase correctness

### Individual purchase

The backend uses one atomic conditional update:

```sql
UPDATE items
SET status = 'SOLD', buyer_id = $2, sold_at = NOW()
WHERE id = $1 AND status = 'AVAILABLE' AND seller_id = $3
RETURNING id;
```

If zero rows are returned, the item was already claimed and the API returns HTTP `409 Conflict`. The item claim and order insertion are in the same transaction.

### Bundle purchase

The backend:

1. Begins a database transaction.
2. Locks all physical item rows in ascending item-ID order (`SELECT ... FOR UPDATE`).
3. Checks that every item is still available.
4. Claims every item.
5. Inserts one order and its order-item rows.
6. Marks all overlapping sale listings unavailable.
7. Commits everything together.

If any item is unavailable, the transaction rolls back and no part of the bundle is sold. Consistent ascending lock order reduces deadlock risk for overlapping bundles.

## Concurrency tests

Use an unused single listing ID from the seeded database. Set it in the shell before running:

```bash
RACE_LISTING_ID=YOUR_LISTING_ID npm run test:race
```

The expected result is exactly one `201`, 49 `409` responses, zero `500` responses, and one order row for the listing. The test is destructive: it sells the chosen listing. Choose a fresh available listing each time.

For the overlap test, choose a single listing and a bundle listing that share at least one physical item:

```bash
INDIVIDUAL_LISTING_ID=123 BUNDLE_LISTING_ID=456 npm run test:bundle-race
```

Expected result: one `201`, one `409`, and one order across those two competing listings. This test is also destructive.

## Main API routes

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Log in |
| GET | `/api/auth/me` | Current user (auth required) |
| GET | `/api/listings` | Browse/filter active listings |
| GET | `/api/listings/:id` | Listing details |
| GET | `/api/listings/mine` | Seller's listings (auth required) |
| POST | `/api/listings` | Create a single or bundle listing (auth required) |
| POST | `/api/orders/:listingId/purchase` | Purchase listing (auth required) |
| GET | `/api/orders/mine` | Buyer's orders (auth required) |

## Known academic-prototype limitations

- Payment is simulated; no payment provider is connected.
- Images are represented by URLs; file uploads/storage are not implemented.
- Shipping and delivery tracking are outside the approved core scope.
- Order status is currently `PLACED`; seller fulfilment workflows can be added if required.
- Before production use, add email verification, password reset, stronger audit logging, image upload/storage, payment integration, deployment secrets management and broader automated tests.
