/**
 * TermoExpedicaoTemplate — Template A4 do Termo de Expedição de Diploma
 *
 * Usado pela rota /print/termo-expedicao/[id] + Puppeteer para gerar
 * o PDF via render-pdf.ts (Fase 3 do Snapshot Imutável).
 *
 * Lê dados consolidados (diplomado, curso, datas, assinantes) e renderiza
 * em uma folha A4 branca (com timbrado se configurado).
 */

"use client";

import type { SnapshotAssinante } from "@/lib/diploma/snapshot";

// ═══════════════════════════════════════════════════════════════════════════
// Props
// ═══════════════════════════════════════════════════════════════════════════

export interface DadosTermoExpedicao {
  // Diplomado
  nome_diplomado: string;
  cpf_diplomado: string;

  // Curso
  curso_nome: string;
  grau?: string | null;
  titulo_conferido?: string | null;

  // Datas
  data_colacao?: string | null;
  data_conclusao?: string | null;
  data_expedicao?: string | null; // default: hoje

  // Registro
  numero_registro?: string | null;
  livro?: string | null;
  folha?: string | null;
  processo?: string | null;

  // IES
  ies_nome: string;
  ies_municipio: string;
  ies_uf: string;

  // Assinantes
  assinantes: SnapshotAssinante[];
}

export interface TermoExpedicaoTemplateProps {
  dados: DadosTermoExpedicao;
  /** URL do timbrado PNG/JPG (se configurado) */
  timbradoUrl?: string | null;
  /** Margens internas em mm (default 25/20/20/20) */
  margens?: {
    topo: number;
    inferior: number;
    esquerda: number;
    direita: number;
  };
  /** Fonte base (default 'Times New Roman') */
  fonte?: string;
  /** Tamanho base em pt (default 11) */
  tamanhoFonte?: number;
  /** Rodapé opcional (de diploma_config.historico_texto_rodape) */
  textoRodape?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function dataPorExtenso(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
    const meses = [
      "janeiro",
      "fevereiro",
      "março",
      "abril",
      "maio",
      "junho",
      "julho",
      "agosto",
      "setembro",
      "outubro",
      "novembro",
      "dezembro",
    ];
    return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
  } catch {
    return iso;
  }
}

