import { describe, expect, it, vi } from "vitest";
import { createArtXXIIHook } from "../src/art-xxii-aprendizado.js";
import { sessionCtx } from "./_helpers.js";

describe("Art. XXII — Aprendizado", () => {
  it("chama memoryAdd com summary + tags", async () => {
    const memoryAdd = vi.fn(async () => {});
    const hook = createArtXXIIHook({ memoryAdd });

    await hook(
      sessionCtx({
        session_id: "sess-42",
        tools_used: ["llm_chat", "consultar_saldo"],
        files_touched: ["apps/fic/src/app/page.tsx"],
        outcome: "success",
      }),
    );

    expect(memoryAdd).toHaveBeenCalledOnce();
    const entry = memoryAdd.mock.calls[0][0];
    expect(entry.session_id).toBe("sess-42");
    expect(entry.summary).toMatch(/sess-42/);
    expect(entry.tags).toContain("uses_llm");
    expect(entry.tags).toContain("outcome:success");
  });

  it("detecta tags sql e migration", async () => {
    const memoryAdd = vi.fn(async () => {});
    const hook = createArtXXIIHook({ memoryAdd });

    await hook(
      sessionCtx({
        files_touched: ["infra/supabase/migrations/0001_init.sql"],
      }),
    );

    const entry = memoryAdd.mock.calls[0][0];
    expect(entry.tags).toContain("sql");
    expect(entry.tags).toContain("migration");
  });

  it("respeita enabled=false", async () => {
    const memoryAdd = vi.fn(async () => {});
    const hook = createArtXXIIHook({ memoryAdd, enabled: false });
    await hook(sessionCtx());
    expect(memoryAdd).not.toHaveBeenCalled();
  });

  it("default stub loga em console.log (comportamento temporário S7)", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const hook = createArtXXIIHook();
    await hook(sessionCtx());
    expect(logSpy).toHaveBeenCalledWith("[art-xxii][stub] memory.add", expect.any(Object));
    logSpy.mockRestore();
  });
});
