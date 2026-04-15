// ============================================================
// Intentus Real Estate — Service Worker v1
// App Shell + Runtime Cache + Push + Offline Sync
// ============================================================

const CACHE_VERSION = "intentus-v1";
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const OFFLINE_QUEUE_KEY = "intentus-offline-queue";

// Assets to pre-cache (app shell)
const APP_SHELL = [
  "/",
  "/offline.html",
  "/manifest.json",
  "/favicon.ico",
];

// ==================== INSTALL ====================
self.addEventListener("install", (event) => {
  console.log("[SW] Install v1");
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ==================== ACTIVATE ====================
self.addEventListener("activate", (event) => {
  console.log("[SW] Activate v1");
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ==================== FETCH ====================
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // Skip Supabase API calls and Edge Functions
  if (url.pathname.startsWith("/functions/") || url.pathname.startsWith("/rest/") || url.pathname.startsWith("/auth/")) {
    return;
  }

  // Navigation requests → Network-first, fallback to cache, then offline page
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/offline.html"))
        )
    );
    return;
  }

  // JS/CSS bundles → Stale-while-revalidate
  if (url.pathname.match(/\.(js|css)$/) || url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
    );
    return;
  }

  // Images → Cache-first
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico)$/)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  // Fonts → Cache-first with long TTL
  if (url.pathname.match(/\.(woff2?|ttf|otf|eot)$/)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }
});

// ==================== PUSH NOTIFICATIONS ====================
self.addEventListener("push", (event) => {
  console.log("[SW] Push received");

  let data = {
    title: "Intentus Real Estate",
    body: "Você tem uma nova notificação",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    tag: "intentus-default",
    data: { url: "/" },
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        tag: payload.tag || `intentus-${Date.now()}`,
        data: {
          url: payload.url || payload.data?.url || "/",
          notificationId: payload.notificationId || null,
        },
        actions: payload.actions || [],
        requireInteraction: payload.priority === "high" || payload.priority === "urgent",
        vibrate: payload.priority === "urgent" ? [200, 100, 200, 100, 200] : [200, 100, 200],
      };
    }
  } catch (e) {
    console.warn("[SW] Push parse error:", e);
    if (event.data) {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      data: data.data,
      actions: data.actions || [],
      requireInteraction: data.requireInteraction || false,
      vibrate: data.vibrate || [200, 100, 200],
    })
  );
});

// ==================== NOTIFICATION CLICK ====================
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event.notification.tag);
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Try to focus existing window
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.postMessage({
            type: "NOTIFICATION_CLICK",
            url,
            notificationId: event.notification.data?.notificationId,
          });
          return;
        }
      }
      // Open new window
      return self.clients.openWindow(url);
    })
  );
});

// ==================== BACKGROUND SYNC ====================
self.addEventListener("sync", (event) => {
  console.log("[SW] Sync event:", event.tag);

  if (event.tag === "intentus-offline-sync") {
    event.waitUntil(processOfflineQueue());
  }
});

async function processOfflineQueue() {
  try {
    // Read queue from IndexedDB
    const db = await openDB();
    const tx = db.transaction("offline_queue", "readwrite");
    const store = tx.objectStore("offline_queue");
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = async () => {
        const items = request.result || [];
        console.log(`[SW] Processing ${items.length} offline items`);

        for (const item of items) {
          try {
            const response = await fetch(item.url, {
              method: item.method,
              headers: item.headers,
              body: item.body ? JSON.stringify(item.body) : undefined,
            });

            if (response.ok) {
              // Remove from queue
              const delTx = db.transaction("offline_queue", "readwrite");
              delTx.objectStore("offline_queue").delete(item.id);
              console.log(`[SW] Synced item ${item.id}`);
            }
          } catch (err) {
            console.warn(`[SW] Failed to sync item ${item.id}:`, err);
          }
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("[SW] Offline queue processing failed:", err);
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("intentus-offline", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("offline_queue")) {
        db.createObjectStore("offline_queue", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("cached_data")) {
        db.createObjectStore("cached_data", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ==================== MESSAGE HANDLER ====================
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data?.type === "CACHE_URLS") {
    const urls = event.data.urls || [];
    caches.open(DYNAMIC_CACHE).then((cache) => {
      urls.forEach((url) => cache.add(url).catch(() => {}));
    });
  }
});
