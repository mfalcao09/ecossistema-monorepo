import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protegerRota } from "@/lib/security/api-guard";

// GET /api/diplomas/pendentes-assinatura
// Lista diplomas que estão prontos para assinatura digital (BRy)
// Filtra por status: aguardando_assinatura_emissora, xml_gerado, em_assinatura
export const GET = protegerRota(async (_request: NextRequest) => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("diplomas")
    .select(`
      id,
      diplomado_id,
      curso_id,
      processo_id,
      status,
      data_conclusao,
      created_at,
      updated_at,
      diplomados (
        nome,
        cpf
      ),
      cursos (
        nome,
        grau
      ),
      processos_emissao (
        nome
      )
    `)
    .in("status", [
      "xml_gerado",
      "aguardando_assinatura_emissora",
      "em_assinatura",
      "assinado",
      "aguardando_envio_registradora",
    ])
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ diplomas: data ?? [] });
}, { skipCSRF: true });
