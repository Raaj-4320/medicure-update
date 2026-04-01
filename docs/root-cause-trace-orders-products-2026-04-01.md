# Root-Cause Debug Trace — Orders Visibility + Product Edit/Delete

Date: 2026-04-01

## SECTION A — ORDER ROOT TRACE

Linear active path:
1. `src/pages/customer/CartPage.tsx` checkout button navigates to `/checkout`.
2. `src/pages/customer/CheckoutPage.tsx` place-order action runs `handlePlaceOrder`.
3. `handlePlaceOrder` sequence:
   - validates cart/address/prescription state in page flow
   - calls `api.processPayment(...)`
   - optional `api.createPrescription(...)`
   - builds `orderData` with real auth `customerId`, top-level `pharmacyId`, optional `sellerId`, top-level `items`, top-level `deliveryAddress`, `totalAmount`, `status/payment fields`
   - calls `api.createOrder(orderData)`
   - verifies `order.id` exists; otherwise throws
   - patches payment with `orderId`
   - only then sets success step (`setStep(3)`) and clears cart
4. `api.createOrder` (`src/services/api.ts`) writes to top-level `orders` via `createDoc('orders', orderPayload)`.
5. Service-layer error behavior in active path after fix:
   - `createDoc` throws on Firestore write failure
   - proxy rethrows caught errors (no fake fallback values)
   - payment patch transitions throw if persistence fails
   - `listCollection` now throws on query failures (no silent `[]` fallback)

Readers:
- Customer: `src/pages/customer/OrderHistory.tsx` -> `api.getOrders({ customerId: profile?.uid })`
- Seller: `src/pages/seller/SellerOrders.tsx` -> resolve seller pharmacy -> `api.getOrders({ pharmacyId: myPharmacy.id })`
- Admin: `src/pages/admin/AdminDashboard.tsx` -> `api.getOrders()` for order count

Confirmed root causes (historical and now fixed):
- false success due silent create fallback (empty id) and proxy fallback returns
- success UI path depended on returned object rather than confirmed persistent id

Current active ownership model:
- seller-side visibility canonical filter remains `pharmacyId`
- checkout now writes both `pharmacyId` (canonical for seller reads) and `sellerId` (compatibility support)
- temporary compatibility read path supports older records where `deliveryAddress.pharmacyId` exists without top-level `pharmacyId`

## SECTION B — PRODUCT ROOT TRACE

### Seller
- List component: `src/pages/seller/SellerCatalog.tsx` loads seller inventory.
- Edit/Delete buttons now wired to `handleEdit` / `handleDelete`.
- Handlers call `api.updateInventory` / `api.deleteInventory` and require truthy persistence result.
- Post-success path: `loadData()` refetch.
- Failure path: sets `errorMessage` and does not silently noop.

### Seller Inventory page
- Existing edit/delete handlers in `src/pages/seller/InventoryManagement.tsx` now enforce boolean result checks and surface errors.

### Admin
- List component: `src/pages/admin/MedicineMasterCatalog.tsx`.
- Edit flow: `editMedicine` -> `api.updateMedicine` -> `loadMedicines()`.
- Delete flow: `deleteMedicine` -> `api.deleteMedicine` -> `loadMedicines()`.
- Status update flow now also checks persistence result before refresh.

Confirmed product root causes (historical and now fixed):
- admin edit/delete mutation path did not exist
- seller catalog page had no active mutation wiring
- seller/admin handlers could appear no-op when persistence booleans were not validated

## SECTION C — MINIMAL ROOT FIX PLAN (EXECUTED)

Executed minimal root fixes:
1. Eliminate fake-success in active order path by throwing on create/query failures and rethrowing in proxy.
2. Gate success UI on confirmed persisted `order.id`.
3. Keep one source of truth collection (`orders`) and preserve canonical seller ownership filter via `pharmacyId`.
4. Add/repair seller/admin product edit/delete handlers with real mutation calls, awaited operations, explicit failure surfacing, and refetch.

Out-of-scope (intentionally untouched in this patch):
- delivery workflow redesign
- analytics/dashboard model refactor
- full security hardening of rules/claims architecture
