/**
 * ibgeApi.ts — Cliente para a API de localidades do IBGE
 *
 * Busca UFs e municípios para os selects do wizard de novo projeto.
 * Usa a API pública do IBGE: https://servicodados.ibge.gov.br/api/v1/localidades
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UFOption {
  value: string; // sigla, ex: "SP"
  label: string; // nome completo, ex: "São Paulo"
  id: number;
}

export interface MunicipioOption {
  value: string; // nome do município
  label: string; // nome do município (display)
  id: number;
  uf: string;
}

// ---------------------------------------------------------------------------
// API Base
// ---------------------------------------------------------------------------

const IBGE_BASE = "https://servicodados.ibge.gov.br/api/v1/localidades";

// ---------------------------------------------------------------------------
// UFs
// ---------------------------------------------------------------------------

let _ufsCache: UFOption[] | null = null;

/**
 * Retorna todas as Unidades Federativas do Brasil ordenadas por nome.
 * Resultado é cacheado em memória para evitar múltiplas requisições.
 */
export async function fetchUFs(): Promise<UFOption[]> {
  if (_ufsCache) return _ufsCache;

  try {
    const res = await fetch(`${IBGE_BASE}/estados?orderBy=nome`);
    if (!res.ok) throw new Error(`IBGE API error: ${res.status}`);
    const data = await res.json() as Array<{ id: number; sigla: string; nome: string }>;
    _ufsCache = data.map((uf) => ({
      id: uf.id,
      value: uf.sigla,
      label: uf.nome,
    }));
    return _ufsCache;
  } catch {
    // Fallback estático com todas as UFs
    _ufsCache = FALLBACK_UFS;
    return _ufsCache;
  }
}

// ---------------------------------------------------------------------------
// Municípios
// ---------------------------------------------------------------------------

const _municipiosCache: Record<string, MunicipioOption[]> = {};

/**
 * Retorna os municípios de uma UF para uso em selects (value=nome, label=nome).
 *
 * @param uf — Sigla da UF (ex: "SP")
 */
export async function fetchMunicipiosForSelect(uf: string): Promise<MunicipioOption[]> {
  const key = uf.toUpperCase();
  if (_municipiosCache[key]) return _municipiosCache[key];

  try {
    const res = await fetch(`${IBGE_BASE}/estados/${key}/municipios?orderBy=nome`);
    if (!res.ok) throw new Error(`IBGE API error: ${res.status}`);
    const data = await res.json() as Array<{ id: number; nome: string }>;
    _municipiosCache[key] = data.map((m) => ({
      id: m.id,
      value: m.nome,
      label: m.nome,
      uf: key,
    }));
    return _municipiosCache[key];
  } catch {
    // Retorna vazio em caso de falha — usuário pode digitar manualmente
    return [];
  }
}

// ---------------------------------------------------------------------------
// Reverse geocoding — descobre cidade/UF a partir de lat/lng
// ---------------------------------------------------------------------------

/**
 * Resultado de reverse geocoding — cidade, UF e endereço simplificado.
 * Os campos podem ser `null` se a API não retornar o dado ou se a consulta
 * falhar. O caller é responsável por tratar campos ausentes.
 */
export interface ReverseGeocodeResult {
  city: string | null;
  uf: string | null; // sigla ex: "SP"
  neighborhood: string | null;
  address: string | null; // endereço completo formatado
  source: "nominatim" | "bigdatacloud" | "fallback";
}

