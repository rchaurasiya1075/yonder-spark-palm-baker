import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseAuthSignOut,
  updatePassword,
  updateProfile,
  type User,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { fbEnsureUser } from "@/lib/firebase-data";
import { fbIsHandleTaken, fbResolveLoginEmail, fbSaveShopUser } from "@/lib/firebase-users";
import { displayNameFrom, isValidEmail, isValidPhone, isValidUsername, normalizePhone, normalizeUsername } from "@/lib/identity";

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
      return "Email, username, mobile, or password is incorrect.";
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
    case "auth/requires-recent-login":
      return "Please enter your current password again.";
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
    const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
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

export async function firebaseIdentifierSignIn(
  identifier: string,
  password: string,
): Promise<FirebaseAuthResult> {
  const raw = identifier.trim();
  if (!raw) return { ok: false, error: "Enter your email, username, or mobile." };
  let email = raw;
  if (!isValidEmail(raw)) {
    try {
      const resolved = await fbResolveLoginEmail(raw);
      if (!resolved) {
        return { ok: false, error: "No account found for this username or mobile number." };
      }
      email = resolved;
    } catch {
      return { ok: false, error: "Could not look up this username or mobile." };
    }
  }
  return firebaseEmailSignIn(email, password);
}

export async function firebaseEmailSignUp(
  email: string,
  password: string,
  name: string,
  extra?: { firstName?: string; lastName?: string; username?: string; phone?: string; role?: "admin" | "customer" },
): Promise<FirebaseAuthResult> {
  if (!isFirebaseConfigured) return { ok: false };
  const auth = getFirebaseAuth();
  if (!auth) return { ok: false };
  const firstName = extra?.firstName?.trim() || name.trim().split(/\s+/)[0] || "";
  const lastName = extra?.lastName?.trim() || name.trim().split(/\s+/).slice(1).join(" ");
  const username = extra?.username ? normalizeUsername(extra.username) : "";
  const phone = extra?.phone ? normalizePhone(extra.phone) : "";
  if (username && !isValidUsername(username)) {
    return { ok: false, error: "Username should start with a letter and use 3–20 letters, numbers, or _." };
  }
  if (phone && !isValidPhone(phone)) {
    return { ok: false, error: "Enter a valid 10-digit mobile number." };
  }
  try {
    if (username && (await fbIsHandleTaken("username", username))) {
      return { ok: false, error: "This username is taken." };
    }
    if (phone && (await fbIsHandleTaken("phone", phone))) {
      return { ok: false, error: "This mobile number is already used." };
    }
    const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    const display = displayNameFrom(firstName, lastName, name);
    const role = extra?.role === "admin" ? "admin" : "customer";
    if (display) {
      await updateProfile(cred.user, { displayName: display });
    }
    try {
      await fbEnsureUser({
        userId: cred.user.uid,
        email: cred.user.email,
        name: display,
        phone,
        firstName,
        lastName,
        username,
        role,
      });
      if (cred.user.email) {
        await fbSaveShopUser({
          userId: cred.user.uid,
          email: cred.user.email,
          username,
          firstName,
          lastName,
          phone,
          addresses: [],
          role,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("username") || message.includes("mobile")) {
        return { ok: false, error: message };
      }
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

export async function firebaseSendReset(identifier: string): Promise<FirebaseAuthResult> {
  if (!isFirebaseConfigured) return { ok: false, error: "Reset is not available." };
  const auth = getFirebaseAuth();
  if (!auth) return { ok: false, error: "Reset is not available." };
  const raw = identifier.trim();
  if (!raw) return { ok: false, error: "Enter your email, username, or mobile." };
  let email = raw;
  if (!isValidEmail(raw)) {
    const resolved = await fbResolveLoginEmail(raw);
    if (!resolved) return { ok: false, error: "No account found for this username or mobile number." };
    email = resolved;
  }
  try {
    await sendPasswordResetEmail(auth, email.toLowerCase());
    return { ok: true, email };
  } catch (err) {
    const code = errCode(err);
    if (code === "auth/unauthorized-domain") return { ok: false, unauthorizedDomain: true };
    return { ok: false, error: friendlyAuthError(code, "Could not send reset email.") };
  }
}

export async function firebaseChangePassword(currentPassword: string, nextPassword: string): Promise<FirebaseAuthResult> {
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;
  if (!auth || !user?.email) return { ok: false, error: "Please sign in again." };
  if (nextPassword.length < 8) return { ok: false, error: "New password should be at least 8 characters." };
  try {
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, nextPassword);
    return { ok: true, email: user.email };
  } catch (err) {
    return { ok: false, error: friendlyAuthError(errCode(err), "Could not update password.") };
  }
}

export async function firebaseUpdateDisplayName(name: string) {
  const user = getFirebaseCurrentUser();
  if (!user || !name.trim()) return;
  await updateProfile(user, { displayName: name.trim() });
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
