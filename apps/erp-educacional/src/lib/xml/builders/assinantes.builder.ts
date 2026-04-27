/**
 * Builder de Assinantes — TInfoAssinantes do XSD v1.05
 *
 * Estrutura:
 *   <Assinantes>
 *     <Assinante>
 *       <CPF>00000000000</CPF>
 *       <Cargo>Reitor</Cargo>           ← se cargo está no enum TCargosAssinantes
 *     </Assinante>
 *     <Assinante>
 *       <CPF>00000000000</CPF>
 *       <OutroCargo>Vice-Reitor</OutroCargo>  ← caso contrário
 *     </Assinante>
 *   </Assinantes>
 *
 * Cardinalidade: <Assinantes> é opcional dentro do <DadosDiploma>, mas
 * <Assinante> tem minOccurs=1 dentro de <Assinantes>. Por isso, se não
 * houver assinantes ativos, NÃO emitimos o bloco <Assinantes> (em vez
 * de emitir um <Assinantes> vazio que quebra o XSD).
 *
 * O elemento <Assinantes> deve aparecer DEPOIS de <IesEmissora> e ANTES
 * das <ds:Signature> (que serão adicionadas pela API de assinatura).
 *
 * IMPORTANTE: O XSD impõe APENAS CPF + (Cargo|OutroCargo). NÃO existe
 * <Nome> dentro de <Assinante> — o nome é apenas referência interna nossa.
 */

import type { XMLBuilder } from "xmlbuilder2/lib/interfaces";
import { DadosDiploma, Assinante } from "../tipos";
import { limparNum } from "./base.builder";

/**
 * Cargos válidos do enum TCargosAssinantes (XSD v1.05).
 * Qualquer cargo fora desta lista vai como <OutroCargo>.
 */
const CARGOS_VALIDOS_XSD = new Set<string>([
  "Reitor",
  "Reitor em Exercício",
  "Responsável pelo registro",
  "Coordenador de Curso",
  "Subcoordenador de Curso",
  "Coordenador de Curso em exercício",
  "Chefe da área de registro de diplomas",
  "Chefe em exercício da área de registro de diplomas",
]);

/**
 * Decide se o cargo informado bate com o enum XSD ou se vai como OutroCargo.
 * Comparação case-sensitive (o XSD é case-sensitive).
 */
function classificarCargo(cargo: string | undefined | null): {
  tag: "Cargo" | "OutroCargo";
  valor: string;
} {
  const c = (cargo || "").trim();
  if (CARGOS_VALIDOS_XSD.has(c)) {
    return { tag: "Cargo", valor: c };
  }
  return { tag: "OutroCargo", valor: c };
}

/**
 * Adiciona o bloco <Assinantes> ao parent (deve ser <DadosDiploma>).
 * Retorna `true` se o bloco foi emitido, `false` se foi pulado por
 * ausência de assinantes válidos.
 */
export function buildAssinantesIes(
  parent: XMLBuilder,
  dados: DadosDiploma,
): boolean {
  // XSD v1.05 TAssinante exige <CPF type="TCpf"> = 11 dígitos.
  // Não há slot para CNPJ (eCNPJ) nesse bloco — o eCNPJ assina via XAdES,
  // não aparece como pessoa em <Assinantes>. Filtramos:
  //   1. Sem CPF/cargo → ignora
  //   2. tipo_certificado === 'eCNPJ' → ignora (não é pessoa física)
  //   3. CPF que após limpeza tem ≠ 11 dígitos (CNPJ por engano) → ignora
  const assinantes = (dados.assinantes || []).filter((a: Assinante) => {
    if (!a || !a.cpf || !a.cargo) return false;
    if (a.tipo_certificado === "eCNPJ") return false;
    const cpfLimpo = limparNum(a.cpf);
    return cpfLimpo.length === 11;
  });

  if (assinantes.length === 0) {
    // Bloco <Assinantes> exige minOccurs=1 de <Assinante>. Sem assinantes,
    // emitir o bloco vazio quebra o XSD — melhor omitir e deixar que a
    // validação posterior aponte que o diploma não tem assinantes.
    return false;
  }

  // Ordena por ordem_assinatura quando presente (eCNPJ deve assinar por último).
  const ordenados = [...assinantes].sort((a, b) => {
    const oa = a.ordem_assinatura ?? Number.MAX_SAFE_INTEGER;
    const ob = b.ordem_assinatura ?? Number.MAX_SAFE_INTEGER;
    return oa - ob;
  });

  const assinantesEle = parent.ele("Assinantes");

  for (const a of ordenados) {
    const assinanteEle = assinantesEle.ele("Assinante");
    assinanteEle.ele("CPF").txt(limparNum(a.cpf));

    const { tag, valor } = classificarCargo(a.cargo);
    assinanteEle.ele(tag).txt(valor);
  }

  return true;
}
