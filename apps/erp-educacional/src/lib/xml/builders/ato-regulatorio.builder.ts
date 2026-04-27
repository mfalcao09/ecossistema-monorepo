/**
 * Builder de Ato Regulatório — TAtoRegulatorioComOuSemEMEC do XSD v1.05
 * Sequence: Tipo, Numero, Data, VeiculoPublicacao?, DataPublicacao?,
 *           SecaoPublicacao?, PaginaPublicacao?, NumeroDOU?
 *
 * Reutilizado em: Autorizacao, Reconhecimento, Credenciamento, etc.
 */

import type { XMLBuilder } from "xmlbuilder2/lib/interfaces";
import { AtoRegulatorio } from "../tipos";
import { fmtData, eleOpc } from "./base.builder";

/**
 * Adiciona bloco de ato regulatório ao parent
 * @param parent - Nó XML pai (ex: <Autorizacao>, <Credenciamento>)
 * @param ato - Dados do ato regulatório
 */
export function buildAtoRegulatorio(
  parent: XMLBuilder,
  ato: AtoRegulatorio,
): void {
  parent.ele("Tipo").txt(ato.tipo || "");
  parent.ele("Numero").txt(ato.numero || "");
  parent.ele("Data").txt(fmtData(ato.data));
  eleOpc(parent, "VeiculoPublicacao", ato.veiculo_publicacao);
  eleOpc(
    parent,
    "DataPublicacao",
    ato.data_publicacao ? fmtData(ato.data_publicacao) : undefined,
  );
  eleOpc(parent, "SecaoPublicacao", ato.secao_publicacao);
  eleOpc(parent, "PaginaPublicacao", ato.pagina_publicacao);
  // XSD TNumeroDOU é restrição de TNumeroPositivo (xs:unsignedInt, padrão [1-9][0-9]*).
  // Alguns atos históricos têm sufixo alfa (ex: "249-E" = edição extra do DOU).
  // Remove não-dígitos antes de gravar; se ficar vazio, omite o elemento.
  const numeroDOULimpo = ato.numero_dou
    ? ato.numero_dou.replace(/\D/g, "")
    : undefined;
  eleOpc(parent, "NumeroDOU", numeroDOULimpo || undefined);
}
