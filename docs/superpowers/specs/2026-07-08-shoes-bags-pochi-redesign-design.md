# FashionDrop Redesign: Shoes & Bags, Nationwide Delivery, Manual Pochi Payment

**Date:** 2026-07-08
**Status:** Approved design — ready for implementation plan

## 1. Goal

Refocus the FashionDrop storefront from a broad fashion catalog with a rider
delivery network into a lean shop for **men's shoes, women's shoes, and women's
bags**, delivered anywhere in Kenya, and paid for by a **single manual M-Pesa
Pochi La Biashara transfer** that the owner confirms in the admin dashboard
before dispatch.

Three things change: the rider system is removed, the catalog is reduced to
three categories, and the payment flow becomes a manual Pochi transfer with
admin confirmation.

## 2. Scope

### 2.1 Remove the rider system entirely

- Delete `src/pages/RiderPage.tsx`, `src/pages/RiderPage.css`,
  `src/pages/RiderPageParts.tsx`.
- Remove the `/rider` route and its import from `src/App.tsx`.
- Remove the two "Riders" nav links from `src/components/Layout.tsx` (desktop
  and mobile nav).
- Remove the `@react-google-maps/api` dependency from `package.json` (only the
  rider map used it).
- Remove rider fields from the `Order` type (`src/types/index.ts`):
  `riderId`, `riderName`, `pickupAddress`, `destinationLabel`,
  `estimatedDistanceKm`, `riderPayout`, `platformFee`, `acceptedAt`,
  `proofOfDeliveryImage`.
- Remove all rider references in `AdminPage.tsx`, `TrackOrderPage.tsx`,
  `AccountPage.tsx`, and `OrderConfirmedPage.tsx` (rider status rows, payout
  columns, rider-name displays).

### 2.2 Catalog → exactly three categories

Replace `DEFAULT_CATEGORIES` in `src/store/categoryStore.ts` with exactly:

| value          | label          | sizes                          |
|----------------|----------------|--------------------------------|
| `mens-shoes`   | Men's Shoes    | 39, 40, 41, 42, 43, 44, 45     |
| `womens-shoes` | Women's Shoes  | 36, 37, 38, 39, 40, 41, 42     |
| `womens-bags`  | Women's Bags   | One Size                       |

- All other default categories (dresses, two-pieces, three-pieces, trousers,
  accessories, generic bags/shoes) are removed.
