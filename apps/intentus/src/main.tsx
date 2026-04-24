import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// ==================== Service Worker Registration ====================
//
// Estratégia de atualização (resolve "useContext null" causado por mistura de
// bundles entre deploys):
//
// 1. Cada build gera um sw.js com VERCEL_GIT_COMMIT_SHA único (ver vite.config.ts)
// 2. Browser detecta sw.js diferente -> instala nova versão em background
// 3. Quando a nova versão termina de instalar, prompt de "recarregar agora"
// 4. Usuário aceita -> SKIP_WAITING -> controllerchange -> reload
// 5. Após reload, todos os chunks vêm da rede (assets/ não é interceptado)
//
// O reload é necessário porque o React montado já está usando os chunks antigos
// na memória — só uma navegação fresh garante chunks consistentes.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      console.log("[PWA] SW registered, scope:", registration.scope);

      const promptReload = (worker: ServiceWorker) => {
        // TODO: trocar window.confirm por toast/dialog do design system
        // (não usei agora pra não acoplar ao shadcn dentro de main.tsx, que
        // precisa rodar antes do React montar a árvore)
        const accepted = window.confirm(
          "Nova versão do Intentus disponível. Recarregar agora?",
        );
        if (accepted) {
          worker.postMessage({ type: "SKIP_WAITING" });
        }
      };

      // Caso 1: já existe SW esperando ao registrar (usuário voltou ao app
      // após deploy enquanto estava em outra aba)
      if (registration.waiting && navigator.serviceWorker.controller) {
        promptReload(registration.waiting);
      }

      // Caso 2: nova versão detectada durante a sessão
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          // "installed" + controller existente = é UPDATE (não primeira instalação)
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            promptReload(newWorker);
          }
        });
      });

      // Quando o novo SW assume controle (após SKIP_WAITING + clients.claim),
      // recarregamos a página para garantir chunks consistentes.
      let reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });
    } catch (err) {
      console.warn("[PWA] SW registration failed:", err);
    }
  });

  // Cliques em notificações vindos do SW
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "NOTIFICATION_CLICK" && event.data.url) {
      window.location.href = event.data.url;
    }
  });
}
