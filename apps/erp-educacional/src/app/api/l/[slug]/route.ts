import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  selectNumberIndex,
  sha256Hex,
  type LinkNumber,
  type ScheduleConfig,
  type DistributionMode,
} from "@/lib/atendimento/link-redirects";
import { isLinksRedirectEnabled } from "@/lib/atendimento/feature-flags";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/l/[slug]
 *
 * Rota PÚBLICA (sem auth). Seleciona um número conforme `distribution`,
 * registra click em link_clicks e redireciona 302 para wa.me/<num>?text=<greeting>.
 *
 * Feature flag: ATENDIMENTO_LINKS_REDIRECT_ENABLED.
 */
export async function GET(req: NextRequest, routeArgs: Params) {
  if (!isLinksRedirectEnabled()) {
    return NextResponse.json(
      { erro: "Funcionalidade desabilitada." },
      { status: 503 },
    );
  }

  const { slug } = await routeArgs.params;

  const admin = createAdminClient();

  const { data: link, error } = await admin
    .from("link_redirects")
    .select("id, slug, greeting, numbers, distribution, schedule_config, cursor_idx, active")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (error || !link) {
    return new NextResponse("Link não encontrado ou inativo.", { status: 404 });
  }

  const numbers = (link.numbers as LinkNumber[]) ?? [];
  const distribution = (link.distribution as DistributionMode) ?? "sequential";
  const schedule = (link.schedule_config as ScheduleConfig) ?? {};

  const idx = selectNumberIndex(numbers, distribution, schedule, link.cursor_idx ?? 0);
  if (idx === null) {
    return new NextResponse("Nenhum número ativo configurado.", { status: 503 });
  }

  const picked = numbers[idx];
  const destNumber = picked.number;
  const text = link.greeting ? `?text=${encodeURIComponent(link.greeting)}` : "";
  const waUrl = `https://wa.me/${destNumber}${text}`;

  // Extrai UTM + headers
  const url = new URL(req.url);
  const utm_source   = url.searchParams.get("utm_source")   ?? undefined;
  const utm_medium   = url.searchParams.get("utm_medium")   ?? undefined;
  const utm_campaign = url.searchParams.get("utm_campaign") ?? undefined;
  const utm_term     = url.searchParams.get("utm_term")     ?? undefined;
  const utm_content  = url.searchParams.get("utm_content")  ?? undefined;

  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  const rawIp = forwarded.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const ipHash = await sha256Hex(rawIp);

  const user_agent = req.headers.get("user-agent")?.slice(0, 500) ?? null;
  const referer    = req.headers.get("referer")?.slice(0, 500) ?? null;
  const country    = req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry") ?? null;

  // Fire-and-(almost)forget: registra click + avança cursor se sequential.
  // Usamos await curto para garantir idempotência mínima; se o insert demorar,
  // ainda redirecionamos em seguida (limite razoável dado o webhook volume).
  try {
    await admin.from("link_clicks").insert({
      link_id: link.id,
      ip_hash: ipHash,
      user_agent,
      referer,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
      selected_index: idx,
      selected_number: destNumber,
      country,
    });

    if (distribution === "sequential") {
      await admin
        .from("link_redirects")
        .update({ cursor_idx: (link.cursor_idx ?? 0) + 1 })
        .eq("id", link.id);
    }
  } catch {
    // não bloqueia redirect por falha de tracking
  }

  return NextResponse.redirect(waUrl, { status: 302 });
}
