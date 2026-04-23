"use client";

/**
 * /print/termo-expedicao/[diplomaId]
 *
 * Rota minimalista renderizada pelo Puppeteer headless (via render-pdf.ts)
 * para gerar o PDF do Termo de Expedição. Busca dados consolidados via
 * endpoint de snapshot e passa ao template.
 */

import { useEffect, useState, use } from "react";
import TermoExpedicaoTemplate, {
  type DadosTermoExpedicao,
} from "@/components/documentos/TermoExpedicaoTemplate";
import type { DiplomaConfig } from "@/types/diploma-config";
import type { DadosSnapshot, SnapshotAssinante } from "@/lib/diploma/snapshot";

// Resposta do endpoint /dados (formato atual da Secretaria)
interface DadosResponse {
  config: DiplomaConfig | null;
  dadosAluno?: {
    nome?: string | null;
    cpf?: string | null;
  };
  dadosCurso?: {
    curso_nome?: string | null;
    grau?: string | null;
    titulo_conferido?: string | null;
    numero_registro?: string | null;
    livro?: string | null;
    folha?: string | null;
    processo?: string | null;
    data_conclusao?: string | null;
    data_colacao?: string | null;
    data_expedicao?: string | null;
  };
  assinantes?: SnapshotAssinante[];
  // Quando disponível — snapshot imutável tem precedência
  snapshot?: DadosSnapshot | null;
}

export default function PrintTermoExpedicaoPage({
  params,
}: {
  params: Promise<{ diplomaId: string }>;
}) {
  const { diplomaId } = use(params);
  const [data, setData] = useState<DadosResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/secretaria/emissao/historico/${diplomaId}/dados`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ?? `HTTP ${res.status}`,
          );
        }
        return res.json();
      })
      .then((d: DadosResponse) => {
        if (!cancelado) setData(d);
      })
      .catch((e: unknown) => {
        if (!cancelado)
          setErro(e instanceof Error ? e.message : "Erro ao carregar");
      });
    return () => {
      cancelado = true;
    };
  }, [diplomaId]);

  if (erro) {
    return (
      <div
        style={{ padding: "2rem", fontFamily: "sans-serif", color: "#dc2626" }}
      >
        Erro: {erro}
      </div>
    );
  }
  if (!data) {
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif", color: "#666" }}>
        Carregando…
      </div>
    );
  }

  // Prioriza snapshot se existir (consistência com os XMLs)
  const snap = data.snapshot;
  const cfg = data.config;

  const nomeDiplomado = snap?.diplomado.nome ?? data.dadosAluno?.nome ?? "—";
  const cpfDiplomado = snap?.diplomado.cpf ?? data.dadosAluno?.cpf ?? "—";
  const cursoNome = snap?.curso.nome ?? data.dadosCurso?.curso_nome ?? "—";
  const grau = snap?.curso.grau ?? data.dadosCurso?.grau ?? null;
  const tituloConferido =
    snap?.curso.titulo_conferido ?? data.dadosCurso?.titulo_conferido ?? null;
  const dataColacao =
    snap?.dados_academicos.data_colacao_grau ??
    data.dadosCurso?.data_colacao ??
    null;
  const dataConclusao =
    snap?.dados_academicos.data_conclusao ??
    data.dadosCurso?.data_conclusao ??
    null;
  const dataExpedicao =
    snap?.dados_academicos.data_expedicao ??
    data.dadosCurso?.data_expedicao ??
    null;
  const numeroRegistro =
    snap?.registro?.numero_registro ?? data.dadosCurso?.numero_registro ?? null;
  const livro = snap?.registro?.livro ?? data.dadosCurso?.livro ?? null;
  const folha = snap?.registro?.folha ?? data.dadosCurso?.folha ?? null;
  const processo =
    snap?.registro?.processo ?? data.dadosCurso?.processo ?? null;

  const iesNome =
    snap?.ies_emissora?.nome ??
    cfg?.historico_texto_rodape ??
    "Faculdades Integradas de Cassilândia";
  const iesMunicipio = snap?.ies_emissora?.municipio ?? "Cassilândia";
  const iesUf = snap?.ies_emissora?.uf ?? "MS";

  const assinantes: SnapshotAssinante[] =
    snap?.assinantes && snap.assinantes.length > 0
      ? snap.assinantes
      : (data.assinantes ?? []);

  const dadosTermo: DadosTermoExpedicao = {
    nome_diplomado: nomeDiplomado,
    cpf_diplomado: cpfDiplomado,
    curso_nome: cursoNome,
    grau,
    titulo_conferido: tituloConferido,
    data_colacao: dataColacao,
    data_conclusao: dataConclusao,
    data_expedicao: dataExpedicao,
    numero_registro: numeroRegistro,
    livro,
    folha,
    processo,
    ies_nome:
      typeof iesNome === "string"
        ? iesNome
        : "Faculdades Integradas de Cassilândia",
    ies_municipio: iesMunicipio,
    ies_uf: iesUf,
    assinantes,
  };

  const timbradoRaw = cfg?.historico_arquivo_timbrado_url ?? "";
  const timbradoUrl =
    timbradoRaw && !timbradoRaw.toLowerCase().endsWith(".pdf")
      ? timbradoRaw
      : null;

  const margens = {
    topo: cfg?.historico_margem_topo ?? 25,
    inferior: cfg?.historico_margem_inferior ?? 20,
    esquerda: cfg?.historico_margem_esquerda ?? 20,
    direita: cfg?.historico_margem_direita ?? 20,
  };

  return (
    <>
      <style>{`
        @page { size: A4; margin: 0; }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        #print-root > div > div {
          page-break-after: always;
          margin: 0 !important;
          box-shadow: none !important;
          border-radius: 0 !important;
        }
        #print-root > div > div:last-child {
          page-break-after: auto;
        }
      `}</style>

      <div id="print-root" data-print-ready="true">
        <TermoExpedicaoTemplate
          dados={dadosTermo}
          timbradoUrl={timbradoUrl}
          margens={margens}
          fonte={cfg?.historico_fonte ?? "Times New Roman"}
          tamanhoFonte={11}
          textoRodape={cfg?.historico_texto_rodape ?? null}
        />
      </div>
    </>
  );
}
