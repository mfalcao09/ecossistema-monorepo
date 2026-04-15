// pricing-ai v24r8 — Edge Function com Apify (VivaReal + ZapImóveis) + OpenAI
// Deploy: via Supabase MCP (deploy_edge_function)
// verify_jwt: false
//
// Changelog v24r8: Filtro por tipo de imóvel (URL + post-processing)
//   - CHANGE 1: resolveProperty() agora inclui property_type da tabela properties
//   - CHANGE 2: Mapeamento Intentus → VivaReal slug (ex: apartamento → apartamento_residencial)
//   - CHANGE 3: Mapeamento Intentus → ZapImóveis slug (ex: apartamento → apartamentos)
//   - CHANGE 4: URLs dinâmicas com slug do tipo de imóvel no path
//     - VivaReal: /{tx}/{uf}/{cidade}/bairros/{bairro}/{tipoSlug}/
//     - ZapImóveis: /{tx}/{tipoSlug}/{uf}+{cidade}++{bairroSlug}/
//   - CHANGE 5: normalizeApifyItem() extrai propertyType do raw Apify data
//   - CHANGE 6: Post-processing filter applyPropertyTypeFilter() como safety net
//   - Mantido: TX filter boundary, two-pass, safe fallback, geo filter, round-robin, confidence
// Changelog v24r8: Remove /apartamento_residencial/ + adiciona ZapImóveis como 2ª fonte
// Changelog v24r6: Fix URL VivaReal — adiciona /bairros/ no path do bairro
// Changelog v24r5: TX filter boundary — NUNCA misturar venda com locação
// Changelog v24r4: Two-pass scraping + never-fail strategy + maxResults 150
// Changelog v24r3: Field normalization + resilient area handling + diagnostic logging
// Changelog v24r2: Fix contract_type mapping + neighborhood URL + post-processing filters
// Changelog v24r-fix: Corrigido endpoint Apify
// Changelog v24: Timeout 180s, filtro área ±70%, single actor VivaReal

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APIFY_TOKEN = Deno.env.get('APIFY_TOKEN') || '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

// Actors Apify — v24r8: 2 actors em paralelo
const ACTOR_VIVAREAL = 'f1xSvpkpklEh2EhGJ';
const ACTOR_ZAPIMOVEIS = 'avorio~zap-imoveis-scraper';

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_TIME_MS = 180000; // 3 minutos

interface ApifyListing {
  id?: string;
  title?: string;
  price?: number;
  priceFormatted?: string;
  area?: number;
  neighborhood?: string;
  city?: string;
  address?: string;
  url?: string;
  source?: string;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpaces?: number;
  propertyType?: string; // v24r8: tipo de imóvel normalizado
}

// ===================== PROPERTY TYPE SLUG MAPPINGS (v24r8) =====================

// Intentus property_type → VivaReal URL path slug
const VIVAREAL_TYPE_SLUGS: Record<string, string> = {
  'apartamento': 'apartamento_residencial',
  'casa':        'casa_residencial',
  'terreno':     'lote-terreno_residencial',
  'lote':        'lote-terreno_residencial',
  'comercial':   'imovel-comercial_comercial',
  'rural':       'granja_residencial',
  'industrial':  'galpao_comercial',
};

// Intentus property_type → ZapImóveis URL path slug
const ZAP_TYPE_SLUGS: Record<string, string> = {
  'apartamento': 'apartamentos',
  'casa':        'casas',
  'terreno':     'terrenos-lotes-e-areas',
  'lote':        'terrenos-lotes-e-areas',
  'comercial':   'comercial',
  'rural':       'rural',
  'industrial':  'comercial',
};

// Property type compatibility groups for post-processing filter
// Maps Apify raw property type strings → Intentus categories they match
const PROPERTY_TYPE_COMPAT: Record<string, string[]> = {
  'apartamento': ['apartamento', 'apartment', 'flat', 'kitnet', 'studio', 'loft', 'cobertura', 'penthouse', 'duplex'],
  'casa':        ['casa', 'house', 'sobrado', 'townhouse', 'vila', 'bangalo', 'condominio', 'residencial'],
  'terreno':     ['terreno', 'lote', 'land', 'area', 'gleba', 'chacara'],
  'lote':        ['terreno', 'lote', 'land', 'area', 'gleba', 'chacara'],
  'comercial':   ['comercial', 'commercial', 'sala', 'loja', 'escritorio', 'office', 'galpao', 'ponto'],
  'rural':       ['rural', 'fazenda', 'sitio', 'chacara', 'granja', 'ranch', 'farm'],
  'industrial':  ['industrial', 'galpao', 'warehouse', 'armazem', 'fabrica', 'deposito'],
};

interface TopComparable {
  title: string;
  price: number;
  area: number;
  pricePerSqm: number;
  neighborhood: string;
  city: string;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  source: string;
  url: string;
}

// ===================== ZAP IMÓVEIS SLUG ABBREVIATION (v24r8) =====================

/**
 * ZapImóveis usa slugs abreviados para bairros.
 * Ex: "Vila Pires" → "vl-pires", "Nova América" → "nv-america"
 * A abreviação é aplicada a CADA palavra do nome do bairro.
 */
const ZAP_ABBREVIATIONS: Record<string, string> = {
  'vila': 'vl',
  'jardim': 'jd',
  'nova': 'nv',
  'novo': 'nv',
  'parque': 'pq',
  'santa': 'sta',
  'santo': 'sto',
  'são': 's',
  'sao': 's',
  'loteamento': 'lot',
  'residencial': 'res',
  'conjunto': 'cj',
  'habitacional': 'hab',
  'chácara': 'ch',
  'chacara': 'ch',
  'condomínio': 'cond',
  'condominio': 'cond',
  'estância': 'est',
  'estancia': 'est',
  'portal': 'ptl',
  'recanto': 'rec',
  'cidade': 'cid',
};

function buildZapNeighborhoodSlug(neighborhood: string): string {
  if (!neighborhood) return '';

  // Normaliza: remove acentos, lowercase
  const normalized = neighborhood.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Divide em palavras
  const words = normalized.split(/\s+/);

  // Aplica abreviações a cada palavra
  const slugWords = words.map((word) => {
    // Verifica no mapa de abreviações (sem acento)
    const cleanWord = word.replace(/[^a-z0-9]/g, '');
    return ZAP_ABBREVIATIONS[cleanWord] || cleanWord;
  });

  return slugWords.join('-');
}

