import { protegerRota } from '@/lib/security/api-guard'
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createHash } from "crypto";
import { registrarDocumento } from "@/lib/documentos/engine";
import { sanitizarErro } from "@/lib/security/sanitize-error";

// POST /api/acervo/upload
// Recebe um PDF digitalizado, calcula SHA-256, sobe para storage,
// cria registro em documentos_digitais (origem: digitalizado) e
// salva metadados obrigatórios do Decreto 10.278/2020.
export const POST = protegerRota(async (request: NextRequest, { userId, tenantId }) => {
  try {
    const supabase = await createClient();
    const formData = await request.formData();

    // ── Campos obrigatórios ──────────────────────────────
    const arquivo = formData.get("arquivo") as File | null;
    if (!arquivo) {
      return NextResponse.json({ error: "Arquivo PDF obrigatório." }, { status: 400 });
    }

    const tipo = formData.get("tipo") as string;
    const destinatarioNome = formData.get("destinatario_nome") as string;
    const titulo = formData.get("titulo") as string;

    if (!tipo || !destinatarioNome || !titulo) {
      return NextResponse.json(
        { error: "tipo, destinatario_nome e titulo são obrigatórios." },
        { status: 400 }
      );
    }

    // ── Campos de metadados MEC ──────────────────────────
    const loteId = formData.get("lote_id") as string | null;
    const localDigitalizacao = formData.get("local_digitalizacao") as string || "Secretaria FIC";
    const responsavelNome = formData.get("responsavel_nome") as string || "Secretaria";
    const responsavelCargo = formData.get("responsavel_cargo") as string | null;
    const responsavelCpf = formData.get("responsavel_cpf") as string | null;
    const dataDocOriginal = formData.get("data_documento_original") as string | null;
    const numeroDocOriginal = formData.get("numero_documento_original") as string | null;
    const observacoes = formData.get("observacoes_originais") as string | null;
    const resolucaoDpi = formData.get("resolucao_dpi");
    const equipamento = formData.get("equipamento") as string | null;

    // ── Lê o arquivo e calcula hash SHA-256 ──────────────
    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const hashSha256 = createHash("sha256").update(buffer).digest("hex");
    const tamanhoBytes = buffer.length;

    // ── Sobe para Supabase Storage ────────────────────────
    const nomeArquivo = `acervo/${Date.now()}-${arquivo.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documentos")
      .upload(nomeArquivo, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Erro no upload: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from("documentos")
      .getPublicUrl(uploadData.path);

    const arquivoUrl = urlData.publicUrl;

    // ── Cria registro na engine de documentos_digitais ───
    const resultado = await registrarDocumento({
      tipo: tipo as Parameters<typeof registrarDocumento>[0]["tipo"],
      destinatario_nome: destinatarioNome,
      destinatario_cpf: formData.get("destinatario_cpf") as string | undefined,
      titulo,
      numero_documento: formData.get("numero_documento") as string | undefined,
      diplomado_id: formData.get("diplomado_id") as string | undefined,
      ies_id: formData.get("ies_id") as string | undefined,
      metadata: { origem: "digitalizado" },
    });

    if (!resultado.sucesso || !resultado.documento) {
      return NextResponse.json(
        { error: `Erro ao registrar documento: ${resultado.erro}` },
        { status: 500 }
      );
    }

    const docId = resultado.documento.id;

    // ── Atualiza arquivo, hash e origem ───────────────────
    await supabase
      .from("documentos_digitais")
      .update({
        arquivo_url: arquivoUrl,
        arquivo_hash_sha256: hashSha256,
        arquivo_tamanho_bytes: tamanhoBytes,
        origem: "digitalizado",
        status: "aguardando_assinatura",
      })
      .eq("id", docId);

    // ── Salva metadados obrigatórios Decreto 10.278/2020 ─
    await supabase.from("acervo_digitalizacao_meta").insert({
      documento_id: docId,
      lote_id: loteId ?? null,
      local_digitalizacao: localDigitalizacao,
      responsavel_nome: responsavelNome,
      responsavel_cargo: responsavelCargo ?? null,
      responsavel_cpf: responsavelCpf ?? null,
      data_documento_original: dataDocOriginal ?? null,
      numero_documento_original: numeroDocOriginal ?? null,
      observacoes_originais: observacoes ?? null,
      resolucao_dpi: resolucaoDpi ? parseInt(resolucaoDpi as string) : null,
      equipamento: equipamento ?? null,
    });

    // ── Atualiza contador do lote ─────────────────────────
    if (loteId) {
      const { data: lote } = await supabase
        .from("acervo_lotes")
        .select("total_docs")
        .eq("id", loteId)
        .single();

      if (lote) {
        await supabase
          .from("acervo_lotes")
          .update({
            total_docs: (lote.total_docs ?? 0) + 1,
            status: "em_andamento",
            updated_at: new Date().toISOString(),
          })
          .eq("id", loteId);
      }
    }

    return NextResponse.json({
      ok: true,
      documento_id: docId,
      arquivo_url: arquivoUrl,
      hash_sha256: hashSha256,
      codigo_verificacao: resultado.documento.codigo_verificacao,
    }, { status: 201 });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ erro: sanitizarErro(msg, 500) }, { status: 500 });
  }
})
