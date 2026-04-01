# PHASE 2 — Code-Traceable Evidence Report + Implementation-Grade Repair Plan

Date: 2026-04-01
Scope: Firebase/Firestore-driven medicine ordering platform (customer, seller, delivery, admin panels)

---

## SECTION 1 — CONFIRMED ISSUE REGISTER

| Issue ID | Issue Title | Severity | Panels Affected | Exact Files | Exact Functions / Components | Firestore Collections / Fields | Reproduction Path | Root Cause | User Impact | Recommended Fix Direction |
|---|---|---|---|---|---|---|---|---|---|---|
| ISS-001 | Static admin auth bypass in client | Critical | Admin, global auth trust boundary | `src/AuthContext.tsx` | `login`, auth `useEffect` localStorage branch | `users.role`, localStorage key `admin` | Login with `raj.golakiya0@gmail.com / 123`, admin profile injected locally | Admin authority is client-side hardcoded and persisted in localStorage | Full admin impersonation without Firebase role checks | Remove static branch; derive admin only from Firebase Auth + server-issued custom claims |
| ISS-002 | Over-broad order write permissions | Critical | Customer/Seller/Delivery/Admin | `firestore.rules` | `match /orders/{orderId}` | `orders.*` | Any seller or delivery client can call order update path | Rules allow `update, delete` for any seller/delivery, no ownership or assignment checks | Unauthorized status mutation/cancellation/data tampering | Restrict updates to claim-checked owners + server transition function; remove direct delete from clients |
| ISS-003 | Order status model mismatch (`approved` used but not typed) | High | Seller, Delivery, Customer, Admin analytics | `src/pages/seller/SellerOrders.tsx`, `src/types.ts`, `src/services/api.ts` | `updateStatus`, `OrderStatus` type, `createOrder` default | `orders.status` | Seller approves order -> status set to `approved`; type model does not include `approved` | UI and data model diverged; no canonical state machine validator | Query/filter drift, branch bugs, inconsistent UI coloring and transitions | Define canonical status enum and centralized transition validator in service/backend |
| ISS-004 | Delivery navigation route mismatch | High | Delivery | `src/App.tsx`, `src/pages/delivery/DeliveryDashboard.tsx`, `src/components/layout/DeliveryLayout.tsx` | Route config, dashboard link, layout nav | N/A | From delivery dashboard click “View All” -> `/delivery/available-orders` (not registered) | Link path diverges from router path (`/delivery/available`) | Broken navigation in active delivery workflow | Replace all delivery order links with canonical route constant |
| ISS-005 | Payment->order flow is fragmented and non-atomic | High | Customer, Seller, Admin financials | `src/pages/customer/CheckoutPage.tsx`, `src/services/api.ts` | `handlePlaceOrder`, `processPayment`, `createOrder`, `updatePayment` | `payments.paymentStatus/orderId`, `orders.*` | Payment success, then order create, then payment patch | Sequential writes across docs/collections without transaction orchestration | Partial failures create orphaned payments or unlinked orders | Move checkout finalization to trusted backend command with idempotency + transaction/corrective ledger |
| ISS-006 | Inventory not decremented/reserved during order creation | High | Customer, Seller | `src/services/api.ts` | `createOrder` | `inventory.stock`, `orders.items` | Place same item from two sessions concurrently | `createOrder` only validates inventory non-empty, not per-item stock or reservation | Oversell, stock illusion, fulfillment failures | Add per-line stock reservation/decrement in transactional backend workflow |
| ISS-007 | API layer masks failures with fallback results | High | All panels | `src/services/api.ts` | Proxy wrapper `api` + `getFallbackByName` | All collections indirectly | Trigger Firestore permission/index error | Exceptions are swallowed and replaced with `[]`, `{id:''}`, `false` | Silent data corruption / false “no data” states | Remove fallback substitution for critical domain ops; surface structured errors |
| ISS-008 | Prescription gating is UI-toggle driven and not enforced by order line logic | High | Customer, Seller compliance | `src/pages/customer/CheckoutPage.tsx`, `src/services/api.ts`, `src/types.ts` | `handlePlaceOrder`, `createPrescription`, `createOrder` | `orders.prescriptionId`, `orders.items[].medicineMasterId`, `prescriptions.*` | Cart with/without Rx items still blocked by same toggle; order can carry placeholder URL | No per-item Rx-required computation in checkout finalization | Compliance bypass or false blocking | Compute Rx requirement from inventory/master medicine flags and enforce in backend transition |
| ISS-009 | Delivery completion ignores assignment OTP fields | Medium-High | Delivery, Customer | `src/pages/delivery/MyDeliveries.tsx`, `src/services/api.ts`, `src/types.ts` | `handleVerifyOtp`, `updateDeliveryAssignment`, `DeliveryAssignment` model | `deliveryAssignments.pickupOtp/deliveryOtp/status` | Enter any 4 digits in modal and complete | OTP input not validated against assignment doc; assignment status written directly | Fraudulent completion possibility | Validate OTP server-side, lock failed attempts, write proof metadata |
| ISS-010 | Seller order action lacks ownership enforcement in service layer | High | Seller | `src/pages/seller/SellerOrders.tsx`, `src/services/api.ts` | `updateStatus`, `updateOrder` | `orders.pharmacyId`, seller identity | Seller app calls `api.updateOrder(orderId,{status})` directly | No server/business guard checking seller owns order pharmacy | Cross-pharmacy status tampering under permissive rules | Route status changes through backend command that checks seller->pharmacy ownership |
| ISS-011 | Seed process injects production collections at app startup | Medium | All | `src/App.tsx`, `src/utils/ensureSeedData.ts` | `ensureSeedData` call in `useEffect` | `orders`, `inventory`, `pharmacies`, `notifications`, `medicine_master` | App boot on empty or misconfigured project | Runtime boot mutates production-like collections from client | Data pollution, test/prod contamination | Gate seeding behind explicit environment flag and non-production project check |
| ISS-012 | Admin operational modules contain mixed real/mock business data | Medium | Admin | `src/pages/admin/AdminDashboard.tsx`, `src/pages/admin/LogisticsManagement.tsx`, `src/pages/admin/Financials.tsx`, `src/staticData.ts` | Dashboard chart constants, logistics local state, financial chart constants | Mostly none (UI local), payouts from `payouts` | Open admin dashboards | Visual KPIs and workflows run on constants/mock arrays | False operational visibility and wrong decisions | Feature-flag demo widgets; bind production dashboards only to validated aggregate pipelines |

