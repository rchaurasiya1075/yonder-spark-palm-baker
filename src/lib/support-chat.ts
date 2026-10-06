import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

const VISITOR_KEY = "pinaki-support-visitor";

export type ChatFrom = "customer" | "staff";

export type SupportMessage = {
  id: string;
  from: ChatFrom;
  text: string;
  createdAt: number;
};

export type SupportThread = {
  id: string;
  visitorId: string;
  customerName: string;
  phone: string;
  lastMessage: string;
  updatedAt: number;
  unreadStaff: number;
  status: "open" | "closed";
};

export function getVisitorId() {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

export function threadIdFor(visitorId: string) {
  return visitorId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 28);
}

function millis(value: unknown) {
  if (!value) return Date.now();
  if (typeof value === "number") return value;
  if (typeof value === "object" && value && "toMillis" in value) {
    return (value as Timestamp).toMillis();
  }
  return Date.now();
}

export async function ensureThread(input: {
  visitorId: string;
  customerName: string;
  phone?: string;
}) {
  const db = getFirebaseDb();
  if (!db) throw new Error("Chat is not connected.");
  const id = threadIdFor(input.visitorId);
  await setDoc(
    doc(db, "supportThreads", id),
    {
      visitorId: input.visitorId,
      customerName: input.customerName.trim() || "Customer",
      phone: (input.phone ?? "").trim(),
      status: "open",
      lastMessage: "",
      unreadStaff: 0,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return id;
}

export async function sendCustomerMessage(input: {
  visitorId: string;
  customerName: string;
  phone?: string;
  text: string;
}) {
  const text = input.text.trim();
  if (!text) return;
  const db = getFirebaseDb();
  if (!db) throw new Error("Chat is not connected.");
  const id = await ensureThread(input);
  await addDoc(collection(db, "supportThreads", id, "messages"), {
    from: "customer",
    text: text.slice(0, 1000),
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "supportThreads", id), {
    customerName: input.customerName.trim() || "Customer",
    phone: (input.phone ?? "").trim(),
    lastMessage: text.slice(0, 180),
    unreadStaff: 1,
    status: "open",
    updatedAt: serverTimestamp(),
  });
}

export async function sendStaffReply(threadId: string, text: string) {
  const body = text.trim();
  if (!body) return;
  const db = getFirebaseDb();
  if (!db) throw new Error("Chat is not connected.");
  await addDoc(collection(db, "supportThreads", threadId, "messages"), {
    from: "staff",
    text: body.slice(0, 1000),
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "supportThreads", threadId), {
    lastMessage: body.slice(0, 180),
    unreadStaff: 0,
    status: "open",
    updatedAt: serverTimestamp(),
  });
}

export function listenMessages(threadId: string, onChange: (rows: SupportMessage[]) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const q = query(collection(db, "supportThreads", threadId, "messages"), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    onChange(
      snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          from: data.from === "staff" ? "staff" : "customer",
          text: String(data.text ?? ""),
          createdAt: millis(data.createdAt),
        };
      }),
    );
  });
}

export function listenThreads(onChange: (rows: SupportThread[]) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const q = query(collection(db, "supportThreads"), orderBy("updatedAt", "desc"));
  return onSnapshot(q, (snap) => {
    onChange(
      snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          visitorId: String(data.visitorId ?? ""),
          customerName: String(data.customerName ?? "Customer"),
          phone: String(data.phone ?? ""),
          lastMessage: String(data.lastMessage ?? ""),
          updatedAt: millis(data.updatedAt),
          unreadStaff: Number(data.unreadStaff ?? 0),
          status: data.status === "closed" ? "closed" : "open",
        };
      }),
    );
  });
}
