import type { Status } from "@/lib/collection-status";

const DB_NAME = "reciclapp-route";
/** v2: marks record their town and week caches are keyed by town. */
const DB_VERSION = 2;
const OUTBOX_STORE = "pendingMarks";
const CACHE_STORE = "weekCache";

export interface PendingMark {
  pdr_id: string;
  status: Status;
  collected_at: string;
  year: number;
  week: number;
  /** Missing on marks queued before towns existed: those belong to the user's
   * only town at the time, so they're sent to the current town. */
  town_id?: string;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: "pdr_id" });
      }
      // Week caches from v1 aren't keyed by town, so drop them: they're only a
      // copy of server data. Queued marks are kept, since they may be unsaved.
      if (event.oldVersion < 2 && db.objectStoreNames.contains(CACHE_STORE)) {
        db.deleteObjectStore(CACHE_STORE);
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

export async function enqueueMark(mark: PendingMark & { town_id: string }): Promise<void> {
  await tx(OUTBOX_STORE, "readwrite", (s) => s.put(mark));
}

export async function getOutbox(): Promise<PendingMark[]> {
  return tx(OUTBOX_STORE, "readonly", (s) => s.getAll());
}

/** Remove the given marks once they've been saved. */
export async function clearOutbox(pdrIds: string[]): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(OUTBOX_STORE, "readwrite");
    const store = transaction.objectStore(OUTBOX_STORE);
    for (const id of pdrIds) {
      store.delete(id);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/** A batch of marks that can be saved with one request. */
export interface MarkGroup {
  townId: string;
  year: number;
  week: number;
  marks: PendingMark[];
}

/**
 * Group marks by town and week, so each is saved to its own week even if the
 * user has since moved on to another week or town. Marks without a town go to
 * `currentTownId`.
 */
export function groupMarks(marks: PendingMark[], currentTownId: string): MarkGroup[] {
  const groups = new Map<string, MarkGroup>();
  for (const mark of marks) {
    const townId = mark.town_id ?? currentTownId;
    const key = `${townId}|${mark.year}|${mark.week}`;
    const group = groups.get(key) ?? { townId, year: mark.year, week: mark.week, marks: [] };
    group.marks.push(mark);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** This town's marks (including any queued before towns existed). */
export function marksForTown(marks: PendingMark[], townId: string): PendingMark[] {
  return marks.filter((m) => (m.town_id ?? townId) === townId);
}

function cacheKey(townId: string, year: number, week: number): string {
  return `${townId}-${year}-${week}`;
}

export async function cacheWeek(townId: string, year: number, week: number, data: unknown): Promise<void> {
  await tx(CACHE_STORE, "readwrite", (s) =>
    s.put({ key: cacheKey(townId, year, week), data, cachedAt: Date.now() }),
  );
}

export async function getCachedWeek(townId: string, year: number, week: number): Promise<unknown | null> {
  const result = await tx(CACHE_STORE, "readonly", (s) => s.get(cacheKey(townId, year, week)));
  return result?.data ?? null;
}
