# PINAKI Farms

Homemade achar, A2 bilona ghee, and wooden-kolhu cold pressed oils.

**Ghar Ka Swaad, Shuddhata Ke Saath**

Customer shop + owner desk: catalog, cart, checkout, accounts, order tracking. Cart stays in the browser. Products, stock, and orders persist in the database.

---

## GitHub setup (browser)

1. Open [github.com/new](https://github.com/new) and sign in.
2. Repository name: `pinaki-farms`
3. Keep it **Private** if you want (recommended until launch).
4. Do **not** add a README, `.gitignore`, or license on GitHub — this project already has them.
5. Create the repository.
6. On the empty repo page choose **uploading an existing file**.
7. Unzip `pinaki-farms-github.zip` on your computer, then drag **all inner files and folders** onto GitHub (not the zip itself).
8. Commit message: `PINAKI Farms shop`.

Confirm these never appear in the repo: `.env`, `.env.local`, `node_modules`. They are already gitignored.

If you use Git on your own computer instead of the upload page:

```bash
git remote add origin https://github.com/YOUR_USER/pinaki-farms.git
git branch -M main
git push -u origin main
```

---

## Firebase setup (browser)

Firebase is for **Authentication (email/password)** and **Cloud Firestore** (products, orders, profiles). Do not paste keys into source files.

### 1. Create the project

1. Open [Firebase Console](https://console.firebase.google.com/).
2. Add project → name `pinaki-farms`.
3. Google Analytics optional.

### 2. Enable Email/Password Auth

1. **Build → Authentication → Get started**
2. **Sign-in method → Email/Password → Enable** (password). Save.

### 3. Create Firestore

1. **Build → Firestore Database → Create database**
2. Start in **production mode** (this repo ships `firestore.rules`).
3. Pick a region close to India, e.g. `asia-south1`.

### 4. Add a web app + copy config

1. Project settings (gear) → **Your apps** → **</> Web**
2. App nickname: `PINAKI Farms`
3. Copy the config values. They map to:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Put these in the host’s environment UI (Vercel / Netlify / Firebase Hosting), **never** in GitHub files.

### 5. Deploy Firestore rules from this repo

This repo includes:

- `firebase.json` — Firestore + Hosting config
- `firestore.rules` — customers read shop products; only admin writes catalog; orders are owner-or-self
- `firestore.indexes.json` — queries for user orders and category

In Firebase Console you can paste `firestore.rules` under **Firestore → Rules**, or deploy with the Firebase CLI after `firebase login`.

### 6. Hosting

This shop uses server routes (login, checkout, owner desk). **Vercel or Netlify** is the recommended host.

- Connect the GitHub repo in Vercel → add the `VITE_FIREBASE_*` env vars → deploy.
- Optional production database: `DATABASE_URL` (server only, never `VITE_`).
- Firebase Hosting in `firebase.json` is a static fallback. Full checkout/admin need the server host above.

Until Firebase env values are set, the shop already runs with built-in email/password auth and its own database.

### Firestore collections

| Collection | Purpose |
| --- | --- |
| `products` | name, price, mrp, unit, category, imageUrls[], videoUrl, stock, active |
| `orders` | customer details, items, total, paymentMethod, orderStatus, createdAt |
| `profiles` | userId, role: `customer` \| `admin` |

Admin role is granted only after the owner PIN on the server. Firestore rules block customers from promoting themselves.

---

## Run locally

```bash
npm install
npm run dev
```

```bash
npm run build
npm run preview
```

---

## Owner desk

Not in the customer header. Footer → **Store owner**.

1. Sign in with email/password.
2. Enter owner PIN.
3. Demo PIN: `PINAKI`

Customers stay customers. Product images are Google Drive share links (Anyone with the link), not local uploads.

Share URL `https://drive.google.com/file/d/FILE_ID/view?usp=sharing` is stored as `https://drive.google.com/uc?export=view&id=FILE_ID`. Optional video: YouTube or `.mp4`.
