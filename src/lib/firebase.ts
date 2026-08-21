/**
 * Firebase config surface — fill these from Project settings → Your apps.
 * Never hardcode secrets. Host env only (Vercel / Netlify / Firebase).
 *
 * Firestore collections and access rules live in firestore.rules
 * (products, orders, profiles). The live shop uses src/lib/server/
 * until these VITE_FIREBASE_* values are set.
 */

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

/** Suggested Firestore collections — keep names stable if you migrate. */
export const FIRESTORE_COLLECTIONS = {
  products: "products",
  orders: "orders",
  profiles: "profiles",
} as const;
