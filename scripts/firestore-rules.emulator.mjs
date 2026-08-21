/**
 * PINAKI Farms Firestore rules — run via Firebase emulator, not the shop preview.
 *   npx firebase-tools emulators:exec --only firestore --project pinaki-rules-test "node --test scripts/firestore-rules.emulator.mjs"
 */
import { readFileSync } from "node:fs";
import { after, before, beforeEach, test } from "node:test";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const PROJECT_ID = "pinaki-rules-test";
const OWNER_EMAIL = "grokaia94@gmail.com";
const OWNER_UID = "owner-uid";
const CUST_UID = "cust-uid";
const CUST_EMAIL = "buyer@gmail.com";
const OTHER_UID = "other-uid";
const OTHER_EMAIL = "other@gmail.com";

const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");

/** @type {import('@firebase/rules-unit-testing').RulesTestEnvironment} */
let env;

function guest() {
  return env.unauthenticatedContext().firestore();
}

function asUser(uid, email) {
  return env.authenticatedContext(uid, { email, email_verified: true }).firestore();
}

function owner() {
  return asUser(OWNER_UID, OWNER_EMAIL);
}

function customer() {
  return asUser(CUST_UID, CUST_EMAIL);
}

function other() {
  return asUser(OTHER_UID, OTHER_EMAIL);
}

const product = {
  name: "Aam ka Achar",
  price: 249,
  stock: 10,
  active: true,
  slug: "aam-ka-achar",
};

const placedOrder = (userId, email) => ({
  userId,
  email,
  customerName: "Ravi",
  status: "placed",
  orderStatus: "placed",
  total: 249,
  items: [{ id: "p1", name: "Aam ka Achar", quantity: 1, price: 249 }],
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules, host: "127.0.0.1", port: 8082 },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "products", "p1"), product);
    await setDoc(doc(db, "coupons", "PINAKI10"), {
      code: "PINAKI10",
      type: "percent",
      value: 10,
      active: true,
    });
    await setDoc(doc(db, "orders", "ord-cust"), placedOrder(CUST_UID, CUST_EMAIL));
    await setDoc(doc(db, "orders", "ord-other"), placedOrder(OTHER_UID, OTHER_EMAIL));
    await setDoc(doc(db, "users", CUST_UID), {
      uid: CUST_UID,
      email: CUST_EMAIL,
      role: "customer",
    });
    await setDoc(doc(db, "users", OTHER_UID), {
      uid: OTHER_UID,
      email: OTHER_EMAIL,
      role: "customer",
    });
    await setDoc(doc(db, "profiles", CUST_UID), { role: "customer", userId: CUST_UID });
    await setDoc(doc(db, "handles", "u_ravi"), { uid: CUST_UID, email: CUST_EMAIL });
    await setDoc(doc(db, "handles", "p_9876543210"), { uid: OTHER_UID, email: OTHER_EMAIL });
  });
});

after(async () => {
  await env?.cleanup();
});

test("guest can read catalog and coupons", async () => {
  await assertSucceeds(getDoc(doc(guest(), "products", "p1")));
  await assertSucceeds(getDoc(doc(guest(), "coupons", "PINAKI10")));
});

test("guest cannot write catalog, coupons, or orders", async () => {
  await assertFails(setDoc(doc(guest(), "products", "p2"), product));
  await assertFails(updateDoc(doc(guest(), "products", "p1"), { stock: 1 }));
  await assertFails(setDoc(doc(guest(), "coupons", "X"), { code: "X", active: true }));
  await assertFails(setDoc(doc(guest(), "orders", "ord-new"), placedOrder(CUST_UID, CUST_EMAIL)));
});

test("guest can look up one login handle but cannot list all handles", async () => {
  await assertSucceeds(getDoc(doc(guest(), "handles", "u_ravi")));
  await assertFails(getDocs(collection(guest(), "handles")));
});

test("guest cannot read orders or user profiles", async () => {
  await assertFails(getDoc(doc(guest(), "orders", "ord-cust")));
  await assertFails(getDocs(collection(guest(), "orders")));
  await assertFails(getDoc(doc(guest(), "users", CUST_UID)));
  await assertFails(getDoc(doc(guest(), "profiles", CUST_UID)));
});

test("customer can place their own order", async () => {
  await assertSucceeds(
    setDoc(doc(customer(), "orders", "ord-mine"), placedOrder(CUST_UID, CUST_EMAIL)),
  );
});

test("customer cannot place an order as someone else", async () => {
  await assertFails(
    setDoc(doc(customer(), "orders", "ord-steal"), placedOrder(OTHER_UID, OTHER_EMAIL)),
  );
});

test("customer cannot create an order as delivered", async () => {
  await assertFails(
    setDoc(doc(customer(), "orders", "ord-fake"), {
      ...placedOrder(CUST_UID, CUST_EMAIL),
      status: "delivered",
      orderStatus: "delivered",
    }),
  );
});

test("customer can read own order, not another customer's", async () => {
  await assertSucceeds(getDoc(doc(customer(), "orders", "ord-cust")));
  await assertFails(getDoc(doc(customer(), "orders", "ord-other")));
  await assertFails(getDocs(collection(customer(), "orders")));
});