function formatarCPF(cpf: string | null | undefined): string {
  if (!cpf) return "—";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return cpf;
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

// ═══════════════════════════════════════════════════════════════════════════
// Componente
// ═══════════════════════════════════════════════════════════════════════════

export default function TermoExpedicaoTemplate({
  dados,
  timbradoUrl,
  margens = { topo: 25, inferior: 20, esquerda: 20, direita: 20 },
  fonte = "Times New Roman",
  tamanhoFonte = 11,
  textoRodape,
}: TermoExpedicaoTemplateProps) {
  const dataExpedicao =
    dados.data_expedicao ?? new Date().toISOString().split("T")[0];

  const temTimbrado =
    Boolean(timbradoUrl) && !timbradoUrl!.toLowerCase().endsWith(".pdf");

  return (
    <div className="flex flex-col">
      {/* Uma página A4 */}
      <div
        className="bg-white relative overflow-hidden"
        style={{ width: "210mm", height: "297mm" }}
      >
        {/* Timbrado de fundo */}
        {temTimbrado && (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${timbradoUrl})`,
              backgroundSize: "100% 100%",
              backgroundPosition: "center",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Conteúdo com margens */}
        <div
          className="relative flex flex-col"
          style={{
            padding: `${margens.topo}mm ${margens.direita}mm ${margens.inferior}mm ${margens.esquerda}mm`,
            fontFamily: fonte,
            fontSize: `${tamanhoFonte}pt`,
            height: "297mm",
            color: "#1a1a1a",
          }}
        >
          {/* Título */}
          <div className="text-center mb-8">
            <h1
              className="font-bold tracking-wide"
              style={{ fontSize: `${tamanhoFonte + 5}pt` }}
            >
              TERMO DE EXPEDIÇÃO DE DIPLOMA
            </h1>
            <p
              className="text-gray-600 mt-2"
              style={{ fontSize: `${tamanhoFonte - 1}pt` }}
            >
              Portaria MEC nº 70/2025 · IN SESu/MEC nº 05/2022
            </p>
          </div>

          {/* Corpo — texto oficial */}
          <div
            className="leading-relaxed text-justify"
            style={{ fontSize: `${tamanhoFonte}pt`, lineHeight: 1.7 }}
          >
            <p className="mb-4">
              A <strong>{dados.ies_nome}</strong>, com sede em{" "}
              <strong>
                {dados.ies_municipio}/{dados.ies_uf}
              </strong>
              , no exercício das atribuições conferidas pela legislação de
              ensino superior em vigor, confere a:
            </p>

            {/* Dados do diplomado em destaque */}
            <div className="my-6 px-4 py-4 border-l-4 border-gray-300">
              <p className="mb-2">
                <span
                  className="text-gray-500"
                  style={{ fontSize: `${tamanhoFonte - 1}pt` }}
                >
                  Nome:
                </span>{" "}
                <strong>{dados.nome_diplomado}</strong>
              </p>
              <p className="mb-2">
                <span
                  className="text-gray-500"
                  style={{ fontSize: `${tamanhoFonte - 1}pt` }}
                >
                  CPF:
                </span>{" "}
                <strong>{formatarCPF(dados.cpf_diplomado)}</strong>
              </p>
              <p>
                <span
                  className="text-gray-500"
                  style={{ fontSize: `${tamanhoFonte - 1}pt` }}
                >
                  Curso:
                </span>{" "}
                <strong>{dados.curso_nome}</strong>
                {dados.grau ? ` (${dados.grau})` : ""}
              </p>
            </div>

            <p className="mb-4">
              o <strong>DIPLOMA DIGITAL</strong> de{" "}
              <strong>
                {dados.titulo_conferido || dados.grau || "Graduação"}
              </strong>{" "}
              em <strong>{dados.curso_nome}</strong>, tendo concluído o curso em{" "}
              <strong>{formatarData(dados.data_conclusao)}</strong> e colado
              grau em <strong>{formatarData(dados.data_colacao)}</strong>,
              expedido na presente data, em{" "}
              <strong>{dataPorExtenso(dataExpedicao)}</strong>.
            </p>

            {/* Registro */}
            {(dados.numero_registro ||
              dados.livro ||
              dados.folha ||
              dados.processo) && (
              <>
                <p className="mb-2 mt-6">
                  <strong>Dados do Registro:</strong>
                </p>
                <table
                  className="w-full mb-4"
                  style={{ fontSize: `${tamanhoFonte - 1}pt` }}
                >
                  <tbody>
                    {dados.numero_registro && (
                      <tr>
                        <td className="py-1" style={{ width: "30%" }}>
                          Registro nº:
                        </td>
                        <td className="py-1">
                          <strong>{dados.numero_registro}</strong>
                        </td>
                      </tr>
                    )}
                    {dados.livro && (
                      <tr>
                        <td className="py-1">Livro nº:</td>
                        <td className="py-1">
                          <strong>{dados.livro}</strong>
                        </td>
                      </tr>
                    )}
                    {dados.folha && (
                      <tr>
                        <td className="py-1">Folha nº:</td>
                        <td className="py-1">
                          <strong>{dados.folha}</strong>
                        </td>
                      </tr>
                    )}
                    {dados.processo && (
                      <tr>
                        <td className="py-1">Processo nº:</td>
                        <td className="py-1">
                          <strong>{dados.processo}</strong>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </>
            )}

            <p className="mb-4">
              Este termo, assinado digitalmente pelos responsáveis da
              Instituição de Ensino Superior, atesta a regularidade do
              procedimento de emissão do diploma digital, nos termos da Portaria
              MEC nº 70/2025 e da Instrução Normativa SESu/MEC nº 05/2022.
            </p>
          </div>

          {/* Espaçador flex */}
          <div className="flex-1" />

          {/* Local e data */}
          <div
            className="text-center mb-6"
            style={{ fontSize: `${tamanhoFonte}pt` }}
          >
            <p>
              {dados.ies_municipio}/{dados.ies_uf},{" "}
              {dataPorExtenso(dataExpedicao)}
            </p>
          </div>

          {/* Assinantes */}
          <div
            className="border-t-2 border-gray-300 pt-4"
            style={{ fontSize: `${tamanhoFonte - 1}pt` }}
          >
            <p className="font-bold mb-3 text-gray-700">
              Assinaturas Digitais ICP-Brasil:
            </p>
            <div className="space-y-3">
              {dados.assinantes.length === 0 ? (
                <p className="text-gray-400 italic">
                  Aguardando cadastro de signatários
                </p>
              ) : (
                dados.assinantes.map((a, i) => (
                  <div key={i} className="border-l-2 border-gray-200 pl-3">
                    <p className="font-semibold text-gray-800">{a.nome}</p>
                    <p className="text-gray-600">{a.cargo}</p>
                    {a.cpf && (
                      <p
                        className="text-gray-500"
                        style={{ fontSize: `${tamanhoFonte - 2}pt` }}
                      >
                        CPF: {formatarCPF(a.cpf)}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Rodapé opcional */}
          {textoRodape && (
            <div
              className="text-center text-gray-500 mt-4 pt-3 border-t border-gray-200"
              style={{ fontSize: `${tamanhoFonte - 3}pt` }}
            >
              {textoRodape}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
