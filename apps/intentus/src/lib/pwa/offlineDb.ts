// ============================================================
// IndexedDB wrapper for offline data cache + action queue
// ============================================================

const DB_NAME = "intentus-offline";
const DB_VERSION = 2;

export interface OfflineAction {
  id?: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
  timestamp: number;
  retries: number;
  entityType: string; // "lead" | "deal" | "interaction" | "visit"
  entityId?: string;
  description: string;
}

export interface CachedData {
  key: string;
  data: unknown;
  timestamp: number;
  ttl: number; // seconds
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("offline_queue")) {
        const queueStore = db.createObjectStore("offline_queue", {
          keyPath: "id",
          autoIncrement: true,
        });
        queueStore.createIndex("entityType", "entityType", { unique: false });
        queueStore.createIndex("timestamp", "timestamp", { unique: false });
      }

      if (!db.objectStoreNames.contains("cached_data")) {
        const cacheStore = db.createObjectStore("cached_data", { keyPath: "key" });
        cacheStore.createIndex("timestamp", "timestamp", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ── Offline Action Queue ──────────────────────────────────────

export async function enqueueOfflineAction(action: Omit<OfflineAction, "id" | "timestamp" | "retries">): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline_queue", "readwrite");
    const store = tx.objectStore("offline_queue");
    const request = store.add({
      ...action,
      timestamp: Date.now(),
      retries: 0,
    });
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineQueue(): Promise<OfflineAction[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline_queue", "readonly");
    const store = tx.objectStore("offline_queue");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function removeFromQueue(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline_queue", "readwrite");
    const store = tx.objectStore("offline_queue");
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearOfflineQueue(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline_queue", "readwrite");
    const store = tx.objectStore("offline_queue");
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getQueueCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("offline_queue", "readonly");
    const store = tx.objectStore("offline_queue");
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ── Data Cache ────────────────────────────────────────────────

export async function cacheData(key: string, data: unknown, ttlSeconds = 3600): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cached_data", "readwrite");
    const store = tx.objectStore("cached_data");
    const request = store.put({
      key,
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds,
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedData<T = unknown>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cached_data", "readonly");
    const store = tx.objectStore("cached_data");
    const request = store.get(key);
    request.onsuccess = () => {
      const result = request.result as CachedData | undefined;
      if (!result) return resolve(null);

      // Check TTL
      const age = (Date.now() - result.timestamp) / 1000;
      if (age > result.ttl) {
        // Expired — delete and return null
        const delTx = db.transaction("cached_data", "readwrite");
        delTx.objectStore("cached_data").delete(key);
        return resolve(null);
      }

      resolve(result.data as T);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function removeCachedData(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cached_data", "readwrite");
    const store = tx.objectStore("cached_data");
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearExpiredCache(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cached_data", "readwrite");
    const store = tx.objectStore("cached_data");
    const request = store.getAll();
    let cleared = 0;

    request.onsuccess = () => {
      const items = request.result as CachedData[];
      const now = Date.now();

      for (const item of items) {
        const age = (now - item.timestamp) / 1000;
        if (age > item.ttl) {
          store.delete(item.key);
          cleared++;
        }
      }

      resolve(cleared);
    };
    request.onerror = () => reject(request.error);
  });
}
