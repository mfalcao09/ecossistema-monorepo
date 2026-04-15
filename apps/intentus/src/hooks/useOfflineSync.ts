import { useState, useEffect, useCallback, useRef } from "react";
import {
  enqueueOfflineAction,
  getOfflineQueue,
  removeFromQueue,
  getQueueCount,
  clearOfflineQueue,
  cacheData,
  getCachedData,
  clearExpiredCache,
  type OfflineAction,
} from "@/lib/pwa/offlineDb";

export interface OfflineSyncStatus {
  isOnline: boolean;
  queueCount: number;
  isSyncing: boolean;
  lastSyncAt: number | null;
  syncErrors: string[];
}

export function useOfflineSync() {
  const [status, setStatus] = useState<OfflineSyncStatus>({
    isOnline: navigator.onLine,
    queueCount: 0,
    isSyncing: false,
    lastSyncAt: null,
    syncErrors: [],
  });
  const syncingRef = useRef(false);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setStatus((s) => ({ ...s, isOnline: true }));
      // Auto-sync when coming back online
      processQueue();
    };
    const handleOffline = () => {
      setStatus((s) => ({ ...s, isOnline: false }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial queue count
    refreshQueueCount();

    // Clean expired cache periodically
    clearExpiredCache().catch(() => {});

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const refreshQueueCount = useCallback(async () => {
    try {
      const count = await getQueueCount();
      setStatus((s) => ({ ...s, queueCount: count }));
    } catch {
      // IndexedDB not available
    }
  }, []);

  // Enqueue an action for offline processing
  const enqueue = useCallback(
    async (
      action: Omit<OfflineAction, "id" | "timestamp" | "retries">
    ): Promise<number> => {
      const id = await enqueueOfflineAction(action);
      await refreshQueueCount();

      // Try to register background sync
      if ("serviceWorker" in navigator && "SyncManager" in window) {
        try {
          const reg = await navigator.serviceWorker.ready;
          await (reg as any).sync.register("intentus-offline-sync");
        } catch {
          // Background Sync not supported — will sync on next online event
        }
      }

      return id;
    },
    [refreshQueueCount]
  );

  // Process the offline queue (called when back online)
  const processQueue = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setStatus((s) => ({ ...s, isSyncing: true, syncErrors: [] }));

    const errors: string[] = [];

    try {
      const queue = await getOfflineQueue();

      for (const item of queue) {
        try {
          const response = await fetch(item.url, {
            method: item.method,
            headers: {
              "Content-Type": "application/json",
              ...item.headers,
            },
            body: item.body ? JSON.stringify(item.body) : undefined,
          });

          if (response.ok || response.status === 409) {
            // 409 = conflict (already processed), treat as success
            await removeFromQueue(item.id!);
          } else if (response.status >= 500) {
            // Server error — keep in queue for retry
            errors.push(`${item.description}: server error ${response.status}`);
          } else {
            // Client error (4xx) — remove from queue (won't succeed on retry)
            await removeFromQueue(item.id!);
            errors.push(`${item.description}: ${response.status}`);
          }
        } catch (err) {
          errors.push(`${item.description}: network error`);
        }
      }

      await refreshQueueCount();
      setStatus((s) => ({
        ...s,
        isSyncing: false,
        lastSyncAt: Date.now(),
        syncErrors: errors,
      }));
    } catch (err) {
      setStatus((s) => ({
        ...s,
        isSyncing: false,
        syncErrors: [...errors, `Queue error: ${err}`],
      }));
    } finally {
      syncingRef.current = false;
    }
  }, [refreshQueueCount]);

  // Cache data for offline use
  const cache = useCallback(async (key: string, data: unknown, ttlSeconds = 3600) => {
    await cacheData(key, data, ttlSeconds);
  }, []);

  // Get cached data
  const getCache = useCallback(async <T = unknown>(key: string): Promise<T | null> => {
    return getCachedData<T>(key);
  }, []);

  // Clear entire queue
  const clearQueue = useCallback(async () => {
    await clearOfflineQueue();
    await refreshQueueCount();
  }, [refreshQueueCount]);

  return {
    ...status,
    enqueue,
    processQueue,
    cache,
    getCache,
    clearQueue,
    refreshQueueCount,
  };
}

// ── Helper: Offline-aware fetch wrapper ──
export async function offlineFetch(
  url: string,
  options: RequestInit & {
    entityType: string;
    entityId?: string;
    description: string;
    offlineQueue?: ReturnType<typeof useOfflineSync>;
  }
): Promise<Response> {
  const { entityType, entityId, description, offlineQueue, ...fetchOptions } = options;

  try {
    const response = await fetch(url, fetchOptions);
    return response;
  } catch (err) {
    // Network error — queue for later if offline
    if (!navigator.onLine && offlineQueue) {
      await offlineQueue.enqueue({
        url,
        method: fetchOptions.method || "POST",
        headers: (fetchOptions.headers as Record<string, string>) || {},
        body: fetchOptions.body ? JSON.parse(fetchOptions.body as string) : undefined,
        entityType,
        entityId,
        description,
      });

      // Return a fake "queued" response
      return new Response(JSON.stringify({ queued: true, offline: true }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      });
    }

    throw err;
  }
}
