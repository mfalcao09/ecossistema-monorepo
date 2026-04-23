import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/atendimento/link-redirects/[id]/stats?days=30
 *
 * Retorna agregados para o relatório:
 *   - total           (total de clicks)
 *   - daily           [{ day:"YYYY-MM-DD", count:N }]
 *   - by_number       [{ index:N, number:"...", count:N }]
 *   - by_utm_source   [{ source:"...", count:N }]
 *   - recent          últimos 50 clicks
 */
export const GET = withPermission("link_redirects", "view")(async (req: NextRequest, ctx) => {
  const { params } = ctx as unknown as Params;
  const { id } = await params;

  const url = new URL(req.url);
  const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? 30), 1), 180);
  const sinceIso = new Date(Date.now() - days * 86400_000).toISOString();

  const { data: link, error: linkErr } = await ctx.supabase
    .from("link_redirects")
    .select("id, slug, name, total_clicks, numbers")
    .eq("id", id)
    .maybeSingle();

  if (linkErr) return NextResponse.json({ erro: linkErr.message }, { status: 500 });
  if (!link) return NextResponse.json({ erro: "Link não encontrado." }, { status: 404 });

  const { data: clicks, error: clicksErr } = await ctx.supabase
    .from("link_clicks")
    .select("created_at, selected_index, selected_number, utm_source, utm_medium, utm_campaign, country, user_agent, referer")
    .eq("link_id", id)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (clicksErr) return NextResponse.json({ erro: clicksErr.message }, { status: 500 });

  const rows = clicks ?? [];

  // Agregado diário
  const dailyMap = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 86400_000);
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, 0);
  }
  for (const r of rows) {
    const key = (r.created_at as string).slice(0, 10);
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1);
  }
  const daily = Array.from(dailyMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, count]) => ({ day, count }));

  // Por número
  const numbersArr = (link.numbers as Array<{ number: string; label?: string }>) ?? [];
  const byNumberMap = new Map<number, number>();
  for (const r of rows) {
    const idx = r.selected_index ?? -1;
    byNumberMap.set(idx, (byNumberMap.get(idx) ?? 0) + 1);
  }
  const by_number = Array.from(byNumberMap.entries()).map(([index, count]) => ({
    index,
    number: index >= 0 && index < numbersArr.length ? numbersArr[index].number : "?",
    label: index >= 0 && index < numbersArr.length ? numbersArr[index].label ?? null : null,
    count,
  }));

  // Por UTM source
  const utmMap = new Map<string, number>();
  for (const r of rows) {
    const key = r.utm_source ?? "(direto)";
    utmMap.set(key, (utmMap.get(key) ?? 0) + 1);
  }
  const by_utm_source = Array.from(utmMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    link: { id: link.id, slug: link.slug, name: link.name, total_clicks: link.total_clicks },
    window_days: days,
    total_in_window: rows.length,
    daily,
    by_number,
    by_utm_source,
    recent: rows.slice(0, 50),
  });
});
