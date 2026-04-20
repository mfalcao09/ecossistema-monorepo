// dual-write-pipeline/index.ts
// SC-03 — escrita idempotente em primary + mirror com fallback queue.
// P-006: suporte cross-project via {PROJECT}_SERVICE_ROLE_KEY env vars.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { authenticate } from "../_shared/auth.ts";
import { getAdmin, type SupabaseClient } from "../_shared/supabase-admin.ts";
import { errors, ok, readJson } from "../_shared/errors.ts";
import { startTimer, writeAuditLog } from "../_shared/audit.ts";

type Op = "insert" | "upsert" | "update" | "delete";

// P-006: client para projetos além do ECOSYSTEM
// Env var: {PROJECT_UPPER}_SERVICE_ROLE_KEY (ex: INTENTUS_SERVICE_ROLE_KEY)
// URL derivada do ref no payload do JWT.
function getClientForProject(project: string): SupabaseClient {
  if (project === "ecosystem") return getAdmin();
  const envKey = `${project.toUpperCase()}_SERVICE_ROLE_KEY`;
  const key = Deno.env.get(envKey);
  if (!key) throw new Error(`Missing env var ${envKey} for project '${project}'`);
  const { ref } = JSON.parse(atob(key.split(".")[1])) as { ref: string };
  return createClient(`https://${ref}.supabase.co`, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-ef-origin": "ecosystem-dual-write" } },
  });
}

interface WriteSpec {
  project: string;         // ref do projeto Supabase (para audit) — client é sempre service-role atual
  table: string;
  op: Op;
  payload: Record<string, unknown> | Record<string, unknown>[];
  match?: Record<string, unknown>;      // para update/delete
  on_conflict?: string;                 // para upsert
}

interface DualWriteBody {
  pipeline_id: string;
  idempotency_key: string;
  primary: WriteSpec;
  mirror?: WriteSpec;
  on_mirror_failure?: "fail" | "queue";
}

async function executeSpec(supabase: SupabaseClient, spec: WriteSpec) {
  const t = supabase.from(spec.table);
  if (spec.op === "insert") {
    const { error } = await t.insert(spec.payload);
    if (error) throw new Error(error.message);
    return;
  }
  if (spec.op === "upsert") {
    const { error } = await t.upsert(spec.payload, spec.on_conflict ? { onConflict: spec.on_conflict } : undefined);
    if (error) throw new Error(error.message);
    return;
  }
  if (spec.op === "update") {
    if (!spec.match) throw new Error("update requires match");
    const q = t.update(spec.payload as Record<string, unknown>);
    for (const [k, v] of Object.entries(spec.match)) q.eq(k, v as never);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return;
  }
  if (spec.op === "delete") {
    if (!spec.match) throw new Error("delete requires match");
    const q = t.delete();
    for (const [k, v] of Object.entries(spec.match)) q.eq(k, v as never);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return;
  }
  throw new Error(`unknown op: ${spec.op}`);
}

Deno.serve(async (req) => {
  const timer = startTimer();
  const supabase = getAdmin();
  if (req.method !== "POST") return errors.methodNotAllowed();

  const ctx = await authenticate(req);
  if (!ctx) return errors.unauthorized();

  const body = await readJson<DualWriteBody>(req);
  if (!body.idempotency_key) return errors.badRequest("idempotency_key required");
  if (!body.pipeline_id) return errors.badRequest("pipeline_id required");
  if (!body.primary) return errors.badRequest("primary spec required");

  // 1) Idempotency check
  const { data: existing } = await supabase.from("dual_write_log")
    .select("idempotency_key, primary_status, mirror_status, completed_at")
    .eq("idempotency_key", body.idempotency_key).maybeSingle();
  if (existing) {
    return ok({
      idempotent: true,
      primary_status: existing.primary_status,
      mirror_status: existing.mirror_status,
      completed_at: existing.completed_at,
    });
  }

  // 2) Create log row
  await supabase.from("dual_write_log").insert({
    idempotency_key: body.idempotency_key,
    pipeline_id: body.pipeline_id,
    primary_project: body.primary.project,
    primary_table: body.primary.table,
    mirror_project: body.mirror?.project ?? null,
    mirror_table: body.mirror?.table ?? null,
    primary_status: "fail",
  });

  // 3) Execute primary
  try {
    await executeSpec(supabase, body.primary);
    await supabase.from("dual_write_log").update({ primary_status: "ok" }).eq("idempotency_key", body.idempotency_key);
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("dual_write_log").update({ primary_status: "fail", primary_error: msg, completed_at: new Date().toISOString() }).eq("idempotency_key", body.idempotency_key);
    await writeAuditLog(supabase, {
      agent_id: ctx.principal_id, tool_name: "dual-write-pipeline", action: "primary",
      success: false, severity: "error", article_ref: "SC-03", duration_ms: timer(),
      metadata: { pipeline_id: body.pipeline_id, error: msg },
    });
    return errors.internal("primary write failed", msg);
  }

  // 4) Execute mirror (if provided) — P-006: client por projeto via {PROJECT}_SERVICE_ROLE_KEY
  let mirrorStatus: "ok" | "fail" | "queued" | "skipped" = "skipped";
  let mirrorError: string | null = null;
  if (body.mirror) {
    const queueMirror = async (err: string) => {
      await supabase.from("dual_write_queue").insert({
        idempotency_key: body.idempotency_key,
        pipeline_id: body.pipeline_id,
        mirror_project: body.mirror!.project,
        mirror_table: body.mirror!.table,
        mirror_op: body.mirror!.op,
        mirror_payload: body.mirror,
        last_error: err,
      });
    };

    let mirrorClient: SupabaseClient;
    try {
      mirrorClient = getClientForProject(body.mirror.project);
    } catch (e) {
      mirrorError = (e as Error).message;
      if (body.on_mirror_failure === "queue") {
        await queueMirror(mirrorError);
        mirrorStatus = "queued";
      } else {
        mirrorStatus = "fail";
      }
    }

    if (mirrorStatus === "skipped") {
      try {
        await executeSpec(mirrorClient!, body.mirror);
        mirrorStatus = "ok";
      } catch (e) {
        mirrorError = (e as Error).message;
        if (body.on_mirror_failure === "queue") {
          await queueMirror(mirrorError);
          mirrorStatus = "queued";
        } else {
          mirrorStatus = "fail";
        }
      }
    }
  }

  await supabase.from("dual_write_log").update({
    mirror_status: mirrorStatus,
    mirror_error: mirrorError,
    completed_at: new Date().toISOString(),
  }).eq("idempotency_key", body.idempotency_key);

  await writeAuditLog(supabase, {
    agent_id: ctx.principal_id, tool_name: "dual-write-pipeline", action: "dual_write",
    success: mirrorStatus !== "fail", severity: mirrorStatus === "fail" ? "warning" : "info",
    article_ref: "SC-03", duration_ms: timer(),
    metadata: {
      pipeline_id: body.pipeline_id,
      primary: { project: body.primary.project, table: body.primary.table, op: body.primary.op },
      mirror_status: mirrorStatus,
      mirror_error: mirrorError,
    },
  });

  return ok({
    idempotent: false,
    primary_status: "ok",
    mirror_status: mirrorStatus,
    mirror_error: mirrorError,
    duration_ms: timer(),
  });
});
