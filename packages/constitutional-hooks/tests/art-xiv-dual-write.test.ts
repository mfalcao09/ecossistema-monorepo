import { describe, expect, it } from "vitest";
import { artXIVDualWrite } from "../src/art-xiv-dual-write.js";
import { ctx } from "./_helpers.js";

describe("Art. XIV — Dual-Write", () => {
  it("allow para Write em path comum", async () => {
    const res = await artXIVDualWrite(
      ctx({ tool_name: "Write", tool_input: { file_path: "/tmp/readme.md" } }),
    );
    expect(res).toEqual({ decision: "allow" });
  });

  it("block para Write em /memory/*.md", async () => {
    const res = await artXIVDualWrite(
      ctx({
        tool_name: "Write",
        tool_input: { file_path: "/project/memory/notes.md", content: "x" },
      }),
    );
    expect(res).toMatchObject({ decision: "block" });
    expect((res as { reason: string }).reason).toMatch(/ecosystem_memory/);
  });

  it("block para Edit em /secrets/", async () => {
    const res = await artXIVDualWrite(
      ctx({
        tool_name: "Edit",
        tool_input: { file_path: "/project/secrets/api.env" },
      }),
    );
    expect(res).toMatchObject({ decision: "block" });
    expect((res as { reason: string }).reason).toMatch(/ecosystem_credentials/);
  });

  it("block para /tasks/*.md", async () => {
    const res = await artXIVDualWrite(
      ctx({
        tool_name: "Write",
        tool_input: { file_path: "/repo/tasks/S01.md" },
      }),
    );
    expect(res).toMatchObject({ decision: "block" });
    expect((res as { reason: string }).reason).toMatch(/agent_tasks/);
  });

  it("block para /sessions/*.md", async () => {
    const res = await artXIVDualWrite(
      ctx({
        tool_name: "Write",
        tool_input: { file_path: "/repo/sessions/2026-04-17.md" },
      }),
    );
    expect(res).toMatchObject({ decision: "block" });
    expect((res as { reason: string }).reason).toMatch(/ecosystem_sessions/);
  });

  it("allow para tool não-write (Bash, Read)", async () => {
    const res = await artXIVDualWrite(
      ctx({ tool_name: "Bash", tool_input: { command: "ls /memory" } }),
    );
    expect(res).toEqual({ decision: "allow" });
  });

  it("allow quando input não tem path", async () => {
    const res = await artXIVDualWrite(ctx({ tool_name: "Write", tool_input: {} }));
    expect(res).toEqual({ decision: "allow" });
  });
});
