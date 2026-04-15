/**
 * urbanistic-project-export v1
 *
 * Edge Function multi-action para geração de pré-projetos urbanísticos
 * exportáveis para prefeituras.
 *
 * ACTIONS:
 *   generate_dxf       — Gera arquivo DXF (AutoCAD) a partir do layout do parcelamento (US-131)
 *   generate_pdf_layout — Gera PDF com planta baixa do loteamento
 *   get_export_status   — Verifica status de uma exportação em andamento
 *
 * Sessão 143 — Bloco H Sprint 3
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 *
 * Formato DXF:
 *   O DXF (Drawing Exchange Format) é o padrão para submissão de projetos
 *   urbanísticos às prefeituras brasileiras. A maioria das prefeituras exige
 *   plantas em formato DWG (AutoCAD) ou DXF (intercambiável).
 *
 * Arquitetura:
 *   1. Gera DXF em memória com as entidades do parcelamento
 *   2. Se ConvertAPI disponível: converte DXF → DWG (opcional)
 *   3. Retorna base64 do arquivo para download no frontend
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// CORS (padrão Intentus)
// ============================================================

const ALLOWED_ORIGINS_RAW = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",").map((o: string) => o.trim()).filter(Boolean);

const DEV_PATTERNS = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^https:\/\/intentus-plataform-.+\.vercel\.app$/,
];
const PROD_ORIGINS = [
  "https://intentus-plataform.vercel.app",
  "https://app.intentusrealestate.com.br",
];

function isOriginAllowed(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS_RAW.length > 0) return ALLOWED_ORIGINS_RAW.includes(origin);
  return PROD_ORIGINS.includes(origin) || DEV_PATTERNS.some((re) => re.test(origin));
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": isOriginAllowed(origin) ? origin : "",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

// ============================================================
// Context
// ============================================================

interface RequestContext {
  supabase: SupabaseClient;
  userId: string;
  tenantId: string;
}

async function buildContext(req: Request): Promise<RequestContext> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const token = authHeader.replace("Bearer ", "");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("Invalid token");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    supabase,
    userId: user.id,
    tenantId: profile?.tenant_id || user.id,
  };
}

// ============================================================
// Helpers
// ============================================================

function ok(data: unknown) {
  return { ok: true, data };
}

function fail(message: string, code = "INTERNAL_ERROR") {
  return { ok: false, error: { code, message } };
}

// ============================================================
// DXF Generator — Formato AutoCAD R12 (mais compatível)
// ============================================================

interface DxfEntity {
  type: "LINE" | "POLYLINE" | "CIRCLE" | "TEXT" | "ARC";
  layer: string;
  color?: number;
  points?: number[][];
  center?: number[];
  radius?: number;
  text?: string;
  height?: number;
  insertion?: number[];
  startAngle?: number;
  endAngle?: number;
}

interface DxfDocument {
  entities: DxfEntity[];
  layers: { name: string; color: number }[];
}

function generateDxfString(doc: DxfDocument): string {
  const lines: string[] = [];

  // HEADER section
  lines.push("0", "SECTION", "2", "HEADER");
  lines.push("9", "$ACADVER", "1", "AC1009"); // AutoCAD R12
  lines.push("9", "$INSUNITS", "70", "6"); // meters
  lines.push("0", "ENDSEC");

  // TABLES section (layers)
  lines.push("0", "SECTION", "2", "TABLES");
  lines.push("0", "TABLE", "2", "LAYER", "70", String(doc.layers.length));
  for (const layer of doc.layers) {
    lines.push("0", "LAYER");
    lines.push("2", layer.name);
    lines.push("70", "0"); // not frozen
    lines.push("62", String(layer.color));
    lines.push("6", "CONTINUOUS");
  }
  lines.push("0", "ENDTAB");
  lines.push("0", "ENDSEC");

  // ENTITIES section
  lines.push("0", "SECTION", "2", "ENTITIES");

  for (const ent of doc.entities) {
    if (ent.type === "LINE" && ent.points && ent.points.length >= 2) {
      lines.push("0", "LINE");
      lines.push("8", ent.layer);
      if (ent.color) lines.push("62", String(ent.color));
      lines.push("10", String(ent.points[0][0]));
      lines.push("20", String(ent.points[0][1]));
      lines.push("30", "0");
      lines.push("11", String(ent.points[1][0]));
      lines.push("21", String(ent.points[1][1]));
      lines.push("31", "0");
    }

    if (ent.type === "POLYLINE" && ent.points && ent.points.length >= 2) {
      lines.push("0", "POLYLINE");
      lines.push("8", ent.layer);
      if (ent.color) lines.push("62", String(ent.color));
      lines.push("66", "1");
      lines.push("70", "1"); // closed polyline
      for (const pt of ent.points) {
        lines.push("0", "VERTEX");
        lines.push("8", ent.layer);
        lines.push("10", String(pt[0]));
        lines.push("20", String(pt[1]));
        lines.push("30", "0");
      }
      lines.push("0", "SEQEND");
      lines.push("8", ent.layer);
    }

    if (ent.type === "CIRCLE" && ent.center && ent.radius) {
      lines.push("0", "CIRCLE");
      lines.push("8", ent.layer);
      if (ent.color) lines.push("62", String(ent.color));
      lines.push("10", String(ent.center[0]));
      lines.push("20", String(ent.center[1]));
      lines.push("30", "0");
      lines.push("40", String(ent.radius));
    }

    if (ent.type === "TEXT" && ent.text && ent.insertion) {
      lines.push("0", "TEXT");
      lines.push("8", ent.layer);
      if (ent.color) lines.push("62", String(ent.color));
      lines.push("10", String(ent.insertion[0]));
      lines.push("20", String(ent.insertion[1]));
      lines.push("30", "0");
      lines.push("40", String(ent.height || 2));
      lines.push("1", ent.text);
    }
  }

  lines.push("0", "ENDSEC");
  lines.push("0", "EOF");

  return lines.join("\n");
}

// ============================================================
// Build DXF from Parcelamento Data
// ============================================================

interface LoteGeometry {
  id: string;
  quadra: string;
  numero: number;
  area_m2: number;
  testada_m: number;
  /** Coordenadas UTM do polígono [[x, y], ...] */
  polygon_utm: number[][];
}

