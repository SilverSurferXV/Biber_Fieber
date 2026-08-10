---
created: 2026-05-13T10:56:42.478Z
updated: 2026-05-13T10:56:42.478Z
---

# Performance-Optimierung — Rote & Gelbe Maßnahmen

## Summary
Umsetzung aller hoch- und mittelpriorigen Performance-Verbesserungen: React Query staleTime, Lazy Loading für Bilder, dynamischer pdfMake-Import, Session-Update-Throttling, fehlende DB-Indexes, Admin-Orders JOIN-Optimierung und Pagination für Admin-Tabellen.

## Files to Modify

### 🔴 1. React Query `staleTime` setzen
**File: `helpers/useShopApi.tsx`**
- `useSettings`: `staleTime: 5 * 60 * 1000` (5 Min) — Settings ändern sich selten
- `useCategories`: `staleTime: 5 * 60 * 1000` (5 Min) — Categories sind quasi statisch
- `useProducts`: `staleTime: 2 * 60 * 1000` (2 Min) — Produkte ändern sich etwas öfter
- `useDeliveryZoneCheck`: `staleTime: 10 * 60 * 1000` (10 Min) — Zones ändern sich fast nie

**File: `helpers/useAdminApi.tsx`**
- `useAdminProducts`: `staleTime: 60 * 1000` (1 Min)
- `useAdminCategories`: `staleTime: 2 * 60 * 1000` (2 Min)
- `useAdminOrders`: `staleTime: 30 * 1000` (30 Sek) — Orders brauchen frischere Daten
- `useAdminCustomers`: `staleTime: 60 * 1000` (1 Min)
- `useAdminDeliveryZones`: `staleTime: 2 * 60 * 1000` (2 Min)
- `useAdminReviews`: `staleTime: 2 * 60 * 1000` (2 Min)
- `useAdminSonderbereichFiles`: `staleTime: 2 * 60 * 1000` (2 Min)
- `useAdminStatistics`: `staleTime: 60 * 1000` (1 Min)

**File: `helpers/useAdminDriverApi.tsx`**
- `useAdminDrivers`: `staleTime: 2 * 60 * 1000` (2 Min)

**File: `helpers/useCustomerApi.tsx`** (if exists)
- Add staleTime to customer-facing hooks (profile, orders): `staleTime: 60 * 1000`

### 🔴 2. `loading="lazy"` auf Bilder
**File: `pages/shop.tsx`**
- Add `loading="lazy"` to all product `<img>` tags (product card image, detail dialog image)
- Add `loading="lazy"` to category `<img>` tags in the category scroller

**File: `components/AdminProducts.tsx`**
- Add `loading="lazy"` to product photo preview `<img>` in the table (if rendered)

**File: `components/AdminCustomers.tsx`**
- Add `loading="lazy"` to dropoff photo `<img>` tag

### 🔴 3. pdfMake dynamisch importieren
**File: `components/AdminOrders.tsx`**
- Remove the top-level static `import * as pdfMake` and `import * as pdfFonts` and the `addVirtualFileSystem` call
- In `generatePdf()` and `generatePdf4x6()`: use dynamic `const pdfMake = await import("pdfmake/build/pdfmake")` and `const pdfFonts = await import("pdfmake/build/vfs_fonts")` inside the function, then call `pdfMake.addVirtualFileSystem(pdfFonts)` before creating the PDF
- Make `generatePdf` and `generatePdf4x6` async functions
- Update all callers (`handlePrintA4`, `handlePrint4x6`) to `await` the calls

**File: `components/AdminDailyClosing.tsx`** (if it also imports pdfMake statically)
- Same treatment: move to dynamic import inside the function that generates the Z-Bericht PDF
- Note: `helpers/generateZBerichtPdf.tsx` likely imports pdfMake — move to dynamic import there too

**File: `helpers/generateZBerichtPdf.tsx`**
- Move pdfMake/pdfFonts imports to dynamic imports inside the `generateZBerichtPdf` function
- Make it async (it probably already is)

### 🟡 4. Session-Update throtteln
**File: `helpers/getServerUserSession.tsx`**
- Instead of updating `lastAccessed` on every single request, compare the current time with `session.lastAccessed` from the JWT
- Only update the DB row if `lastAccessed` is more than 5 minutes ago: `if (Date.now() - session.lastAccessed > 5 * 60 * 1000)`
- This saves one DB WRITE per API call for most requests
- The session cookie update (via `setServerSession`) should also only happen when the DB is actually updated, so the caller (auth/session_GET) needs adjustment: return a flag `sessionUpdated: boolean` so the caller knows whether to re-set the cookie
- Actually simpler approach: just throttle the DB update in `getServerUserSession`. The JWT `lastAccessed` stays as-is (it was set when the cookie was last refreshed). Check `if (now.getTime() - result.sessionLastAccessed.getTime() > 5 * 60 * 1000)` before running the UPDATE query. If we skip the update, return the existing `sessionLastAccessed` as `session.lastAccessed`.