### Confirmed vs Inferred
- **Confirmed:** ISS-001..ISS-012 above are directly traceable in code paths listed.
- **Inferred (excluded from register):** Firestore composite index gaps may appear for specific query combinations; code logs index errors but no index manifests were inspected.

---

## SECTION 2 — CANONICAL ORDER STATE MACHINE

### A) Current actual state model found in code

1. **Type-declared statuses:** `pending`, `confirmed`, `awaiting_prescription`, `prescription_under_review`, `dispatched`, `packed`, `ready_for_pickup`, `assigned`, `on_the_way`, `picked_up`, `out_for_delivery`, `delivered`, `cancelled`, `rejected`.  
2. **Actually written statuses in active flow:** `pending` (create), `approved` (seller), `dispatched` (seller), `on_the_way` (delivery accept), `delivered` (delivery complete), `cancelled` (seller reject action).  
3. **Mismatch:** `approved` exists in UI/service writes but not in TypeScript union.  
4. **Delivery assignment statuses used:** `assigned`, then `completed` in UI write while type union allows `assigned`, `picked_up`, `delivered`, `failed`.

### B) Recommended canonical production state model

#### Order status enum (single source of truth)
`created` -> `awaiting_prescription` -> `prescription_verified` -> `seller_confirmed` -> `packed` -> `ready_for_dispatch` -> `delivery_assigned` -> `out_for_delivery` -> `delivered`  
Terminal: `cancelled`, `rejected`, `delivery_failed`, `returned`, `refunded`

#### Allowed transitions + actor + required conditions

1. `created` (system)  
   - Actor: backend checkout command  
   - Conditions: idempotency key valid; items normalized; payment intent created (or COD policy validated)
2. `created -> awaiting_prescription`  
   - Actor: backend  
   - Conditions: any line item requires Rx and no approved Rx linked
3. `awaiting_prescription -> prescription_verified`  
   - Actor: seller pharmacist/admin pharmacist service  
   - Conditions: prescription doc status `approved`, linked to order and customer