// ===================== APIFY FIELD NORMALIZATION (v24r3) =====================

function normalizeApifyItem(raw: Record<string, any>): ApifyListing {
  // Price: tenta vários campos possíveis
  const price = raw.price ?? raw.listingPrice ?? raw.rentPrice ?? raw.salePrice ??
                raw.value ?? raw.priceValue ?? raw.priceNum ?? raw.totalPrice ??
                (raw.pricingInfos?.[0]?.price ?? null) ??
                (typeof raw.priceFormatted === 'string' ? parseFloat(raw.priceFormatted.replace(/[^\d.,]/g, '').replace(',', '.')) : null) ??
                0;

  // Area: tenta vários campos possíveis
  const area = raw.area ?? raw.totalArea ?? raw.usableArea ?? raw.areaTotal ??
               raw.areaUsable ?? raw.squareMeters ?? raw.size ?? raw.areaM2 ??
               raw.usableAreas ?? raw.totalAreas ?? 0;

  // City: pode estar nested em location ou address
  const city = raw.city ?? raw.location?.city ?? raw.address?.city ??
               raw.locationCity ?? raw.cityName ?? '';

  // Neighborhood: pode estar nested
  const neighborhood = raw.neighborhood ?? raw.location?.neighborhood ?? raw.address?.neighborhood ??
                       raw.district ?? raw.locationNeighborhood ?? raw.neighbourhoodName ?? '';

  // URL
  const url = raw.url ?? raw.link ?? raw.listingUrl ?? raw.detailUrl ?? raw.pageUrl ?? '';

  // Source — v24r8: normaliza nomes de fonte
  const rawSource = raw.source ?? raw.origin ?? raw.portal ?? '';
  let source = String(rawSource).toLowerCase();
  if (source.includes('vivareal') || source.includes('viva real')) source = 'vivareal';
  else if (source.includes('zap') || source.includes('zapimoveis')) source = 'zapimoveis';
  else if (source.includes('olx')) source = 'olx';
  else if (!source) source = 'unknown';

  // v24r8: Property type — extract from various raw field names
  const rawPropertyType = raw.propertyType ?? raw.unitTypes ?? raw.listingType ?? raw.type ??
                          raw.property_type ?? raw.typeProperty ?? raw.categoria ?? '';
  // Normalize: pode ser array (ex: ["APARTMENT"]) ou string
  let propertyTypeStr = '';
  if (Array.isArray(rawPropertyType)) {
    propertyTypeStr = String(rawPropertyType[0] || '').toLowerCase();
  } else {
    propertyTypeStr = String(rawPropertyType).toLowerCase();
  }
  // Normalize common English/Portuguese variations
  propertyTypeStr = propertyTypeStr
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]/g, ' ').trim();

  return {
    id: raw.id ?? raw.listingId ?? undefined,
    title: raw.title ?? raw.description?.substring(0, 100) ?? raw.name ?? undefined,
    price: typeof price === 'number' ? price : parseFloat(String(price)) || 0,
    priceFormatted: raw.priceFormatted ?? undefined,
    area: typeof area === 'number' ? area : parseFloat(String(area)) || 0,
    neighborhood: String(neighborhood),
    city: String(city),
    address: raw.address && typeof raw.address === 'string' ? raw.address : raw.fullAddress ?? raw.streetAddress ?? undefined,
    url: String(url),
    source,
    bedrooms: raw.bedrooms ?? raw.rooms ?? raw.dormitorios ?? raw.dorms ?? 0,
    bathrooms: raw.bathrooms ?? raw.banheiros ?? raw.suites ?? 0,
    parkingSpaces: raw.parkingSpaces ?? raw.garages ?? raw.vagas ?? raw.garage ?? 0,
    propertyType: propertyTypeStr || undefined,
  };
}

// ===================== APIFY POLLING =====================

async function pollApifyRun(runId: string, label: string): Promise<Record<string, any>[]> {
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_POLL_TIME_MS) {
    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}`,
      { headers: { Authorization: `Bearer ${APIFY_TOKEN}` } },
    );
    const { data } = await statusRes.json();
    const status = data?.status;

    console.log(`[pricing-ai] v24r8 poll [${label}]: status=${status}, elapsed=${Math.round((Date.now() - startTime) / 1000)}s`);

    if (['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED_OUT'].includes(status)) {
      if (status === 'SUCCEEDED' && data.defaultDatasetId) {
        const dsRes = await fetch(
          `https://api.apify.com/v2/datasets/${data.defaultDatasetId}/items`,
          { headers: { Authorization: `Bearer ${APIFY_TOKEN}` } },
        );
        const items = await dsRes.json();
        console.log(`[pricing-ai] v24r8 dataset [${label}]: ${Array.isArray(items) ? items.length : 0} listings`);
        return Array.isArray(items) ? items : [];
      }
      console.warn(`[pricing-ai] v24r8 [${label}] actor finished with status: ${status}`);
      return [];
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  console.error(`[pricing-ai] v24r8 [${label}] timeout after ${MAX_POLL_TIME_MS}ms`);
  return [];
}

// ===================== SCRAPE VIVAREAL (v24r8: sem /apartamento_residencial/) =====================

