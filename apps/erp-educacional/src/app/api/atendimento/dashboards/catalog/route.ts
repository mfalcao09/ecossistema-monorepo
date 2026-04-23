/**
 * GET /api/atendimento/dashboards/catalog — lista widgets disponíveis no catálogo
 *
 * Consumido pela UI de "Adicionar widget" no DashboardHome.
 * ADR-020 · catálogo extensível (novos widgets via INSERT, sem migration).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withPermission } from "@/lib/atendimento/permissions";

export const GET = withPermission(
  "dashboard",
  "view",
)(async (_req: NextRequest) => {
  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from("atendimento_widget_catalog")
    .select("*")
    .eq("active", true)
    .order("order_weight", { ascending: true })
    .order("label", { ascending: true });

  if (error) {
    return NextResponse.json(
      { erro: "Falha ao buscar catálogo", detalhes: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ catalog: data ?? [] });
});
