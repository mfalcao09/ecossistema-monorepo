/**
 * Gateway entry point — sobe HTTP + InstanceManager + bootstrap de instâncias.
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { loadConfig } from "./config.js";
import { rootLogger } from "./logger.js";
import { supabase } from "./db/client.js";
import { InstanceManager } from "./instances/manager.js";
import { createRoutes } from "./http/routes.js";

async function main() {
  const cfg = loadConfig();
  const log = rootLogger();
  log.info(
    { port: cfg.PORT, host: cfg.HOST, env: cfg.NODE_ENV },
    "whatsapp-gateway starting",
  );

  const manager = new InstanceManager({
    supabase: supabase(),
    logger: log,
    browserName: cfg.BAILEYS_BROWSER_NAME,
    rateLimitMinIntervalMs: 3000, // ~20 msgs/min cap por instância
    heartbeatIntervalSec: cfg.HEALTH_HEARTBEAT_INTERVAL_SEC,
    canaryIntervalSec: cfg.HEALTH_CANARY_INTERVAL_SEC,
  });

  const app = new Hono();

  // Health — sem bearer (Railway healthcheck)
  app.get("/", (c) =>
    c.json({ ok: true, service: "whatsapp-gateway", version: "0.1.0" }),
  );
  app.get("/healthz", (c) =>
    c.json({ ok: true, ts: new Date().toISOString() }),
  );

  // Rotas v1 (bearer-protected)
  app.route("/", createRoutes(manager));

  // Bootstrap instâncias existentes em background
  manager.bootstrap().catch((err) =>
    log.error({ err }, "bootstrap failed"),
  );

  const server = serve(
    { fetch: app.fetch, port: cfg.PORT, hostname: cfg.HOST },
    (info) => log.info({ port: info.port }, "listening"),
  );

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log.info({ signal }, "shutdown signal received");
    server.close();
    await manager.shutdown();
    process.exit(0);
  };
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  rootLogger().fatal({ err }, "failed to start");
  process.exit(1);
});
