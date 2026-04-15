/**
 * development-dwg-validator v1
 *
 * Valida e converte arquivos CAD para o módulo Parcelamento de Solo.
 *
 * Suporte de formatos:
 *   DXF (texto)     → Parse direto, extrai entidades geoespaciais (LWPOLYLINE, POLYLINE, INSERT, etc.)
 *   DWG (binário)   → Converte para DXF via ConvertAPI, depois parseia
 *   KML/KMZ/GeoJSON → Informa que deve usar o upload de geometria, não este endpoint
 *
 * Actions:
 *   validate       — Valida o arquivo (detecta formato, versão, entidades)
 *   convert_dwg    — Converte DWG → DXF via ConvertAPI e armazena no storage
 *   get_status     — Retorna status de conversão/validação de um arquivo
 *
 * Por que ConvertAPI?
 * Decisão D2 (Marcelo, 07/04/2026): Opção 3 selecionada para MVP.
 * Chave: CONVERT_API_SECRET (configurada nos secrets Supabase — sessão 118).
 *
 * Sessão 119 — Fase 2 Parcelamento de Solo
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// CORS
// ============================================================

const ALLOWED_ORIGINS_RAW = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",").map((o: string) => o.trim()).filter(Boolean);
const DEV_PATTERNS = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^https:\/\/intentus-plataform-.+\.vercel\.app$/,
];
const PROD_ORIGINS = ["https://intentus-plataform.vercel.app", "https://app.intentusrealestate.com.br"];
function isOriginAllowed(origin: string) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS_RAW.length > 0) return ALLOWED_ORIGINS_RAW.includes(origin);
  return PROD_ORIGINS.includes(origin) || DEV_PATTERNS.some((re) => re.test(origin));
}
function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": isOriginAllowed(origin) ? origin : "",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

// ============================================================
// DWG version detection via magic bytes
// ============================================================

const DWG_VERSIONS: Record<string, string> = {
  "AC1006": "AutoCAD 10",
  "AC1009": "AutoCAD 11/12 (R11/R12)",
  "AC1012": "AutoCAD 13",
  "AC1014": "AutoCAD 14",
  "AC1015": "AutoCAD 2000/2000i/2002",
  "AC1018": "AutoCAD 2004/2005/2006",
  "AC1021": "AutoCAD 2007/2008/2009",
  "AC1024": "AutoCAD 2010/2011/2012",
  "AC1027": "AutoCAD 2013/2014/2015/2016/2017",
  "AC1032": "AutoCAD 2018/2019/2020/2021",
  "AC1036": "AutoCAD 2022/2023/2024",
};

function detectDWGVersion(buffer: Uint8Array): { version: string; name: string } | null {
  const header = new TextDecoder("ascii").decode(buffer.slice(0, 6));
  if (!header.startsWith("AC")) return null;
  return { version: header, name: DWG_VERSIONS[header] ?? `DWG (versão desconhecida: ${header})` };
}

// ============================================================
// DXF basic validation (count entities)
// ============================================================

interface DXFStats {
  entity_count: number;
  polyline_count: number;
  layer_count: number;
  has_coordinates: boolean;
  coordinate_system: string | null;
  version: string | null;
}

function analyzeDXF(text: string): DXFStats {
  const lines = text.split("\n").map((l) => l.trim());
  let entityCount = 0;
  let polylineCount = 0;
  const layers = new Set<string>();
  let inEntities = false;
  let dxfVersion: string | null = null;
  let hasCoords = false;
  let coordSystem: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const code = lines[i];
    const value = lines[i + 1]?.trim() ?? "";

    if (code === "9" && value === "$ACADVER") {
      dxfVersion = lines[i + 2]?.trim() ?? null;
    }
    if (code === "9" && value === "$DWGCODEPAGE") {
      coordSystem = lines[i + 2]?.trim() ?? null;
    }
    if (code === "2" && value === "ENTITIES") inEntities = true;
    if (code === "2" && value === "ENDSEC" && inEntities) inEntities = false;

    if (inEntities && code === "0") entityCount++;
    if (inEntities && (value === "LWPOLYLINE" || value === "POLYLINE")) polylineCount++;
    if (code === "8") layers.add(value); // Layer group code

    // Check for coordinate values (codes 10, 20 = X, Y)
    if ((code === "10" || code === "20") && !isNaN(Number(value)) && Number(value) !== 0) {
      hasCoords = true;
    }
  }

  return {
    entity_count: entityCount,
    polyline_count: polylineCount,
    layer_count: layers.size,
    has_coordinates: hasCoords,
    coordinate_system: coordSystem,
    version: dxfVersion,
  };
}

// ============================================================
// ConvertAPI — DWG → DXF
// ============================================================

async function convertDWGtoDXF(
  dwgBytes: Uint8Array,
  filename: string
): Promise<{ success: boolean; dxfBytes?: Uint8Array; error?: string }> {
  const apiSecret = Deno.env.get("CONVERT_API_SECRET");
  if (!apiSecret) {
    return { success: false, error: "CONVERT_API_SECRET not configured" };
  }

  // ConvertAPI v2 endpoint for DWG → DXF
  const url = `https://v2.convertapi.com/convert/dwg/to/dxf?Secret=${apiSecret}`;

  // Build multipart form data
  const formData = new FormData();
  const blob = new Blob([dwgBytes], { type: "application/octet-stream" });
  formData.append("File", blob, filename);
  formData.append("StoreFile", "true");

  const res = await fetch(url, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(60_000), // DWG conversion can take up to 60s
  });

  if (!res.ok) {
    const errBody = await res.text();
    return { success: false, error: `ConvertAPI HTTP ${res.status}: ${errBody.substring(0, 200)}` };
  }

  const result = await res.json() as {
    Files?: { FileData?: string; FileName?: string; Url?: string }[];
  };

  const fileData = result?.Files?.[0]?.FileData;
  if (!fileData) {
    // Try fetching from URL if FileData not inline
    const fileUrl = result?.Files?.[0]?.Url;
    if (fileUrl) {
      const dlRes = await fetch(fileUrl, { signal: AbortSignal.timeout(30_000) });
      if (!dlRes.ok) return { success: false, error: `Failed to download converted file: HTTP ${dlRes.status}` };
      const dxfBytes = new Uint8Array(await dlRes.arrayBuffer());
      return { success: true, dxfBytes };
    }
    return { success: false, error: "ConvertAPI returned no file data" };
  }

  // Decode base64
  const binaryStr = atob(fileData);
  const dxfBytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    dxfBytes[i] = binaryStr.charCodeAt(i);
  }

  return { success: true, dxfBytes };
}

// ============================================================
// Main handler
// ============================================================

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    }
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const action = (body.action as string) || "validate";
  const { development_id, file_id, storage_path } = body as {
    development_id: string;
    file_id?: string;
    storage_path?: string;
  };

  if (!development_id) {
    return new Response(JSON.stringify({ error: "development_id required" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // ——————————————
  // ACTION: get_status
  // ——————————————
  if (action === "get_status") {
    const q = supabase
      .from("development_parcelamento_files")
      .select("id, file_name, file_type, metadata, created_at")
      .eq("development_id", development_id)
      .eq("is_active", true);

    if (file_id) q.eq("id", file_id);
    const { data, error } = await q;

    if (error) return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });

    return new Response(JSON.stringify({ data }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // ——————————————
  // ACTION: validate / convert_dwg
  // ——————————————
  if (!storage_path) {
    return new Response(JSON.stringify({ error: "storage_path required" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Download file from Supabase Storage
  const { data: fileData, error: downloadErr } = await supabase.storage
    .from("parcelamento-files")
    .download(storage_path);

  if (downloadErr || !fileData) {
    return new Response(
      JSON.stringify({ error: `Failed to download file: ${downloadErr?.message ?? "not found"}` }),
      { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  const arrayBuffer = await fileData.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const filename = storage_path.split("/").pop() ?? "file";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  // ——————————————
  // ACTION: validate
  // ——————————————
  if (action === "validate") {
    if (ext === "dwg") {
      const dwgInfo = detectDWGVersion(bytes);
      if (!dwgInfo) {
        return new Response(
          JSON.stringify({
            valid: false,
            format: "dwg",
            error: "Arquivo não reconhecido como DWG válido. Verifique se o arquivo não está corrompido.",
          }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          valid: true,
          format: "dwg",
          dwg_version: dwgInfo.version,
          dwg_version_name: dwgInfo.name,
          file_size_bytes: bytes.length,
          can_convert: true,
          message: `Arquivo DWG válido (${dwgInfo.name}). Use a action "convert_dwg" para converter para DXF antes do processamento.`,
          tutorial: {
            manual: "Abra o arquivo no AutoCAD → Arquivo → Salvar Como → DXF AutoCAD 2000+ (.dxf)",
            online: "https://www.autodesk.com/products/autocad-web-app — Abrir DWG → Salvar como DXF (grátis)",
            alternatives: ["BricsCAD", "QCAD (open-source)", "LibreCAD (open-source)"],
          },
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (ext === "dxf") {
      const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      const stats = analyzeDXF(text);

      if (stats.entity_count === 0) {
        return new Response(
          JSON.stringify({
            valid: false,
            format: "dxf",
            error: "Arquivo DXF não contém entidades. Verifique se o arquivo foi exportado corretamente.",
            stats,
          }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      if (!stats.has_coordinates) {
        return new Response(
          JSON.stringify({
            valid: false,
            format: "dxf",
            warning: "DXF não contém coordenadas geoespaciais detectáveis. O arquivo pode estar em coordenadas locais (não georreferenciado).",
            stats,
            suggestion: "Certifique-se que o arquivo está exportado em SIRGAS 2000 (EPSG:4674) ou WGS84 (EPSG:4326).",
          }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          valid: true,
          format: "dxf",
          dxf_version: stats.version,
          file_size_bytes: bytes.length,
          stats,
          message: `DXF válido com ${stats.entity_count} entidades (${stats.polyline_count} polígonos) em ${stats.layer_count} camadas.`,
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Unsupported format
    const supportedFormats = ["dwg", "dxf", "kml", "kmz", "geojson", "shp"];
    return new Response(
      JSON.stringify({
        valid: false,
        format: ext || "unknown",
        error: `Formato ".${ext}" não suportado para validação/conversão CAD.`,
        supported_formats: supportedFormats,
        message: ext === "kml" || ext === "kmz" || ext === "geojson"
          ? "Para KML/KMZ/GeoJSON, use o endpoint de upload de geometria (não este validador CAD)."
          : "Envie um arquivo DWG ou DXF do projeto urbanístico.",
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  // ——————————————
  // ACTION: convert_dwg
  // ——————————————
  if (action === "convert_dwg") {
    if (ext !== "dwg") {
      return new Response(
        JSON.stringify({ error: `convert_dwg só aceita arquivos .dwg. Arquivo enviado: .${ext}` }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const dwgInfo = detectDWGVersion(bytes);
    if (!dwgInfo) {
      return new Response(
        JSON.stringify({ error: "Arquivo DWG inválido ou corrompido." }),
        { status: 422, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Convert via ConvertAPI
    const conversion = await convertDWGtoDXF(bytes, filename);

    if (!conversion.success || !conversion.dxfBytes) {
      return new Response(
        JSON.stringify({
          error: `Falha na conversão DWG → DXF: ${conversion.error}`,
          dwg_version: dwgInfo.version,
          fallback: "Tente converter manualmente usando AutoCAD, BricsCAD ou AutoCAD Web App (gratuito em autodesk.com).",
        }),
        { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Store converted DXF to storage
    const dxfPath = storage_path.replace(/\.dwg$/i, "_converted.dxf");
    const dxfBlob = new Blob([conversion.dxfBytes], { type: "application/dxf" });

    const { error: uploadErr } = await supabase.storage
      .from("parcelamento-files")
      .upload(dxfPath, dxfBlob, {
        contentType: "application/dxf",
        upsert: true,
      });

    if (uploadErr) {
      return new Response(
        JSON.stringify({ error: `Conversão concluída mas falha ao salvar DXF: ${uploadErr.message}` }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Parse the DXF to get stats
    const dxfText = new TextDecoder("utf-8", { fatal: false }).decode(conversion.dxfBytes);
    const stats = analyzeDXF(dxfText);

    // Update file record if file_id provided
    if (file_id) {
      await supabase.from("development_parcelamento_files").update({
        metadata: {
          dwg_version: dwgInfo.version,
          dwg_version_name: dwgInfo.name,
          converted_dxf_path: dxfPath,
          dxf_stats: stats,
          converted_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }).eq("id", file_id);
    }

    // Insert DXF file record
    const { data: dev } = await supabase
      .from("developments")
      .select("tenant_id")
      .eq("id", development_id)
      .maybeSingle();

    if (dev?.tenant_id) {
      await supabase.from("development_parcelamento_files").insert({
        development_id,
        tenant_id: dev.tenant_id,
        uploaded_by: user.id,
        file_name: dxfPath.split("/").pop(),
        file_size: conversion.dxfBytes.length,
        file_type: "terrain",
        storage_path: dxfPath,
        storage_bucket: "parcelamento-files",
        metadata: {
          converted_from: storage_path,
          dwg_version: dwgInfo.version,
          dxf_stats: stats,
        },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        development_id,
        dwg_version: dwgInfo.version,
        dwg_version_name: dwgInfo.name,
        dxf_storage_path: dxfPath,
        dxf_file_size_bytes: conversion.dxfBytes.length,
        dxf_stats: stats,
        message: `DWG convertido com sucesso para DXF. ${stats.entity_count} entidades extraídas (${stats.polyline_count} polígonos).`,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
    status: 400, headers: { ...cors, "Content-Type": "application/json" },
  });
});
