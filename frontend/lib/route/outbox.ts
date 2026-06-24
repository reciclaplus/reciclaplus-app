import type { Status } from "@/lib/collection-status";

const DB_NAME = "reciclapp-route";
const DB_VERSION = 1;
const OUTBOX_STORE = "pendingMarks";
const CACHE_STORE = "weekCache";

interface PendingMark {
  pdr_id: string;
  status: Status;
  collected_at: string;
  year: number;
  week: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: "pdr_id" });
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const store = db.transaction(storeName, mode).objectStore(storeName);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function enqueueMark(mark: PendingMark): Promise<void> {
  await tx(OUTBOX_STORE, "readwrite", (s) => s.put(mark));
}

export async function getOutbox(): Promise<PendingMark[]> {
  return tx(OUTBOX_STORE, "readonly", (s) => s.getAll());
}

export async function clearOutbox(pdrIds: string[]): Promise<void> {
  const db = await open();
  const store = db.transaction(OUTBOX_STORE, "readwrite").objectStore(OUTBOX_STORE);
  for (const id of pdrIds) {
    store.delete(id);
  }
}

export async function clearAllOutbox(): Promise<void> {
  await tx(OUTBOX_STORE, "readwrite", (s) => s.clear());
}

export async function cacheWeek(year: number, week: number, data: unknown): Promise<void> {
  await tx(CACHE_STORE, "readwrite", (s) =>
    s.put({ key: `${year}-${week}`, data, cachedAt: Date.now() }),
  );
}

export async function getCachedWeek(year: number, week: number): Promise<unknown | null> {
  const result = await tx(CACHE_STORE, "readonly", (s) => s.get(`${year}-${week}`));
  return result?.data ?? null;
}