4. `created/prescription_verified -> seller_confirmed`  
   - Actor: seller owner of pharmacy  
   - Conditions: stock reservation successful for all lines, payment status permits processing
5. `seller_confirmed -> packed`  
   - Actor: seller  
   - Conditions: packing timestamp and picker identity recorded
6. `packed -> ready_for_dispatch`  
   - Actor: seller  
   - Conditions: delivery mode = delivery, handoff payload prepared
7. `ready_for_dispatch -> delivery_assigned`  
   - Actor: dispatch service/admin/delivery assignment command  
   - Conditions: assignment document created with delivery partner ownership
8. `delivery_assigned -> out_for_delivery`  
   - Actor: assigned delivery partner  
   - Conditions: pickup OTP/proof validated
9. `out_for_delivery -> delivered`  
   - Actor: assigned delivery partner  
   - Conditions: delivery OTP/proof validated, payment COD settled
10. Cancellation transitions  
   - `created/awaiting_prescription/seller_confirmed -> cancelled` by customer (within policy window)
   - `seller_confirmed/packed/ready_for_dispatch -> rejected` by seller with reason code
   - `delivery_assigned/out_for_delivery -> delivery_failed` by assigned rider with reason + retry policy
11. Return/refund transitions (if enabled)  
   - `delivered -> returned` by customer return request approved  
   - `returned -> refunded` by finance settlement command

#### Forbidden transitions
- No direct `pending/created -> delivered`
- No `cancelled/rejected/refunded` back to active states
- No status updates by actors outside ownership/assignment/admin override scopes

#### Payment relationship
- `paymentStatus` and `orderStatus` are orthogonal but constrained:
  - Prepaid: `seller_confirmed` requires `paymentStatus in {authorized,captured}`
  - COD: allowed to continue, but `delivered` requires COD collection mark in assignment/payment doc

#### Prescription relationship
- If any order line has Rx-required medicine, order remains blocked from seller confirmation until prescription approved.

#### Delivery assignment relationship
- `delivery_assigned` requires `deliveryAssignments/{id}` with matching `orderId`, `deliveryStaffId`, assignment status active.

#### Cancellation / return rules
- Cancellation window closes at `packed` for customer path; seller/admin path can still move to `rejected` with reason.
- Return and refund transitions logged with actor and timestamps.

#### Timestamps to store
`createdAt`, `paymentInitiatedAt`, `paymentCapturedAt`, `prescriptionSubmittedAt`, `prescriptionApprovedAt`, `sellerConfirmedAt`, `packedAt`, `readyForDispatchAt`, `assignedAt`, `pickedUpAt`, `outForDeliveryAt`, `deliveredAt`, `cancelledAt`, `rejectedAt`, `returnedAt`, `refundedAt`, `updatedAt`.

### C) Migration mapping (current -> canonical)

- `pending` -> `created`
- `approved` -> `seller_confirmed`
- `dispatched` -> `ready_for_dispatch`
- `on_the_way` -> `out_for_delivery`
- `delivered` -> `delivered`
- `cancelled` -> `cancelled`
- `confirmed` (existing typed but rarely used) -> `seller_confirmed`
- `assigned` (order-level legacy) -> `delivery_assigned`

For delivery assignments:
- `completed` (currently written by UI) -> `delivered`

---

## SECTION 3 — FIREBASE AUTHORITY MODEL

### Target role authority (client-visible APIs)

#### Customer
- **Read:** own profile, own orders, own payments, own notifications, pharmacies/inventory public views.
- **Create:** checkout command request doc/callable input, prescriptions for own orders.
- **Update:** own address profile fields, own notification read-state.
- **Never directly writable from customer client:** `orders.status`, `inventory.stock`, `deliveryAssignments`, `analytics`, `payouts`.

#### Seller
- **Read:** own pharmacy, own inventory, own pharmacy orders, related prescriptions, related payout views.
- **Create/Update:** own inventory; seller action command requests (confirm/pack/ready/reject) not direct order patch.
- **Never directly writable:** `payments` outcome fields, cross-pharmacy orders, delivery assignment ownership fields.

