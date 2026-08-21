import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseAuthSignOut,
  updateProfile,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";

function isIgnorableAuthError(err: unknown) {
  const code = typeof err === "object" && err && "code" in err ? String((err as { code: string }).code) : "";
  return (
    code === "auth/unauthorized-domain" ||
    code === "auth/operation-not-allowed" ||
    code === "auth/network-request-failed" ||
    code === "auth/configuration-not-found"
  );
}

export async function firebaseEmailSignIn(email: string, password: string) {
  if (!isFirebaseConfigured) return;
  const auth = getFirebaseAuth();
  if (!auth) return;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    if (isIgnorableAuthError(err)) return;
    const code = typeof err === "object" && err && "code" in err ? String((err as { code: string }).code) : "";
    if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") {
      return;
    }
    /* keep shop login on Better Auth; ignore extra firebase failures */
  }
}

export async function firebaseEmailSignUp(email: string, password: string, name: string) {
  if (!isFirebaseConfigured) return;
  const auth = getFirebaseAuth();
  if (!auth) return;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name.trim()) {
      await updateProfile(cred.user, { displayName: name.trim() });
    }
  } catch (err) {
    if (isIgnorableAuthError(err)) return;
    const code = typeof err === "object" && err && "code" in err ? String((err as { code: string }).code) : "";
    if (code === "auth/email-already-in-use") {
      await firebaseEmailSignIn(email, password);
    }
  }
}

export async function firebaseSignOutSafe() {
  if (!isFirebaseConfigured) return;
  const auth = getFirebaseAuth();
  if (!auth) return;
  try {
    await firebaseAuthSignOut(auth);
  } catch {
    /* ignore */
  }
}
