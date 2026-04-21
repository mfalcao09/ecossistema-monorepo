/**
 * GET /api/atendimento/labels — lista etiquetas (atendimento_labels)
 *
 * Usado pelo wizard do DS Agente para seleção de tags de ativação.
 * Permissão: conversations / view (leve — qualquer atendente pode ler labels)
 */

import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

export const GET = withPermission(
  "conversations",
  "view",
)(async (_req: NextRequest, ctx) => {
  const { data, error } = await ctx.supabase
    .from("atendimento_labels")
    .select("id, title, color, show_on_sidebar")
    .order("title", { ascending: true });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ labels: data ?? [] });
});
