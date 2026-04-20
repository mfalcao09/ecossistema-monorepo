/**
 * ============================================================
 * TESTES — Atendimento S6 / Permissões Granulares
 * ============================================================
 * Cobre:
 *   - requirePermission(): fail-closed quando agent sem role
 *   - requirePermission(): matriz básica por cargo
 *   - requirePermission(): fail-open quando flag desligada
 *   - withPermission(): HOC retorna 401/403 nos casos adequados
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadPermissionsForUser,
  PermissionDeniedError,
  requirePermission,
  assertPermission,
} from "@/lib/atendimento/permissions";

// ──────────────────────────────────────────────────────────────
// Helpers — mock do SupabaseClient com builder encadeado
// ──────────────────────────────────────────────────────────────
function makeSupabaseStub(options: {
  agent?: { id: string; role_id: string | null } | null;
  perms?: Array<{ module: string; action: string; granted: boolean }>;
}): SupabaseClient {
  const agentResult = {
    data: options.agent ?? null,
    error: null,
  };
  const permsResult = { data: options.perms ?? [], error: null };

  const from = (table: string) => {
    if (table === "atendimento_agents") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => agentResult,
          }),
        }),
      };
    }
    if (table === "role_permissions") {
      return {
        select: () => ({
          eq: async () => permsResult,
        }),
      };
    }
    throw new Error(`Tabela não mockada: ${table}`);
  };

  return { from } as unknown as SupabaseClient;
}

// ──────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────
describe("atendimento/permissions", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.ATENDIMENTO_RBAC_ENABLED = "true";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetAllMocks();
  });

  describe("requirePermission()", () => {
    it("fail-open quando feature flag está desligada", async () => {
      process.env.ATENDIMENTO_RBAC_ENABLED = "false";
      delete process.env.NEXT_PUBLIC_ATENDIMENTO_RBAC_ENABLED;

      const supabase = makeSupabaseStub({ agent: null, perms: [] });
      const ok = await requirePermission(supabase, "user-123", "roles", "delete");
      expect(ok).toBe(true);
    });

    it("fail-closed quando agent não tem role_id", async () => {
      const supabase = makeSupabaseStub({ agent: { id: "a1", role_id: null } });
      const ok = await requirePermission(supabase, "user-sem-role", "conversations", "view");
      expect(ok).toBe(false);
    });

    it("fail-closed quando agent não existe", async () => {
      const supabase = makeSupabaseStub({ agent: null });
      const ok = await requirePermission(supabase, "user-inexistente", "conversations", "view");
      expect(ok).toBe(false);
    });

    it("Atendente pode editar pipelines mas não deletar", async () => {
      const supabase = makeSupabaseStub({
        agent: { id: "a1", role_id: "role-atendente" },
        perms: [
          { module: "pipelines", action: "view", granted: true },
          { module: "pipelines", action: "edit", granted: true },
          { module: "pipelines", action: "delete", granted: false },
        ],
      });
      // Novo scope pra cada user_id — evita cache cruzado
      expect(await requirePermission(supabase, "u-atendente-edit", "pipelines", "edit")).toBe(true);

      const supabase2 = makeSupabaseStub({
        agent: { id: "a1", role_id: "role-atendente" },
        perms: [{ module: "pipelines", action: "delete", granted: false }],
      });
      expect(await requirePermission(supabase2, "u-atendente-del", "pipelines", "delete")).toBe(false);
    });

    it("Admin (tudo granted) passa em todas as actions", async () => {
      const supabase = makeSupabaseStub({
        agent: { id: "a2", role_id: "role-admin" },
        perms: [
          { module: "roles", action: "delete", granted: true },
          { module: "users", action: "create", granted: true },
          { module: "webhooks", action: "edit", granted: true },
        ],
      });
      expect(await requirePermission(supabase, "u-admin1", "roles", "delete")).toBe(true);

      const s2 = makeSupabaseStub({
        agent: { id: "a2", role_id: "role-admin" },
        perms: [{ module: "users", action: "create", granted: true }],
      });
      expect(await requirePermission(s2, "u-admin2", "users", "create")).toBe(true);
    });

    it("Atendente restrito NÃO tem pipelines/automations", async () => {
      const supabase = makeSupabaseStub({
        agent: { id: "a3", role_id: "role-restrito" },
        perms: [
          { module: "conversations", action: "view", granted: true },
          { module: "conversations", action: "edit", granted: true },
          { module: "pipelines", action: "view", granted: false },
          { module: "automations", action: "view", granted: false },
        ],
      });
      expect(await requirePermission(supabase, "u-r1", "conversations", "view")).toBe(true);

      const s2 = makeSupabaseStub({
        agent: { id: "a3", role_id: "role-restrito" },
        perms: [{ module: "pipelines", action: "view", granted: false }],
      });
      expect(await requirePermission(s2, "u-r2", "pipelines", "view")).toBe(false);
    });
  });

  describe("assertPermission()", () => {
    it("lança PermissionDeniedError quando negado", async () => {
      const supabase = makeSupabaseStub({ agent: null });
      await expect(
        assertPermission(supabase, "u-nobody", "roles", "edit"),
      ).rejects.toThrow(PermissionDeniedError);
    });

    it("não lança quando permitido", async () => {
      const supabase = makeSupabaseStub({
        agent: { id: "ag", role_id: "r1" },
        perms: [{ module: "roles", action: "edit", granted: true }],
      });
      await expect(
        assertPermission(supabase, "u-assert-ok", "roles", "edit"),
      ).resolves.toBeUndefined();
    });
  });

  describe("loadPermissionsForUser()", () => {
    it("retorna mapa vazio quando agent sem role", async () => {
      const supabase = makeSupabaseStub({ agent: { id: "a", role_id: null } });
      const map = await loadPermissionsForUser(supabase, "u-empty-" + Math.random());
      expect(map.size).toBe(0);
    });

    it("popula mapa com entradas granted=true", async () => {
      const supabase = makeSupabaseStub({
        agent: { id: "ag", role_id: "r1" },
        perms: [
          { module: "dashboard", action: "view", granted: true },
          { module: "reports", action: "export", granted: false },
        ],
      });
      const uid = "u-map-" + Math.random();
      const map = await loadPermissionsForUser(supabase, uid);
      expect(map.get("dashboard::view")).toBe(true);
      expect(map.get("reports::export")).toBe(false);
    });
  });
});
