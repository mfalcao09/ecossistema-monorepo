import { protegerRota } from "@/lib/security/api-guard";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// Default checklists when DB has no records
const CHECKLIST_PADRAO: Record<
  string,
  {
    tipo_documento: string;
    descricao: string;
    obrigatorio: boolean;
    ordem: number;
  }[]
> = {
  aluno: [
    {
      tipo_documento: "rg",
      descricao: "RG (Identidade)",
      obrigatorio: true,
      ordem: 1,
    },
    {
      tipo_documento: "cpf",
      descricao: "CPF",
      obrigatorio: true,
      ordem: 2,
    },
    {
      tipo_documento: "certidao_nascimento",
      descricao: "Certidão de Nascimento ou Casamento",
      obrigatorio: true,
      ordem: 3,
    },
    {
      tipo_documento: "comprovante_residencia",
      descricao: "Comprovante de Residência",
      obrigatorio: true,
      ordem: 4,
    },
    {
      tipo_documento: "historico_escolar",
      descricao: "Histórico Escolar do Ensino Médio",
      obrigatorio: true,
      ordem: 5,
    },
    {
      tipo_documento: "foto_3x4",
      descricao: "Foto 3x4 recente",
      obrigatorio: true,
      ordem: 6,
    },
    {
      tipo_documento: "titulo_eleitor",
      descricao: "Título de Eleitor",
      obrigatorio: false,
      ordem: 7,
    },
    {
      tipo_documento: "reservista",
      descricao: "Certificado de Reservista (sexo masculino)",
      obrigatorio: false,
      ordem: 8,
    },
  ],
  professor: [
    {
      tipo_documento: "rg",
      descricao: "RG (Identidade)",
      obrigatorio: true,
      ordem: 1,
    },
    {
      tipo_documento: "cpf",
      descricao: "CPF",
      obrigatorio: true,
      ordem: 2,
    },
    {
      tipo_documento: "comprovante_residencia",
      descricao: "Comprovante de Residência",
      obrigatorio: true,
      ordem: 3,
    },
    {
      tipo_documento: "diploma",
      descricao: "Diploma de Graduação",
      obrigatorio: true,
      ordem: 4,
    },
    {
      tipo_documento: "diploma_pos",
      descricao: "Diploma de Pós-Graduação (se houver)",
      obrigatorio: false,
      ordem: 5,
    },
    {
      tipo_documento: "curriculo_lattes",
      descricao: "Currículo Lattes atualizado",
      obrigatorio: true,
      ordem: 6,
    },
  ],
  colaborador: [
    {
      tipo_documento: "rg",
      descricao: "RG (Identidade)",
      obrigatorio: true,
      ordem: 1,
    },
    {
      tipo_documento: "cpf",
      descricao: "CPF",
      obrigatorio: true,
      ordem: 2,
    },
    {
      tipo_documento: "ctps",
      descricao: "CTPS (Carteira de Trabalho)",
      obrigatorio: true,
      ordem: 3,
    },
    {
      tipo_documento: "comprovante_residencia",
      descricao: "Comprovante de Residência",
      obrigatorio: true,
      ordem: 4,
    },
    {
      tipo_documento: "certidao_nascimento",
      descricao: "Certidão de Nascimento ou Casamento",
      obrigatorio: true,
      ordem: 5,
    },
    {
      tipo_documento: "pis_pasep",
      descricao: "PIS/PASEP",
      obrigatorio: true,
      ordem: 6,
    },
  ],
};

interface ChecklistItem {
  id?: string;
  tipo_vinculo: string;
  tipo_documento: string;
  descricao: string;
  obrigatorio: boolean;
  ordem: number;
  created_at?: string;
  updated_at?: string;
}

/** Combina checklists padrão de múltiplos tipos sem duplicar tipo_documento */
function combinarChecklists(tipos: string[]) {
  const vistos = new Set<string>();
  const resultado: (typeof CHECKLIST_PADRAO)[string] = [];
  let ordemGlobal = 1;

  for (const tipo of tipos) {
    const items = CHECKLIST_PADRAO[tipo] || [];
    for (const item of items) {
      if (!vistos.has(item.tipo_documento)) {
        vistos.add(item.tipo_documento);
        resultado.push({ ...item, ordem: ordemGlobal++ });
      }
    }
  }

  return resultado;
}

