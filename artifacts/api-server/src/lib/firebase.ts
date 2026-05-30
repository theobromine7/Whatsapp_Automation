import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "./logger";

function initFirebase() {
  if (getApps().length > 0) return getApps()[0]!;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    logger.warn("FIREBASE_SERVICE_ACCOUNT_JSON not set — Firestore sync unavailable");
    return null;
  }

  try {
    const serviceAccount = JSON.parse(raw);
    return initializeApp({ credential: cert(serviceAccount) });
  } catch (err) {
    logger.error({ err }, "Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON");
    return null;
  }
}

const app = initFirebase();

export function getDb() {
  if (!app) throw new Error("Firebase not initialised — set FIREBASE_SERVICE_ACCOUNT_JSON");
  return getFirestore(app);
}

export interface FirestoreProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  sale_price?: number;
  category: string;
  image_url?: string;
  product_type?: string;
  units?: number;
  store_id: string;
}

export interface FirestoreStore {
  id: string;
  name: string;
  slug: string;
  upi_id?: string;
  description?: string;
  category?: string;
  location?: string;
  whatsapp?: string;
  delivery_charge?: number;
  terms_and_conditions?: string;
  owner_id: string;
}

export async function fetchStoreByOwner(ownerUid: string): Promise<FirestoreStore | null> {
  const db = getDb();
  const snap = await db.collection("stores").where("owner_id", "==", ownerUid).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0]!;
  return { id: doc.id, ...(doc.data() as Omit<FirestoreStore, "id">) };
}

export async function fetchProductsByStoreId(storeId: string): Promise<FirestoreProduct[]> {
  const db = getDb();
  const snap = await db.collection("products").where("store_id", "==", storeId).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FirestoreProduct, "id">) }));
}
