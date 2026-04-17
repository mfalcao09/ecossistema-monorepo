// skills-registry-crud/index.ts
// SC-04 — CRUD + FTS matching para skills_registry.
import { authenticate, hasScope } from "../_shared/auth.ts";
import { getAdmin } from "../_shared/supabase-admin.ts";
import { errors, ok, readJson } from "../_shared/errors.ts";
import { writeAuditLog } from "../_shared/audit.ts";
import { matchSkills } from "./matcher.ts";

interface SkillUpsert {
  business_id?: string;
  name: string;
  version?: string;
  description?: string;
  tags?: string[];
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  tool_refs?: unknown;
  markdown_path?: string;
  author?: string;
}

Deno.serve(async (req) => {
  const supabase = getAdmin();
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  // /skills-registry-crud[/:id|/match]
  const fnIdx = parts.indexOf("skills-registry-crud");
  const suffix = parts.slice(fnIdx + 1);

  const ctx = await authenticate(req);
  if (!ctx) return errors.unauthorized();

  try {
    // Matching (GET /match or POST /match)
    if (suffix[0] === "match") {
      const body = req.method === "GET"
        ? { query: url.searchParams.get("q") ?? "", business_id: url.searchParams.get("business_id") ?? "ecosystem", limit: Number(url.searchParams.get("limit") ?? 5) }
        : await readJson<{ query: string; business_id?: string; limit?: number }>(req);
      if (!body.query) return errors.badRequest("query required");
      const matches = await matchSkills(supabase, body.query, body.business_id ?? ctx.business_id ?? "ecosystem", body.limit ?? 5);
      return ok({ matches, count: matches.length });
    }

    // GET /skills-registry-crud?business_id=fic&tags=marketing
    if (req.method === "GET" && suffix.length === 0) {
      const bizParam = url.searchParams.get("business_id");
      const tagsParam = url.searchParams.get("tags");
      const activeOnly = url.searchParams.get("active") !== "false";
      const q = supabase.from("skills_registry")
        .select("id, business_id, name, version, description, tags, input_schema, output_schema, tool_refs, author, markdown_path, is_active, usage_count, last_used_at, created_at, updated_at");
      if (bizParam) q.in("business_id", [bizParam, "ecosystem"]);
      if (activeOnly) q.eq("is_active", true);
      if (tagsParam) q.overlaps("tags", tagsParam.split(",").map((s) => s.trim()).filter(Boolean));
      const { data, error } = await q.order("name");
      if (error) return errors.internal("list failed", error.message);
      return ok({ items: data ?? [], count: data?.length ?? 0 });
    }

    // GET /skills-registry-crud/:id
    if (req.method === "GET" && suffix.length === 1) {
      const { data, error } = await supabase.from("skills_registry")
        .select("*").eq("id", suffix[0]).maybeSingle();
      if (error) return errors.internal("get failed", error.message);
      if (!data) return errors.notFound();
      return ok(data);
    }

    // POST /skills-registry-crud (create)
    if (req.method === "POST" && suffix.length === 0) {
      if (!hasScope(ctx, "operator")) return errors.forbidden("forbidden", "operator scope required");
      const body = await readJson<SkillUpsert>(req);
      if (!body.name) return errors.badRequest("name required");
      const row = {
        business_id: body.business_id ?? ctx.business_id ?? "ecosystem",
        name: body.name,
        version: body.version ?? "1.0.0",
        description: body.description ?? null,
        tags: body.tags ?? [],
        input_schema: body.input_schema ?? {},
        output_schema: body.output_schema ?? {},
        tool_refs: body.tool_refs ?? [],
        markdown_path: body.markdown_path ?? null,
        author: body.author ?? ctx.principal_id,
        is_active: true,
      };
      const { data, error } = await supabase.from("skills_registry").insert(row).select("*").single();
      if (error) return errors.conflict("insert failed", error.message);
      await writeAuditLog(supabase, {
        agent_id: ctx.principal_id, tool_name: "skills-registry-crud", action: "create",
        success: true, severity: "info", article_ref: "SC-04", decision: "allow",
        metadata: { skill_id: data.id, name: data.name },
      });
      return ok(data);
    }

    // PATCH /skills-registry-crud/:id
    if (req.method === "PATCH" && suffix.length === 1) {
      if (!hasScope(ctx, "operator")) return errors.forbidden("forbidden", "operator scope required");
      const body = await readJson<Partial<SkillUpsert> & { is_active?: boolean }>(req);
      const updatable = ["description", "tags", "version", "input_schema", "output_schema", "tool_refs", "markdown_path", "is_active"] as const;
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of updatable) if (k in body) patch[k] = (body as Record<string, unknown>)[k];
      const { data, error } = await supabase.from("skills_registry").update(patch).eq("id", suffix[0]).select("*").maybeSingle();
      if (error) return errors.internal("update failed", error.message);
      if (!data) return errors.notFound();
      return ok(data);
    }

    // DELETE /skills-registry-crud/:id (soft)
    if (req.method === "DELETE" && suffix.length === 1) {
      if (!hasScope(ctx, "admin")) return errors.forbidden("forbidden", "admin scope required");
      const { data, error } = await supabase.from("skills_registry")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", suffix[0]).select("id").maybeSingle();
      if (error) return errors.internal("delete failed", error.message);
      if (!data) return errors.notFound();
      await writeAuditLog(supabase, {
        agent_id: ctx.principal_id, tool_name: "skills-registry-crud", action: "soft_delete",
        success: true, severity: "info", article_ref: "SC-04",
        metadata: { skill_id: suffix[0] },
      });
      return ok({ deleted: true, id: suffix[0] });
    }

    return errors.methodNotAllowed();
  } catch (e) {
    if (e instanceof Response) return e;
    return errors.internal("unhandled", (e as Error).message);
  }
});
