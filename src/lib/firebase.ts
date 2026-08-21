/**
 * Firebase web config. VITE_* env wins; public web values are fallbacks so
 * GitHub Pages can talk to project pinaki-1fe56 without a server.
 * Security is Firestore rules + authorized domains, not hiding the web key.
 */
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBYy7OfmGGfnRllOcRvgjtClr0T845kqAA",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "pinaki-1fe56.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "pinaki-1fe56",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "pinaki-1fe56.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "779330744487",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:779330744487:web:39f316a974b3f48b692b82",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-LW63K3V555",
  databaseURL:
    import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://pinaki-1fe56-default-rtdb.firebaseio.com",
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
