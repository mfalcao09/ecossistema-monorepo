/**
 * Smoke test da taxonomia e do seed script.
 * Sem banco — valida contratos estáticos.
 */

import { describe, expect, it } from "vitest";
import { PERMISSION_MODULES } from "@/lib/atendimento/permissions";

describe("PERMISSION_MODULES taxonomia", () => {
  it("contém os 15 módulos canônicos", () => {
    const slugs = PERMISSION_MODULES.map((m) => m.slug).sort();
    expect(slugs).toEqual(
      [
        "automations",
        "contacts",
        "conversations",
        "dashboard",
        "ds_ai",
        "ds_voice",
        "inboxes",
        "pipelines",
        "reports",
        "roles",
        "schedules",
        "settings",
        "templates",
        "users",
        "webhooks",
      ].sort(),
    );
  });

  it("toda action declarada está no conjunto válido", () => {
    const validActions = new Set(["view", "create", "edit", "delete", "export"]);
    for (const mod of PERMISSION_MODULES) {
      for (const act of mod.actions) {
        expect(validActions.has(act), `${mod.slug}.${act}`).toBe(true);
      }
    }
  });

  it("todo módulo tem pelo menos 'view'", () => {
    for (const mod of PERMISSION_MODULES) {
      expect(mod.actions.includes("view"), `${mod.slug}`).toBe(true);
    }
  });

  it("não há duplicatas (module, action)", () => {
    const seen = new Set<string>();
    for (const mod of PERMISSION_MODULES) {
      for (const act of mod.actions) {
        const key = `${mod.slug}::${act}`;
        expect(seen.has(key), `duplicata ${key}`).toBe(false);
        seen.add(key);
      }
    }
  });
});