#### Delivery partner
- **Read:** assignments where `deliveryStaffId == auth.uid`, eligible dispatch board (derived feed), own notifications.
- **Update via command:** pickup confirmation, out-for-delivery, completion/failure with proof.
- **Never directly writable:** arbitrary orders, unassigned assignments, seller-owned fields.

#### Admin
- **Read:** all operational collections.
- **Write:** controlled override commands, compliance adjudication, payout settlement, emergency order interventions.
- **Audit requirement:** every admin override writes immutable audit log with actor uid + before/after snapshot IDs.

### Explicit handling requirements

1. **Static admin bypass removal**  
   Replace hardcoded login/localStorage branch with Firebase custom claims check and profile role validation from trusted token.
2. **Custom claims enforcement**  
   Roles derive from `request.auth.token.role` in rules; Firestore `users.role` becomes display metadata, not authority source.
3. **Order ownership checks**  
   Seller action requires pharmacy ownership relation (`pharmacies/{id}.ownerId == auth.uid`) and order pharmacy match.
4. **Delivery assignment ownership checks**  
   Delivery action requires `deliveryAssignments/{id}.deliveryStaffId == auth.uid`.
5. **Prescription-sensitive actions**  
   Seller confirmation command verifies prescription status when Rx-required lines exist.
6. **Admin override rules**  
   Admin can transition to terminal remediation states only via audited command path.
7. **Audit trail**  
   Add `orderEvents` append-only collection: actor, role, action, prevStatus, nextStatus, reasonCode, timestamp.

---

## SECTION 4 — FIRESTORE RULES REPAIR PLAN

### Collections requiring tighter rules
- `orders`
- `payments`
- `deliveryAssignments`
- `inventory`
- `prescriptions`
- `notifications`
- `analytics`
- `payouts`
- `orderEvents` (new append-only)

### Rule blueprint by collection

#### `orders`
- Client create/update/delete disabled for all non-admin clients.
- Client writes replaced by command docs/functions (`checkoutRequests`, `orderActionRequests`).
- Immutable fields after create: `customerId`, `pharmacyId`, `items`, `totalAmount`, `traceId`, `createdAt`.
- Mutable via backend only: `status`, lifecycle timestamps, assignment refs, cancellation metadata.

#### `payments`
- Customer can create payment intent request only; cannot set `paymentStatus` directly.
- Immutable after creation: `amount`, `customerId`, `currency`, `paymentMethod`, `createdAt`.
- Payment status transitions handled by backend webhook/command.

#### `deliveryAssignments`
- Create/update by backend dispatcher path.
- Delivery user can update only proof/OTP submission fields for own assignment through command requests.
- Immutable: `orderId`, `deliveryStaffId`, `assignedAt`.

#### `inventory`
- Seller can manage own pharmacy inventory only.
- Stock decrement/increment from order lifecycle by backend service path.
- Add immutable linkage fields: `pharmacyId`, `medicineMasterId` (or require controlled migration command).

#### `prescriptions`
- Customer can create own prescription linked to own order.
- Seller/pharmacist/admin role can update review status with remark requirements.

#### `notifications`
- Read limited to owner/admin.
- Client updates limited to `isRead`; forbid title/message/type edits.

#### `analytics` / `payouts`
- Read: authorized scopes.
- Write: backend/admin workflows only.

### Cross-document checks needed
- Seller order action requires verifying seller ownership of order pharmacy doc.
- Delivery completion requires active assignment with matching delivery uid and order status precondition.
- Prescription-dependent transitions verify at least one approved prescription linked to order when Rx-required lines exist.

### Writes currently too dangerous from client
- `api.updateOrder(...)`
- `api.updateDeliveryAssignment(...)`
- `api.updatePayment(...)`
- direct `createOrder(...)` from client

These operations move to callable/cloud function or trusted backend endpoints with role validation and transition guardrails.

---

## SECTION 5 — ORDER CREATION ATOMICITY PLAN

### Current fragmented writes (confirmed)
1. `processPayment` writes/patches `payments`.
2. `createOrder` writes `orders` and `notifications`.
3. Checkout patches payment with `orderId`.

This sequence runs in separate operations with no cross-document transaction boundary.

### Target flow (trusted backend orchestration)

1. **Checkout initiation**  
   Client submits `checkoutRequests/{id}` with `idempotencyKey`, cart snapshot, addressId, payment method.