test("customer cannot change order status or delete orders", async () => {
  await assertFails(updateDoc(doc(customer(), "orders", "ord-cust"), { orderStatus: "delivered" }));
  await assertFails(deleteDoc(doc(customer(), "orders", "ord-cust")));
});

test("customer cannot change product stock or add products", async () => {
  await assertFails(updateDoc(doc(customer(), "products", "p1"), { stock: 9 }));
  await assertFails(setDoc(doc(customer(), "products", "p2"), product));
  await assertFails(deleteDoc(doc(customer(), "products", "p1")));
});

test("customer can create their own customer profile, not an admin profile", async () => {
  const uid = "new-cust";
  const db = asUser(uid, "new@gmail.com");
  await assertSucceeds(
    setDoc(doc(db, "users", uid), { uid, email: "new@gmail.com", role: "customer" }),
  );
  const uid2 = "fake-admin";
  const db2 = asUser(uid2, "fake@gmail.com");
  await assertFails(
    setDoc(doc(db2, "users", uid2), { uid: uid2, email: "fake@gmail.com", role: "admin" }),
  );
  await assertFails(
    setDoc(doc(db2, "profiles", uid2), { userId: uid2, role: "admin" }),
  );
});

test("customer cannot promote themselves to admin", async () => {
  await assertFails(updateDoc(doc(customer(), "users", CUST_UID), { role: "admin" }));
  await assertFails(updateDoc(doc(customer(), "profiles", CUST_UID), { role: "admin" }));
});

test("customer can update their own profile without changing role", async () => {
  await assertSucceeds(updateDoc(doc(customer(), "users", CUST_UID), { name: "Ravi", role: "customer" }));
});

test("customer cannot list all shop users", async () => {
  await assertFails(getDocs(collection(customer(), "users")));
});

test("owner Gmail can manage catalog, coupons, and orders", async () => {
  await assertSucceeds(setDoc(doc(owner(), "products", "p2"), product));
  await assertSucceeds(updateDoc(doc(owner(), "products", "p1"), { stock: 8 }));
  await assertSucceeds(setDoc(doc(owner(), "coupons", "WELCOME50"), { code: "WELCOME50", active: true }));
  await assertSucceeds(updateDoc(doc(owner(), "orders", "ord-cust"), { orderStatus: "confirmed" }));
  await assertSucceeds(getDocs(collection(owner(), "orders")));
  await assertSucceeds(getDocs(collection(owner(), "users")));
  await assertSucceeds(getDocs(collection(owner(), "handles")));
});

test("owner Gmail can create an admin profile for themselves", async () => {
  await assertSucceeds(
    setDoc(doc(owner(), "users", OWNER_UID), {
      uid: OWNER_UID,
      email: OWNER_EMAIL,
      role: "admin",
    }),
  );
  await assertSucceeds(
    setDoc(doc(owner(), "profiles", OWNER_UID), { userId: OWNER_UID, role: "admin" }),
  );
});

test("signed-in user can create a login handle for themselves only", async () => {
  await assertSucceeds(
    setDoc(doc(customer(), "handles", "u_custshop"), { uid: CUST_UID, email: CUST_EMAIL }),
  );
  await assertFails(
    setDoc(doc(customer(), "handles", "u_stolen"), { uid: OTHER_UID, email: OTHER_EMAIL }),
  );
});

test("role=admin in Firestore also unlocks the desk", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "users", "staff-uid"), {
      uid: "staff-uid",
      email: "staff@gmail.com",
      role: "admin",
    });
    await setDoc(doc(ctx.firestore(), "profiles", "staff-uid"), {
      userId: "staff-uid",
      role: "admin",
    });
  });
  const staff = asUser("staff-uid", "staff@gmail.com");
  await assertSucceeds(updateDoc(doc(staff, "products", "p1"), { stock: 5 }));
  await assertSucceeds(getDocs(collection(staff, "orders")));
});

test("employee staff can pack orders and list products, not coupons or customers", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "users", "emp-uid"), {
      uid: "emp-uid",
      email: "emp@gmail.com",
      role: "staff",
    });
    await setDoc(doc(ctx.firestore(), "profiles", "emp-uid"), {
      userId: "emp-uid",
      role: "staff",
    });
  });
  const emp = asUser("emp-uid", "emp@gmail.com");
  await assertSucceeds(getDocs(collection(emp, "products")));
  await assertSucceeds(updateDoc(doc(emp, "products", "p1"), { stock: 4 }));
  await assertSucceeds(updateDoc(doc(emp, "orders", "ord-cust"), { orderStatus: "packed" }));
  await assertSucceeds(getDocs(collection(emp, "orders")));
  await assertFails(setDoc(doc(emp, "coupons", "X"), { code: "X", active: true }));
  await assertFails(getDocs(collection(emp, "users")));
  await assertFails(setDoc(doc(emp, "categories", "honey"), { label: "Honey", active: true }));
});

test("owner can add a pantry category; guest can read it", async () => {
  await assertSucceeds(
    setDoc(doc(owner(), "categories", "honey"), { label: "Honey", hindi: "शहद", active: true, sort: 4 }),
  );
  await assertSucceeds(getDoc(doc(guest(), "categories", "honey")));
  await assertFails(
    setDoc(doc(customer(), "categories", "papad"), { label: "Papad", active: true }),
  );
});
