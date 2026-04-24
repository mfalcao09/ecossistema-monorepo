// ============================================================
// Intentus Real Estate — Service Worker
// App Shell + Runtime Cache + Push + Offline Sync
//
// CACHE_VERSION é substituído no build pelo plugin sw-version-replacer
// (vite.config.ts) usando VERCEL_GIT_COMMIT_SHA. Se você ver "__SW_VERSION__"
// literal aqui em produção, o plugin falhou — investigar imediatamente.
// ============================================================

const CACHE_VERSION = "__SW_VERSION__";
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

// App shell mínimo — NÃO incluir "/" porque o HTML referencia chunks com hash
// que mudam a cada deploy. Cachear "/" provoca mistura de bundles entre deploys.
const APP_SHELL = ["/offline.html", "/manifest.json", "/favicon.ico"];

// ==================== INSTALL ====================
self.addEventListener("install", (event) => {
  console.log(`[SW] Install ${CACHE_VERSION}`);
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

// ==================== ACTIVATE ====================
self.addEventListener("activate", (event) => {
  console.log(`[SW] Activate ${CACHE_VERSION}`);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          // Deletar TODOS os caches que não pertencem à versão atual.
          // Isso garante limpeza completa quando uma nova versão entra em produção.
          keys
            .filter((k) => !k.endsWith(`-${CACHE_VERSION}`))
            .map((k) => {
              console.log(`[SW] Deleting old cache: ${k}`);
              return caches.delete(k);
            }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ==================== FETCH ====================
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET e cross-origin
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // Skip Supabase API calls e Edge Functions
  if (
    url.pathname.startsWith("/functions/") ||
    url.pathname.startsWith("/rest/") ||
    url.pathname.startsWith("/auth/")
  ) {
    return;
  }

  // CRÍTICO: NÃO interceptar /assets/* (chunks Vite com hash no nome).
  // Esses arquivos são imutáveis (Vercel serve com Cache-Control: immutable
  // max-age=31536000) e diferentes deploys produzem nomes diferentes.
  // Interceptar provoca mistura de bundles -> "useContext null" error.
  if (url.pathname.startsWith("/assets/")) {
    return; // browser faz fetch direto, Vercel faz o cache
  }

  // Navegação (HTML) -> Network-first SEM cachear, fallback offline.html
  // HTML referencia chunks por hash que muda a cada deploy. Não cachear.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .match("/offline.html")
          .then(
            (cached) =>
              cached ||
              new Response("<h1>Offline</h1>", {
                status: 503,
                headers: { "Content-Type": "text/html" },
              }),
          ),
      ),
    );
    return;
  }

  // Imagens -> Cache-first
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico)$/)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches
                .open(DYNAMIC_CACHE)
                .then((cache) => cache.put(request, clone));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Fontes -> Cache-first com TTL longa
  if (url.pathname.match(/\.(woff2?|ttf|otf|eot)$/)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches
                .open(STATIC_CACHE)
                .then((cache) => cache.put(request, clone));
            }
            return response;
          }),
      ),
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
        requireInteraction:
          payload.priority === "high" || payload.priority === "urgent",
        vibrate:
          payload.priority === "urgent"
            ? [200, 100, 200, 100, 200]
            : [200, 100, 200],
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
    }),
  );
});

// ==================== NOTIFICATION CLICK ====================
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event.notification.tag);
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
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
        return self.clients.openWindow(url);
      }),
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
        db.createObjectStore("offline_queue", {
          keyPath: "id",
          autoIncrement: true,
        });
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

  // Permite ao app consultar a versão atual do SW (útil para debug e UI)
  if (event.data?.type === "GET_VERSION") {
    event.ports[0]?.postMessage({ version: CACHE_VERSION });
  }
});
