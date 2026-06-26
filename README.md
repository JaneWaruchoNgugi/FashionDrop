# FashionDrop Kenya

React + TypeScript + Vite + Zustand + Firebase storefront for a Kenyan fashion e-commerce drop.

Built features:

- Customer storefront, catalog, cart, checkout, order confirmation, and order tracking.
- Firebase env configuration through Vite environment variables.
- Admin dashboard at `/admin` for adding/editing/deleting products and updating order statuses.
- Firestore-backed products and orders, with seed products as a local preview fallback.
- Light/dark theme switch. Light mode is white, orange, and dark red by default.

## 1. Run it locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:5173`.

Before connecting Firebase, fill `.env.local` with your Firebase web app values:

```bash
VITE_FIREBASE_API_KEY=YOUR_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=YOUR_PROJECT.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID
VITE_FIREBASE_APP_ID=YOUR_APP_ID
VITE_MPESA_PAYMENT_LABEL=PAYBILL: 000000
```

`.env.local` is ignored by git so your real config stays out of source control. Firebase web config is still public in the browser by design, so protect data with Firestore rules.

## 2. Firebase setup

1. In Firebase Console, enable Firestore Database, Firebase Authentication, and Storage.
2. In Authentication, enable Email/Password sign-in.
3. Create your admin user in Authentication.
4. Copy that user's UID.
5. In Firestore, create `admins/{uid}` with any fields, for example `{ "role": "owner" }`.
6. Add products in `/admin`, or manually in the `products` collection using the `Product` interface in `src/types/index.ts`.

Starter Firestore rules are also saved in firestore.rules:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null &&
        exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }

    match /admins/{adminId} {
      allow read: if request.auth != null && request.auth.uid == adminId;
      allow write: if false;
    }

    match /products/{productId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /orders/{orderId} {
      allow read: if true;
      allow create: if true;
      allow update: if isAdmin();
      allow delete: if false;
    }
  }
}
```

## 3. Admin dashboard

Go to `/admin`, sign in with the Firebase Auth admin email/password, then manage:

- Products, images, categories, featured/new-drop flags, and stock variants.
- Orders and status changes: Pending, Confirmed, Packed, Out for Delivery, Delivered, Cancelled.
- Sales, pending orders, product count, revenue, and low-stock summary.

Variant lines use this format:

```text
S,Rust,#B5502E,5
M,Black,#161616,3
```

## 4. Delivery fee and M-Pesa label

Set these in `.env.local`:

```bash
VITE_MPESA_PAYMENT_LABEL=PAYBILL: 000000
```

Replace the Paybill/Till label with your real business payment details before going live.

## 5. Deploy

```bash
npm run build
```

Deploy the `dist/` folder to Vercel or Firebase Hosting. Add the same `VITE_` environment variables in your hosting provider.

## Future work

- Rider/delivery dashboard.
- SMS notifications through a Firebase Cloud Function and Africa's Talking.
- M-Pesa STK Push through a backend function.