### 🟡 5. Fehlende DB-Indexes
Run SQL to add:
```sql
CREATE INDEX CONCURRENTLY idx_orders_status ON orders (status);
CREATE INDEX CONCURRENTLY idx_orders_created_at ON orders (created_at);
CREATE INDEX CONCURRENTLY idx_order_items_product_id ON order_items (product_id);
```

### 🟡 6. Admin Orders: JOIN statt N+1
**File: `endpoints/admin/orders_GET.ts`**
- Instead of 3 separate queries (orders, then items by IDs, then products by IDs), combine into fewer queries:
  - Main query: JOIN orders with users (already done)
  - Items query: JOIN orderItems with products to get costPriceEuro, supplier, articleNumber in one query instead of fetching products separately
  - This eliminates the third query entirely and reduces the product map lookups
- The items query becomes:
  ```
  db.selectFrom("orderItems")
    .leftJoin("products", "orderItems.productId", "products.id")
    .select([...all orderItems fields, "products.costPriceEuro", "products.supplier", "products.articleNumber"])
    .where("orderId", "in", orderIds)
  ```

### 🟡 7. Pagination für Admin-Tabellen
**File: `endpoints/admin/orders_GET.ts` + `endpoints/admin/orders_GET.schema.ts`**
- Add `page` (default 1) and `limit` (default 50) params to the schema
- Apply `.limit(limit).offset((page - 1) * limit)` to the orders query
- Return `totalCount` alongside orders so the frontend can paginate
- Output type becomes `{ orders: [...], summary: {...}, totalCount: number, page: number, totalPages: number }`

**File: `endpoints/admin/customers_GET.ts` + `endpoints/admin/customers_GET.schema.ts`**
- Add `page` (default 1) and `limit` (default 100) params
- Apply pagination to the customers query
- Return `totalCount`, `page`, `totalPages`

**File: `endpoints/admin/products_GET.ts` + `endpoints/admin/products_GET.schema.ts`**
- Add `page` (default 1) and `limit` (default 100) params
- Apply pagination
- Return `totalCount`, `page`, `totalPages`

**File: `helpers/useAdminApi.tsx`**
- Update `useAdminOrders` to accept page param
- Update `useAdminCustomers` to accept page param
- Update `useAdminProducts` to accept page param
- Include page in queryKey for proper caching

**File: `components/AdminOrders.tsx`**
- Add pagination state and Pagination component at the bottom of the orders list
- Show "Seite X von Y" info

**File: `components/AdminCustomers.tsx`**
- Add pagination state and Pagination component

**File: `components/AdminProducts.tsx`**
- Add pagination state and Pagination component

## Approach

### Step 1: Database Indexes
Add the 3 missing indexes via `runSQLQuery` with `CONCURRENTLY` flag and `noTransaction: true`.

### Step 2: Backend Optimizations (Session throttle + Orders JOIN)
Update `helpers/getServerUserSession.tsx` to throttle session updates.
Update `endpoints/admin/orders_GET.ts` to JOIN items with products.

### Step 3: Backend Pagination
Add pagination support to orders, customers, and products GET endpoints (schema + implementation).

### Step 4: Frontend — staleTime
Update all React Query hooks in `useShopApi`, `useAdminApi`, `useAdminDriverApi`, and `useCustomerApi` with appropriate staleTime values.

### Step 5: Frontend — Lazy Loading Images
Add `loading="lazy"` to all `<img>` tags in shop, admin products, and admin customers.

### Step 6: Frontend — Dynamic pdfMake Import
Convert pdfMake imports to dynamic in AdminOrders and generateZBerichtPdf.

### Step 7: Frontend Pagination UI
Add Pagination component usage to AdminOrders, AdminCustomers, AdminProducts with page state and navigation.

## Risks & Considerations

1. **Pagination breaking existing flows**: Admin might rely on seeing all orders/customers at once for search/filtering. Ensure a reasonable default page size (50–100) and that existing filter functionality works across pages.
2. **Session throttle**: The 5-minute window means `lastAccessed` in the JWT cookie may be slightly stale. This is acceptable since the session expiry is 1 week. No functional impact.
3. **Dynamic pdfMake import**: First PDF generation will have a brief loading delay (~1–2s). Consider showing a loading toast or spinner while the module loads.
4. **staleTime values**: These are defaults. If mutations properly invalidate queries (which they already do), the cache will stay fresh after mutations regardless of staleTime.
5. **CONCURRENTLY indexes**: These won't lock the table but need to be run outside a transaction (`noTransaction: true`).
6. **Orders JOIN optimization**: The combined items+products query returns more data per row but eliminates an entire round trip. Net benefit for any meaningful number of orders.
