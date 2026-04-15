import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// ==================== Service Worker Registration ====================
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      console.log("[PWA] SW registered, scope:", registration.scope);

      // Listen for updates
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "activated" && navigator.serviceWorker.controller) {
              // New version available — could show update prompt
              console.log("[PWA] New version available");
              window.dispatchEvent(new CustomEvent("sw-updated"));
            }
          });
        }
      });
    } catch (err) {
      console.warn("[PWA] SW registration failed:", err);
    }
  });

  // Handle notification clicks from SW
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "NOTIFICATION_CLICK" && event.data.url) {
      window.location.href = event.data.url;
    }
  });
}
