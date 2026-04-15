/**
 * commercial-portal-integration — Edge Function para Integração Multi-Portal Imobiliário.
 * Actions: generate_xml, get_dashboard, validate_properties, update_portal_settings, get_property_status, toggle_property_portal
 * v1: VrSync (ZAP/VivaReal), OLX nativo, validação de campos, dashboard de status.
 * Referências:
 *   - VrSync: https://developers.grupozap.com/feeds/vrsync/
 *   - OLX: https://developers.olx.com.br/anuncio/xml/real_estate/home.html
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// ─── CORS ────────────────────────────────────────────────────────────────────

const PROD_ORIGINS = [
  "https://intentus-plataform.vercel.app",
  "https://app.intentusrealestate.com.br",
];
const DEV_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const PREVIEW_REGEX = /^https:\/\/intentus-plataform-.+\.vercel\.app$/;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (PROD_ORIGINS.includes(origin)) return true;
  if (DEV_REGEX.test(origin)) return true;
  if (PREVIEW_REGEX.test(origin)) return true;
  const extra = Deno.env.get("ALLOWED_ORIGINS");
  if (extra) for (const o of extra.split(",")) if (o.trim() === origin) return true;
  return false;
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = isAllowedOrigin(origin) ? origin : PROD_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

// ─── Auth ────────────────────────────────────────────────────────────────────

interface AuthContext {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  tenantId: string;
}

async function resolveAuth(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Não autenticado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

  return { supabase, userId: user.id, tenantId: profile.tenant_id };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function num(v: unknown): number { const n = Number(v); return isNaN(n) ? 0 : n; }

// ─── Portal format mappings ──────────────────────────────────────────────────

// property_type → VrSync PropertyType
const VRSYNC_PROPERTY_TYPE: Record<string, string> = {
  apartamento: "Residential / Apartment",
  casa: "Residential / Home",
  terreno: "Residential / Land",
  lote: "Residential / Land",
  comercial: "Commercial / Building",
  rural: "Residential / Farm/Ranch",
  industrial: "Commercial / Industrial",
};

// property_type → OLX SubTipoImovel
const OLX_SUBTIPO: Record<string, string> = {
  apartamento: "Apartamentos",
  casa: "Casas",
  terreno: "Terrenos, sítios e fazendas",
  lote: "Terrenos, sítios e fazendas",
  comercial: "Comércio e indústria",
  rural: "Terrenos, sítios e fazendas",
  industrial: "Comércio e indústria",
};

// purpose → VrSync TransactionType
const VRSYNC_TRANSACTION: Record<string, string[]> = {
  venda: ["For Sale"],
  locacao: ["For Rent"],
  ambos: ["For Sale", "For Rent"],
};

// feature_name → VrSync Feature code (subset of most common)
const VRSYNC_FEATURES: Record<string, string> = {
  piscina: "POOL",
  churrasqueira: "BBQ",
  academia: "GYM",
  sauna: "SAUNA",
  salão de festas: "PARTY_ROOM",
  playground: "PLAYGROUND",
  portaria 24h: "DOORMAN",
  elevador: "ELEVATOR",
  varanda: "BALCONY",
  ar condicionado: "AIR_CONDITIONING",
  aquecimento: "HEATING",
  segurança: "SECURITY_24H",
  jardim: "GARDEN",
  lavanderia: "LAUNDRY",
  mobiliado: "FURNISHED",
};

// ─── Data fetching ───────────────────────────────────────────────────────────

async function fetchProperties(supabase: ReturnType<typeof createClient>, tenantId: string, onlyAvailable = true) {
  let q = supabase
    .from("properties")
    .select("*")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (onlyAvailable) {
    q = q.eq("status", "disponivel");
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as any[];
}

async function fetchMedia(supabase: ReturnType<typeof createClient>, tenantId: string, propertyIds: string[]) {
  if (propertyIds.length === 0) return [];
  const { data } = await supabase
    .from("property_media")
    .select("property_id, media_url, media_type, display_order, caption")
    .eq("tenant_id", tenantId)
    .in("property_id", propertyIds.slice(0, 200))
    .order("display_order", { ascending: true })
    .limit(2000);
  return (data || []) as any[];
}

async function fetchFeatures(supabase: ReturnType<typeof createClient>, tenantId: string, propertyIds: string[]) {
  if (propertyIds.length === 0) return [];
  const { data } = await supabase
    .from("property_features")
    .select("property_id, feature_name")
    .eq("tenant_id", tenantId)
    .in("property_id", propertyIds.slice(0, 200))
    .limit(2000);
  return (data || []) as any[];
}

async function fetchTenant(supabase: ReturnType<typeof createClient>, tenantId: string) {
  const { data } = await supabase
    .from("tenants")
    .select("name, logo_url, settings")
    .eq("id", tenantId)
    .maybeSingle();
  return data as { name: string; logo_url: string | null; settings: any } | null;
}

// ─── Validation ──────────────────────────────────────────────────────────────

interface ValidationError {
  propertyId: string;
  title: string;
  portal: string;
  field: string;
  message: string;
  severity: "error" | "warning";
}

function validateForVrSync(p: any, media: any[], features: any[]): ValidationError[] {
  const errs: ValidationError[] = [];
  const add = (field: string, message: string, severity: "error" | "warning" = "error") =>
    errs.push({ propertyId: p.id, title: p.title || "Sem título", portal: "vrsync", field, message, severity });

  if (!p.title) add("title", "Título é obrigatório");
  if (!p.description || p.description.length < 50) add("description", "Descrição deve ter no mínimo 50 caracteres");
  if (p.description && p.description.length > 3000) add("description", "Descrição não pode exceder 3000 caracteres", "warning");
  if (!p.city) add("city", "Cidade é obrigatória");
  if (!p.state) add("state", "Estado é obrigatório");
  if (!p.neighborhood) add("neighborhood", "Bairro é obrigatório");
  if (!p.zip_code) add("zip_code", "CEP é obrigatório");
  if (!p.property_type || !VRSYNC_PROPERTY_TYPE[p.property_type]) add("property_type", "Tipo de imóvel inválido para VrSync");

  const isLand = ["terreno", "lote"].includes(p.property_type);
  if (!isLand && !num(p.area_built) && !num(p.area_total)) add("area", "Área útil ou total é obrigatória");
  if (isLand && !num(p.area_total)) add("area_total", "Área total é obrigatória para terrenos");

  const isResidential = ["apartamento", "casa"].includes(p.property_type);
  if (isResidential && !p.rooms) add("rooms", "Número de quartos é obrigatório para residencial", "warning");
  if (isResidential && !p.bathrooms) add("bathrooms", "Número de banheiros é obrigatório para residencial", "warning");

  if (!p.purpose) add("purpose", "Finalidade (venda/locação) é obrigatória");
  if (p.purpose === "venda" && !num(p.sale_price)) add("sale_price", "Preço de venda é obrigatório");
  if (p.purpose === "locacao" && !num(p.rental_price)) add("rental_price", "Preço de locação é obrigatório");
  if (p.purpose === "ambos" && !num(p.sale_price) && !num(p.rental_price)) add("price", "Ao menos um preço é obrigatório");

  const photos = media.filter((m: any) => m.media_type === "image" || m.media_type === "photo" || !m.media_type);
  if (photos.length === 0) add("media", "Pelo menos 1 foto é obrigatória");
  if (photos.length < 3) add("media", "Recomendado pelo menos 3 fotos para melhor performance", "warning");

  return errs;
}

function validateForOLX(p: any, media: any[]): ValidationError[] {
  const errs: ValidationError[] = [];
  const add = (field: string, message: string, severity: "error" | "warning" = "error") =>
    errs.push({ propertyId: p.id, title: p.title || "Sem título", portal: "olx", field, message, severity });

  if (!p.property_code && !p.id) add("property_code", "Código do imóvel é obrigatório (max 20 chars)");
  if (!p.property_type || !OLX_SUBTIPO[p.property_type]) add("property_type", "SubTipoImovel inválido para OLX");
  if (!p.zip_code) add("zip_code", "CEP é obrigatório");
  if (!p.description) add("description", "Descrição/Observação é obrigatória");
  if (p.description && p.description.length > 6000) add("description", "Descrição não pode exceder 6000 caracteres", "warning");

  const photos = media.filter((m: any) => m.media_type === "image" || m.media_type === "photo" || !m.media_type);
  if (photos.length === 0) add("media", "Pelo menos 1 foto é recomendada", "warning");

  return errs;
}

// ─── XML Generators ──────────────────────────────────────────────────────────

function generateVrSyncXML(
  properties: any[],
  mediaMap: Map<string, any[]>,
  featureMap: Map<string, string[]>,
  tenant: { name: string; logo_url: string | null; settings: any },
): string {
  const contactEmail = tenant.settings?.portal_email || tenant.settings?.email || "contato@intentusrealestate.com.br";
  const contactName = tenant.name || "Intentus Real Estate";
  const contactPhone = tenant.settings?.portal_phone || tenant.settings?.phone || "";

  let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
  xml += `<ListingDataFeed xmlns="http://www.vivareal.com/schemas/1.0/VRSync"\n`;
  xml += `  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n`;
  xml += `  xsi:schemaLocation="http://www.vivareal.com/schemas/1.0/VRSync http://xml.vivareal.com/vrsync.xsd">\n`;
  xml += `  <Header>\n`;
  xml += `    <Provider>${esc(contactName)}</Provider>\n`;
  xml += `    <Email>${esc(contactEmail)}</Email>\n`;
  xml += `    <ContactName>${esc(contactName)}</ContactName>\n`;
  xml += `    <Telephone>${esc(contactPhone)}</Telephone>\n`;
  xml += `    <Logo>${esc(tenant.logo_url || "")}</Logo>\n`;
  xml += `  </Header>\n`;
  xml += `  <Listings>\n`;

  for (const p of properties) {
    const media = mediaMap.get(p.id) || [];
    const features = featureMap.get(p.id) || [];
    const photos = media.filter((m: any) => m.media_type === "image" || m.media_type === "photo" || !m.media_type);
    const videos = media.filter((m: any) => m.media_type === "video");

    const propType = VRSYNC_PROPERTY_TYPE[p.property_type] || "Residential / Home";
    const transactions = VRSYNC_TRANSACTION[p.purpose] || ["For Sale"];
    const isLand = ["terreno", "lote"].includes(p.property_type);

    xml += `    <Listing>\n`;
    xml += `      <ListingID>${esc(p.property_code || p.id)}</ListingID>\n`;
    xml += `      <Title>${esc(p.title)}</Title>\n`;

    for (const tx of transactions) {
      xml += `      <TransactionType>${tx}</TransactionType>\n`;
    }

    xml += `      <Featured>false</Featured>\n`;

    xml += `      <Location>\n`;
    xml += `        <Country abbreviation="BR">Brasil</Country>\n`;
    xml += `        <State abbreviation="${esc((p.state || "").substring(0, 2).toUpperCase())}">${esc(p.state)}</State>\n`;
    xml += `        <City>${esc(p.city)}</City>\n`;
    xml += `        <Neighborhood>${esc(p.neighborhood)}</Neighborhood>\n`;
    xml += `        <Address>${esc(p.street || "")}</Address>\n`;
    xml += `        <StreetNumber>${esc(p.number || "")}</StreetNumber>\n`;
    xml += `        <Complement>${esc(p.complement || "")}</Complement>\n`;
    xml += `        <PostalCode>${esc((p.zip_code || "").replace(/\D/g, ""))}</PostalCode>\n`;
    if (p.latitude && p.longitude) {
      xml += `        <Latitude>${p.latitude}</Latitude>\n`;
      xml += `        <Longitude>${p.longitude}</Longitude>\n`;
    }
    xml += `      </Location>\n`;

    xml += `      <Details>\n`;
    xml += `        <PropertyType>${propType}</PropertyType>\n`;
    xml += `        <Description><![CDATA[${(p.description || "").substring(0, 3000)}]]></Description>\n`;

    if (num(p.sale_price)) xml += `        <ListPrice currency="BRL">${Math.round(num(p.sale_price))}</ListPrice>\n`;
    if (num(p.rental_price)) xml += `        <RentalPrice currency="BRL" period="Monthly">${Math.round(num(p.rental_price))}</RentalPrice>\n`;
    if (num(p.condominium_fee)) xml += `        <PropertyAdministrationFee currency="BRL">${Math.round(num(p.condominium_fee))}</PropertyAdministrationFee>\n`;
    if (num(p.iptu)) xml += `        <Iptu currency="BRL" period="Yearly">${Math.round(num(p.iptu))}</Iptu>\n`;

    if (!isLand) {
      if (num(p.area_built)) xml += `        <LivingArea unit="square metres">${num(p.area_built)}</LivingArea>\n`;
      else if (num(p.area_total)) xml += `        <LivingArea unit="square metres">${num(p.area_total)}</LivingArea>\n`;
    }
    if (num(p.area_total)) xml += `        <LotArea unit="square metres">${num(p.area_total)}</LotArea>\n`;

    if (p.rooms) xml += `        <Bedrooms>${p.rooms}</Bedrooms>\n`;
    if (p.bathrooms) xml += `        <Bathrooms>${p.bathrooms}</Bathrooms>\n`;
    if (p.suites) xml += `        <Suites>${p.suites}</Suites>\n`;
    if (p.parking_spots) xml += `        <Garage type="Parking Space">${p.parking_spots}</Garage>\n`;

    // Features
    const vrsyncFeatures = features
      .map((f: string) => VRSYNC_FEATURES[f.toLowerCase()])
      .filter(Boolean);
    if (vrsyncFeatures.length > 0) {
      xml += `        <Features>\n`;
      for (const feat of vrsyncFeatures) {
        xml += `          <Feature>${feat}</Feature>\n`;
      }
      xml += `        </Features>\n`;
    }

    xml += `      </Details>\n`;

    // Media
    xml += `      <Media>\n`;
    for (const photo of photos.slice(0, 50)) {
      xml += `        <Item medium="image">${esc(photo.media_url)}</Item>\n`;
    }
    for (const video of videos.slice(0, 3)) {
      xml += `        <Item medium="video">${esc(video.media_url)}</Item>\n`;
    }
    xml += `      </Media>\n`;

    // ContactInfo
    xml += `      <ContactInfo>\n`;
    xml += `        <Name>${esc(contactName)}</Name>\n`;
    xml += `        <Email>${esc(contactEmail)}</Email>\n`;
    if (contactPhone) xml += `        <Telephone>${esc(contactPhone)}</Telephone>\n`;
    xml += `      </ContactInfo>\n`;

    xml += `    </Listing>\n`;
  }

  xml += `  </Listings>\n`;
  xml += `</ListingDataFeed>`;
  return xml;
}

function generateOLXXML(
  properties: any[],
  mediaMap: Map<string, any[]>,
  tenant: { name: string; logo_url: string | null; settings: any },
): string {
  let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
  xml += `<Carga xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n`;
  xml += `  xsi:noNamespaceSchemaLocation="http://feed.olx.com.br/real_estate_v2.xsd">\n`;

  for (const p of properties) {
    const media = mediaMap.get(p.id) || [];
    const photos = media.filter((m: any) => m.media_type === "image" || m.media_type === "photo" || !m.media_type);
    const code = (p.property_code || p.id.substring(0, 20));

    xml += `  <Imovel>\n`;
    xml += `    <CodigoImovel>${esc(code)}</CodigoImovel>\n`;
    xml += `    <TipoImovel>Imóvel</TipoImovel>\n`;
    xml += `    <SubTipoImovel>${esc(OLX_SUBTIPO[p.property_type] || "Casas")}</SubTipoImovel>\n`;
    xml += `    <CategoriaImovel>${p.purpose === "locacao" ? "Aluguel" : "Venda"}</CategoriaImovel>\n`;

    xml += `    <CEP>${esc((p.zip_code || "").replace(/\D/g, ""))}</CEP>\n`;
    if (p.street) xml += `    <Endereco>${esc(p.street)}</Endereco>\n`;
    if (p.number) xml += `    <Numero>${esc(p.number)}</Numero>\n`;
    if (p.complement) xml += `    <Complemento>${esc(p.complement)}</Complemento>\n`;
    if (p.neighborhood) xml += `    <Bairro>${esc(p.neighborhood)}</Bairro>\n`;
    if (p.city) xml += `    <Cidade>${esc(p.city)}</Cidade>\n`;
    if (p.state) xml += `    <UF>${esc((p.state || "").substring(0, 2).toUpperCase())}</UF>\n`;

    xml += `    <Observacao><![CDATA[${(p.description || "").substring(0, 6000)}]]></Observacao>\n`;

    if (num(p.sale_price)) xml += `    <PrecoVenda>${Math.round(num(p.sale_price))}</PrecoVenda>\n`;
    if (num(p.rental_price)) xml += `    <PrecoAluguel>${Math.round(num(p.rental_price))}</PrecoAluguel>\n`;
    if (num(p.condominium_fee)) xml += `    <PrecoCondominio>${Math.round(num(p.condominium_fee))}</PrecoCondominio>\n`;
    if (num(p.iptu)) xml += `    <ValorIPTU>${Math.round(num(p.iptu))}</ValorIPTU>\n`;

    if (num(p.area_total)) xml += `    <AreaTotal>${num(p.area_total)}</AreaTotal>\n`;
    if (num(p.area_built)) xml += `    <AreaUtil>${num(p.area_built)}</AreaUtil>\n`;

    if (p.rooms) xml += `    <QtdDormitorios>${p.rooms}</QtdDormitorios>\n`;
    if (p.suites) xml += `    <QtdSuites>${p.suites}</QtdSuites>\n`;
    if (p.bathrooms) xml += `    <QtdBanheiros>${p.bathrooms}</QtdBanheiros>\n`;
    if (p.parking_spots) xml += `    <QtdVagas>${p.parking_spots}</QtdVagas>\n`;

    // Fotos (max 20 para OLX)
    if (photos.length > 0) {
      xml += `    <Fotos>\n`;
      for (const photo of photos.slice(0, 20)) {
        xml += `      <Foto>\n`;
        xml += `        <URLArquivo>${esc(photo.media_url)}</URLArquivo>\n`;
        xml += `      </Foto>\n`;
      }
      xml += `    </Fotos>\n`;
    }

    xml += `  </Imovel>\n`;
  }

  xml += `</Carga>`;
  return xml;
}

// ─── Main handler ────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const hdrs = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: hdrs });

  try {
    const { action, ...params } = await req.json();
    const auth = await resolveAuth(req);
    const { supabase, tenantId } = auth;

    // ── generate_xml ──────────────────────────────────────────────────────
    if (action === "generate_xml") {
      const format = params.format || "vrsync"; // vrsync | olx
      const propertyIds: string[] | undefined = params.property_ids; // optional filter

      let properties = await fetchProperties(supabase, tenantId, true);

      // Filter by specific IDs if provided
      if (propertyIds && propertyIds.length > 0) {
        const idSet = new Set(propertyIds);
        properties = properties.filter((p: any) => idSet.has(p.id));
      }

      // Filter only properties marked for this portal (if published_portals is set)
      const portalKey = format === "olx" ? "olx" : "grupozap";
      properties = properties.filter((p: any) => {
        if (!p.published_portals || p.published_portals.length === 0) return true; // default: all portals
        return p.published_portals.includes(portalKey);
      });

      const pIds = properties.map((p: any) => p.id);
      const [media, features, tenant] = await Promise.all([
        fetchMedia(supabase, tenantId, pIds),
        fetchFeatures(supabase, tenantId, pIds),
        fetchTenant(supabase, tenantId),
      ]);

      const mediaMap = new Map<string, any[]>();
      for (const m of media) {
        if (!mediaMap.has(m.property_id)) mediaMap.set(m.property_id, []);
        mediaMap.get(m.property_id)!.push(m);
      }

      const featureMap = new Map<string, string[]>();
      for (const f of features) {
        if (!featureMap.has(f.property_id)) featureMap.set(f.property_id, []);
        featureMap.get(f.property_id)!.push(f.feature_name);
      }

      const tenantData = tenant || { name: "Intentus", logo_url: null, settings: {} };

      let xml: string;
      if (format === "olx") {
        xml = generateOLXXML(properties, mediaMap, tenantData);
      } else {
        xml = generateVrSyncXML(properties, mediaMap, featureMap, tenantData);
      }

      return new Response(JSON.stringify({
        xml,
        format,
        propertyCount: properties.length,
        generatedAt: new Date().toISOString(),
      }), { headers: { ...hdrs, "Content-Type": "application/json" } });
    }

    // ── validate_properties ───────────────────────────────────────────────
    if (action === "validate_properties") {
      const format = params.format || "all"; // vrsync | olx | all

      const properties = await fetchProperties(supabase, tenantId, true);
      const pIds = properties.map((p: any) => p.id);
      const [media, features] = await Promise.all([
        fetchMedia(supabase, tenantId, pIds),
        fetchFeatures(supabase, tenantId, pIds),
      ]);

      const mediaMap = new Map<string, any[]>();
      for (const m of media) {
        if (!mediaMap.has(m.property_id)) mediaMap.set(m.property_id, []);
        mediaMap.get(m.property_id)!.push(m);
      }

      const featureMap = new Map<string, string[]>();
      for (const f of features) {
        if (!featureMap.has(f.property_id)) featureMap.set(f.property_id, []);
        featureMap.get(f.property_id)!.push(f.feature_name);
      }

      const allErrors: ValidationError[] = [];
      for (const p of properties) {
        const pMedia = mediaMap.get(p.id) || [];
        const pFeatures = featureMap.get(p.id) || [];
        if (format === "vrsync" || format === "all") {
          allErrors.push(...validateForVrSync(p, pMedia, pFeatures));
        }
        if (format === "olx" || format === "all") {
          allErrors.push(...validateForOLX(p, pMedia));
        }
      }

      // Summary
      const errorCount = allErrors.filter((e) => e.severity === "error").length;
      const warningCount = allErrors.filter((e) => e.severity === "warning").length;
      const validVrSync = properties.filter((p: any) => {
        const pMedia = mediaMap.get(p.id) || [];
        const pFeatures = featureMap.get(p.id) || [];
        return validateForVrSync(p, pMedia, pFeatures).filter((e) => e.severity === "error").length === 0;
      }).length;
      const validOLX = properties.filter((p: any) => {
        const pMedia = mediaMap.get(p.id) || [];
        return validateForOLX(p, pMedia).filter((e) => e.severity === "error").length === 0;
      }).length;

      return new Response(JSON.stringify({
        totalProperties: properties.length,
        validVrSync,
        validOLX,
        errorCount,
        warningCount,
        errors: allErrors,
      }), { headers: { ...hdrs, "Content-Type": "application/json" } });
    }

    // ── get_dashboard ─────────────────────────────────────────────────────
    if (action === "get_dashboard") {
      const properties = await fetchProperties(supabase, tenantId, false);
      const available = properties.filter((p: any) => p.status === "disponivel");
      const pIds = available.map((p: any) => p.id);
      const [media, features] = await Promise.all([
        fetchMedia(supabase, tenantId, pIds),
        fetchFeatures(supabase, tenantId, pIds),
      ]);

      const mediaMap = new Map<string, any[]>();
      for (const m of media) {
        if (!mediaMap.has(m.property_id)) mediaMap.set(m.property_id, []);
        mediaMap.get(m.property_id)!.push(m);
      }

      const featureMap = new Map<string, string[]>();
      for (const f of features) {
        if (!featureMap.has(f.property_id)) featureMap.set(f.property_id, []);
        featureMap.get(f.property_id)!.push(f.feature_name);
      }

      // Count by portal
      const portalStats: Record<string, { total: number; valid: number; errors: number; warnings: number }> = {
        grupozap: { total: 0, valid: 0, errors: 0, warnings: 0 },
        olx: { total: 0, valid: 0, errors: 0, warnings: 0 },
      };

      // Per-property status
      const propertyStatuses: any[] = [];

      for (const p of available) {
        const pMedia = mediaMap.get(p.id) || [];
        const pFeatures = featureMap.get(p.id) || [];
        const vrsyncErrors = validateForVrSync(p, pMedia, pFeatures);
        const olxErrors = validateForOLX(p, pMedia);

        const publishedTo = p.published_portals || [];
        const isGrupoZap = publishedTo.length === 0 || publishedTo.includes("grupozap");
        const isOLX = publishedTo.length === 0 || publishedTo.includes("olx");

        if (isGrupoZap) {
          portalStats.grupozap.total++;
          const criticalErrors = vrsyncErrors.filter((e) => e.severity === "error").length;
          if (criticalErrors === 0) portalStats.grupozap.valid++;
          else portalStats.grupozap.errors += criticalErrors;
          portalStats.grupozap.warnings += vrsyncErrors.filter((e) => e.severity === "warning").length;
        }
        if (isOLX) {
          portalStats.olx.total++;
          const criticalErrors = olxErrors.filter((e) => e.severity === "error").length;
          if (criticalErrors === 0) portalStats.olx.valid++;
          else portalStats.olx.errors += criticalErrors;
          portalStats.olx.warnings += olxErrors.filter((e) => e.severity === "warning").length;
        }

        propertyStatuses.push({
          id: p.id,
          title: p.title,
          propertyCode: p.property_code,
          propertyType: p.property_type,
          purpose: p.purpose,
          city: p.city,
          neighborhood: p.neighborhood,
          salePrice: num(p.sale_price),
          rentalPrice: num(p.rental_price),
          photoCount: pMedia.filter((m: any) => m.media_type === "image" || m.media_type === "photo" || !m.media_type).length,
          publishedPortals: publishedTo,
          vrsyncValid: vrsyncErrors.filter((e) => e.severity === "error").length === 0,
          olxValid: olxErrors.filter((e) => e.severity === "error").length === 0,
          vrsyncErrors: vrsyncErrors.length,
          olxErrors: olxErrors.length,
        });
      }

      const tenant = await fetchTenant(supabase, tenantId);
      const portalSettings = tenant?.settings?.portal_settings || {};

      return new Response(JSON.stringify({
        totalProperties: properties.length,
        availableProperties: available.length,
        portalStats,
        propertyStatuses,
        portalSettings,
      }), { headers: { ...hdrs, "Content-Type": "application/json" } });
    }

    // ── toggle_property_portal ────────────────────────────────────────────
    if (action === "toggle_property_portal") {
      const { property_id, portal, enabled } = params;
      if (!property_id || !portal) throw new Error("property_id e portal são obrigatórios");

      const { data: prop } = await supabase
        .from("properties")
        .select("published_portals")
        .eq("id", property_id)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (!prop) throw new Error("Imóvel não encontrado");

      let portals: string[] = prop.published_portals || [];
      if (enabled && !portals.includes(portal)) {
        portals.push(portal);
      } else if (!enabled) {
        portals = portals.filter((p: string) => p !== portal);
      }

      const { error } = await supabase
        .from("properties")
        .update({ published_portals: portals, updated_at: new Date().toISOString() })
        .eq("id", property_id)
        .eq("tenant_id", tenantId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, published_portals: portals }), {
        headers: { ...hdrs, "Content-Type": "application/json" },
      });
    }

    // ── update_portal_settings ────────────────────────────────────────────
    if (action === "update_portal_settings") {
      const { portal_settings } = params;
      if (!portal_settings) throw new Error("portal_settings é obrigatório");

      const tenant = await fetchTenant(supabase, tenantId);
      const currentSettings = tenant?.settings || {};
      const newSettings = { ...currentSettings, portal_settings };

      const { error } = await supabase
        .from("tenants")
        .update({ settings: newSettings })
        .eq("id", tenantId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...hdrs, "Content-Type": "application/json" },
      });
    }

    // ── get_property_status ───────────────────────────────────────────────
    if (action === "get_property_status") {
      const { property_id } = params;
      if (!property_id) throw new Error("property_id é obrigatório");

      const { data: p } = await supabase
        .from("properties")
        .select("*")
        .eq("id", property_id)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (!p) throw new Error("Imóvel não encontrado");

      const [media, features] = await Promise.all([
        fetchMedia(supabase, tenantId, [property_id]),
        fetchFeatures(supabase, tenantId, [property_id]),
      ]);

      const featureNames = features.map((f: any) => f.feature_name);
      const vrsyncErrors = validateForVrSync(p, media, featureNames);
      const olxErrors = validateForOLX(p, media);

      return new Response(JSON.stringify({
        property: {
          id: p.id,
          title: p.title,
          propertyCode: p.property_code,
          publishedPortals: p.published_portals || [],
        },
        vrsync: { valid: vrsyncErrors.filter((e) => e.severity === "error").length === 0, errors: vrsyncErrors },
        olx: { valid: olxErrors.filter((e) => e.severity === "error").length === 0, errors: olxErrors },
        mediaCount: media.length,
        featureCount: featureNames.length,
      }), { headers: { ...hdrs, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
      status: 400, headers: { ...hdrs, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 500, headers: { ...hdrs, "Content-Type": "application/json" },
    });
  }
});
