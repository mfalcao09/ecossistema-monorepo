/**
 * Config loader — lê env com validação zod. Falha cedo e claro se algo faltar.
 */
import { z } from "zod";

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  PORT: z.coerce.number().int().positive().default(3030),
  HOST: z.string().default("0.0.0.0"),
  GATEWAY_BEARER_TOKEN: z.string().min(32, "gera com `openssl rand -hex 32`"),
  BAILEYS_BROWSER_NAME: z.string().default("Ecossistema Gateway"),
  HEALTH_HEARTBEAT_INTERVAL_SEC: z.coerce.number().int().positive().default(60),
  HEALTH_CANARY_INTERVAL_SEC: z.coerce.number().int().min(0).default(3600),
  AUTH_SNAPSHOT_KEEP: z.coerce.number().int().min(1).default(3),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
  NODE_ENV: z.enum(["dev", "prod", "test"]).default("dev"),
});

export type Config = z.infer<typeof schema>;

let _cfg: Config | null = null;

export function loadConfig(): Config {
  if (_cfg) return _cfg;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Config inválido:\n${issues}`);
  }
  _cfg = parsed.data;
  return _cfg;
}