export const GET = protegerRota(
  async (req: NextRequest, { userId, tenantId }) => {
    try {
      // Get tipo_vinculo from query params — aceita múltiplos separados por vírgula
      const { searchParams } = new URL(req.url);
      const tipoVinculoParam = searchParams.get("tipo_vinculo");

      // Validate tipo_vinculo parameter
      if (!tipoVinculoParam) {
        return NextResponse.json(
          { error: 'Missing "tipo_vinculo" query parameter' },
          { status: 400 },
        );
      }

      // Suporta múltiplos tipos: ?tipo_vinculo=aluno,professor
      const tiposVinculo = tipoVinculoParam
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      // Validar cada tipo
      const tiposInvalidos = tiposVinculo.filter((t) => !CHECKLIST_PADRAO[t]);
      if (tiposInvalidos.length > 0) {
        return NextResponse.json(
          {
            error: `Invalid "tipo_vinculo": ${tiposInvalidos.join(", ")}. Supported values: ${Object.keys(CHECKLIST_PADRAO).join(", ")}`,
          },
          { status: 400 },
        );
      }

      // Create Supabase client
      const supabase = await createClient();

      // Try to fetch from database para todos os tipos (filtrar por tenant_id)
      const { data, error } = await supabase
        .from("checklist_documentos")
        .select("*")
        .in("tipo_vinculo", tiposVinculo)
        .eq("tenant_id", tenantId)
        .order("ordem", { ascending: true });

      // If query error (but table doesn't exist yet), fall back to default
      if (error) {
        console.warn(
          `Supabase query error for tipo_vinculo=${tipoVinculoParam}, using default checklist:`,
          error.message,
        );
        // Combinar checklists padrão de todos os tipos, sem duplicar tipo_documento
        const combinado = combinarChecklists(tiposVinculo);
        return NextResponse.json(combinado, {
          status: 200,
          headers: { "X-Checklist-Source": "default" },
        });
      }

      // If no records found in database, return combined defaults
      if (!data || data.length === 0) {
        const combinado = combinarChecklists(tiposVinculo);
        return NextResponse.json(combinado, {
          status: 200,
          headers: { "X-Checklist-Source": "default" },
        });
      }

      // Deduplica por tipo_documento (se aluno+professor pedem RG, retorna 1 vez)
      const vistos = new Set<string>();
      const deduplicado = data.filter((item: any) => {
        if (vistos.has(item.tipo_documento)) return false;
        vistos.add(item.tipo_documento);
        return true;
      });

      // Return database records (deduplicados)
      return NextResponse.json(deduplicado, {
        status: 200,
        headers: { "X-Checklist-Source": "database" },
      });
    } catch (error) {
      console.error("Checklist GET error:", error);
      return NextResponse.json(
        {
          erro: sanitizarErro("Internal server error fetching checklist", 500),
        },
        { status: 500 },
      );
    }
  },
  { skipCSRF: true },
);

export const POST = protegerRota(
  async (req: NextRequest, { userId, tenantId }) => {
    try {
      // Parse request body
      let body;
      try {
        body = await req.json();
      } catch (error) {
        return NextResponse.json(
          { error: "Invalid JSON in request body" },
          { status: 400 },
        );
      }

      const { tipo_vinculo, tipo_documento, descricao, obrigatorio, ordem } =
        body as ChecklistItem;

      // Validate required fields
      if (!tipo_vinculo || typeof tipo_vinculo !== "string") {
        return NextResponse.json(
          { error: 'Missing or invalid "tipo_vinculo" field' },
          { status: 400 },
        );
      }

      if (!CHECKLIST_PADRAO[tipo_vinculo]) {
        return NextResponse.json(
          {
            error: `Invalid "tipo_vinculo". Supported values: ${Object.keys(CHECKLIST_PADRAO).join(", ")}`,
          },
          { status: 400 },
        );
      }

      if (!tipo_documento || typeof tipo_documento !== "string") {
        return NextResponse.json(
          { error: 'Missing or invalid "tipo_documento" field' },
          { status: 400 },
        );
      }

      if (!descricao || typeof descricao !== "string") {
        return NextResponse.json(
          { error: 'Missing or invalid "descricao" field' },
          { status: 400 },
        );
      }

      if (typeof obrigatorio !== "boolean") {
        return NextResponse.json(
          { error: '"obrigatorio" must be a boolean' },
          { status: 400 },
        );
      }

      if (typeof ordem !== "number" || ordem < 1) {
        return NextResponse.json(
          { error: '"ordem" must be a positive number' },
          { status: 400 },
        );
      }

      // Check for admin authorization (you can implement proper auth here)
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return NextResponse.json(
          { error: "Unauthorized. Admin token required." },
          { status: 401 },
        );
      }

      // Create Supabase client
      const supabase = await createClient();

      // Check if this document type already exists for this tipo_vinculo
      const { data: existingData, error: existingError } = await supabase
        .from("checklist_documentos")
        .select("id")
        .eq("tipo_vinculo", tipo_vinculo)
        .eq("tipo_documento", tipo_documento)
        .single();

      if (existingData && !existingError) {
        return NextResponse.json(
          {
            error: `Document type "${tipo_documento}" already exists for tipo_vinculo "${tipo_vinculo}"`,
          },
          { status: 409 },
        );
      }

      // Insert new checklist item
      const { data, error } = await supabase
        .from("checklist_documentos")
        .insert([
          {
            tipo_vinculo,
            tipo_documento,
            descricao,
            obrigatorio,
            ordem,
          },
        ])
        .select();

      if (error) {
        console.error("Supabase insert error:", error);
        return NextResponse.json(
          {
            erro: sanitizarErro(
              "Failed to create checklist item. Database error.",
              500,
            ),
          },
          { status: 500 },
        );
      }

      return NextResponse.json(data[0], { status: 201 });
    } catch (error) {
      console.error("Checklist POST error:", error);
      return NextResponse.json(
        {
          erro: sanitizarErro(
            "Internal server error creating checklist item",
            500,
          ),
        },
        { status: 500 },
      );
    }
  },
);
