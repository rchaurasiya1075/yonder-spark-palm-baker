import { deleteApp, getApp, initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, signOut, updateProfile } from "firebase/auth";
import { firebaseConfig, getFirebaseApp, isFirebaseConfigured } from "@/lib/firebase";
import { fbEnsureUser } from "@/lib/firebase-data";
import { fbSaveShopUser } from "@/lib/firebase-users";
import { getFirebaseCurrentUser } from "@/lib/firebase-auth";
import { isValidEmail } from "@/lib/identity";

const WORKER = "pinaki-staff-create";

export async function fbCreateStaffAccount(input: {
  name: string;
  email: string;
  password: string;
}) {
  if (!isFirebaseConfigured) throw new Error("Firebase is not connected.");
  const owner = getFirebaseCurrentUser();
  if (!owner) throw new Error("Sign in as the shop owner first.");
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!name) throw new Error("Enter the employee's name.");
  if (!isValidEmail(email)) throw new Error("Enter a valid Gmail / email.");
  if (input.password.length < 8) throw new Error("Password should be at least 8 characters.");

  getFirebaseApp();
  let worker;
  try {
    worker = getApp(WORKER);
  } catch {
    worker = initializeApp(firebaseConfig, WORKER);
  }
  const auth = getAuth(worker);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, input.password);
    if (name) await updateProfile(cred.user, { displayName: name });
    const uid = cred.user.uid;
    await signOut(auth);
    const firstName = name.split(/\s+/)[0] ?? name;
    const lastName = name.split(/\s+/).slice(1).join(" ");
    await fbEnsureUser({
      userId: uid,
      email,
      name,
      firstName,
      lastName,
      role: "staff",
    });
    await fbSaveShopUser({
      userId: uid,
      email,
      username: "",
      firstName,
      lastName,
      phone: "",
      addresses: [],
      role: "staff",
    });
    return { uid, email };
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? String((err as { code: string }).code) : "";
    if (code === "auth/email-already-in-use") {
      throw new Error("That email already has an account. Give them the staff login link instead.");
    }
    if (err instanceof Error && err.message) throw err;
    throw new Error("Could not create the employee account.");
  } finally {
    try {
      await deleteApp(worker);
    } catch {
      /* reused next time */
    }
  }
}
