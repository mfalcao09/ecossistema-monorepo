import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protegerRota } from "@/lib/security/api-guard";
import { sanitizarErro } from "@/lib/security/sanitize-error";
import archiver from "archiver";
import { PassThrough } from "stream";

// Fix 2026-04-23: Next.js 15 + Fluid Compute exige dynamic explicito;
// sem isso, rotas serverless travam em cold-start (ate 300s default).
export const dynamic = "force-dynamic";
export const maxDuration = 20;

// ═══════════════════════════════════════════════════════════════════
// POST /api/diplomas/[id]/pacote-registradora
// Gera pacote ZIP para envio à registradora contendo:
//   - 2 XMLs assinados (HistoricoEscolar + DocumentacaoAcademica)
//   - 3 PDFs (Histórico, Termo Expedição, Termo Responsabilidade)
//   - Documentos do acervo digital
//   - manifest.json com metadados
// ═══════════════════════════════════════════════════════════════════
export const POST = protegerRota(
  async (request, { userId }) => {
    const supabase = await createClient();

    // Extrair ID do diploma da URL
    const url = new URL(request.url);
    const segments = url.pathname.split("/");
    const diplomaIdx = segments.indexOf("diplomas");
    const diplomaId = diplomaIdx >= 0 ? segments[diplomaIdx + 1] : null;

    if (!diplomaId) {
      return NextResponse.json(
        { error: "ID do diploma não fornecido" },
        { status: 400 },
      );
    }

    // Buscar diploma
    const { data: diploma, error: errDiploma } = await supabase
      .from("diplomas")
      .select(
        `
        *,
        diplomados (nome, cpf),
        cursos (nome, grau, codigo_emec)
      `,
      )
      .eq("id", diplomaId)
      .single();

    if (errDiploma || !diploma) {
      return NextResponse.json(
        {
          error: sanitizarErro(
            errDiploma?.message || "Diploma não encontrado",
            404,
          ),
        },
        { status: 404 },
      );
    }

    // Verificar status — aceita qualquer estado após assinatura estar completa
    const statusPermitidos = [
      "assinado",
      "aplicando_carimbo_tempo",
      "acervo_completo",
      "aguardando_envio_registradora",
      "pronto_para_registro",
      "aguardando_documentos",
      "gerando_documentos",
      "documentos_assinados",
    ];
    if (!statusPermitidos.includes(diploma.status)) {
      return NextResponse.json(
        {
          error: `Status atual (${diploma.status}) não permite gerar pacote. O diploma precisa estar assinado.`,
        },
        { status: 422 },
      );
    }

    try {
      // ── 1. Buscar XMLs assinados (com carimbo) ──
      const { data: xmls } = await supabase
        .from("xml_gerados")
        .select(
          "tipo, conteudo_xml, hash_sha256, arquivo_url, status, carimbo_tempo_base64, carimbo_tempo_nonce, carimbo_tempo_at",
        )
        .eq("diploma_id", diplomaId)
        .eq("status", "assinado");

      // ── 2. Buscar documentos complementares (PDFs — nova tabela Sprint 7) ──
      const { data: docsComplementares } = await supabase
        .from("diploma_documentos_complementares")
        .select("tipo, arquivo_assinado_url, arquivo_url, status")
        .eq("diploma_id", diplomaId)
        .in("tipo", [
          "historico_escolar_pdf",
          "termo_expedicao",
          "termo_responsabilidade",
        ]);

      // ── 3. Buscar documentos do acervo (tabela documentos_digitais — referência polimórfica) ──
      const { data: docsAcervo } = await supabase
        .from("documentos_digitais")
        .select("tipo, arquivo_url, status, metadados")
        .eq("referencia_tabela", "diplomas")
        .eq("referencia_id", diplomaId)
        .like("tipo", "acervo_%");

      // ── 4. Gerar manifest.json ──
      const diplomado = diploma.diplomados as any;
      const curso = diploma.cursos as any;

      const xmlsCarimbados = (xmls || []).filter(
        (x: any) => x.carimbo_tempo_base64,
      );
      const xmlsSemCarimbo = (xmls || []).filter(
        (x: any) => !x.carimbo_tempo_base64,
      );

      const manifest = {
        versao: "1.1",
        gerado_em: new Date().toISOString(),
        diploma_id: diplomaId,
        emissora: {
          nome: "Faculdades Integradas de Cassilândia",
          sigla: "FIC",
          codigo_mec: diploma.emissora_codigo_mec ?? null,
          cnpj: diploma.emissora_cnpj ?? null,
        },
        diplomado: {
          nome: diplomado?.nome,
          cpf: diplomado?.cpf,
        },
        curso: {
          nome: curso?.nome,
          grau: curso?.grau,
          codigo_emec: curso?.codigo_emec,
        },
        xmls: (xmls || []).map((x: any) => ({
          tipo: x.tipo,
          arquivo: `xmls/${x.tipo}.xml`,
          hash_sha256: x.hash_sha256,
          status: x.status,
          carimbo: x.carimbo_tempo_base64
            ? {
                arquivo: `xmls/${x.tipo}_carimbo.p7s`,
                nonce: x.carimbo_tempo_nonce,
                aplicado_em: x.carimbo_tempo_at,
              }
            : null,
        })),
        documentos_complementares: (docsComplementares || []).map((d: any) => ({
          tipo: d.tipo,
          status: d.status,
          disponivel: !!d.arquivo_url,
        })),
        acervo: (docsAcervo || []).map((d: any) => ({
          tipo: d.tipo,
          status: d.status,
        })),
        aviso:
          xmlsSemCarimbo.length > 0
            ? `${xmlsSemCarimbo.length} XML(s) sem carimbo do tempo: ${xmlsSemCarimbo.map((x: any) => x.tipo).join(", ")}`
            : null,
        total_arquivos:
          (xmls?.length ?? 0) * 2 +
          (docsComplementares?.length ?? 0) +
          (docsAcervo?.length ?? 0) +
          1,
      };

      // ── 5. Criar ZIP em memória ──
      const archive = archiver("zip", { zlib: { level: 9 } });
      const passthrough = new PassThrough();
      const chunks: Buffer[] = [];

      passthrough.on("data", (chunk: Buffer) => chunks.push(chunk));

      archive.pipe(passthrough);

      // Adicionar manifest
      archive.append(JSON.stringify(manifest, null, 2), {
        name: "manifest.json",
      });

      // Adicionar XMLs assinados (do storage — versão assinada) + carimbo separado
      for (const xml of xmls || []) {
        const nomeArquivo = `xmls/${xml.tipo}.xml`;

        // Buscar XML assinado do storage (arquivo_url) ou fallback para conteudo_xml
        if ((xml as any).arquivo_url) {
          try {
            const resp = await fetch((xml as any).arquivo_url, {
              signal: AbortSignal.timeout(10_000),
            });
            if (resp.ok) {
              const xmlBuffer = Buffer.from(await resp.arrayBuffer());
              archive.append(xmlBuffer, { name: nomeArquivo });
            } else if (xml.conteudo_xml) {
              archive.append(xml.conteudo_xml, { name: nomeArquivo });
            }
          } catch {
            if (xml.conteudo_xml)
              archive.append(xml.conteudo_xml, { name: nomeArquivo });
          }
        } else if (xml.conteudo_xml) {
          archive.append(xml.conteudo_xml, { name: nomeArquivo });
        }

        // Adicionar carimbo do tempo como arquivo .p7s separado (padrão CAdES)
        if ((xml as any).carimbo_tempo_base64) {
          const carimboBuffer = Buffer.from(
            (xml as any).carimbo_tempo_base64,
            "base64",
          );
          archive.append(carimboBuffer, {
            name: `xmls/${xml.tipo}_carimbo.p7s`,
          });
        }
      }

      // ── 6. Baixar PDFs/A do storage e incluir no ZIP ──
      // Para cada documento complementar com arquivo_url, inclui diretamente
      const pastas: Record<string, string> = {
        historico_escolar_pdf: "pdfs",
        termo_expedicao: "pdfs",
        termo_responsabilidade: "pdfs",
      };
      for (const doc of docsComplementares || []) {
        // Preferir versão assinada, fallback para original gerado
        const urlDoc =
          (doc as any).arquivo_assinado_url ?? (doc as any).arquivo_url;
        if (!urlDoc) continue;
        try {
          const resp = await fetch(urlDoc, {
            signal: AbortSignal.timeout(10_000),
          });
          if (resp.ok) {
            const buf = Buffer.from(await resp.arrayBuffer());
            const pasta = pastas[doc.tipo] ?? "documentos";
            archive.append(buf, { name: `${pasta}/${doc.tipo}.pdf` });
          }
        } catch {
          // Se não conseguir baixar, registra no manifest mas não bloqueia o ZIP
        }
      }

      // Adicionar referências de acervo como arquivo de texto
      const refsAcervo: string[] = [];
      for (const doc of docsAcervo || []) {
        if ((doc as any).arquivo_url) {
          refsAcervo.push(`[ACERVO] ${doc.tipo}: ${(doc as any).arquivo_url}`);
        }
      }
      if (refsAcervo.length > 0) {
        archive.append(refsAcervo.join("\n"), {
          name: "acervo/referencias.txt",
        });
      }

      await archive.finalize();

      // Esperar todos os chunks
      await new Promise<void>((resolve) => {
        passthrough.on("end", resolve);
      });

      const zipBuffer = Buffer.concat(chunks);

      // ── 7. Upload do ZIP ao storage ──
      const timestamp = Date.now();
      const zipPath = `diplomas/${diplomaId}/pacotes/pacote_registradora_${timestamp}.zip`;

      const { error: errUpload } = await supabase.storage
        .from("documentos")
        .upload(zipPath, zipBuffer, {
          contentType: "application/zip",
          upsert: true,
        });

      if (errUpload) {
        console.error("[API] Erro ao fazer upload do ZIP:", errUpload.message);
      }

      // ── 8. Atualizar status do diploma para aguardando_envio_registradora ──
      await supabase
        .from("diplomas")
        .update({
          status: "aguardando_envio_registradora",
          updated_at: new Date().toISOString(),
        })
        .eq("id", diplomaId);

      // Log assíncrono
      supabase
        .from("documentos_digitais_log")
        .insert({
          documento_id: diplomaId,
          evento: "pacote_registradora_gerado",
          status_antes: diploma.status,
          status_depois: "aguardando_envio_registradora",
          usuario_id: userId,
          detalhes: {
            tipo: "pacote_registradora",
            total_arquivos: manifest.total_arquivos,
            zip_path: zipPath,
            tamanho_bytes: zipBuffer.length,
            xmls_com_carimbo: xmlsCarimbados.length,
            xmls_sem_carimbo: xmlsSemCarimbo.length,
          },
        })
        .then(() => {});

      const cpfDiplomado =
        (diploma.diplomados as any)?.cpf?.replace(/\D/g, "").slice(0, 11) ??
        diplomaId.slice(0, 8);
      const nomeArquivoZip = `pacote_${cpfDiplomado}.zip`;

      // Retornar ZIP como binário (frontend usa res.blob() para download direto)
      return new NextResponse(zipBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${nomeArquivoZip}"`,
          "Content-Length": String(zipBuffer.length),
          "X-Pacote-Path": zipPath,
          "X-Total-Arquivos": String(manifest.total_arquivos),
        },
      });
    } catch (err: any) {
      return NextResponse.json(
        { error: sanitizarErro(err.message ?? "Erro ao gerar pacote", 500) },
        { status: 500 },
      );
    }
  },
  { skipCSRF: true },
);
