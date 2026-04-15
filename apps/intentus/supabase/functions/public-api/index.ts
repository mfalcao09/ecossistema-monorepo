import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(message: string, status = 400) {
  return json({ error: message }, status);
}

// Input validation helpers
function sanitizeString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}

function isValidPhone(phone: string): boolean {
  // Allow digits, spaces, dashes, parens, plus sign
  return /^[\d\s\-\(\)\+]+$/.test(phone) && phone.length <= 20;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const domain = url.searchParams.get("domain");
  const slug = url.searchParams.get("slug");

  if (!action) {
    return err("Parâmetro 'action' é obrigatório");
  }

  // Platform-level identity (no tenant needed)
  if (action === "platform-identity") {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data, error: idErr } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "identity")
      .single();
    if (idErr || !data) {
      return json({
        platform_name: "Gestão Imobiliária",
        logo_url: null,
        favicon_url: null,
        primary_color: "#1b2a4a",
        accent_color: "#e8a020",
        sidebar_color: "#172240",
      });
    }
    const identity = data.value as Record<string, unknown>;
    return json({
      platform_name: identity.platform_name ?? "Gestão Imobiliária",
      logo_url: identity.logo_url ?? null,
      favicon_url: identity.favicon_url ?? null,
      primary_color: identity.primary_color ?? "#1b2a4a",
      accent_color: identity.accent_color ?? "#e8a020",
      sidebar_color: identity.sidebar_color ?? "#172240",
    });
  }

  if (!domain && !slug) {
    return err("Parâmetro 'domain' ou 'slug' é obrigatório");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Resolve tenant
  let tenantQuery = supabase
    .from("tenants")
    .select("id, name, slug, logo_url, settings, custom_domain")
    .eq("active", true);

  if (domain) {
    tenantQuery = tenantQuery.eq("custom_domain", domain);
  } else {
    tenantQuery = tenantQuery.eq("slug", slug);
  }

  const { data: tenant, error: tenantErr } = await tenantQuery.single();
  if (tenantErr || !tenant) {
    return err("Tenant não encontrado", 404);
  }

  const settings = (tenant.settings as Record<string, unknown>) || {};
  const tenantPublic = {
    name: tenant.name,
    slug: tenant.slug,
    logo_url: settings.logo_url || tenant.logo_url,
    favicon_url: settings.favicon_url,
    primary_color: settings.primary_color,
    secondary_color: settings.secondary_color,
    hero_images: settings.hero_images,
    hero_title: settings.hero_title,
    hero_subtitle: settings.hero_subtitle,
    about_text: settings.about_text,
    phone: settings.phone,
    email: settings.email,
    address: settings.address,
    whatsapp_number: settings.whatsapp_number,
    whatsapp_message: settings.whatsapp_message,
    social_links: settings.social_links,
  };

  // ACTION: tenant
  if (action === "tenant") {
    return json({ tenant: tenantPublic });
  }

  // ACTION: properties (list)
  if (action === "properties") {
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const perPage = Math.min(50, Math.max(1, parseInt(url.searchParams.get("per_page") || "20")));
    const offset = (page - 1) * perPage;

    let query = supabase
      .from("properties")
      .select("id, title, property_type, purpose, sale_price, rental_price, area_total, area_built, rooms, suites, bathrooms, parking_spots, city, neighborhood, state, description, highlight_web, property_code, condominium_fee, iptu", { count: "exact" })
      .eq("tenant_id", tenant.id)
      .eq("show_on_website", true)
      .eq("status", "disponivel")
      .order("highlight_web", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    const type = url.searchParams.get("type");
    if (type) query = query.eq("property_type", type);

    const purpose = url.searchParams.get("purpose");
    if (purpose) query = query.eq("purpose", purpose);

    const minPrice = url.searchParams.get("min_price");
    if (minPrice) query = query.gte("sale_price", parseFloat(minPrice));

    const maxPrice = url.searchParams.get("max_price");
    if (maxPrice) query = query.lte("sale_price", parseFloat(maxPrice));

    const bedrooms = url.searchParams.get("bedrooms");
    if (bedrooms) query = query.gte("rooms", parseInt(bedrooms));

    const city = url.searchParams.get("city");
    if (city) {
      const safeCity = city.replace(/[%_\\]/g, '\\$&').slice(0, 100);
      query = query.ilike("city", `%${safeCity}%`);
    }

    const neighborhood = url.searchParams.get("neighborhood");
    if (neighborhood) {
      const safeNeighborhood = neighborhood.replace(/[%_\\]/g, '\\$&').slice(0, 100);
      query = query.ilike("neighborhood", `%${safeNeighborhood}%`);
    }

    const { data: properties, error: propErr, count } = await query;
    if (propErr) return err("Erro ao buscar imóveis", 500);

    // Fetch images and features for these properties
    const propIds = (properties || []).map((p) => p.id);

    const [mediaRes, featuresRes] = await Promise.all([
      propIds.length > 0
        ? supabase
            .from("property_media")
            .select("property_id, media_url, display_order, caption, media_type")
            .in("property_id", propIds)
            .eq("media_type", "image")
            .order("display_order", { ascending: true })
        : { data: [] },
      propIds.length > 0
        ? supabase
            .from("property_features")
            .select("property_id, feature_name")
            .in("property_id", propIds)
        : { data: [] },
    ]);

    const mediaByProp = new Map<string, { url: string; order: number; caption: string | null }[]>();
    for (const m of (mediaRes as any).data || []) {
      const arr = mediaByProp.get(m.property_id) || [];
      arr.push({ url: m.media_url, order: m.display_order, caption: m.caption });
      mediaByProp.set(m.property_id, arr);
    }

    const featuresByProp = new Map<string, string[]>();
    for (const f of (featuresRes as any).data || []) {
      const arr = featuresByProp.get(f.property_id) || [];
      arr.push(f.feature_name);
      featuresByProp.set(f.property_id, arr);
    }

    const result = (properties || []).map((p) => ({
      ...p,
      images: mediaByProp.get(p.id) || [],
      features: featuresByProp.get(p.id) || [],
    }));

    return json({
      tenant: tenantPublic,
      properties: result,
      total: count || 0,
      page,
      per_page: perPage,
    });
  }

  // ACTION: property (detail)
  if (action === "property") {
    const propertyId = url.searchParams.get("id");
    if (!propertyId) return err("Parâmetro 'id' é obrigatório");

    const { data: property, error: propErr } = await supabase
      .from("properties")
      .select("*")
      .eq("id", propertyId)
      .eq("tenant_id", tenant.id)
      .eq("show_on_website", true)
      .eq("status", "disponivel")
      .single();

    if (propErr || !property) return err("Imóvel não encontrado", 404);

    const [mediaRes, featuresRes] = await Promise.all([
      supabase
        .from("property_media")
        .select("media_url, display_order, caption, media_type")
        .eq("property_id", propertyId)
        .order("display_order", { ascending: true }),
      supabase
        .from("property_features")
        .select("feature_name")
        .eq("property_id", propertyId),
    ]);

    return json({
      tenant: tenantPublic,
      property: {
        id: property.id,
        title: property.title,
        property_code: property.property_code,
        property_type: property.property_type,
        purpose: property.purpose,
        sale_price: property.sale_price,
        rental_price: property.rental_price,
        condominium_fee: property.condominium_fee,
        iptu: property.iptu,
        area_total: property.area_total,
        area_built: property.area_built,
        private_area: property.private_area,
        rooms: property.rooms,
        suites: property.suites,
        bathrooms: property.bathrooms,
        parking_spots: property.parking_spots,
        street: property.street,
        number: property.number,
        complement: property.complement,
        neighborhood: property.neighborhood,
        city: property.city,
        state: property.state,
        zip_code: property.zip_code,
        region: property.region,
        description: property.description,
        highlight_web: property.highlight_web,
        accepts_exchange: property.accepts_exchange,
        exchange_value: property.exchange_value,
        images: (mediaRes.data || []).map((m) => ({
          url: m.media_url,
          order: m.display_order,
          caption: m.caption,
          type: m.media_type,
        })),
        features: (featuresRes.data || []).map((f) => f.feature_name),
      },
    });
  }

  // ACTION: lead (create) - with input validation
  if (action === "lead" && req.method === "POST") {
    try {
      const body = await req.json();

      // Validate and sanitize inputs
      const name = sanitizeString(body.name, 200);
      if (!name) return err("Campo 'name' é obrigatório");

      const email = sanitizeString(body.email, 255);
      if (email && !isValidEmail(email)) return err("Email inválido");

      const phone = sanitizeString(body.phone, 20);
      if (phone && !isValidPhone(phone)) return err("Telefone inválido");

      const message = sanitizeString(body.message, 2000);
      const property_id = sanitizeString(body.property_id, 36) || null;
      const interest_type = sanitizeString(body.interest_type, 50) || null;

      // Validate property_id format if provided (UUID)
      if (property_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(property_id)) {
        return err("ID de imóvel inválido");
      }

      const { error: insertErr } = await supabase.from("leads").insert({
        name,
        email: email || null,
        phone: phone || null,
        notes: message || null,
        property_id,
        interest_type,
        source: "site",
        status: "novo",
        tenant_id: tenant.id,
        created_by: null as any,
      });

      if (insertErr) {
        console.error("Lead insert error:", insertErr);
        return err("Erro ao registrar interesse", 500);
      }

      return json({ success: true, message: "Interesse registrado com sucesso" }, 201);
    } catch {
      return err("Body JSON inválido", 400);
    }
  }

  return err("Ação não reconhecida. Use: tenant, properties, property, lead");
});
