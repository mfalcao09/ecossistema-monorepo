import pino, { type Logger } from "pino";
import { loadConfig } from "./config.js";

let _root: Logger | null = null;

export function rootLogger(): Logger {
  if (_root) return _root;
  const cfg = loadConfig();
  _root = pino({
    level: cfg.LOG_LEVEL,
    ...(cfg.NODE_ENV === "dev"
      ? {
          transport: {
            target: "pino-pretty",
            options: { colorize: true, translateTime: "SYS:HH:MM:ss" },
          },
        }
      : {}),
    base: { service: "whatsapp-gateway" },
  });
  return _root;
}

/** Retorna um child logger carimbado com `instance_id` / `req_id` / etc. */
export function childLogger(bindings: Record<string, unknown>): Logger {
  return rootLogger().child(bindings);
}
