import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseAuthSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { fbEnsureUser } from "@/lib/firebase-data";

export type FirebaseAuthResult = {
  ok: boolean;
  uid?: string;
  email?: string | null;
  error?: string;
  unauthorizedDomain?: boolean;
};

function errCode(err: unknown) {
  return typeof err === "object" && err && "code" in err ? String((err as { code: string }).code) : "";
}

function friendlyAuthError(code: string, fallback: string) {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is incorrect.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Sign in instead.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/operation-not-allowed":
      return "Email/password sign-in is not enabled in Firebase Authentication.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    default:
      return fallback;
  }
}

export function getFirebaseCurrentUser(): User | null {
  if (!isFirebaseConfigured) return null;
  return getFirebaseAuth()?.currentUser ?? null;
}

export function useFirebaseUser(): { user: User | null; isPending: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [isPending, setPending] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setPending(false);
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      setPending(false);
      return;
    }
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setPending(false);
    });
  }, []);

  return { user, isPending };
}

export async function firebaseEmailSignIn(email: string, password: string): Promise<FirebaseAuthResult> {
  if (!isFirebaseConfigured) return { ok: false };
  const auth = getFirebaseAuth();
  if (!auth) return { ok: false };
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    try {
      await fbEnsureUser({
        userId: cred.user.uid,
        email: cred.user.email,
        name: cred.user.displayName,
      });
    } catch {
      /* profile write may wait until rules + admin exist */
    }
    return { ok: true, uid: cred.user.uid, email: cred.user.email };
  } catch (err) {
    const code = errCode(err);
    if (code === "auth/unauthorized-domain") {
      return { ok: false, unauthorizedDomain: true };
    }
    return { ok: false, error: friendlyAuthError(code, "Could not sign in.") };
  }
}

export async function firebaseEmailSignUp(
  email: string,
  password: string,
  name: string,
): Promise<FirebaseAuthResult> {
  if (!isFirebaseConfigured) return { ok: false };
  const auth = getFirebaseAuth();
  if (!auth) return { ok: false };
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name.trim()) {
      await updateProfile(cred.user, { displayName: name.trim() });
    }
    try {
      await fbEnsureUser({
        userId: cred.user.uid,
        email: cred.user.email,
        name: name.trim() || cred.user.displayName,
        role: "customer",
      });
    } catch {
      /* ok — rules may block until the user is signed in */
    }
    return { ok: true, uid: cred.user.uid, email: cred.user.email };
  } catch (err) {
    const code = errCode(err);
    if (code === "auth/unauthorized-domain") {
      return { ok: false, unauthorizedDomain: true };
    }
    if (code === "auth/email-already-in-use") {
      return firebaseEmailSignIn(email, password);
    }
    return { ok: false, error: friendlyAuthError(code, "Could not create account.") };
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
