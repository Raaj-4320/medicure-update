# A. Executive Summary

## Confirmed facts (from current code)
- Main runtime path is **React + Firebase Auth + Firestore direct calls**.
- Frontend routing is role-guarded for customer/seller/admin/delivery.
- Checkout is a multi-step async flow: cart validation → simulated payment → optional prescription upload → order write → payment/order linking.
- Seller flow includes pharmacy bootstrap if missing, inventory CRUD, and seller-scoped order views.
- Admin flow includes user management and seller verification.
- Optional Express + LowDB backend exists in parallel but is not used by frontend API calls by default.

## High-impact risk
- Biggest stability risk is **schema drift** across old/new collections and fields (ownerId vs sellerId, status vs verificationStatus, medicines vs inventory/sellerMedicines, medicine_master vs medicinesMaster, old vs new order statuses).

---

# B. Actual Runtime Architecture

## 1) Frontend structure
- App bootstraps providers + router in `App.tsx` and defines all role routes.
- `ProtectedRoute` enforces login and role checks.
- `AppCrashGuard` catches runtime/unhandled promise errors and shows fallback UI.

## 2) Auth flow
- `AuthContext` subscribes to Firebase `onAuthStateChanged`.
- On login/auth restore, it syncs profile from Firestore `users/{uid}` (creates fallback profile if missing).
- If role is `seller`, it ensures a seller pharmacy doc exists (`pharmacies/{uid}`).
- There is a localStorage admin shortcut (`localStorage.getItem('admin') === 'true'`) that bypasses normal auth for demo admin.

## 3) Data access / Firestore usage
- Frontend uses `src/services/api.ts` as the central data layer.
- `api.ts` contains:
  - data normalizers,
  - generic collection CRUD wrappers,
  - business flows for pharmacies, inventory, orders, payments, etc.,
  - realtime subscriptions via `onSnapshot`.

## 4) Realtime subscriptions
- Implemented for orders, inventory, notifications (`subscribeToOrders`, `subscribeToInventory`, `subscribeToNotifications`).

## 5) Optional Express backend usage
- Express server exposes `/api/*` resources and reads/writes `db.json` through LowDB.
- Frontend does not call these REST endpoints in current runtime path; it calls Firestore directly.

## 6) Which backend is truly active in practice?
- **Confirmed active path:** React → Firebase Auth/Firestore (`AuthContext` + `api.ts`).
- **Parallel path present but optional:** Express + LowDB (can run via npm scripts, but not default-wired from UI data layer).

---

# C. Role-Based Flows

## Customer flow (actual code behavior)
1. Register/Login from role-specific auth pages.
2. AuthContext syncs/creates profile in `users`.
3. Customer discovers pharmacies via `getPharmaciesForCustomer()`:
   - pharmacy must be verified/operational and have inventory.
4. Cart is stored in localStorage (`cart`) and parsed safely.
5. Checkout validates:
   - logged-in user,
   - non-empty cart,
   - cart pharmacyId,
   - seller linkage.
6. Payment simulation runs (`processPayment`) with statuses.
7. If required, prescription is uploaded to Firebase Storage and prescription record is created.
8. Order is created in `orders`, then payment record is patched with final order ID.
9. Customer tracks orders via list fetch + realtime subscription.

## Seller flow (actual code behavior)
1. Seller register/login.
2. Seller pharmacy bootstrap:
   - AuthContext ensures a pharmacy for seller uid,
   - Seller pages also self-heal by creating pharmacy if missing.
3. Inventory CRUD on `medicines` collection via `createInventoryEntry`, `updateInventory`, `deleteInventory`.
4. Seller orders:
   - query by pharmacy + seller filters,
   - realtime subscription by pharmacyId + client-side seller filtering.
5. Seller updates order status from UI actions.

## Admin flow (actual code behavior)
1. Admin login route exists; admin shortcut also exists for demo.
2. User management page calls user CRUD in API layer.
3. Seller verification page reads/updates pharmacies status.
4. Admin dashboard/routes expose global visibility pages including orders-related analytics pages.

## Delivery role (present)
- Delivery routes/pages exist, with order status updates in delivery pages.

---

# D. Database / Firestore Model

## Main collections used by `api.ts`
- `users`
- `pharmacies`
- `medicine_master` (and fallback read from `medicines`)
- `medicines` (active seller inventory source)
- `orders`
- `payments`
- `notifications`
- `prescriptions`
- `tickets`
- `payouts`
- `compliance`
- `returns`
- `deliveryAssignments`
- `analytics`