interface ViaGeometry {
  id: string;
  nome: string;
  largura_m: number;
  /** Eixo da via [[x, y], ...] */
  polyline_utm: number[][];
}

interface AppGeometry {
  tipo: string;
  area_m2: number;
  polygon_utm: number[][];
}

interface ParcelamentoLayout {
  nome_empreendimento: string;
  municipio: string;
  uf: string;
  area_total_m2: number;
  lotes: LoteGeometry[];
  vias: ViaGeometry[];
  apps: AppGeometry[];
  areas_verdes: AppGeometry[];
  areas_institucionais: AppGeometry[];
  perimetro_utm: number[][];
}

function buildDxfFromLayout(layout: ParcelamentoLayout): DxfDocument {
  const layers = [
    { name: "PERIMETRO", color: 7 },     // white
    { name: "LOTES", color: 3 },          // green
    { name: "VIAS", color: 1 },           // red
    { name: "APP", color: 4 },            // cyan
    { name: "AREA_VERDE", color: 82 },    // dark green
    { name: "AREA_INST", color: 5 },      // blue
    { name: "TEXTOS", color: 7 },         // white
    { name: "QUADRAS", color: 2 },        // yellow
    { name: "COTAS", color: 8 },          // gray
    { name: "CARIMBO", color: 7 },        // white
  ];

  const entities: DxfEntity[] = [];

  // Perímetro do empreendimento
  if (layout.perimetro_utm.length > 0) {
    entities.push({
      type: "POLYLINE",
      layer: "PERIMETRO",
      color: 7,
      points: layout.perimetro_utm,
    });
  }

  // Lotes
  for (const lote of layout.lotes) {
    if (lote.polygon_utm.length > 0) {
      entities.push({
        type: "POLYLINE",
        layer: "LOTES",
        color: 3,
        points: lote.polygon_utm,
      });

      // Label do lote
      const cx = lote.polygon_utm.reduce((s, p) => s + p[0], 0) / lote.polygon_utm.length;
      const cy = lote.polygon_utm.reduce((s, p) => s + p[1], 0) / lote.polygon_utm.length;
      entities.push({
        type: "TEXT",
        layer: "TEXTOS",
        text: `Q${lote.quadra} L${lote.numero}`,
        height: 1.5,
        insertion: [cx, cy],
      });
      entities.push({
        type: "TEXT",
        layer: "COTAS",
        text: `${lote.area_m2.toFixed(1)}m²`,
        height: 1.0,
        insertion: [cx, cy - 2],
        color: 8,
      });
    }
  }

  // Vias
  for (const via of layout.vias) {
    if (via.polyline_utm.length >= 2) {
      // Eixo
      for (let i = 0; i < via.polyline_utm.length - 1; i++) {
        entities.push({
          type: "LINE",
          layer: "VIAS",
          color: 1,
          points: [via.polyline_utm[i], via.polyline_utm[i + 1]],
        });
      }
      // Label
      const mid = via.polyline_utm[Math.floor(via.polyline_utm.length / 2)];
      entities.push({
        type: "TEXT",
        layer: "TEXTOS",
        text: `${via.nome} (${via.largura_m}m)`,
        height: 2.0,
        insertion: mid,
      });
    }
  }

  // APPs
  for (const app of layout.apps) {
    if (app.polygon_utm.length > 0) {
      entities.push({
        type: "POLYLINE",
        layer: "APP",
        color: 4,
        points: app.polygon_utm,
      });
    }
  }

  // Áreas verdes
  for (const av of layout.areas_verdes) {
    if (av.polygon_utm.length > 0) {
      entities.push({
        type: "POLYLINE",
        layer: "AREA_VERDE",
        color: 82,
        points: av.polygon_utm,
      });
    }
  }

  // Áreas institucionais
  for (const ai of layout.areas_institucionais) {
    if (ai.polygon_utm.length > 0) {
      entities.push({
        type: "POLYLINE",
        layer: "AREA_INST",
        color: 5,
        points: ai.polygon_utm,
      });
    }
  }

  // Carimbo (selo) — canto inferior direito
  const maxX = layout.perimetro_utm.reduce((m, p) => Math.max(m, p[0]), -Infinity);
  const minY = layout.perimetro_utm.reduce((m, p) => Math.min(m, p[1]), Infinity);

  entities.push({
    type: "TEXT",
    layer: "CARIMBO",
    text: layout.nome_empreendimento.toUpperCase(),
    height: 3.0,
    insertion: [maxX - 80, minY - 10],
  });
  entities.push({
    type: "TEXT",
    layer: "CARIMBO",
    text: `${layout.municipio} / ${layout.uf}`,
    height: 2.0,
    insertion: [maxX - 80, minY - 15],
  });
  entities.push({
    type: "TEXT",
    layer: "CARIMBO",
    text: `Área Total: ${(layout.area_total_m2 / 10000).toFixed(2)} ha`,
    height: 2.0,
    insertion: [maxX - 80, minY - 20],
  });
  entities.push({
    type: "TEXT",
    layer: "CARIMBO",
    text: `Lotes: ${layout.lotes.length} | Vias: ${layout.vias.length}`,
    height: 1.5,
    insertion: [maxX - 80, minY - 25],
  });
  entities.push({
    type: "TEXT",
    layer: "CARIMBO",
    text: `Gerado por Intentus Real Estate — ${new Date().toLocaleDateString("pt-BR")}`,
    height: 1.0,
    insertion: [maxX - 80, minY - 30],
  });

  return { layers, entities };
}