2. **Prescription validation**  
   Backend resolves medicines from inventory/master, computes `rxRequired` lines, validates linked approved prescription where needed.
3. **Payment initialization**  
   Backend creates payment intent record (`status=initiated`), returns client token.
4. **Order finalization command**  
   Backend command (`finalizeCheckout`) executes:
   - inventory line validation
   - inventory reservation/decrement
   - order creation
   - order event creation
   - seller notification creation
   - payment link + status advancement
5. **Atomicity mechanism**  
   - Firestore transaction for inventory docs + order doc + reservation docs + order event writes
   - payment gateway callback reconciliation outside txn but idempotent command with order lock
6. **Rollback/recovery**  
   - If payment succeeds but transaction fails: payment flagged `reconciliation_required`, order not created, compensating workflow retries.
   - If order created but payment callback delayed: order status `payment_pending_confirmation`.
7. **Idempotency**  
   - Unique `idempotencyKey` stored in `checkoutLocks/{key}`; duplicate submits return same order/payment mapping.
8. **Duplicate-submit handling**  
   - second request checks lock and returns existing processing/result state.

### Existing inconsistent records recovery plan
- Scheduled repair job scans:
  - payments with no `orderId` and `status=successful`
  - orders with missing payment linkage
  - delivered orders with assignment missing terminal state
- Job emits `reconciliationReports` and deterministic repair actions.

---

## SECTION 6 — INVENTORY INTEGRITY PLAN

### Current logic trace
- Checkout sends item list.
- `createOrder` checks inventory collection non-empty for pharmacy only.
- No per-item stock check, no decrement, no reservation ledger.

### Repair design

1. **Per-item stock validation**  
   For each line, fetch canonical inventory doc by `(pharmacyId, medicineMasterId)` and verify `stockAvailable >= quantity`.
2. **Reservation timing**  
   Reserve stock at seller confirmation or checkout finalization (prepaid path).  
   Store `reservedStock` and reservation records per order line.
3. **Decrement timing**  
   Convert reservation to sold stock at `packed` or `ready_for_dispatch` (selected policy fixed across system).
4. **Rejection/restock**  
   On seller reject/cancel before dispatch: release reservation.
5. **Cancellation/restock**  
   On customer cancellation before pack: release reservation.
6. **Return/restock**  
   On approved return and restockable condition: increment available stock with batch trace.
7. **Race-condition protection**  
   Use transaction on inventory docs; reject when write preconditions fail.
8. **Oversell prevention**  
   Block transition if reservation fails for any line; no partial line acceptance for medicine orders.
9. **Batch-aware extension**  
   Current code has `InventoryBatch` type and static batch mocks; production path binds order lines to batch allocations when batch module is enabled.

---

## SECTION 7 — PANEL-BY-PANEL REPAIR MATRIX

### Customer Panel
- **Currently works:** local cart, checkout UI, payment simulation, order creation, order history display.
- **Breaks:** Rx logic not line-driven; duplicate submit risk; no cancellation path; localStorage cart drift.
- **Why:** checkout function performs client-side orchestration and direct domain writes.
- **Code changes:**
  - Replace `handlePlaceOrder` direct flow with command-based request/response.
  - Add order cancellation action and status-driven button availability.
  - Move cart state to server-backed `carts` or signed checkout snapshot.
- **Fix category:** UI + service + workflow + rules.

### Seller Panel
- **Currently works:** fetch own pharmacy orders; approve/dispatch buttons; realtime list.
- **Breaks:** uses non-canonical `approved`, direct order status patching from client.
- **Why:** no transition guard backend, weak rules.
- **Code changes:**
  - Replace `api.updateOrder` calls with seller action command (`confirm`, `pack`, `ready_for_dispatch`, `reject`).
  - Update status badges and filters to canonical enum.
- **Fix category:** UI + service + schema + rules.

### Delivery Panel
- **Currently works:** list dispatched, accept assignment, mark delivered.
- **Breaks:** route mismatch, OTP not verified, uses mock details.
- **Why:** path inconsistency + UI-only verification + incomplete backend flow.
- **Code changes:**
  - Normalize routes to `/delivery/available` and shared constants.
  - Replace `handleVerifyOtp` direct writes with OTP verification command.
  - Bind detail screen to real order/customer/address/proof payloads.
