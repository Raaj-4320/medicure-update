# 1. ROOT FILES

## Confirmed from code
- **Admin route wiring**: `src/App.tsx`
  - `/admin/catalog` → `MedicineMasterCatalog`
  - `/admin/financials` → `Financials`
  - Protected by `allowedRoles=['admin']`.
- **Admin dashboard**: `src/pages/admin/AdminDashboard.tsx`
- **Admin medicine catalog**: `src/pages/admin/MedicineMasterCatalog.tsx`
- **Admin financial tab/page**: `src/pages/admin/Financials.tsx`
- **Admin modal used by catalog**: `src/components/medicine/AddMedicineModal.tsx`
- **Shared runtime API layer**: `src/services/api.ts`
- **Core data shapes**: `src/types.ts`

## Likely inferred
- Main runtime for admin pages is still Firestore-direct through `api.ts` (not Express REST).

## Needs verification
- Whether production deployment also runs only Firestore path or some environments proxy to Express.

---

# 2. CURRENT BEHAVIOR

## A) Admin route/page structure
- Admin pages render under `/admin/*` through `MainLayout` and role-guarded route.
- Catalog and financials are separate pages, not tabs in one page.

## B) Medicine catalog current behavior
### Confirmed
- **Data source currently used**: `api.getMedicines({ includeAll: 'true' })`.
- `getMedicines` reads `medicine_master` first, then falls back to `medicines`.
- Table columns currently rendered: **Name, Category, Price, Status, Actions**.
- Name shown from `med.name || med.brandName`; generic shown as subtext.
- Price is `med.price` (often absent in medicine master records).
- Approve/Reject buttons call `api.updateMedicine(id, {status: 'approved'|'rejected'})`.
- `updateMedicine` updates `medicine_master` only.

### Practical implication
- Catalog is currently medicine-master moderation style, not seller inventory listing.
- It does **not** show seller name, stock/quantity, or image as required target behavior.

## C) Financial tab current behavior
### Confirmed
- `Financials.tsx` loads payouts via `api.getPayouts()` and normalizes rows for payout table.
- **Payouts table is dynamic** from live `payouts` collection.
- **Overview KPIs are static hardcoded numbers** (revenue, commission, pending payouts, GST).
- **Overview charts are static mock arrays** (`revenueData`, `categoryData`).
- **Reconciliation queue is static mock rows** (`t1/t2/t3`).

### Practical implication
- Financial page is mixed mode: dynamic payouts + static overview/reconciliation.

---

# 3. LIVE DATA SOURCES

## Medicine catalog target fields

### Medicine image
- Available in:
  - `MedicineMaster.image` (master)
  - `SellerMedicine.image` (inventory via `medicines` or legacy-inventory normalization)

### Medicine name
- Available in:
  - `MedicineMaster.brandName`
  - `SellerMedicine.name`
  - fallback from master via inventory normalization logic.

### Seller name
- Not directly on medicine master records.
- Can be resolved through:
  - inventory item `sellerId` / `pharmacyId`
  - join with `pharmacies` (`name`, `ownerId/sellerId`)
  - optionally join with `users` for user displayName.

### Quantity/stock
- Available on inventory (`SellerMedicine.stock`) in active `medicines` and normalized legacy `inventory`.
- Not present on medicine master records.

### Price
- Inventory: `price`, optional `discountPrice`.
- Medicine master may not have reliable price.

### Blocked/unblocked status
- Current code vocabulary in admin catalog uses `approved/rejected` status on `medicine_master`.
- No explicit `blocked` boolean currently wired.

## Financial dynamic sources currently available
- `orders`: count and revenue base (`totalAmount`).
- `payments`: payment totals by status.
- `returns`: return count/amount opportunities.
- `payouts`: seller payout flows (already used in `Financials`).
- `analytics`: aggregate totals function exists (`getAnalytics`) based on orders.

## Trustworthy source-of-truth notes
- For gross revenue: orders `totalAmount` is reliable in current frontend logic.
- For settlement/payout state: `payouts` collection is reliable for current page.
- For actual paid cash movement: `payments` should be used, but `Financials` currently does not read it.

---

# 4. RISKS

## Confirmed schema risks relevant to admin task
- **medicines vs inventory vs medicine_master drift**:
  - catalog currently reads master, but required fields (seller, stock, price) are inventory-centric.
- **sellerId vs ownerId drift** on pharmacies affects seller-name joins.
- **status vocabulary mismatch**:
  - admin catalog uses `approved/rejected`, requirement asks Block/Unblock.
- **price/stock availability mismatch**:
  - price/stock are not guaranteed on master records.
- **financial mismatch risk**:
  - overview currently static; dynamic payouts table may not match static KPI values.
  - order totals vs payment totals can diverge if payment pending/failed or split states.

## Likely inferred
- If catalog is moved to inventory-backed admin view, dual-source joins will be needed for seller name + medicine metadata.

## Needs verification
- Whether there is a dedicated moderation status field already used elsewhere for seller medicines (beyond generic `status`).

---

# 5. SAFE FIX PLAN

## Part A — Admin medicine catalog (target fields + Block/Unblock)
1. Keep admin route/component structure unchanged.
2. In `MedicineMasterCatalog.tsx`, switch list source to inventory-style data for table rows:
   - use `api.getInventory({})` for stock/price/image and pharmacy linkage.
   - load `api.getPharmacies({})` + `api.getUsers()` only for seller/pharmacy name resolution.
3. Render required columns:
   - image, medicine name, seller name, quantity(stock), price.
4. Replace approve/reject actions with single toggle:
   - if current status indicates blocked/rejected → show **Unblock Medicine**
   - else show **Block Medicine**
   - write back using existing update API path compatible with current schema (minimal field patch).
5. Keep search/filter behavior and loading/empty states intact.
6. Avoid rewriting seller/admin/checkout flows.

## Part B — Admin financial tab (dynamic)
1. Keep page/layout/tabs unchanged in `Financials.tsx`.
2. Replace static overview metrics with computed live values from existing APIs:
   - `api.getOrders()` for gross revenue + order count.
   - `api.getPayments()` for paid/pending/failed totals.
   - `api.getPayouts()` for pending payout totals.
   - `api.getReturns()` for return burden counts/amount estimates.
3. Keep payout table dynamic (already live) and preserve reconciliation tab UI for now.
4. Convert chart datasets to derived aggregations from live records (time-bucket by createdAt).
5. Add safe fallbacks for empty datasets and missing dates.

## Guardrails
- No architecture change.
- No backend migration.
- No unrelated route rewrites.
- Keep changes surgical to admin catalog + financials + required API helper wiring only.