## Main document relationships
- `users.uid` ← principal identity for all roles.
- `pharmacies.ownerId/sellerId` ← seller ownership.
- `medicines.pharmacyId + sellerId` ← seller inventory ownership.
- `orders.customerId + pharmacyId + sellerId + items[].sellerId` ← customer/seller/pharmacy linkage.
- `payments.orderId + paymentId` ← payment-order mapping.
- `deliveryAssignments.orderId` ← delivery linkage.

## Critical fields for order visibility/linkage
- Customer visibility: `orders.customerId` must match logged-in customer uid.
- Seller visibility: either `orders.sellerId` OR `orders.items[].sellerId` must match seller uid, plus pharmacy filtering path.
- Pharmacy linkage: `orders.pharmacyId` must map to seller pharmacy.

---

# E. Order System Analysis

## 1) Order creation path
- Checkout builds `orderData` with:
  - `customerId`, `pharmacyId`, `sellerId`,
  - `items[]`, `totalAmount`, `deliveryAddress`,
  - `paymentId`, `paymentStatus`, `transactionReference`, optional `prescriptionId`.
- `api.createOrder` then:
  - normalizes payload,
  - validates pharmacy exists,
  - validates pharmacy has inventory,
  - writes `orders` doc,
  - writes seller notification.

## 2) Required behavior for successful creation
- Practical required inputs from flow:
  - `customerId`, `pharmacyId`, `sellerId`, meaningful `items[]`, `totalAmount`, `deliveryAddress`.
- Hard blocks in current API:
  - missing/non-existent pharmacy,
  - zero inventory for pharmacy.

## 3) Role-based fetch behavior
- Customer path: `api.getOrders({ customerId: profile.uid })` + `subscribeToOrders({ customerId })`.
- Seller path:
  - `api.getOrders({ sellerId, pharmacyId })`,
  - seller filtering allows either order-level sellerId or item-level sellerId.
- Admin path:
  - global `api.getOrders()` used by admin pages.

## 4) Why orders may not appear (exact, code-grounded)
1. Missing or wrong `sellerId` on order and items.
2. Wrong/missing `pharmacyId` linkage.
3. Seller has no pharmacy doc (bootstrap failed), causing wrong fetch scope.
4. Status/value mismatch causing UI assumptions to fail.
5. Legacy/alternate collection confusion where some data exists in older paths but UI reads newer path.

## 5) Existing fallback/self-heal logic
- Pharmacy lookup fallbacks in `getPharmacies`:
  - ownerId query,
  - direct doc by ownerId,
  - legacy sellerId fallback with migration patch.
- Seller pharmacy auto-create appears in both AuthContext and seller pages.

## 6) Weak spots
- Multi-source ownership/status fields still coexist.
- Seller status buttons use `approved/dispatched` labels while wider order type includes different lifecycle values.
- Order creation and payment linking are non-transactional across multiple writes.

---

# F. Payment System Analysis

## 1) Payment record lifecycle
- `processPayment` creates payment record in `payments/{paymentId}` with `initiated`.
- Then patches to `processing`.
- Then resolves to `successful` / `failed` / `pending` (demo outcome, optional forced override).

## 2) Checkout handling
- If payment fails: throws and order is not created.
- If payment succeeds: checkout proceeds to order creation.
- After order creation: payment is patched with final `orderId`.

## 3) Partial failure handling
- If payment succeeded but order creation fails, checkout tries to patch payment to:
  - `paymentStatus: pending`
  - failure notes for manual review.

## 4) Split-brain risk points
- Payment success write completed, but order write failed.
- Order write succeeded, but payment link patch failed.
- Any step in prescription upload path can fail between payment and order write.

---

# G. Schema Drift and Legacy Risks

## Drift 1: `ownerId` vs `sellerId` in pharmacies
- Old pattern: `sellerId` only.
- New pattern: `ownerId` as primary plus mirrored `sellerId`.
- Current code still supports both and migrates some records on read.
- Risk: seller-pharmacy mapping ambiguity.
- Safe standard: always persist both, treat `ownerId` as canonical.

## Drift 2: `status` vs `verificationStatus` in pharmacies
- Old pattern: one field may exist without the other.
- New handling: API mirrors/normalizes both when updating/filtering.
- Risk: inconsistent query results if only one field set.
- Safe standard: write both consistently for now.

## Drift 3: inventory collections (`medicines` vs `inventory` vs `sellerMedicines`)
- Active seller runtime writes/reads `medicines`.
- Seed utility still writes legacy `inventory`.
- LowDB default data includes `sellerMedicines`.
- Risk: data appears “missing” in UI if written to inactive collection.
- Safe standard: unify runtime and seeding on `medicines`.

## Drift 4: `medicine_master` vs `medicinesMaster`
- Active API reads/writes `medicine_master`.
- `seedData.ts` writes `medicinesMaster` (different name).
- Risk: admin master catalog inconsistency depending on which script ran.
- Safe standard: standardize to `medicine_master`.