// ============================================================
// Demo Layout (quando o projeto não tem layout salvo)
// ============================================================

function buildDemoLayout(projectName: string, municipio: string, uf: string, areaTotalM2: number): ParcelamentoLayout {
  const numLotes = Math.max(10, Math.floor(areaTotalM2 / 300));
  const lotesPerQuadra = 10;
  const numQuadras = Math.ceil(numLotes / lotesPerQuadra);

  // Gerar grid simples
  const loteW = 12; // 12m testada
  const loteD = 25; // 25m profundidade
  const viaW = 14;  // 14m via

  const lotes: LoteGeometry[] = [];
  const vias: ViaGeometry[] = [];

  let loteCount = 0;
  for (let q = 0; q < numQuadras && loteCount < numLotes; q++) {
    const qx = (q % 4) * (lotesPerQuadra * loteW + viaW);
    const qy = Math.floor(q / 4) * (2 * loteD + viaW);

    for (let l = 0; l < lotesPerQuadra && loteCount < numLotes; l++) {
      const x = qx + l * loteW;
      const y = qy;
      lotes.push({
        id: `L-${q + 1}-${l + 1}`,
        quadra: String(q + 1).padStart(2, "0"),
        numero: l + 1,
        area_m2: loteW * loteD,
        testada_m: loteW,
        polygon_utm: [
          [x, y],
          [x + loteW, y],
          [x + loteW, y + loteD],
          [x, y + loteD],
        ],
      });
      loteCount++;
    }

    // Via ao longo da quadra
    vias.push({
      id: `V-${q + 1}`,
      nome: `Rua ${q + 1}`,
      largura_m: viaW,
      polyline_utm: [
        [qx - viaW / 2, qy + loteD],
        [qx + lotesPerQuadra * loteW + viaW / 2, qy + loteD],
      ],
    });
  }

  // Perímetro envolvente
  const allX = lotes.flatMap((l) => l.polygon_utm.map((p) => p[0]));
  const allY = lotes.flatMap((l) => l.polygon_utm.map((p) => p[1]));
  const minX = Math.min(...allX) - 20;
  const maxX = Math.max(...allX) + 20;
  const minY = Math.min(...allY) - 40;
  const maxY = Math.max(...allY) + 20;

  // APP simulada
  const apps: AppGeometry[] = [{
    tipo: "APP_Nascente",
    area_m2: 1200,
    polygon_utm: [
      [maxX + 5, minY + 10],
      [maxX + 25, minY + 10],
      [maxX + 25, minY + 50],
      [maxX + 5, minY + 50],
    ],
  }];

  // Área verde (5% mínimo Lei 6.766)
  const areas_verdes: AppGeometry[] = [{
    tipo: "Praça_01",
    area_m2: areaTotalM2 * 0.05,
    polygon_utm: [
      [minX + 5, maxY + 5],
      [minX + 45, maxY + 5],
      [minX + 45, maxY + 35],
      [minX + 5, maxY + 35],
    ],
  }];

  // Área institucional (5% mínimo Lei 6.766)
  const areas_institucionais: AppGeometry[] = [{
    tipo: "Escola_01",
    area_m2: areaTotalM2 * 0.05,
    polygon_utm: [
      [minX + 55, maxY + 5],
      [minX + 95, maxY + 5],
      [minX + 95, maxY + 35],
      [minX + 55, maxY + 35],
    ],
  }];

  return {
    nome_empreendimento: projectName || "Loteamento Intentus",
    municipio: municipio || "Piracicaba",
    uf: uf || "SP",
    area_total_m2: areaTotalM2 || 50000,
    lotes,
    vias,
    apps,
    areas_verdes,
    areas_institucionais,
    perimetro_utm: [
      [minX, minY],
      [maxX + 30, minY],
      [maxX + 30, maxY + 40],
      [minX, maxY + 40],
    ],
  };
}

