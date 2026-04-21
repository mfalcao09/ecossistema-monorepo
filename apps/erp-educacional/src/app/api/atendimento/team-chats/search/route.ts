import { NextResponse, type NextRequest } from "next/server";
import { withPermission } from "@/lib/atendimento/permissions";

/**
 * GET /api/atendimento/team-chats/search?q=texto&kind=agent|conversation|deal|contact
 *
 * Autocomplete usado por:
 *   - Menções @nome    (kind=agent)  → retorna agents
 *   - Refs cross  #termo (kind=conversation|deal|contact) → itens correspondentes
 */
export const GET = withPermission("team_chats", "view")(async (req: NextRequest, ctx) => {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const kind = url.searchParams.get("kind") ?? "agent";

  if (q.length < 1) return NextResponse.json({ items: [] });

  const like = `%${q}%`;

  if (kind === "agent") {
    const { data, error } = await ctx.supabase
      .from("atendimento_agents")
      .select("id, name, email, avatar_url, availability_status")
      .or(`name.ilike.${like},email.ilike.${like}`)
      .limit(10);
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({
      items: (data ?? []).map((a) => ({
        type: "agent" as const,
        id: a.id,
        label: a.name,
        sublabel: a.email,
        avatar_url: a.avatar_url,
        status: a.availability_status,
      })),
    });
  }

  if (kind === "conversation") {
    const { data, error } = await ctx.supabase
      .from("atendimento_conversations")
      .select("id, status, last_activity_at, atendimento_contacts:contact_id(id, name, phone_number)")
      .order("last_activity_at", { ascending: false })
      .limit(30);
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    const matched = (data ?? []).filter((c) => {
      const contact = c.atendimento_contacts as { name?: string; phone_number?: string } | { name?: string; phone_number?: string }[] | undefined;
      const single = Array.isArray(contact) ? contact[0] : contact;
      if (!single) return false;
      const name = single.name ?? "";
      const phone = single.phone_number ?? "";
      return name.toLowerCase().includes(q.toLowerCase()) || phone.includes(q);
    }).slice(0, 10);
    return NextResponse.json({
      items: matched.map((c) => {
        const contact = c.atendimento_contacts as { name?: string; phone_number?: string } | { name?: string; phone_number?: string }[] | undefined;
        const single = Array.isArray(contact) ? contact[0] : contact;
        return {
          type: "conversation" as const,
          id: c.id,
          label: single?.name ?? "Sem nome",
          sublabel: single?.phone_number ?? "",
          status: c.status,
        };
      }),
    });
  }

  if (kind === "deal") {
    const { data, error } = await ctx.supabase
      .from("deals")
      .select("id, title, value_cents, currency")
      .ilike("title", like)
      .limit(10);
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({
      items: (data ?? []).map((d) => ({
        type: "deal" as const,
        id: d.id,
        label: d.title,
        sublabel: d.value_cents ? `${d.currency} ${(d.value_cents / 100).toFixed(2)}` : "",
      })),
    });
  }

  if (kind === "contact") {
    const { data, error } = await ctx.supabase
      .from("atendimento_contacts")
      .select("id, name, phone_number, email")
      .or(`name.ilike.${like},phone_number.ilike.${like},email.ilike.${like}`)
      .limit(10);
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({
      items: (data ?? []).map((c) => ({
        type: "contact" as const,
        id: c.id,
        label: c.name,
        sublabel: c.phone_number ?? c.email ?? "",
      })),
    });
  }

  return NextResponse.json({ erro: "kind inválido." }, { status: 400 });
});