## Drift 5: order status vocabulary
- Type includes statuses like `confirmed`, `packed`, `out_for_delivery`, etc.
- Seller UI currently uses `approved` and `dispatched` actions.
- Express backend transition map uses another lifecycle (`ready`, etc.).
- Risk: filters/badges/transition assumptions diverge.
- Safe standard: one explicit enum used across UI + Firebase + optional backend.

## Drift 6: Firestore direct runtime vs Express/LowDB parallel backend
- Both have overlapping domain logic but not one source of truth.
- Risk: demo team debugs wrong backend path.
- Safe standard: choose one runtime for demo (recommended: Firebase direct, since current frontend already uses it).

---

# H. Most Likely Breakpoints

1. **Auth/profile sync**: missing or malformed `users/{uid}` role/profile.
2. **Seller pharmacy missing**: no `pharmacies/{sellerUid}` and fallback creation fails.
3. **Inventory linkage issues**: item created in wrong collection (`inventory`/`sellerMedicines` not `medicines`).
4. **sellerId/ownerId mismatch**: seller queries miss pharmacy/order linkage.
5. **pharmacyId mismatch**: cart/order references wrong pharmacy.
6. **Status mismatch**: UI and backend/state models disagree on order states.
7. **Old vs new collection mismatch**: data exists but UI reads a different collection.
8. **UI blank/fallback screen**: runtime exception captured by AppCrashGuard.
9. **Checkout async fragility**: payment/upload/order/link chain can fail mid-way.
10. **Optional backend confusion**: team inspects Express data while UI reads Firestore.

---

# I. Fast Debugging Checklist

## Step 1: Determine active runtime immediately
- Confirm page action triggers Firestore reads/writes (not Express API calls).
- If testing Express, do it intentionally and separately.

## Step 2: Auth/role sanity
- Verify logged-in `uid`, `profile.role`, and existence of `users/{uid}`.
- For seller: verify `pharmacies/{uid}` has both `ownerId` and `sellerId`.

## Step 3: Inventory sanity for seller/customer
- Verify seller-created medicines are in `medicines` with:
  - `pharmacyId`, `sellerId`, `name`, `price`, `stock`.

## Step 4: Checkout write-side verification
- After checkout attempt, verify in Firestore:
  - `payments/{paymentId}` exists and final status,
  - `orders/{orderId}` exists,
  - order has `customerId`, `pharmacyId`, seller linkage,
  - payment doc linked with final `orderId`.

## Step 5: Read/filter-side verification
- Customer query: does `order.customerId === customerUid`?
- Seller query: does `order.pharmacyId` map seller pharmacy and does seller match order/item seller ids?
- Admin query: global order list should include document regardless of role linkage.

## Step 6: Status/path sanity
- Verify new status is one the relevant UI actually renders.
- If using delivery flow, ensure status names are compatible with each page’s expected states.

## Step 7: Use existing logging utilities
- Track logFlow markers for: auth sync, pharmacy fetch, inventory creation, order create, payment events.

---

# J. Priority Fix Order

1. **Lock demo runtime path**: Firebase-direct only for now; clearly mark Express as optional.
2. **Schema unification pass (minimum viable)**:
   - pharmacy: always write `ownerId` + `sellerId`,
   - pharmacy verification: always write `status` + `verificationStatus`,
   - inventory: only `medicines`,
   - medicine master: only `medicine_master`.
3. **Order visibility contract**:
   - enforce seller linkage fields during order creation,
   - add one post-create verification check that order is visible to customer/seller/admin queries.
4. **Status enum harmonization**:
   - choose one status vocabulary and update seller/delivery/admin pages accordingly.
5. **Checkout hardening**:
   - explicit recovery marker/report for payment success + order failure,
   - make reconciliation page/report for orphan payments/orders.
6. **Blank-page defense**:
   - add page-level guards around critical null-dependent render segments.

---

# K. Simplified Explanation for a Junior Developer

- Think of this app as a **React frontend talking directly to Firebase**.
- All important DB operations are in one file: `src/services/api.ts`.
- Users have roles. Routes are protected by role.
- Seller must have a pharmacy record. Without it, seller inventory/orders break.
- Inventory should be in `medicines` (not old collections).
- Checkout is fragile because it performs many async steps in sequence.
- Orders appear by filters:
  - customer sees by `customerId`,
  - seller sees by `pharmacyId` + seller linkage,
  - admin sees global.
- Most bugs come from mismatched schema fields and old/new collection overlap.
- For demo stability, standardize fields/collections first, then verify one full happy path end-to-end.

