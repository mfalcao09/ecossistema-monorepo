/**
 * POST /api/atendimento/webhooks/worker
 *
 * Worker cron (1 min) — processa webhook_attempts pendentes com backoff
 * exponencial. Autenticado via header `x-cron-secret` (ADMIN_SECRET).
 *
 * Recomendado: agendar via pg_cron ou Trigger.dev apontando para esta URL.
 */

import { NextResponse, type NextRequest } from "next/server";
import { processRetryQueue } from "@/lib/atendimento/webhook-dispatcher";

export async function POST(req: NextRequest): Promise<Response> {
  const secret = req.headers.get("x-cron-secret") ?? req.headers.get("authorization");
  const expected = process.env.ADMIN_SECRET ?? process.env.CRON_SECRET;

  if (!expected) {
    return NextResponse.json({ erro: "worker not configured (ADMIN_SECRET)" }, { status: 500 });
  }
  const clean = secret?.replace(/^Bearer\s+/i, "");
  if (clean !== expected) {
    return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  }

  const result = await processRetryQueue(undefined, 50);
  return NextResponse.json({ ok: true, ...result });
}