/**
 * Descobre cidade/UF a partir de coordenadas (lat, lng).
 *
 * Estratégia 2-tier (SESSÃO 130 — inversão):
 *   1. Nominatim (OpenStreetMap) — retorna o **município exato** via
 *      `addr.city || addr.town || addr.municipality`. Preferido porque
 *      BigDataCloud devolve "Região Metropolitana de X" no campo `city`,
 *      o que polui o preenchimento.
 *   2. BigDataCloud — fallback (sem auth, ~10k req/dia).
 *
 * Sempre retorna um objeto — nunca lança. Se ambas APIs falharem,
 * retorna todos os campos null com `source: "fallback"`.
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult> {
  // 1) Nominatim (OpenStreetMap) — primeiro porque crava o município exato
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=pt-BR&zoom=14`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "IntentusRealEstate/1.0 (parcelamento de solo)",
      },
    });
    if (res.ok) {
      const data = await res.json();
      const addr = data?.address ?? {};
      const city: string | null =
        addr.city || addr.town || addr.municipality || addr.village || null;
      const stateFull: string | null = addr.state ?? null;
      let uf: string | null = null;
      if (stateFull) {
        const ufs = await fetchUFs();
        const match = ufs.find(
          (u) => u.label.toLowerCase() === stateFull.toLowerCase()
        );
        uf = match?.value ?? null;
      }
      const neighborhood: string | null = addr.suburb ?? addr.neighbourhood ?? null;
      if (city || uf) {
        return {
          city,
          uf,
          neighborhood,
          address: data?.display_name ?? null,
          source: "nominatim",
        };
      }
    }
  } catch {
    // fall through to BigDataCloud
  }

  // 2) BigDataCloud — fallback
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=pt`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const subdivisionCode: string = data?.principalSubdivisionCode ?? "";
      const uf = subdivisionCode.startsWith("BR-") ? subdivisionCode.slice(3) : null;
      // Prefere `locality` (cidade literal) sobre `city` (que vira "Região Metropolitana de X")
      const city: string | null =
        data?.locality || data?.localityInfo?.administrative?.[3]?.name || data?.city || null;
      const neighborhood: string | null =
        data?.localityInfo?.administrative?.[4]?.name ?? null;
      const address: string | null =
        [data?.locality, city, uf, "Brasil"].filter(Boolean).join(", ") || null;
      if (city || uf) {
        return { city, uf, neighborhood, address, source: "bigdatacloud" };
      }
    }
  } catch {
    // fall through
  }

  return {
    city: null,
    uf: null,
    neighborhood: null,
    address: null,
    source: "fallback",
  };
}

// ---------------------------------------------------------------------------
// Fallback estático (caso API IBGE esteja indisponível)
// ---------------------------------------------------------------------------

const FALLBACK_UFS: UFOption[] = [
  { id: 12, value: "AC", label: "Acre" },
  { id: 27, value: "AL", label: "Alagoas" },
  { id: 16, value: "AP", label: "Amapá" },
  { id: 13, value: "AM", label: "Amazonas" },
  { id: 29, value: "BA", label: "Bahia" },
  { id: 23, value: "CE", label: "Ceará" },
  { id: 53, value: "DF", label: "Distrito Federal" },
  { id: 32, value: "ES", label: "Espírito Santo" },
  { id: 52, value: "GO", label: "Goiás" },
  { id: 21, value: "MA", label: "Maranhão" },
  { id: 51, value: "MT", label: "Mato Grosso" },
  { id: 50, value: "MS", label: "Mato Grosso do Sul" },
  { id: 31, value: "MG", label: "Minas Gerais" },
  { id: 15, value: "PA", label: "Pará" },
  { id: 25, value: "PB", label: "Paraíba" },
  { id: 41, value: "PR", label: "Paraná" },
  { id: 26, value: "PE", label: "Pernambuco" },
  { id: 22, value: "PI", label: "Piauí" },
  { id: 33, value: "RJ", label: "Rio de Janeiro" },
  { id: 24, value: "RN", label: "Rio Grande do Norte" },
  { id: 43, value: "RS", label: "Rio Grande do Sul" },
  { id: 11, value: "RO", label: "Rondônia" },
  { id: 14, value: "RR", label: "Roraima" },
  { id: 42, value: "SC", label: "Santa Catarina" },
  { id: 35, value: "SP", label: "São Paulo" },
  { id: 28, value: "SE", label: "Sergipe" },
  { id: 17, value: "TO", label: "Tocantins" },
];