- **Fix category:** UI + workflow + rules.

### Admin Panel
- **Currently works:** basic counts from API collections; payout list partial realism.
- **Breaks:** chart/KPI/logistics sections are constant-driven and mutable only in local state.
- **Why:** demo scaffolding remains in operational pages.
- **Code changes:**
  - Replace local mock KPIs with server aggregates + reconciliation metrics.
  - Gate demo cards under feature flag.
  - Add order event/audit timelines and failed reconciliation dashboard.
- **Fix category:** UI + data pipeline + observability.

---

## SECTION 8 — MOCK / PARTIAL / FAKE MODULE CLEANUP

| Module | Evidence | Classification | Action |
|---|---|---|---|
| Admin dashboard revenue/category/audit snippets | hardcoded arrays in dashboard file | Must be replaced before production | Move to aggregate collections and verified metrics |
| Logistics management partner CRUD | initialized from `MOCK_LOGISTICS_PARTNERS`, local-only mutations | Must be replaced before production | Bind to `logisticsPartners` collection and command APIs |
| Financial overview chart dataset | hardcoded `revenueData` and category percentages | Can be feature-flagged | Keep demo under `VITE_DEMO_MODE`; production tab reads warehouse aggregates |
| Delivery detail map/chat/persona | mock image, mock chat list, static names/locations | Must be replaced before production | Bind to assignment/order/customer subdocuments |
| `staticData.ts` broad mocks (orders, assignments, payouts, etc.) | explicit mock exports | Safe as demo-only | Keep isolated in demo build profile only |
| `ensureSeedData` runtime seed writes | auto insert on app load | Can be feature-flagged but disabled in production | Guard by non-prod project ID and explicit env var |

---

## SECTION 9 — IMPLEMENTATION PRIORITY PLAN

### Phase 0 — Security blockers
- **Goals:** eliminate privilege bypass and unsafe direct writes.
- **Files first:** `src/AuthContext.tsx`, `firestore.rules`, `src/services/api.ts` (remove critical fallbacks), add backend/cloud function command endpoints.
- **Risk:** Critical.
- **Dependencies:** custom claims issuance pipeline.
- **Validation outcome:** unauthorized mutation attempts fail deterministically; admin only via verified claims.

### Phase 1 — Order correctness blockers
- **Goals:** canonical state machine + atomic checkout + inventory reservation.
- **Files first:** `src/services/api.ts` (replace create/update order calls), `src/pages/customer/CheckoutPage.tsx`, new backend checkout orchestrator.
- **Risk:** High.
- **Dependencies:** Phase 0 rules model.
- **Validation outcome:** no orphan payment/order pairs; no oversell on concurrent checkout tests.

### Phase 2 — Cross-panel sync hardening
- **Goals:** unify status constants, route constants, assignment lifecycle checks.
- **Files first:** `src/types.ts`, `src/pages/seller/SellerOrders.tsx`, `src/pages/delivery/AvailableOrders.tsx`, `src/pages/delivery/MyDeliveries.tsx`, `src/pages/delivery/DeliveryDashboard.tsx`, `src/App.tsx`.
- **Risk:** Medium-High.
- **Dependencies:** canonical status enum published.
- **Validation outcome:** consistent status rendering and transitions across all panels.

### Phase 3 — Admin/delivery realism and observability
- **Goals:** replace mock KPIs, add reconciliation + audit surfaces.
- **Files first:** admin pages (`AdminDashboard`, `Financials`, `LogisticsManagement`), new aggregate jobs/functions.
- **Risk:** Medium.
- **Dependencies:** event logs and canonical transitions operational.
- **Validation outcome:** dashboards reflect live data without demo placeholders.

### Phase 4 — Cleanup and technical debt
- **Goals:** remove runtime seeding from prod, isolate demo modules, tighten error handling taxonomy.
- **Files first:** `src/utils/ensureSeedData.ts`, `src/App.tsx`, `src/staticData.ts`, API error wrappers.
- **Risk:** Low-Medium.
- **Dependencies:** all functional phases stable.
- **Validation outcome:** deterministic environments and lower operational ambiguity.

---

## SECTION 10 — TEST & VERIFICATION MATRIX