async function scrapeVivaReal(vivarealUrl: string, maxResults: number): Promise<Record<string, any>[]> {
  console.log(`[pricing-ai] v24r8 scrapeVivaReal: ${vivarealUrl} (maxResults=${maxResults})`);

  const runRes = await fetch(`https://api.apify.com/v2/acts/${ACTOR_VIVAREAL}/runs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${APIFY_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startUrls: [{ url: vivarealUrl }],
      maxResults,
    }),
  });

  const { data: runData } = await runRes.json();

  if (!runData?.id) {
    console.error(`[pricing-ai] v24r8 scrapeVivaReal: failed to start run for ${vivarealUrl}`);
    return [];
  }

  console.log(`[pricing-ai] v24r8 vivareal run started: ${runData.id}`);
  return await pollApifyRun(runData.id, 'vivareal');
}

// ===================== SCRAPE ZAPIMOVEIS (v24r8: NEW) =====================

async function scrapeZapImoveis(zapUrl: string, maxResults: number): Promise<Record<string, any>[]> {
  console.log(`[pricing-ai] v24r8 scrapeZapImoveis: ${zapUrl} (maxResults=${maxResults})`);

  try {
    const runRes = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ZAPIMOVEIS}/runs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${APIFY_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startUrls: [{ url: zapUrl }],
        maxResults,
      }),
    });

    // Verifica se o actor existe/responde
    if (!runRes.ok) {
      const errText = await runRes.text();
      console.warn(`[pricing-ai] v24r8 scrapeZapImoveis: actor start failed (${runRes.status}): ${errText.substring(0, 200)}`);
      return [];
    }

    const { data: runData } = await runRes.json();

    if (!runData?.id) {
      console.error(`[pricing-ai] v24r8 scrapeZapImoveis: no run ID returned`);
      return [];
    }

    console.log(`[pricing-ai] v24r8 zapimoveis run started: ${runData.id}`);
    return await pollApifyRun(runData.id, 'zapimoveis');
  } catch (err) {
    console.warn(`[pricing-ai] v24r8 scrapeZapImoveis: error:`, err);
    return [];
  }
}

// ===================== PROPERTY RESOLUTION =====================

async function resolveProperty(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, any>,
): Promise<{
  neighborhood: string;
  city: string;
  state: string;
  area: number;
  property_id?: string;
  property_type?: string; // v24r8: tipo de imóvel
}> {
  const { contract_id, property_id, neighborhood, city, state } = body;

  // Strategy 1: direct property_id
  if (property_id) {
    const { data } = await supabase
      .from('properties')
      .select('id, neighborhood, city, state, area_total, area_built, property_type')
      .eq('id', property_id)
      .maybeSingle();
    if (data) {
      return {
        property_id: data.id,
        neighborhood: data.neighborhood || '',
        city: data.city || '',
        state: data.state || '',
        area: data.area_total || data.area_built || 0,
        property_type: data.property_type || undefined,
      };
    }
  }

  // Strategy 2: contract_id → property_id → properties
  if (contract_id) {
    const { data: contract } = await supabase
      .from('contracts')
      .select('property_id')
      .eq('id', contract_id)
      .maybeSingle();
    if (contract?.property_id) {
      const { data } = await supabase
        .from('properties')
        .select('id, neighborhood, city, state, area_total, area_built, property_type')
        .eq('id', contract.property_id)
        .maybeSingle();
      if (data) {
        return {
          property_id: data.id,
          neighborhood: data.neighborhood || '',
          city: data.city || '',
          state: data.state || '',
          area: data.area_total || data.area_built || 0,
          property_type: data.property_type || undefined,
        };
      }
    }
  }

  // Strategy 3: body params
  if (neighborhood && city) {
    return {
      neighborhood,
      city,
      state: state || 'SP',
      area: body.area || 0,
      property_type: body.property_type || undefined,
    };
  }

  throw new Error('Não foi possível identificar o imóvel. Envie property_id, contract_id, ou neighborhood+city.');
}

// ===================== STATS CALCULATION =====================

function calculateStats(
  listings: ApifyListing[],
  targetArea: number,
): {
  suggested_value: number;
  suggested_min_value: number;
  suggested_max_value: number;
  confidence_score: number;
  avg_price_per_sqm: number;
  median_price_per_sqm: number;
  avg_price: number;
  median_price: number;
  total_comparables: number;
  tier_used: string;
  sources: Record<string, number>;
  comparables: TopComparable[];
} {
  const withPriceAndArea = listings.filter((l) => (l.price ?? 0) > 0 && (l.area ?? 0) > 0);
  const withPriceOnly = listings.filter((l) => (l.price ?? 0) > 0);

  console.log(`[pricing-ai] v24r8 calculateStats: ${listings.length} input, ${withPriceAndArea.length} with price+area, ${withPriceOnly.length} with price only`);

  if (withPriceOnly.length === 0) {
    return {
      suggested_value: 0, suggested_min_value: 0, suggested_max_value: 0,
      confidence_score: 0, avg_price_per_sqm: 0, median_price_per_sqm: 0,
      avg_price: 0, median_price: 0, total_comparables: 0, tier_used: 'none',
      sources: {}, comparables: [],
    };
  }

  // v24r3: Decide se usa mode "com área" ou "só preço"
  const useAreaMode = withPriceAndArea.length >= 3;
  const valid = useAreaMode ? withPriceAndArea : withPriceOnly;

  if (!useAreaMode) {
    console.log(`[pricing-ai] v24r8 FALLBACK: Usando preço direto (apenas ${withPriceAndArea.length} listings têm área)`);
  }

  let filtered: ApifyListing[];
  let top: ApifyListing[];

  if (useAreaMode) {
    const minArea = Math.max(targetArea * 0.3, 10);
    const maxArea = targetArea * 1.7;
    filtered = valid.filter((l) => l.area! >= minArea && l.area! <= maxArea);
    if (filtered.length === 0) filtered = valid;
    filtered.sort((a, b) => Math.abs((a.area ?? 0) - targetArea) - Math.abs((b.area ?? 0) - targetArea));
    top = filtered.slice(0, 15);
  } else {
    filtered = [...valid];
    filtered.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    top = filtered.slice(0, 15);
  }

  let avgPriceSqm = 0;
  let medianPriceSqm = 0;

  if (useAreaMode) {
    const pricesPerSqm = top.map((l) => l.price! / l.area!);
    pricesPerSqm.sort((a, b) => a - b);
    avgPriceSqm = pricesPerSqm.reduce((a, b) => a + b, 0) / pricesPerSqm.length;
    medianPriceSqm = pricesPerSqm[Math.floor(pricesPerSqm.length / 2)];
  }

  const prices = top.map((l) => l.price!);
  prices.sort((a, b) => a - b);

  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const medianPrice = prices[Math.floor(prices.length / 2)];

  let suggestedValue: number;
  if (useAreaMode && targetArea > 0) {
    suggestedValue = Math.round(medianPriceSqm * targetArea);
  } else {
    suggestedValue = Math.round(medianPrice);
  }

  const suggestedMin = Math.round(suggestedValue * 0.85);
  const suggestedMax = Math.round(suggestedValue * 1.15);

  let confidence = 50;
  if (top.length >= 10) confidence = 80;
  else if (top.length >= 5) confidence = 65;
  else if (top.length >= 3) confidence = 55;
  else if (top.length >= 1) confidence = 35;
  else confidence = 20;

  if (!useAreaMode) {
    confidence = Math.max(confidence - 15, 15);
  }

  const tier = top.length >= 3 ? 'neighborhood' : top.length >= 1 ? 'city' : 'none';

  const sourcesMap: Record<string, number> = {};
  top.forEach((l) => {
    const src = (l.source || 'unknown').toLowerCase();
    sourcesMap[src] = (sourcesMap[src] || 0) + 1;
  });

  // v24r8: Round-robin balanceado na seleção de comparáveis (mix de fontes)
  const topForComparables = selectBalancedComparables(top, 10);

  const comparables: TopComparable[] = topForComparables.map((l) => ({
    title: l.title || 'Sem título',
    price: l.price!,
    area: l.area ?? 0,
    pricePerSqm: (l.area && l.area > 0) ? Math.round(l.price! / l.area) : 0,
    neighborhood: l.neighborhood || '',
    city: l.city || '',
    bedrooms: l.bedrooms || 0,
    bathrooms: l.bathrooms || 0,
    parkingSpaces: l.parkingSpaces || 0,
    source: l.source || 'unknown',
    url: l.url || '',
  }));

  return {
    suggested_value: suggestedValue,
    suggested_min_value: suggestedMin,
    suggested_max_value: suggestedMax,
    confidence_score: confidence,
    avg_price_per_sqm: Math.round(avgPriceSqm * 100) / 100,
    median_price_per_sqm: Math.round(medianPriceSqm * 100) / 100,
    avg_price: Math.round(avgPrice),
    median_price: Math.round(medianPrice),
    total_comparables: top.length,
    tier_used: tier,
    sources: sourcesMap,
    comparables,
  };
}

// ===================== BALANCED COMPARABLE SELECTION (v24r8) =====================

/**
 * Seleciona comparáveis com mix balanceado de fontes (round-robin).
 * Se 2 fontes e max=10: ~5 de cada.
 * Se 1 fonte: todos da mesma.
 */
function selectBalancedComparables(listings: ApifyListing[], maxCount: number): ApifyListing[] {
  if (listings.length <= maxCount) return listings;

  // Agrupa por fonte
  const bySource: Record<string, ApifyListing[]> = {};
  listings.forEach((l) => {
    const src = (l.source || 'unknown').toLowerCase();
    if (!bySource[src]) bySource[src] = [];
    bySource[src].push(l);
  });

  const sources = Object.keys(bySource);
  if (sources.length <= 1) return listings.slice(0, maxCount);

  // Calcula quota por fonte
  const quotaBase = Math.floor(maxCount / sources.length);
  let remainder = maxCount - quotaBase * sources.length;

  const result: ApifyListing[] = [];
  for (const src of sources) {
    const quota = quotaBase + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
    result.push(...bySource[src].slice(0, quota));
  }

  return result;
}

// ===================== STRING NORMALIZATION =====================

const normalizeStr = (s: string) => s.toLowerCase().trim()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ');

// ===================== POST-PROCESSING FILTERS =====================

function applyTxFilter(listings: ApifyListing[], isRental: boolean): ApifyListing[] {
  if (isRental) {
    const filtered = listings.filter((l) => {
      const price = l.price ?? 0;
      return price >= 200 && price <= 50000;
    });
    console.log(`[pricing-ai] v24r8 tx filter (rental): ${listings.length} → ${filtered.length}`);
    return filtered;
  } else {
    const filtered = listings.filter((l) => {
      const price = l.price ?? 0;
      return price >= 30000 && price <= 50000000;
    });
    console.log(`[pricing-ai] v24r8 tx filter (sale): ${listings.length} → ${filtered.length}`);
    return filtered;
  }
}

function applyGeoFilter(
  listings: ApifyListing[],
  targetCity: string,
  targetNeighborhood: string,
): { finalListings: ApifyListing[]; tierUsed: string; neighborhoodCount: number; cityCount: number } {
  const normCity = normalizeStr(targetCity);
  const normNeighborhood = normalizeStr(targetNeighborhood);

  const cityMatches = listings.filter((l) => {
    const listingCity = normalizeStr(l.city || '');
    return listingCity === normCity || listingCity.includes(normCity) || normCity.includes(listingCity);
  });

  const neighborhoodMatches = cityMatches.filter((l) => {
    const listingNeighborhood = normalizeStr(l.neighborhood || '');
    return listingNeighborhood === normNeighborhood ||
           listingNeighborhood.includes(normNeighborhood) ||
           normNeighborhood.includes(listingNeighborhood);
  });

  if (neighborhoodMatches.length >= 1) {
    console.log(`[pricing-ai] v24r8 geo: ${neighborhoodMatches.length} neighborhood matches`);
    return { finalListings: neighborhoodMatches, tierUsed: 'neighborhood', neighborhoodCount: neighborhoodMatches.length, cityCount: cityMatches.length };
  } else if (cityMatches.length >= 1) {
    console.log(`[pricing-ai] v24r8 geo: ${cityMatches.length} city matches (no neighborhood)`);
    return { finalListings: cityMatches, tierUsed: 'city', neighborhoodCount: 0, cityCount: cityMatches.length };
  } else {
    console.log(`[pricing-ai] v24r8 geo: NO matches, using all ${listings.length}`);
    return { finalListings: listings, tierUsed: 'state', neighborhoodCount: 0, cityCount: 0 };
  }
}

// ===================== PROPERTY TYPE FILTER (v24r8) =====================

/**
 * Filtra listings por tipo de imóvel compatível.
 * Usa URL do anúncio + campo propertyType normalizado para determinar tipo.
 * Safety net: se filtro remove todos, retorna lista original (graceful degradation).
 */
function applyPropertyTypeFilter(
  listings: ApifyListing[],
  targetType: string | undefined,
): { filtered: ApifyListing[]; applied: boolean; removedCount: number } {
  if (!targetType || !PROPERTY_TYPE_COMPAT[targetType]) {
    console.log(`[pricing-ai] v24r8 property type filter: SKIP (no target type or unknown: "${targetType}")`);
    return { filtered: listings, applied: false, removedCount: 0 };
  }

  const compatTerms = PROPERTY_TYPE_COMPAT[targetType];

  const matched = listings.filter((l) => {
    // Method 1: Check URL for property type slug clues
    const url = (l.url || '').toLowerCase();
    const urlMatch = compatTerms.some((term) => url.includes(term));
    if (urlMatch) return true;

    // Method 2: Check normalized propertyType field
    if (l.propertyType) {
      const pt = l.propertyType.toLowerCase();
      const fieldMatch = compatTerms.some((term) => pt.includes(term));
      if (fieldMatch) return true;
    }

    // Method 3: Check title for type keywords
    const title = (l.title || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const titleMatch = compatTerms.some((term) => title.includes(term));
    if (titleMatch) return true;

    // No match found — mark for removal
    return false;
  });

  const removedCount = listings.length - matched.length;
  console.log(`[pricing-ai] v24r8 property type filter (${targetType}): ${listings.length} → ${matched.length} (removed ${removedCount})`);

  // Safety net: if filter removes everything, keep all (graceful degradation)
  if (matched.length === 0 && listings.length > 0) {
    console.warn(`[pricing-ai] v24r8 property type filter: would remove ALL listings — keeping original set`);
    return { filtered: listings, applied: false, removedCount: 0 };
  }

  return { filtered: matched, applied: true, removedCount };
}

// ===================== AI ANALYSIS (OpenAI GPT-4o-mini) =====================

async function generateAIAnalysis(
  stats: ReturnType<typeof calculateStats>,
  propNeighborhood: string,
  propCity: string,
  propArea: number,
  contractType?: string,
): Promise<string> {
  if (!OPENAI_API_KEY) {
    return generateLocalAnalysis(stats, propNeighborhood, propCity, propArea, contractType);
  }

  try {
    const isRentalType = contractType === 'locacao' || contractType === 'administracao' ||
                         contractType === 'rental' || contractType === 'lease' ||
                         (contractType || '').includes('aluguel');
    const txLabel = isRentalType ? 'locação' : 'venda';

    const sourcesStr = Object.entries(stats.sources).map(([s, c]) => `${s}: ${c}`).join(', ');

    const prompt = `Você é um analista imobiliário brasileiro. Analise os dados de mercado abaixo e forneça uma avaliação concisa em português.

Imóvel analisado:
- Bairro: ${propNeighborhood}
- Cidade: ${propCity}
- Área: ${propArea > 0 ? propArea + ' m²' : 'não informada'}
- Tipo de transação: ${txLabel}

Dados de mercado:
- Valor sugerido: R$ ${stats.suggested_value.toLocaleString('pt-BR')}
- Faixa: R$ ${stats.suggested_min_value.toLocaleString('pt-BR')} a R$ ${stats.suggested_max_value.toLocaleString('pt-BR')}
- Preço médio/m²: R$ ${stats.avg_price_per_sqm.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Mediana/m²: R$ ${stats.median_price_per_sqm.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Comparáveis analisados: ${stats.total_comparables}
- Confiança: ${stats.confidence_score}%
- Fontes: ${sourcesStr}

Forneça:
1. Um resumo executivo (2-3 linhas)
2. Posicionamento de mercado
3. Fatores de atenção
4. Recomendação final

Responda em markdown. Seja objetivo e profissional.`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      console.warn(`[pricing-ai] v24r8 OpenAI error: ${res.status}`);
      return generateLocalAnalysis(stats, propNeighborhood, propCity, propArea, contractType);
    }

    const json = await res.json();
    return json.choices?.[0]?.message?.content || generateLocalAnalysis(stats, propNeighborhood, propCity, propArea, contractType);
  } catch (err) {
    console.warn('[pricing-ai] v24r8 OpenAI fallback:', err);
    return generateLocalAnalysis(stats, propNeighborhood, propCity, propArea, contractType);
  }
}

function generateLocalAnalysis(
  stats: ReturnType<typeof calculateStats>,
  propNeighborhood: string,
  propCity: string,
  propArea: number,
  contractType?: string,
): string {
  const isRentalType = contractType === 'locacao' || contractType === 'administracao' ||
                       contractType === 'rental' || contractType === 'lease' ||
                       (contractType || '').includes('aluguel');
  const txLabel = isRentalType ? 'locação' : 'venda';

  const sourcesStr = Object.entries(stats.sources).map(([s, c]) => `${s} (${c})`).join(', ');

  let analysis = `## Análise de Mercado — ${propNeighborhood}, ${propCity}\n\n`;
  analysis += `**Tipo**: ${txLabel.charAt(0).toUpperCase() + txLabel.slice(1)}\n\n`;

  if (propArea > 0) {
    analysis += `**Área**: ${propArea} m²\n\n`;
  }

  analysis += `### Valor Sugerido\n`;
  analysis += `**R$ ${stats.suggested_value.toLocaleString('pt-BR')}** `;
  analysis += `(faixa: R$ ${stats.suggested_min_value.toLocaleString('pt-BR')} – R$ ${stats.suggested_max_value.toLocaleString('pt-BR')})\n\n`;

  analysis += `### Indicadores de Mercado\n`;
  analysis += `- Preço médio/m²: R$ ${stats.avg_price_per_sqm.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
  analysis += `- Mediana/m²: R$ ${stats.median_price_per_sqm.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
  analysis += `- Comparáveis: ${stats.total_comparables} imóveis analisados\n`;
  analysis += `- Confiança: ${stats.confidence_score}%\n`;
  analysis += `- Fontes: ${sourcesStr}\n\n`;

  if (stats.confidence_score < 50) {
    analysis += `⚠️ **Atenção**: Confiança baixa — poucos comparáveis encontrados na região. Considere consultar outras fontes.\n\n`;
  }

  analysis += `*Análise v24r8 — dados via VivaReal + ZapImóveis*`;

  return analysis;
}

// ===================== AUTO-PERSIST =====================

async function persistAnalysis(
  supabase: ReturnType<typeof createClient>,
  contractId: string,
  propertyId: string | undefined,
  stats: ReturnType<typeof calculateStats>,
  aiAnalysis: string,
  contractType?: string,
  propertyType?: string,
): Promise<void> {
  try {
    const confidenceLabel =
      stats.confidence_score >= 70 ? 'Alta' :
      stats.confidence_score >= 40 ? 'Media' : 'Baixa';

    await supabase.from('pricing_analyses').insert({
      contract_id: contractId,
      property_id: propertyId || null,
      suggested_price: stats.suggested_value,
      price_per_sqm: stats.avg_price_per_sqm || null,
      confidence: confidenceLabel,
      analysis_type: (contractType === 'locacao' || contractType === 'administracao' ||
                      contractType === 'rental' || contractType === 'lease' ||
                      (contractType || '').includes('aluguel')) ? 'rental' : 'sale',
      comparables_count: stats.total_comparables,
      median_price: stats.median_price || null,
      mean_price: stats.avg_price || null,
      min_price: stats.suggested_min_value || null,
      max_price: stats.suggested_max_value || null,
      top_comparables: stats.comparables,
      sources: stats.sources,
      ai_analysis: aiAnalysis,
      search_params: {
        version: 'v24r8',
        tier_used: stats.tier_used,
        contract_type: contractType,
        property_type: propertyType || null,
      },
    });
  } catch (err) {
    console.warn('[pricing-ai] v24r8 persist error:', err);
  }
}

// ===================== MAIN HANDLER =====================

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const bodyText = await req.text();

  try {
    if (!bodyText) {
      return new Response(
        JSON.stringify({ error: 'Body vazio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = JSON.parse(bodyText);
    const action = body.action || 'pricing';

    // ==================== ACTION: analyze / pricing ====================
    if (action === 'analyze' || action === 'pricing') {
      console.log('[pricing-ai] v24r8 analyze: start', JSON.stringify({
        contract_id: body.contract_id,
        property_id: body.property_id,
        neighborhood: body.neighborhood,
        city: body.city,
        contract_type: body.contract_type,
      }));

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // 1. Resolve property
      const prop = await resolveProperty(supabase, body);
      console.log('[pricing-ai] v24r8 property resolved:', JSON.stringify(prop));

      const targetArea = prop.area || 100;

      // 2. Build URL components
      const citySlug = prop.city.toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      const stateSlug = (prop.state || 'sp').toLowerCase().substring(0, 2);

      const contractType = body.contract_type || '';
      const isRental = contractType === 'locacao' || contractType === 'administracao' ||
                       contractType === 'rental' || contractType === 'lease' ||
                       contractType.includes('aluguel') || contractType.includes('locação');
      const txSlug = isRental ? 'aluguel' : 'venda';

      // VivaReal slug (hifenizado simples)
      const vivarealNeighborhoodSlug = prop.neighborhood
        ? prop.neighborhood.toLowerCase().trim()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        : '';

      // ZapImóveis slug (abreviado)
      const zapNeighborhoodSlug = prop.neighborhood
        ? buildZapNeighborhoodSlug(prop.neighborhood)
        : '';

      // ===== v24r8: BUILD URLS (com tipo de imóvel dinâmico) =====

      // v24r8: Resolve property type slugs para cada plataforma
      const propertyType = prop.property_type || body.property_type || '';
      const vivarealTypeSlug = VIVAREAL_TYPE_SLUGS[propertyType] || ''; // ex: "apartamento_residencial"
      const zapTypeSlug = ZAP_TYPE_SLUGS[propertyType] || 'imoveis'; // ex: "apartamentos", fallback: "imoveis" (todos)

      console.log(`[pricing-ai] v24r8 property_type: "${propertyType}" → vivareal: "${vivarealTypeSlug}", zap: "${zapTypeSlug}"`);

      // VivaReal URLs — v24r8: COM tipo de imóvel no path (se disponível)
      // Ex: /aluguel/sp/piracicaba/bairros/nova-america/apartamento_residencial/
      const vivarealTypeSuffix = vivarealTypeSlug ? `${vivarealTypeSlug}/` : '';
      const vivarealNeighborhoodUrl = vivarealNeighborhoodSlug
        ? `https://www.vivareal.com.br/${txSlug}/${stateSlug}/${citySlug}/bairros/${vivarealNeighborhoodSlug}/${vivarealTypeSuffix}`
        : null;
      const vivarealCityOnlyUrl = `https://www.vivareal.com.br/${txSlug}/${stateSlug}/${citySlug}/${vivarealTypeSuffix}`;

      // ZapImóveis URLs — v24r8: tipo de imóvel no path em vez de "imoveis"
      // Ex: /aluguel/apartamentos/sp+piracicaba++nv-america/
      const zapNeighborhoodUrl = zapNeighborhoodSlug
        ? `https://www.zapimoveis.com.br/${txSlug}/${zapTypeSlug}/${stateSlug}+${citySlug}++${zapNeighborhoodSlug}/`
        : null;
      const zapCityOnlyUrl = `https://www.zapimoveis.com.br/${txSlug}/${zapTypeSlug}/${stateSlug}+${citySlug}/`;

      console.log(`[pricing-ai] v24r8 URLs:`, JSON.stringify({
        vivareal_neighborhood: vivarealNeighborhoodUrl,
        vivareal_city: vivarealCityOnlyUrl,
        zap_neighborhood: zapNeighborhoodUrl,
        zap_city: zapCityOnlyUrl,
        vivareal_slug: vivarealNeighborhoodSlug,
        zap_slug: zapNeighborhoodSlug,
        property_type: propertyType,
      }));

      // ===== v24r8: PARALLEL SCRAPING (VivaReal + ZapImóveis) =====
      // Pass 1: Ambas as fontes com bairro, em paralelo

      const pass1VivarealUrl = vivarealNeighborhoodUrl || vivarealCityOnlyUrl;
      const pass1ZapUrl = zapNeighborhoodUrl || zapCityOnlyUrl;

      console.log(`[pricing-ai] v24r8 PASS 1 (parallel): VivaReal=${pass1VivarealUrl}, Zap=${pass1ZapUrl}`);

      const [vivarealResult, zapResult] = await Promise.allSettled([
        scrapeVivaReal(pass1VivarealUrl, 150),
        scrapeZapImoveis(pass1ZapUrl, 150),
      ]);

      const rawVivareal1 = vivarealResult.status === 'fulfilled' ? vivarealResult.value : [];
      const rawZap1 = zapResult.status === 'fulfilled' ? zapResult.value : [];

      console.log(`[pricing-ai] v24r8 pass1 results: vivareal=${rawVivareal1.length}, zap=${rawZap1.length}`);

      // Log raw item structure from each source
      if (rawVivareal1.length > 0) {
        console.log('[pricing-ai] v24r8 vivareal raw keys:', Object.keys(rawVivareal1[0]).join(', '));
      }
      if (rawZap1.length > 0) {
        console.log('[pricing-ai] v24r8 zap raw keys:', Object.keys(rawZap1[0]).join(', '));
      }

      // Tag source before normalization
      const taggedVivareal1 = rawVivareal1.map((item) => ({ ...item, _source_tag: 'vivareal' }));
      const taggedZap1 = rawZap1.map((item) => ({ ...item, _source_tag: 'zapimoveis' }));

      // Normalize all listings
      let allListings = [...taggedVivareal1, ...taggedZap1].map((item) => {
        const normalized = normalizeApifyItem(item);
        // Ensure source tag is applied if normalization couldn't detect it
        if (normalized.source === 'unknown' && item._source_tag) {
          normalized.source = item._source_tag;
        }
        return normalized;
      });

      console.log(`[pricing-ai] v24r8 pass1 normalized: ${allListings.length} total`);

      // Apply TX filter
      let txFiltered = applyTxFilter(allListings, isRental);

      // v24r8: Apply property type filter (safety net post-processing)
      const ptFilterResult = applyPropertyTypeFilter(txFiltered, propertyType);
      let ptFiltered = ptFilterResult.filtered;

      // Apply geo filter
      let geoResult = applyGeoFilter(ptFiltered, prop.city, prop.neighborhood);

      // v24r8: TWO-PASS: Se pass 1 retornou < 3 resultados válidos, faz pass 2 com city-only
      const MIN_RESULTS_FOR_CONFIDENCE = 3;
      let pass2Done = false;

      if (geoResult.finalListings.length < MIN_RESULTS_FOR_CONFIDENCE &&
          (vivarealNeighborhoodUrl || zapNeighborhoodUrl)) {
        console.log(`[pricing-ai] v24r8 PASS 2: pass1 got only ${geoResult.finalListings.length} results, trying city-only URLs`);

        // Pass 2: city-only em paralelo
        const pass2Promises: Promise<Record<string, any>[]>[] = [];
        const pass2Labels: string[] = [];

        // Só faz pass 2 para VivaReal se pass 1 usou URL de bairro
        if (vivarealNeighborhoodUrl) {
          pass2Promises.push(scrapeVivaReal(vivarealCityOnlyUrl, 150));
          pass2Labels.push('vivareal-city');
        }

        // Só faz pass 2 para ZapImóveis se pass 1 usou URL de bairro
        if (zapNeighborhoodUrl) {
          pass2Promises.push(scrapeZapImoveis(zapCityOnlyUrl, 100));
          pass2Labels.push('zap-city');
        }

        const pass2Results = await Promise.allSettled(pass2Promises);

        const pass2Listings: Record<string, any>[] = [];
        pass2Results.forEach((result, i) => {
          if (result.status === 'fulfilled' && result.value.length > 0) {
            const tag = pass2Labels[i].startsWith('vivareal') ? 'vivareal' : 'zapimoveis';
            const tagged = result.value.map((item) => ({ ...item, _source_tag: tag }));
            pass2Listings.push(...tagged);
            console.log(`[pricing-ai] v24r8 pass2 [${pass2Labels[i]}]: ${result.value.length} listings`);
          }
        });

        if (pass2Listings.length > 0) {
          pass2Done = true;
          const listings2 = pass2Listings.map((item) => {
            const normalized = normalizeApifyItem(item);
            if (normalized.source === 'unknown' && item._source_tag) {
              normalized.source = item._source_tag;
            }
            return normalized;
          });

          // Merge: deduplica por URL
          const existingUrls = new Set(allListings.map((l) => l.url).filter(Boolean));
          const newListings = listings2.filter((l) => !l.url || !existingUrls.has(l.url));
          allListings = [...allListings, ...newListings];
          console.log(`[pricing-ai] v24r8 merged: ${allListings.length} total (${newListings.length} new from pass2)`);

          // Re-apply filters on merged set
          txFiltered = applyTxFilter(allListings, isRental);
          const ptFilterResult2 = applyPropertyTypeFilter(txFiltered, propertyType);
          ptFiltered = ptFilterResult2.filtered;
          geoResult = applyGeoFilter(ptFiltered, prop.city, prop.neighborhood);
        }
      }

      // Log city distribution for diagnostic
      const cityDistribution: Record<string, number> = {};
      txFiltered.forEach((l) => {
        const c = normalizeStr(l.city || 'unknown');
        cityDistribution[c] = (cityDistribution[c] || 0) + 1;
      });
      console.log(`[pricing-ai] v24r8 city distribution:`, JSON.stringify(cityDistribution));

      // Log source distribution
      const sourceDistribution: Record<string, number> = {};
      txFiltered.forEach((l) => {
        const s = (l.source || 'unknown').toLowerCase();
        sourceDistribution[s] = (sourceDistribution[s] || 0) + 1;
      });
      console.log(`[pricing-ai] v24r8 source distribution:`, JSON.stringify(sourceDistribution));

      let { finalListings, tierUsed } = geoResult;

      // ===== v24r8: SAFE FALLBACK STRATEGY =====
      // Geo filter pode relaxar → TX filter e property type filter NUNCA relaxam

      if (finalListings.length === 0 && ptFiltered.length > 0) {
        console.log(`[pricing-ai] v24r8 RELAXING: geo filter removed all, using ${ptFiltered.length} pt+tx-filtered listings`);
        finalListings = ptFiltered;
        tierUsed = 'state';
      }

      // v24r5+: NUNCA relaxar o TX filter
      if (finalListings.length === 0 && txFiltered.length === 0 && allListings.length > 0) {
        const txLabel = isRental ? 'locação (aluguel)' : 'venda';
        console.warn(`[pricing-ai] v24r8 TX BOUNDARY: ${allListings.length} listings encontrados mas NENHUM compatível com ${txLabel}.`);
        return new Response(JSON.stringify({
          success: false,
          error: `Não encontramos anúncios de ${txLabel} compatíveis na região de ${prop.neighborhood || prop.city || 'sua localização'}. Os ${allListings.length} anúncios encontrados são de outro tipo de transação. Tente novamente mais tarde ou verifique os dados do imóvel.`,
          diagnostic: {
            version: 'v24r8',
            raw_vivareal: rawVivareal1.length,
            raw_zap: rawZap1.length,
            pass2_done: pass2Done,
            all_normalized: allListings.length,
            after_tx_filter: 0,
            tx_type_expected: isRental ? 'rental' : 'sale',
            city_distribution: cityDistribution,
            source_distribution: sourceDistribution,
          },
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (finalListings.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Nenhum imóvel encontrado na região. Tente uma localização diferente.',
          diagnostic: {
            version: 'v24r8',
            raw_vivareal: rawVivareal1.length,
            raw_zap: rawZap1.length,
            pass2_done: pass2Done,
          },
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 4. Calculate stats
      const stats = calculateStats(finalListings, targetArea);
      (stats as any).tier_used = tierUsed;

      // v24r8: LAST RESORT — se calculateStats retornou 0, tenta com PT+TX-filtered inteiro
      if (stats.suggested_value === 0 && ptFiltered.length > 0) {
        console.log(`[pricing-ai] v24r8 LAST RESORT: stats=0, retrying with ${ptFiltered.length} PT+TX-filtered listings`);
        const lastResortListings = ptFiltered.filter((l) => (l.price ?? 0) > 0);
        if (lastResortListings.length > 0) {
          const lastResortStats = calculateStats(lastResortListings, targetArea);
          if (lastResortStats.suggested_value > 0) {
            Object.assign(stats, lastResortStats);
            stats.confidence_score = Math.max(Math.min(stats.confidence_score - 25, 30), 10);
            (stats as any).tier_used = 'state';
            tierUsed = 'state';
            console.log(`[pricing-ai] v24r8 LAST RESORT SUCCESS: suggested=${stats.suggested_value}, confidence=${stats.confidence_score}`);
          }
        }
      }

      if (stats.suggested_value === 0) {
        const diagPricesGt0 = allListings.filter((l) => (l.price ?? 0) > 0).length;
        console.error(`[pricing-ai] v24r8 ZERO after all attempts. priceGt0=${diagPricesGt0}`);

        return new Response(JSON.stringify({
          success: false,
          error: 'Não foi possível calcular valor de mercado — os anúncios encontrados não possuem dados de preço válidos.',
          diagnostic: {
            version: 'v24r8',
            raw_vivareal: rawVivareal1.length,
            raw_zap: rawZap1.length,
            normalized: allListings.length,
            tx_filtered: txFiltered.length,
            geo_final: geoResult.finalListings.length,
            price_gt_0: diagPricesGt0,
            pass2_done: pass2Done,
            tier_used: tierUsed,
            city_distribution: cityDistribution,
            source_distribution: sourceDistribution,
          },
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 5. AI Analysis
      const aiAnalysis = await generateAIAnalysis(
        stats, prop.neighborhood, prop.city, prop.area, contractType,
      );

      // 6. Auto-persist (fire-and-forget)
      if (body.contract_id) {
        persistAnalysis(supabase, body.contract_id, prop.property_id, stats, aiAnalysis, contractType, propertyType);
      }

      // Confidence penalty para tier
      if (tierUsed === 'state' && stats.confidence_score > 30) {
        stats.confidence_score = Math.max(stats.confidence_score - 30, 10);
      } else if (tierUsed === 'city' && stats.confidence_score > 50) {
        stats.confidence_score = Math.max(stats.confidence_score - 10, 20);
      }

      // 7. Response
      const evaluationId = `eval_v24r8_${Date.now()}`;

      return new Response(JSON.stringify({
        success: true,
        evaluation_id: evaluationId,
        property_id: prop.property_id || null,
        status: 'concluida',
        stats: {
          suggested_value: stats.suggested_value,
          suggested_min_value: stats.suggested_min_value,
          suggested_max_value: stats.suggested_max_value,
          confidence_score: stats.confidence_score,
          avg_price_per_sqm: stats.avg_price_per_sqm,
          median_price_per_sqm: stats.median_price_per_sqm,
          avg_price: stats.avg_price,
          median_price: stats.median_price,
          total_comparables: stats.total_comparables,
          tier_used: tierUsed,
          sources: stats.sources,
        },
        ai_analysis: aiAnalysis,
        total_listings: allListings.length,
        total_filtered: finalListings.length,
        total_comparables: stats.total_comparables,
        tier_used: tierUsed,
        geo_stats: {
          raw_vivareal: rawVivareal1.length,
          raw_zap: rawZap1.length,
          pass2_done: pass2Done,
          normalized: allListings.length,
          after_tx_filter: txFiltered.length,
          after_pt_filter: ptFiltered.length,
          pt_filter_applied: ptFilterResult.applied,
          pt_filter_removed: ptFilterResult.removedCount,
          property_type_used: propertyType || 'none',
          neighborhood_matches: geoResult.neighborhoodCount,
          city_matches: geoResult.cityCount,
          final: finalListings.length,
          city_distribution: cityDistribution,
          source_distribution: sourceDistribution,
        },
        top_comparables: stats.comparables,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== ACTION: market_overview ====================
    if (action === 'market_overview') {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { city, state } = body;

      if (!city && !state) {
        return new Response(JSON.stringify({ error: 'Informe city ou state' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const query = supabase
        .from('pricing_analyses')
        .select('suggested_price, price_per_sqm, confidence, analysis_type, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      const { data, error } = await query;

      if (error || !data?.length) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Sem dados de mercado disponíveis. Execute análises individuais primeiro.',
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const prices = data.map((d: any) => d.suggested_price).filter((p: number) => p > 0);
      prices.sort((a: number, b: number) => a - b);
      const avg = prices.reduce((s: number, v: number) => s + v, 0) / prices.length;

      return new Response(JSON.stringify({
        success: true,
        overview: {
          total_analyses: data.length,
          avg_price: Math.round(avg),
          median_price: Math.round(prices[Math.floor(prices.length / 2)]),
          min_price: Math.round(prices[0]),
          max_price: Math.round(prices[prices.length - 1]),
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== UNKNOWN ACTION ====================
    return new Response(JSON.stringify({
      error: 'Ação não reconhecida',
      help: 'Ações disponíveis: analyze, pricing, market_overview',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[pricing-ai] v24r8 Error:', err);
    return new Response(JSON.stringify({
      error: 'Erro interno',
      details: String(err),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
