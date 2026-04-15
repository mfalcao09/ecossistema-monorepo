import { protegerRota } from '@/lib/security/api-guard'
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarDocumento } from "@/lib/documentos/engine";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// POST /api/acervo/emitir
// Emite um documento nato-digital a partir de um template.
// Gera o registro no engine (documentos_digitais) e retorna
// o HTML renderizado para que o frontend possa gerar o PDF via
// API de geração de PDF (Puppeteer/serverless, implementado na Fase 5b).
export const POST = protegerRota(async (request: NextRequest, { userId, tenantId }) => {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const {
      template_id,
      destinatario_nome,
      destinatario_cpf,
      diplomado_id,
      ies_id,
      numero_documento,
      variaveis_valores = {},
    } = body;

    if (!template_id || !destinatario_nome) {
      return NextResponse.json(
        { error: "template_id e destinatario_nome são obrigatórios." },
        { status: 400 }
      );
    }

    // Busca template
    const { data: template, error: tmplErr } = await supabase
      .from("acervo_templates")
      .select("*")
      .eq("id", template_id)
      .eq("ativo", true)
      .single();

    if (tmplErr || !template) {
      return NextResponse.json({ error: "Template não encontrado ou inativo." }, { status: 404 });
    }

    // Valida variáveis obrigatórias do template
    const varDef = template.variaveis as Record<string, { label: string; obrigatorio: boolean }>;
    const missing: string[] = [];
    for (const [key, def] of Object.entries(varDef)) {
      if (def.obrigatorio && !variaveis_valores[key]) {
        missing.push(def.label);
      }
    }
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Campos obrigatórios ausentes: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // Renderiza HTML substituindo as variáveis
    let htmlRenderizado = template.conteudo_html as string;
    // Variáveis do template: {{nome_variavel}}
    for (const [key, value] of Object.entries(variaveis_valores)) {
      htmlRenderizado = htmlRenderizado.replaceAll(`{{${key}}}`, value as string);
    }
    // Variáveis automáticas do sistema
    htmlRenderizado = htmlRenderizado
      .replaceAll("{{destinatario_nome}}", destinatario_nome)
      .replaceAll("{{destinatario_cpf}}", destinatario_cpf ?? "")
      .replaceAll("{{data_emissao}}", new Date().toLocaleDateString("pt-BR"))
      .replaceAll("{{ano_emissao}}", String(new Date().getFullYear()));

    // Gera título padrão
    const titulo = `${template.nome} — ${destinatario_nome}`;

    // Registra no engine de documentos
    const resultado = await registrarDocumento({
      tipo: template.tipo,
      destinatario_nome,
      destinatario_cpf: destinatario_cpf ?? undefined,
      titulo,
      numero_documento: numero_documento ?? undefined,
      diplomado_id: diplomado_id ?? undefined,
      ies_id: ies_id ?? undefined,
      metadata: {
        origem: "nato_digital",
        template_id,
        template_slug: template.slug,
        variaveis_valores,
      },
    });

    if (!resultado.sucesso || !resultado.documento) {
      return NextResponse.json(
        { error: `Erro ao registrar documento: ${resultado.erro}` },
        { status: 500 }
      );
    }

    const docId = resultado.documento.id;

    // Atualiza origem como nato_digital
    await supabase
      .from("documentos_digitais")
      .update({
        origem: "nato_digital",
        status: "aguardando_assinatura",
      })
      .eq("id", docId);

    return NextResponse.json({
      ok: true,
      documento_id: docId,
      codigo_verificacao: resultado.documento.codigo_verificacao,
      html_renderizado: htmlRenderizado,
      orientacao_pdf: template.orientacao_pdf,
      formato_papel: template.formato_papel,
    }, { status: 201 });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ erro: sanitizarErro(msg, 500) }, { status: 500 });
  }
})
