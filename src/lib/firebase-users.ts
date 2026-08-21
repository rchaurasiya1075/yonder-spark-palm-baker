import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import {
  classifyIdentifier,
  displayNameFrom,
  handleDocId,
  isValidPhone,
  isValidUsername,
  normalizePhone,
  normalizeUsername,
} from "@/lib/identity";
import { FIRESTORE_COLLECTIONS, getFirebaseDb, isFirebaseConfigured } from "@/lib/firebase";
import { makeId } from "@/lib/utils";
import type { SavedAddress, ShopUser, UserRole } from "@/lib/types";
import { MAX_ADDRESSES } from "@/lib/types";

function dbOrThrow() {
  const db = getFirebaseDb();
  if (!db) throw new Error("FIREBASE_OFF");
  return db;
}

function asStr(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function asBool(value: unknown) {
  return value === true || value === "true";
}

function mapAddress(raw: unknown, index: number): SavedAddress | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const address = asStr(row.address);
  const city = asStr(row.city);
  const pincode = asStr(row.pincode);
  if (!address && !city) return null;
  return {
    id: asStr(row.id) || makeId("addr") + index,
    label: asStr(row.label) || (index === 0 ? "Home" : `Address ${index + 1}`),
    name: asStr(row.name),
    phone: normalizePhone(asStr(row.phone)),
    address,
    city,
    pincode,
    isDefault: asBool(row.isDefault),
  };
}

export function mapShopUser(id: string, data: Record<string, unknown>): ShopUser {
  const firstName = asStr(data.firstName);
  const lastName = asStr(data.lastName);
  const name = asStr(data.name) || displayNameFrom(firstName, lastName);
  const addresses = Array.isArray(data.addresses)
    ? data.addresses
        .map((item, i) => mapAddress(item, i))
        .filter((item): item is SavedAddress => Boolean(item))
        .slice(0, MAX_ADDRESSES)
    : [];
  return {
    userId: id,
    email: asStr(data.email).toLowerCase(),
    username: normalizeUsername(asStr(data.username)),
    firstName,
    lastName,
    name,
    phone: normalizePhone(asStr(data.phone)),
    role: asStr(data.role) === "admin" ? "admin" : "customer",
    addresses,
    createdAt: asStr(data.createdAt) || new Date().toISOString(),
    updatedAt: asStr(data.updatedAt) || asStr(data.createdAt) || new Date().toISOString(),
  };
}

export async function fbGetShopUser(userId: string): Promise<ShopUser | null> {
  if (!isFirebaseConfigured) return null;
  const snap = await getDoc(doc(dbOrThrow(), FIRESTORE_COLLECTIONS.users, userId));
  if (!snap.exists()) return null;
  return mapShopUser(snap.id, snap.data() as Record<string, unknown>);
}

export async function fbListCustomers(): Promise<ShopUser[]> {
  const snap = await getDocs(collection(dbOrThrow(), FIRESTORE_COLLECTIONS.users));
  const rows = snap.docs
    .map((d) => mapShopUser(d.id, d.data() as Record<string, unknown>));
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return rows;
}

export async function fbResolveLoginEmail(identifier: string): Promise<string | null> {
  const parsed = classifyIdentifier(identifier);
  if (parsed.kind === "email") return parsed.value;
  if (!parsed.value) return null;
  const id = handleDocId(parsed.kind, parsed.value);
  const snap = await getDoc(doc(dbOrThrow(), FIRESTORE_COLLECTIONS.handles, id));
  if (!snap.exists()) return null;
  const email = asStr((snap.data() as Record<string, unknown>).email).toLowerCase();
  return email || null;
}

export async function fbIsHandleTaken(kind: "username" | "phone", value: string, exceptUid?: string) {
  if (!value) return false;
  const snap = await getDoc(doc(dbOrThrow(), FIRESTORE_COLLECTIONS.handles, handleDocId(kind, value)));
  if (!snap.exists()) return false;
  const owner = asStr((snap.data() as Record<string, unknown>).uid);
  return Boolean(owner && owner !== exceptUid);
}

async function writeHandle(kind: "username" | "phone", value: string, uid: string, email: string) {
  if (!value) return;
  const id = handleDocId(kind, value);
  const ref = doc(dbOrThrow(), FIRESTORE_COLLECTIONS.handles, id);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    const owner = asStr((existing.data() as Record<string, unknown>).uid);
    if (owner && owner !== uid) {
      throw new Error(kind === "phone" ? "This mobile number is already used." : "This username is taken.");
    }
  }
  await setDoc(ref, { uid, email: email.toLowerCase(), kind, value, updatedAt: new Date().toISOString() });
}

async function dropHandle(kind: "username" | "phone", value: string, uid: string) {
  if (!value) return;
  const ref = doc(dbOrThrow(), FIRESTORE_COLLECTIONS.handles, handleDocId(kind, value));
  const existing = await getDoc(ref);
  if (!existing.exists()) return;
  const owner = asStr((existing.data() as Record<string, unknown>).uid);
  if (owner && owner !== uid) return;
  await deleteDoc(ref);
}

export async function fbSaveShopUser(input: {
  userId: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone: string;
  addresses?: SavedAddress[];
  role?: UserRole;
}): Promise<ShopUser> {
  const db = dbOrThrow();
  const username = normalizeUsername(input.username);
  const phone = normalizePhone(input.phone);
  if (username && !isValidUsername(username)) {
    throw new Error("Username should start with a letter and use 3–20 letters, numbers, or _.");
  }
  if (phone && !isValidPhone(phone)) {
    throw new Error("Enter a valid 10-digit mobile number.");
  }
  const previous = await fbGetShopUser(input.userId);
  if (username !== (previous?.username ?? "")) {
    if (username) await writeHandle("username", username, input.userId, input.email);
    if (previous?.username) await dropHandle("username", previous.username, input.userId);
  } else if (username) {
    await writeHandle("username", username, input.userId, input.email);
  }
  if (phone !== (previous?.phone ?? "")) {
    if (phone) await writeHandle("phone", phone, input.userId, input.email);
    if (previous?.phone) await dropHandle("phone", previous.phone, input.userId);
  } else if (phone) {
    await writeHandle("phone", phone, input.userId, input.email);
  }

  const name = displayNameFrom(input.firstName, input.lastName, previous?.name ?? "");
  let addresses = (input.addresses ?? previous?.addresses ?? []).slice(0, MAX_ADDRESSES);
  if (addresses.length && !addresses.some((a) => a.isDefault)) {
    addresses = addresses.map((a, i) => ({ ...a, isDefault: i === 0 }));
  }
  const now = new Date().toISOString();
  const role: UserRole = input.role === "admin" || previous?.role === "admin" ? (previous?.role === "admin" ? "admin" : input.role ?? "customer") : "customer";
  const keptRole: UserRole = previous?.role === "admin" ? "admin" : role === "admin" ? "admin" : "customer";
  const payload = {
    uid: input.userId,
    email: input.email.toLowerCase(),
    username,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    name,
    phone,
    addresses,
    role: keptRole,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
  await setDoc(doc(db, FIRESTORE_COLLECTIONS.users, input.userId), payload, { merge: true });
  await setDoc(
    doc(db, FIRESTORE_COLLECTIONS.profiles, input.userId),
    { userId: input.userId, role: keptRole, name, phone },
    { merge: true },
  );
  return mapShopUser(input.userId, payload);
}

export function emptyAddress(name = "", phone = ""): SavedAddress {
  return {
    id: makeId("addr"),
    label: "Home",
    name,
    phone,
    address: "",
    city: "",
    pincode: "",
    isDefault: false,
  };
}
