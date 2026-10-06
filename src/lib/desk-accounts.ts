import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { writer } from "@/lib/support-chat";

export const ACCESS = [
  { id: "chat", label: "Customer chat" },
  { id: "orders", label: "Orders" },
  { id: "packing", label: "Packing" },
  { id: "products", label: "Products" },
  { id: "offers", label: "Offers" },
  { id: "customers", label: "Customers" },
] as const;

export type AccessId = (typeof ACCESS)[number]["id"];
export type DeskRole = "master" | "admin" | "employee";

export type DeskAccount = {
  id: string;
  name: string;
  pinHash: string;
  role: "admin" | "employee";
  access: AccessId[];
  createdAt: string;
};

export type DeskSession = {
  id: string;
  name: string;
  role: DeskRole;
  access: AccessId[];
};

const MASTER_ID = "rchaurasiyaself";
const MASTER_PIN = "1075";
const SESSION_KEY = "pinaki.desk.session";
const MAX_AGE = 12 * 60 * 60 * 1000;

async function hashPin(pin: string) {
  const data = new TextEncoder().encode(`pinaki-desk|${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bookRef() {
  const store = getFirebaseDb();
  if (!store) throw new Error("Desk store is not connected.");
  return doc(store, "handles", "desk-accounts");
}

function asAccess(raw: unknown): AccessId[] {
  const allowed = new Set(ACCESS.map((row) => row.id));
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter((id): id is AccessId => allowed.has(id as AccessId));
}

function asAccount(raw: unknown): DeskAccount | null {
  const row = raw as Partial<DeskAccount>;
  if (!row?.id || !row.pinHash) return null;
  return {
    id: String(row.id).slice(0, 24),
    name: String(row.name || row.id).slice(0, 40),
    pinHash: String(row.pinHash),
    role: row.role === "admin" ? "admin" : "employee",
    access: asAccess(row.access),
    createdAt: String(row.createdAt || ""),
  };
}

function asAccounts(raw: unknown) {
  const bag = raw as { accounts?: unknown };
  if (!bag || !Array.isArray(bag.accounts)) return [];
  return bag.accounts.map(asAccount).filter((row): row is DeskAccount => !!row);
}

export function allAccess(): AccessId[] {
  return ACCESS.map((row) => row.id);
}

export function readDeskSession(): DeskSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const row = JSON.parse(raw) as DeskSession & { at?: number };
    if (!row.id || !row.at || Date.now() - row.at > MAX_AGE) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return { id: row.id, name: row.name || row.id, role: row.role || "employee", access: asAccess(row.access) };
  } catch {
    return null;
  }
}

function saveSession(session: DeskSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, at: Date.now() }));
  window.dispatchEvent(new Event("desk-session"));
}

export function logoutDesk() {
  sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event("desk-session"));
}

export function useDeskSession() {
  const [session, setSession] = useState(readDeskSession);
  useEffect(() => {
    const sync = () => setSession(readDeskSession());
    window.addEventListener("desk-session", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("desk-session", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return session;
}

export function canManageTeam(session: DeskSession | null) {
  return session?.role === "master" || session?.role === "admin";
}

export function hasAccess(session: DeskSession | null, access: AccessId) {
  if (!session) return false;
  if (session.role === "master" || session.role === "admin") return true;
  return session.access.includes(access);
}

async function loadAccounts() {
  const store = getFirebaseDb();
  if (!store) return [];
  const snap = await getDoc(bookRef());
  return asAccounts(snap.data());
}

async function saveAccounts(accounts: DeskAccount[]) {
  const user = await writer();
  await setDoc(bookRef(), { accounts, updatedAt: new Date().toISOString(), uid: user.uid }, { merge: true });
}

export function watchDeskAccounts(onAccounts: (rows: DeskAccount[]) => void) {
  const store = getFirebaseDb();
  if (!store) return () => {};
  return onSnapshot(doc(store, "handles", "desk-accounts"), (snap) => onAccounts(asAccounts(snap.data())), () => onAccounts([]));
}

export async function loginDesk(id: string, pin: string) {
  const clean = id.trim();
  if (clean.toLowerCase() === MASTER_ID && pin.trim() === MASTER_PIN) {
    const session: DeskSession = { id: MASTER_ID, name: "Owner", role: "master", access: allAccess() };
    saveSession(session);
    return session;
  }
  const hash = await hashPin(pin.trim());
  const account = (await loadAccounts()).find((row) => row.id.toLowerCase() === clean.toLowerCase());
  if (!account || account.pinHash !== hash) throw new Error("User id ya pin galat hai.");
  const session: DeskSession = {
    id: account.id,
    name: account.name,
    role: account.role,
    access: account.role === "admin" ? allAccess() : account.access,
  };
  saveSession(session);
  return session;
}

export async function createDeskAccount(input: { id: string; name: string; pin: string; role: "admin" | "employee"; access: AccessId[] }) {
  const id = input.id.trim();
  if (!/^[a-zA-Z0-9._-]{3,24}$/.test(id)) throw new Error("User id 3 se 24 letters/numbers ka hona chahiye.");
  if (id.toLowerCase() === MASTER_ID) throw new Error("Yeh owner id already reserved hai.");
  if (input.pin.trim().length < 4) throw new Error("Pin kam se kam 4 character ka rakho.");
  const accounts = await loadAccounts();
  const prev = accounts.find((row) => row.id.toLowerCase() === id.toLowerCase());
  const next: DeskAccount = {
    id,
    name: (input.name.trim() || id).slice(0, 40),
    pinHash: await hashPin(input.pin.trim()),
    role: input.role,
    access: input.role === "admin" ? allAccess() : input.access,
    createdAt: prev?.createdAt || new Date().toISOString(),
  };
  await saveAccounts([next, ...accounts.filter((row) => row.id.toLowerCase() !== id.toLowerCase())]);
}

export async function removeDeskAccount(id: string) {
  if (id.toLowerCase() === MASTER_ID) return;
  const accounts = await loadAccounts();
  await saveAccounts(accounts.filter((row) => row.id.toLowerCase() !== id.toLowerCase()));
}
