/**
 * Base Builder — Wrapper xmlbuilder2 + utilitários compartilhados
 * Motor XML v2 — Diploma Digital FIC
 *
 * Centraliza:
 * - Constantes (namespace, versão XSD)
 * - Funções utilitárias (limpar números, formatar data)
 * - Factory do xmlbuilder2
 */

import { create } from "xmlbuilder2";
import type { XMLBuilder } from "xmlbuilder2/lib/interfaces";

// ============================================================
// CONSTANTES DO XSD v1.05
// ============================================================

export const XSD_NAMESPACE =
  "https://portal.mec.gov.br/diplomadigital/arquivos-em-xsd";
export const XSI_NAMESPACE = "http://www.w3.org/2001/XMLSchema-instance";
export const XSD_VERSAO = "1.05";

// ============================================================
// UTILITÁRIOS
// ============================================================

/** Remove tudo exceto dígitos (CPF, CNPJ, CEP) */
export function limparNum(num: string | undefined | null): string {
  if (!num) return "";
  return num.replace(/\D/g, "");
}

/** Formata data para ISO YYYY-MM-DD */
export function fmtData(data: string | undefined | null): string {
  if (!data) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) return data;
  const m = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return data;
}

/**
 * Gera a `DataExpedicaoDiploma` que vai dentro de
 * `THistoricoEscolar.SituacaoAtualDiscente.Formado.DataExpedicaoDiploma`.
 *
 * Bug #E — fix 2026-04-07 (Onda 2 / Caminho C):
 * Conforme XSD `leiauteHistoricoEscolar_v1.05.xsd` linhas 415-421
 * (`TSituacaoFormado`), `DataExpedicaoDiploma` é OBRIGATÓRIA
 * (`minOccurs="1"`) sempre que a situação do discente for "Formado".
 *
 * Semanticamente é a data em que a IES emissora está expedindo o diploma —
 * que coincide com a data de geração do XML do histórico (per IN 05). Por
 * isso é derivada aqui ao montar o XML, NÃO recebida no payload de entrada.
 *
 * IMPORTANTE: este helper NUNCA deve ser usado para preencher
 * `DataExpedicaoDiploma` no XML do diploma — esse campo só existe dentro
 * de `TLivroRegistro`/`TLivroRegistroNSF` (XSD diploma linhas 500/532),
 * que são exclusivamente preenchidos pela REGISTRADORA, não pela FIC.
 *
 * Usa fuso America/Sao_Paulo (servidor Vercel roda em UTC — `new Date()`
 * direto pode gerar a data errada após ~21h horário de Brasília).
 */
export function gerarDataExpedicaoXML(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date()).reduce(
    (acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    },
    {} as Record<string, string>,
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Gera ID com padding de zeros (ex: Dip + 44 dígitos)
 *
 * XSD v1.05 restringe IDs ao padrão `^Prefixo[0-9]{N}$` (apenas dígitos
 * decimais). Como UUIDs contêm letras hex (a-f), precisamos converter o
 * UUID para representação decimal antes de fazer padding com zeros.
 *
 * Estratégia: BigInt(0x + hex) → decimal string → padStart com zeros.
 * 32 chars hex = 128 bits → max ≈ 3.4×10³⁸ → cabe em 39 dígitos decimais.
 * Padding até totalDigitos (44) garante o tamanho exato exigido pelo XSD.
 */
export function gerarIdXML(
  prefixo: string,
  totalDigitos: number,
  uuid: string,
): string {
  const hex = uuid.replace(/-/g, "");
  // Converte hex → BigInt → decimal (apenas dígitos 0-9)
  const decimal = BigInt(`0x${hex || "0"}`).toString(10);
  const padded = decimal.padStart(totalDigitos, "0").slice(-totalDigitos);
  return `${prefixo}${padded}`;
}

/**
 * Mapeia o enum interno do banco para o valor literal aceito pelo XSD `TAmb`.
 *
 * Bug #1 — fix 2026-04-07 (Onda 1).
 * Per IN SESu 05/2022 §2.2.2.3, apenas "Produção" tem validade legal.
 * "Homologação" e "Teste" existem só para cenários de desenvolvimento.
 */
export function formatarAmbienteXSD(
  ambiente: "producao" | "homologacao" | "teste" | undefined | null,
): "Produção" | "Homologação" | "Teste" {
  switch (ambiente) {
    case "homologacao":
      return "Homologação";
    case "teste":
      return "Teste";
    case "producao":
    default:
      return "Produção";
  }
}

// ============================================================
// HELPERS xmlbuilder2
// ============================================================

/**
 * Adiciona elemento com texto somente se valor existir
 * Equivalente ao antigo tagOpc()
 */
export function eleOpc(
  parent: XMLBuilder,
  tag: string,
  value?: string | number | null,
): void {
  if (value === null || value === undefined || value === "") return;
  parent.ele(tag).txt(String(value));
}

/**
 * Cria o documento XML raiz com declaração e namespaces
 */
export function criarDocumentoXML(rootTag: string): XMLBuilder {
  const doc = create({ version: "1.0", encoding: "UTF-8" })
    .ele(XSD_NAMESPACE, rootTag)
    .att("xmlns:xsi", XSI_NAMESPACE);
  return doc;
}

/**
 * Serializa o documento XML para string.
 *
 * IMPORTANTE: prettyPrint=false é OBRIGATÓRIO por compliance com a
 * IN SESu 05/2022 §1.2.2.V, que proíbe line-feed, CR, tab e espaços
 * entre tags. Whitespace entre tags afeta a canonicalização XAdES e
 * pode invalidar a assinatura digital.
 *
 * Bug #10 — fix 2026-04-07 (Onda 1).
 */
export function serializarXML(doc: XMLBuilder): string {
  return doc.end({ prettyPrint: false, headless: false });
}

export type { XMLBuilder };