- Replace `src/store/seedData.ts` sample products with items matching only these
  three categories (a couple each of men's shoes, women's shoes, women's bags).
- Fix the currently-broken navigation links. Several links use
  ``to={`/category/`}`` with no category value (in `Layout.tsx` and
  `HomePage.tsx`); these must become ``to={`/category/${category.value}`}`` so
  the three categories are actually reachable. Hero and "View All" links that
  hard-code `/category/dresses` or `/category/accessories` point to a valid
  category (e.g. `mens-shoes`).
- Update copy that names the old catalog: the footer tagline
  ("Dresses, bags, two-pieces, shoes & accessories…"), the promo bar, and any
  homepage "Why shop" text, so they describe shoes and bags delivered across
  Kenya.

### 2.3 Nationwide delivery with two estimate bands

- Replace `DELIVERY_AREAS` / `KENYAN_COUNTIES` in `src/types/index.ts` with the
  full list of **47 Kenyan counties** for a dropdown selector on checkout.
- Fee is an **estimate only**, derived from the selected county:
  - **Nairobi** → estimated **KES 100–200**.
  - **Any other county** → estimated **KES 200–500** (varies with distance).
- A helper maps a county to its band:
  `deliveryBand(county) → { min, max, zone: 'nairobi' | 'outside' }`.
- The estimate is shown to the customer for reference. It is **not** added to
  the amount they pay via Pochi now (see 2.4).

### 2.4 Checkout → single manual Pochi payment

- Remove the payment-method chooser and all STK Push / pay-on-delivery logic
  from `src/pages/CheckoutPage.tsx`. Remove the `firebase/functions`
  `startFashionDropStkPush` call from `OrderConfirmedPage.tsx`.
- Checkout collects delivery details (full name, phone, county dropdown, town,
  address, notes) and shows an order summary with the item subtotal and the
  delivery-fee **estimate range** for the chosen county.
- The amount the customer pays now via Pochi is the **item subtotal only**.
  The delivery fee is confirmed separately by the owner (call/SMS) and paid
  separately — the UI states this clearly.
- Payment instruction shown at checkout and on the confirmation page:
  > **Pay via M-Pesa — Pochi La Biashara: 0791847766**
  > Send **KES {subtotal}** (item total). We'll confirm your delivery fee
  > separately before dispatch.
- The Pochi number and business name are kept as a constant in a small config
  module (e.g. `src/lib/payment.ts`) with optional env override
  (`VITE_POCHI_NUMBER`, `VITE_POCHI_NAME`), replacing the old
  `VITE_MPESA_PAYMENT_LABEL`.
- Placing an order writes it to Firestore with `status: 'pending_payment'` and
  `paymentStatus: 'unpaid'`, then navigates to the confirmation page. The
  confirmation page repeats the Pochi instruction and an "awaiting confirmation"
  message instead of the old STK test button.

### 2.5 Order model & stages

New `OrderStatus`:

```
pending_payment → paid → out_for_delivery → delivered   (+ cancelled)
```

- `ORDER_STATUS_LABELS`: Pending Payment, Paid, Out for Delivery, Delivered,
  Cancelled.
- `ORDER_STATUS_FLOW`: `['pending_payment', 'paid', 'out_for_delivery', 'delivered']`.
- `OrderStatusTracker` updated to render these four steps.
- `PaymentStatus` simplified to `'unpaid' | 'paid'`.
- Remove from `Order`: `paymentMethod`, `itemPaymentDueOnDelivery`,
  `amountPaid`, `balanceDue`, `mpesaCheckoutRequestId`, `mpesaReceipt`.
- Simplified `Order` shape retains: `id`, `buyerId`, `buyerEmail`,
  `orderNumber`, `lines`, `subtotal`, `deliveryFee` (number, owner-set actual;
  defaults `0`), `deliveryEstimate` (`{ min, max }`), `deliveryZone`
  (`'nairobi' | 'outside'`), `total` (defaults to `subtotal`; owner may update
  when the delivery fee is set), `delivery` (details), `paymentStatus`,
  `status`, `statusHistory`, `createdAt`, `updatedAt`.

### 2.6 Admin dashboard

- Remove rider columns/controls.
- Each `pending_payment` order gets a **"Confirm Payment"** action that sets
  `paymentStatus: 'paid'` and `status: 'paid'` (records the timestamp in
  `statusHistory`).
- From `paid`, the owner can advance the order to **Out for Delivery**, then
  **Delivered**. **Cancel** is available from any non-delivered state.
- Optional: an input to record the actual delivery fee on an order (updates
  `deliveryFee` and `total`) for the owner's records. This does not gate the
  flow.

## 3. Data flow

1. Customer browses one of three categories → adds shoe/bag variants to cart.
2. Checkout: enters details, selects county (drives the fee estimate band),
   sees "pay item subtotal via Pochi" instruction, places order
   (`pending_payment` / `unpaid`).
3. Customer sends the item subtotal to Pochi **0791847766**.
4. Owner sees the order in `/admin`, receives the M-Pesa payment, clicks
   **Confirm Payment** → order becomes `paid`.
5. Owner confirms the delivery fee with the customer separately, dispatches,
   marks **Out for Delivery**, then **Delivered**.

## 4. Firestore rules

No structural change required. Existing rules already allow public order
creation and admin-only updates, and admin-only product writes. Category and
order shape changes are field-level and compatible with current rules.

## 5. Testing / verification

The project has no automated test harness (no test script or test deps in
`package.json`). Verification is:

- `npm run build` (`tsc -b && vite build`) passes with no type errors — this
  catches every removed field / renamed type across the codebase.
- Dev-server smoke test of the full flow: browse each of the three categories →
  add to cart → checkout with a Nairobi county and an outside county (verify the
  correct estimate band shows) → place order → confirmation page shows the Pochi
  number and item subtotal → in `/admin`, Confirm Payment → advance to Out for
  Delivery → Delivered.

## 6. Out of scope / future

- No STK Push / Daraja automation (payment stays manual).
- No automated distance-based fee calculation (owner confirms manually).
- No re-introduction of riders or delivery tracking beyond the four order
  stages.
