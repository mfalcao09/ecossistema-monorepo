/**
 * DELETE /api/atendimento/ds-agentes/[id]/knowledge/[chunkId]
 *
 * Remove um chunk específico da base de conhecimento.
 * Permissão: ds_ai / delete
 */

import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";
import { deleteKnowledge } from "@/lib/atendimento/rag-client";

type RouteParams = { id: string; chunkId: string };

export const DELETE = withPermission(
  "ds_ai",
  "delete",
)(async (_req: NextRequest, ctx) => {
  const params =
    (await (ctx.params as Promise<RouteParams> | undefined)) ??
    ({ id: "", chunkId: "" } as RouteParams);

  try {
    await deleteKnowledge(params.chunkId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
});
