"use client";

/**
 * /print/termo-responsabilidade/[diplomaId]
 *
 * Rota minimalista renderizada pelo Puppeteer headless (via render-pdf.ts)
 * para gerar o PDF do Termo de Responsabilidade.
 */

import { useEffect, useState, use } from "react";
import TermoResponsabilidadeTemplate, {
  type DadosTermoResponsabilidade,
} from "@/components/documentos/TermoResponsabilidadeTemplate";
import type { DiplomaConfig } from "@/types/diploma-config";
import type { DadosSnapshot, SnapshotAssinante } from "@/lib/diploma/snapshot";

interface DadosResponse {
  config: DiplomaConfig | null;
  assinantes?: SnapshotAssinante[];
  snapshot?: DadosSnapshot | null;
}

export default function PrintTermoResponsabilidadePage({
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

  const snap = data.snapshot;
  const cfg = data.config;

  const assinantes: SnapshotAssinante[] =
    snap?.assinantes && snap.assinantes.length > 0
      ? snap.assinantes
      : (data.assinantes ?? []);

  const primeiro = assinantes[0];

  const iesNome =
    snap?.ies_emissora?.nome ?? "Faculdades Integradas de Cassilândia";
  const iesCnpj = snap?.ies_emissora?.cnpj ?? null;
  const iesMunicipio = snap?.ies_emissora?.municipio ?? "Cassilândia";
  const iesUf = snap?.ies_emissora?.uf ?? "MS";

  const dadosTermo: DadosTermoResponsabilidade = {
    ies_nome: iesNome,
    ies_cnpj: iesCnpj,
    ies_municipio: iesMunicipio,
    ies_uf: iesUf,
    responsavel_nome: primeiro?.nome ?? "Responsável — Pendente",
    responsavel_cargo: primeiro?.cargo ?? "Diretor(a)",
    responsavel_cpf: primeiro?.cpf ?? null,
    data_emissao: new Date().toISOString().split("T")[0],
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
        <TermoResponsabilidadeTemplate
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
