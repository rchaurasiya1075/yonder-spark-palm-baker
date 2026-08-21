/**
 * Firebase web app — config from VITE_* env only (see .grok/firebase-local.json
 * locally, or the host env on Vercel / Netlify). Never hardcode keys in source.
 *
 * Used for Authentication, Cloud Firestore (products / orders / users),
 * and Analytics in the browser.
 */
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? "",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL ?? "",
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

export const FIRESTORE_COLLECTIONS = {
  products: "products",
  orders: "orders",
  users: "users",
  profiles: "profiles",
} as const;

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null;
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  return app ? getAuth(app) : null;
}

export function getFirebaseDb(): Firestore | null {
  const app = getFirebaseApp();
  return app ? getFirestore(app) : null;
}

export async function initFirebaseAnalytics() {
  if (typeof window === "undefined" || !isFirebaseConfigured) return;
  const app = getFirebaseApp();
  if (!app || !firebaseConfig.measurementId) return;
  try {
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    if (await isSupported()) getAnalytics(app);
  } catch {
    /* analytics is optional */
  }
}
