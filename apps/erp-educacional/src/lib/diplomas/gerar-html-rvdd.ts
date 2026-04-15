// =============================================================================
// gerar-html-rvdd.ts — Gerador de HTML para RVDD (Representação Visual)
//
// Recebe as variáveis planas + hashes dos XMLs assinados e gera o HTML
// completo da RVDD que será convertido em PDF ou salvo no Storage.
//
// TODO: Implementar template HTML completo com design FIC
// =============================================================================

import type { VariaveisRVDD } from '@/types/diplomas'

interface XmlHashInfo {
  tipo: string
  hash: string
}

/**
 * Gera o HTML completo da RVDD a partir das variáveis e hashes dos XMLs.
 *
 * @param variaveis Objeto com todas as variáveis planas para o template
 * @param xmlHashes Array com tipo e hash SHA-256 de cada XML assinado
 * @returns String HTML completa da RVDD
 */
export function gerarHtmlRvdd(
  variaveis: VariaveisRVDD,
  xmlHashes: XmlHashInfo[]
): string {
  // ── Template placeholder — será substituído pelo design completo ──────────
  const hashesHtml = xmlHashes
    .map(h => `<li><strong>${h.tipo}:</strong> ${h.hash}</li>`)
    .join('\n')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RVDD - ${variaveis.nome}</title>
  <style>
    body { font-family: 'Georgia', serif; margin: 2cm; color: #1a1a1a; }
    .header { text-align: center; margin-bottom: 2em; }
    .header h1 { font-size: 1.5em; color: #003366; }
    .header h2 { font-size: 1.1em; font-weight: normal; color: #666; }
    .section { margin: 1.5em 0; }
    .section h3 { font-size: 1em; color: #003366; border-bottom: 1px solid #ccc; padding-bottom: 0.3em; }
    .field { margin: 0.5em 0; }
    .field .label { font-weight: bold; color: #555; }
    .verificacao { margin-top: 2em; padding: 1em; background: #f5f5f5; border-radius: 4px; }
    .hashes { font-size: 0.8em; word-break: break-all; }
    .signatarios { margin-top: 2em; }
    .signatario { display: inline-block; text-align: center; margin: 1em 2em; }
    .signatario .nome { font-weight: bold; }
    .signatario .cargo { font-size: 0.9em; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${variaveis.ies_nome}${variaveis.ies_sigla ? ` (${variaveis.ies_sigla})` : ''}</h1>
    <h2>Representacao Visual do Diploma Digital</h2>
    ${variaveis.segunda_via ? '<p style="color: #cc0000; font-weight: bold;">SEGUNDA VIA</p>' : ''}
  </div>

  <div class="section">
    <h3>Dados do Diplomado</h3>
    <div class="field"><span class="label">Nome:</span> ${variaveis.nome_social ?? variaveis.nome}</div>
    ${variaveis.nome_social ? `<div class="field"><span class="label">Nome de Registro:</span> ${variaveis.nome}</div>` : ''}
    <div class="field"><span class="label">CPF:</span> ${variaveis.cpf}</div>
    ${variaveis.data_nascimento ? `<div class="field"><span class="label">Data de Nascimento:</span> ${variaveis.data_nascimento}</div>` : ''}
    ${variaveis.naturalidade ? `<div class="field"><span class="label">Naturalidade:</span> ${variaveis.naturalidade}</div>` : ''}
    ${variaveis.nacionalidade ? `<div class="field"><span class="label">Nacionalidade:</span> ${variaveis.nacionalidade}</div>` : ''}
    ${variaveis.rg ? `<div class="field"><span class="label">RG:</span> ${variaveis.rg}</div>` : ''}
  </div>

  <div class="section">
    <h3>Dados do Curso</h3>
    <div class="field"><span class="label">Curso:</span> ${variaveis.curso_nome}</div>
    <div class="field"><span class="label">Titulo Conferido:</span> ${variaveis.titulo_conferido}</div>
    <div class="field"><span class="label">Grau:</span> ${variaveis.grau}</div>
    <div class="field"><span class="label">Modalidade:</span> ${variaveis.modalidade}</div>
    ${variaveis.turno ? `<div class="field"><span class="label">Turno:</span> ${variaveis.turno}</div>` : ''}
    <div class="field"><span class="label">Carga Horaria:</span> ${variaveis.carga_horaria}h</div>
    ${variaveis.codigo_emec ? `<div class="field"><span class="label">Codigo e-MEC:</span> ${variaveis.codigo_emec}</div>` : ''}
    ${variaveis.ato_reconhecimento ? `<div class="field"><span class="label">Reconhecimento:</span> ${variaveis.ato_reconhecimento}</div>` : ''}
  </div>

  <div class="section">
    <h3>Datas</h3>
    ${variaveis.data_ingresso ? `<div class="field"><span class="label">Ingresso:</span> ${variaveis.data_ingresso}</div>` : ''}
    ${variaveis.data_conclusao ? `<div class="field"><span class="label">Conclusao:</span> ${variaveis.data_conclusao}</div>` : ''}
    ${variaveis.data_colacao ? `<div class="field"><span class="label">Colacao de Grau:</span> ${variaveis.data_colacao}</div>` : ''}
    ${variaveis.data_expedicao ? `<div class="field"><span class="label">Expedicao:</span> ${variaveis.data_expedicao}</div>` : ''}
  </div>

  ${variaveis.numero_registro ? `
  <div class="section">
    <h3>Registro</h3>
    <div class="field"><span class="label">Nr Registro:</span> ${variaveis.numero_registro}</div>
    ${variaveis.livro ? `<div class="field"><span class="label">Livro:</span> ${variaveis.livro}</div>` : ''}
    ${variaveis.pagina ? `<div class="field"><span class="label">Folha:</span> ${variaveis.pagina}</div>` : ''}
    ${variaveis.data_registro ? `<div class="field"><span class="label">Data Registro:</span> ${variaveis.data_registro}</div>` : ''}
  </div>
  ` : ''}

  <div class="verificacao">
    <h3>Verificacao de Autenticidade</h3>
    <div class="field"><span class="label">Codigo:</span> ${variaveis.codigo_validacao}</div>
    <div class="field"><span class="label">URL:</span> <a href="${variaveis.url_verificacao}">${variaveis.url_verificacao}</a></div>
    ${xmlHashes.length > 0 ? `
    <div class="hashes">
      <span class="label">Hashes SHA-256 dos XMLs:</span>
      <ul>${hashesHtml}</ul>
    </div>
    ` : ''}
  </div>

  ${variaveis.signatarios.length > 0 ? `
  <div class="signatarios">
    <h3>Signatarios</h3>
    <div style="display: flex; justify-content: center; flex-wrap: wrap;">
      ${variaveis.signatarios.map(s => `
        <div class="signatario">
          <div style="border-top: 1px solid #333; width: 200px; margin-bottom: 0.5em;"></div>
          <div class="nome">${s.nome}</div>
          <div class="cargo">${s.cargo}</div>
        </div>
      `).join('')}
    </div>
  </div>
  ` : ''}

  <div style="text-align: center; margin-top: 2em; font-size: 0.8em; color: #999;">
    <p>${variaveis.ies_nome} - CNPJ: ${variaveis.ies_cnpj}</p>
    <p>${variaveis.ies_municipio}/${variaveis.ies_uf}</p>
    <p>Versao XSD: ${variaveis.versao_xsd} | Ambiente: ${variaveis.ambiente}</p>
  </div>
</body>
</html>`
}