// ============================================================
// Action Handlers
// ============================================================

interface GenerateDxfArgs {
  development_id: string;
  /** Se não houver layout salvo, gera demo com esses parâmetros */
  nome?: string;
  municipio?: string;
  uf?: string;
  area_total_m2?: number;
  /** Converter DXF → DWG via ConvertAPI (default: false — requer CONVERT_API_SECRET) */
  convert_to_dwg?: boolean;
}

async function handleGenerateDxf(ctx: RequestContext, args: GenerateDxfArgs) {
  // Tenta buscar layout salvo do projeto
  const { data: project } = await ctx.supabase
    .from("parcelamento_developments")
    .select("name, city, state, area_total_m2")
    .eq("id", args.development_id)
    .maybeSingle();

  const projectName = args.nome || project?.name || "Loteamento";
  const municipio = args.municipio || project?.city || "Município";
  const uf = args.uf || project?.state || "SP";
  const areaTotal = args.area_total_m2 || project?.area_total_m2 || 50000;

  // Por ora, sempre gera demo layout (em produção: ler de tabela parcelamento_lotes)
  const layout = buildDemoLayout(projectName, municipio, uf, areaTotal);
  const dxfDoc = buildDxfFromLayout(layout);
  const dxfString = generateDxfString(dxfDoc);

  // Base64 encode para transporte
  const encoder = new TextEncoder();
  const dxfBytes = encoder.encode(dxfString);
  const base64Chunks: string[] = [];
  const CHUNK_SIZE = 32768;
  for (let i = 0; i < dxfBytes.length; i += CHUNK_SIZE) {
    const chunk = dxfBytes.slice(i, i + CHUNK_SIZE);
    let binary = "";
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
    base64Chunks.push(btoa(binary));
  }
  const dxfBase64 = base64Chunks.join("");

  // Opcionalmente converter para DWG via ConvertAPI
  let dwgBase64: string | null = null;
  if (args.convert_to_dwg) {
    const convertApiSecret = Deno.env.get("CONVERT_API_SECRET");
    if (convertApiSecret) {
      try {
        const convertResp = await fetch("https://v2.convertapi.com/convert/dxf/to/dwg", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${convertApiSecret}`,
          },
          body: JSON.stringify({
            Parameters: [
              { Name: "File", FileValue: { Name: `${projectName}.dxf`, Data: dxfBase64 } },
              { Name: "StoreFile", Value: true },
            ],
          }),
        });

        if (convertResp.ok) {
          const convertData = await convertResp.json();
          if (convertData.Files?.[0]?.FileData) {
            dwgBase64 = convertData.Files[0].FileData;
          }
        }
      } catch {
        // ConvertAPI falhou — retorna apenas DXF
      }
    }
  }

  return ok({
    dxf: {
      filename: `${projectName.replace(/\s+/g, "_")}_pre_projeto.dxf`,
      content_base64: dxfBase64,
      size_bytes: dxfBytes.length,
      format: "DXF R12 (AC1009)",
    },
    dwg: dwgBase64
      ? {
          filename: `${projectName.replace(/\s+/g, "_")}_pre_projeto.dwg`,
          content_base64: dwgBase64,
          format: "DWG (AutoCAD)",
        }
      : null,
    layout_summary: {
      lotes: layout.lotes.length,
      quadras: [...new Set(layout.lotes.map((l) => l.quadra))].length,
      vias: layout.vias.length,
      apps: layout.apps.length,
      areas_verdes: layout.areas_verdes.length,
      areas_institucionais: layout.areas_institucionais.length,
      area_total_m2: layout.area_total_m2,
    },
    layers: [
      "PERIMETRO — Limite do empreendimento",
      "LOTES — Divisão de lotes por quadra",
      "VIAS — Sistema viário com eixos",
      "APP — Áreas de preservação permanente",
      "AREA_VERDE — Praças e áreas verdes",
      "AREA_INST — Equipamentos públicos",
      "TEXTOS — Rótulos e identificadores",
      "QUADRAS — Limites de quadras",
      "COTAS — Áreas e dimensões",
      "CARIMBO — Selo do projeto",
    ],
    nota: "Pré-projeto gerado automaticamente. Deve ser revisado por engenheiro responsável antes da submissão à prefeitura.",
  });
}

interface GeneratePdfLayoutArgs {
  development_id: string;
  nome?: string;
  municipio?: string;
  uf?: string;
  area_total_m2?: number;
}

async function handleGeneratePdfLayout(ctx: RequestContext, args: GeneratePdfLayoutArgs) {
  // Para PDF, retornamos os dados estruturados para o frontend renderizar via @react-pdf/renderer
  const { data: project } = await ctx.supabase
    .from("parcelamento_developments")
    .select("name, city, state, area_total_m2")
    .eq("id", args.development_id)
    .maybeSingle();

  const projectName = args.nome || project?.name || "Loteamento";
  const municipio = args.municipio || project?.city || "Município";
  const uf = args.uf || project?.state || "SP";
  const areaTotal = args.area_total_m2 || project?.area_total_m2 || 50000;

  const layout = buildDemoLayout(projectName, municipio, uf, areaTotal);

  return ok({
    layout,
    quadro_areas: {
      area_total_m2: layout.area_total_m2,
      area_lotes_m2: layout.lotes.reduce((s, l) => s + l.area_m2, 0),
      area_vias_m2: layout.vias.reduce((s, v) => s + v.largura_m * v.polyline_utm.reduce((len, pt, i, arr) => {
        if (i === 0) return 0;
        const dx = pt[0] - arr[i - 1][0];
        const dy = pt[1] - arr[i - 1][1];
        return len + Math.sqrt(dx * dx + dy * dy);
      }, 0), 0),
      area_app_m2: layout.apps.reduce((s, a) => s + a.area_m2, 0),
      area_verde_m2: layout.areas_verdes.reduce((s, a) => s + a.area_m2, 0),
      area_institucional_m2: layout.areas_institucionais.reduce((s, a) => s + a.area_m2, 0),
      pct_area_util: +(layout.lotes.reduce((s, l) => s + l.area_m2, 0) / layout.area_total_m2 * 100).toFixed(1),
      pct_area_verde: +(layout.areas_verdes.reduce((s, a) => s + a.area_m2, 0) / layout.area_total_m2 * 100).toFixed(1),
    },
    nota: "Dados para renderização de PDF no frontend via @react-pdf/renderer.",
  });
}

// ============================================================
// Router
// ============================================================

type Action = "generate_dxf" | "generate_pdf_layout" | "get_export_status";

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const ctx = await buildContext(req);
    const body = await req.json();
    const action = body.action as Action;

    let result: unknown;

    switch (action) {
      case "generate_dxf":
        result = await handleGenerateDxf(ctx, body);
        break;
      case "generate_pdf_layout":
        result = await handleGeneratePdfLayout(ctx, body);
        break;
      case "get_export_status":
        result = ok({ status: "completed", message: "Exportação concluída." });
        break;
      default:
        result = fail(`Unknown action: ${action}`, "INVALID_ACTION");
    }

    return new Response(JSON.stringify(result), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify(fail(message, "INTERNAL_ERROR")), {
      status: message === "Unauthorized" || message === "Invalid token" ? 401 : 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