| Test ID | Actor | Preconditions | Action | Expected Firestore Change | Expected UI Change |
|---|---|---|---|---|---|
| T-01 Customer happy path | Customer | Verified pharmacy, in-stock non-Rx items, payment success | Place order | `orders` created with canonical initial status; `payments` linked; reservation/decrement ledger entries; notification to seller | Customer sees new order in history; seller sees incoming order |
| T-02 Rx-required path | Customer + Seller pharmacist | Cart includes Rx-required item | Submit checkout without approved Rx then upload+approve Rx | Order enters `awaiting_prescription`, then `prescription_verified` after review | Customer sees blocked/progress state; seller sees pending Rx task |
| T-03 Payment fail path | Customer | Payment gateway returns fail | Confirm checkout | `payments.status=failed`; no active order (or explicit payment-pending order per policy) | Customer sees failure and retry; seller sees no processable order |
| T-04 Seller reject path | Seller | Order in seller-confirmable state | Reject with reason | `orders.status=rejected`; reservation released; event log appended | Customer sees rejected + reason; delivery sees no assignable order |
| T-05 Seller confirm + dispatch | Seller | Payment valid, stock reserved, Rx valid if needed | Confirm -> pack -> ready_for_dispatch | Status timestamps appended; order events created | Customer tracking updates in real time; delivery board shows eligible order |
| T-06 Delivery assignment | Delivery/Dispatcher | Order ready_for_dispatch | Accept assignment | `deliveryAssignments` created, `orders.status=delivery_assigned` | Assigned rider sees active delivery; others do not |
| T-07 Delivered path | Delivery | Assigned order out_for_delivery | Submit delivery OTP + proof | `orders.status=delivered`, assignment terminal status, proof refs stored | Customer sees delivered; seller/admin metrics increment |
| T-08 Cancellation path | Customer/Seller | Order before cancellation cutoff | Cancel | `orders.status=cancelled`, reservation released, payment refund intent if prepaid | Customer sees cancelled; seller list updates |
| T-09 Unauthorized mutation attempts | Malicious user (seller/delivery/customer) | Authenticated but not owner/assignee | Try direct order patch via client SDK | Firestore deny + no document change + audit signal | UI error surfaced; no silent fallback |
| T-10 Inventory shortage path | Customer | Requested qty > available stock | Checkout finalize | No order finalization; stock unchanged; payment state reconciled per policy | Clear out-of-stock message and cart correction prompt |
| T-11 Duplicate submit / stale UI | Customer | Slow network, double click | Trigger same checkout twice with same key | Single order/payment pair; second request returns existing result | UI shows one order confirmation only |
| T-12 Cross-panel sync | Customer/Seller/Delivery/Admin | Order in motion | Execute full lifecycle transitions | Consistent status and timestamps across docs; events complete | All panels display same canonical status progression |

### Per-test cross-panel verification checklist
- Customer panel: order card status, payment badge, timestamps.
- Seller panel: visibility filtering by pharmacy ownership, action button availability by status.
- Delivery panel: assignment ownership isolation, OTP/proof gate, route integrity.
- Admin panel: aggregate counters match order-event-derived truth.

---

## File/Function Evidence Index (quick reference)
- Routing + role panels: `src/App.tsx`
- Auth bypass path: `src/AuthContext.tsx` (`login`, auth `useEffect`)
- Rules authority: `firestore.rules`
- Order/payment/delivery service layer: `src/services/api.ts` (`createOrder`, `updateOrder`, `processPayment`, `createDeliveryAssignment`, proxy fallback)
- Customer checkout path: `src/pages/customer/CheckoutPage.tsx`
- Seller status actions: `src/pages/seller/SellerOrders.tsx`
- Delivery accept/complete flows: `src/pages/delivery/AvailableOrders.tsx`, `src/pages/delivery/MyDeliveries.tsx`
- Delivery route discrepancy context: `src/pages/delivery/DeliveryDashboard.tsx`, `src/components/layout/DeliveryLayout.tsx`
- Admin mock surfaces: `src/pages/admin/AdminDashboard.tsx`, `src/pages/admin/Financials.tsx`, `src/pages/admin/LogisticsManagement.tsx`, `src/staticData.ts`
- Seed mutation at runtime: `src/utils/ensureSeedData.ts`

