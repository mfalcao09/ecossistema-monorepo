#!/usr/bin/env node
/**
 * ============================================================================
 * EXTRAIR CÓDIGOS DE VALIDAÇÃO — Lê os XMLs legados e extrai CodigoValidacao
 * ============================================================================
 *
 * Os códigos de validação dos diplomas legados começam com "1606" (código MEC da FIC)
 * e seguem o formato: 1606.XXX.XXXXXXXXXXXX
 *
 * Este script:
 *   1. Lê AMBOS os XMLs de cada KIT (_diploma.xml e _historico.xml)
 *   2. Procura o código de validação em múltiplos campos possíveis
 *   3. Também extrai xml_url se presente no XML
 *   4. Faz UPDATE no banco vinculando: codigo_validacao, xml_url, pdf_url
 *
 * MODO DIAGNÓSTICO:
 *   node scripts/extrair-codigos-validacao.cjs --diagnostico
 *
 * MODO EXECUÇÃO:
 *   node scripts/extrair-codigos-validacao.cjs --executar
 *
 * ============================================================================
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

function carregarEnv() {
  const envPath = path.resolve(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("❌ Arquivo .env.local não encontrado na raiz do projeto!");
    process.exit(1);
  }
  const linhas = fs.readFileSync(envPath, "utf8").split("\n");
  const env = {};
  for (const linha of linhas) {
    const match = linha.match(/^([^#=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
  }
  return env;
}

const env = carregarEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrados!");
  process.exit(1);
}

const KITS_DIR = path.resolve(__dirname, "..", "reference", "xmls-legado", "KITs");
const SUPABASE_STORAGE_BASE = SUPABASE_URL + "/storage/v1/object/public/documentos-digitais/";

const args = process.argv.slice(2);
const MODO_EXECUTAR = args.includes("--executar");

if (!MODO_EXECUTAR) {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  🔍 MODO DIAGNÓSTICO — Apenas analisa, NÃO altera nada     ║");
  console.log("║  Para atualizar o banco, use: --executar                    ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
} else {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  ⚡ MODO EXECUÇÃO — Vai atualizar diplomas no banco!        ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTE HTTP PARA SUPABASE
// ─────────────────────────────────────────────────────────────────────────────

function supabaseRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, SUPABASE_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": method === "PATCH" ? "return=minimal" : "return=representation",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data || "[]")); }
          catch { resolve(data); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRAÇÃO DO CÓDIGO DE VALIDAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extrai conteúdo de uma tag XML (sem namespace ou com namespace)
 */
function extrairTag(xml, tagName) {
  // Tentar várias formas: sem namespace, com namespace comum
  const tentativas = [
    tagName,
    `ns0:${tagName}`,
    `ns1:${tagName}`,
    `ns2:${tagName}`,
    `dd:${tagName}`,
  ];

  for (const tag of tentativas) {
    const open = `<${tag}>`;
    const close = `</${tag}>`;
    const si = xml.indexOf(open);
    if (si !== -1) {
      const ei = xml.indexOf(close, si);
      if (ei !== -1) {
        return xml.substring(si + open.length, ei).trim();
      }
    }
  }
  return null;
}

/**
 * Procura o código de validação no XML.
 * Tenta múltiplos nomes de tag que podem conter o código.
 * Também busca pelo padrão regex "1606.XXX.XXXXXXXXXXXX"
 */
function extrairCodigoValidacao(xml) {
  // 1. Tentar tags conhecidas
  const tagsProvaveis = [
    "CodigoValidacao",
    "codigoValidacao",
    "Codigo",
    "codigo",
    "CodigoVerificacao",
    "codigoVerificacao",
    "InformacoesAdicionais",  // às vezes vem aqui
    "CodigoDiploma",
    "codigoDiploma",
    "codigoDeValidacao",
    "CodigoDeValidacao",
  ];

  for (const tag of tagsProvaveis) {
    const valor = extrairTag(xml, tag);
    if (valor && valor.includes("1606")) {
      return valor;
    }
  }

  // 2. Busca genérica por padrão 1606.XXX.XXXXXXXXXXXX no XML inteiro
  // Formato: 1606 seguido de ponto, dígitos, ponto, hex
  const regex = /1606\.\d{1,5}\.[a-f0-9]{8,16}/gi;
  const match = xml.match(regex);
  if (match && match.length > 0) {
    return match[0];
  }

  // 3. Busca mais ampla: 1606 seguido de qualquer separador e caracteres alfanuméricos
  const regexAmpla = /1606[.\-\/]\d{1,5}[.\-\/][a-f0-9]{6,}/gi;
  const matchAmpla = xml.match(regexAmpla);
  if (matchAmpla && matchAmpla.length > 0) {
    return matchAmpla[0];
  }

  return null;
}

/**
 * Procura a URL de verificação no XML
 */
function extrairUrlVerificacao(xml) {
  const tagsUrl = [
    "URLVerificacao",
    "urlVerificacao",
    "url",
    "URL",
    "EnderecoValidacao",
    "enderecoValidacao",
    "InformacoesAdicionais",
  ];

  for (const tag of tagsUrl) {
    const valor = extrairTag(xml, tag);
    if (valor && (valor.startsWith("http") || valor.includes("diploma"))) {
      return valor;
    }
  }

  // Busca genérica por URL com "diploma" ou "validar" ou "verificar"
  const regexUrl = /https?:\/\/[^\s<>"]+(?:diploma|validar|verificar)[^\s<>"]*/gi;
  const match = xml.match(regexUrl);
  if (match && match.length > 0) {
    return match[0];
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCESSAMENTO PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("📂 Lendo KITs de:", KITS_DIR);

  if (!fs.existsSync(KITS_DIR)) {
    console.error("❌ Pasta KITs não encontrada:", KITS_DIR);
    process.exit(1);
  }

  const pastas = fs.readdirSync(KITS_DIR).filter((d) => {
    const full = path.join(KITS_DIR, d);
    return fs.statSync(full).isDirectory() && /^\d{11}$/.test(d);
  });

  console.log(`📋 Encontradas ${pastas.length} pastas de KITs\n`);

  // Buscar diplomas legados do banco
  console.log("🔍 Buscando diplomas legados do banco...");
  const todos = [];
  let offset = 0;
  while (true) {
    const endpoint = `/rest/v1/diplomas?is_legado=eq.true&select=id,diplomado_id,diplomados(cpf,nome),legado_rvdd_original_path,legado_xml_documentos_path,legado_xml_dados_path,codigo_validacao&offset=${offset}&limit=1000`;
    const lote = await supabaseRequest("GET", endpoint);
    if (!lote || lote.length === 0) break;
    todos.push(...lote);
    if (lote.length < 1000) break;
    offset += 1000;
  }

  // Mapear CPF → diploma
  const cpfDiplomaMap = {};
  for (const d of todos) {
    const cpf = d.diplomados?.cpf;
    if (cpf) cpfDiplomaMap[cpf] = d;
  }
  console.log(`   → ${Object.keys(cpfDiplomaMap).length} diplomas legados encontrados\n`);

  // Estatísticas
  const stats = {
    total: pastas.length,
    codigoEncontrado: 0,
    codigoNaoEncontrado: 0,
    urlEncontrada: 0,
    jaTemCodigo: 0,
    atualizados: 0,
    erros: 0,
    diplomaNaoBanco: 0,
  };

  const resultados = [];
  const semCodigo = [];

  // Para diagnóstico: guardar em qual tag/formato o código foi encontrado
  const debugPrimeiro = true;
  let debugFeito = false;

  for (const cpf of pastas) {
    const diplomaPath = path.join(KITS_DIR, cpf, `${cpf}_diploma.xml`);
    const historicoPath = path.join(KITS_DIR, cpf, `${cpf}_historico.xml`);

    const diploma = cpfDiplomaMap[cpf];
    if (!diploma) {
      stats.diplomaNaoBanco++;
      continue;
    }

    // Se já tem codigo_validacao no banco, pula
    if (diploma.codigo_validacao) {
      stats.jaTemCodigo++;
      continue;
    }

    // Ler ambos XMLs e procurar código de validação
    let codigoValidacao = null;
    let urlVerificacao = null;
    let fonteXml = null;

    for (const [xmlPath, label] of [[diplomaPath, "diploma"], [historicoPath, "historico"]]) {
      if (!fs.existsSync(xmlPath)) continue;

      const xml = fs.readFileSync(xmlPath, "utf8");

      // Debug: no primeiro XML, mostrar contexto ao redor de "1606"
      if (!debugFeito && xml.includes("1606")) {
        const idx1606 = xml.indexOf("1606");
        const contexto = xml.substring(Math.max(0, idx1606 - 200), Math.min(xml.length, idx1606 + 200));
        console.log("🔬 DEBUG — Contexto ao redor de '1606' no primeiro XML encontrado:");
        console.log(`   Arquivo: ${xmlPath}`);
        console.log(`   Posição: ${idx1606}`);
        console.log(`   Contexto:\n   ${contexto}\n`);
        debugFeito = true;
      }

      if (!codigoValidacao) {
        codigoValidacao = extrairCodigoValidacao(xml);
        if (codigoValidacao) fonteXml = label;
      }

      if (!urlVerificacao) {
        urlVerificacao = extrairUrlVerificacao(xml);
      }
    }

    if (codigoValidacao) {
      stats.codigoEncontrado++;
    } else {
      stats.codigoNaoEncontrado++;
      semCodigo.push(cpf);
    }

    if (urlVerificacao) {
      stats.urlEncontrada++;
    }

    // Montar os campos de URL para XMLs e RVDD no storage
    const xmlDocUrl = diploma.legado_xml_documentos_path
      ? SUPABASE_STORAGE_BASE + diploma.legado_xml_documentos_path
      : null;
    const xmlDadosUrl = diploma.legado_xml_dados_path
      ? SUPABASE_STORAGE_BASE + diploma.legado_xml_dados_path
      : null;
    const pdfUrl = diploma.legado_rvdd_original_path
      ? SUPABASE_STORAGE_BASE + diploma.legado_rvdd_original_path
      : null;

    const resultado = {
      cpf,
      nome: diploma.diplomados?.nome,
      diplomaId: diploma.id,
      codigoValidacao,
      fonteXml,
      urlVerificacao,
      xmlDocUrl,
      xmlDadosUrl,
      pdfUrl,
    };
    resultados.push(resultado);

    // Fazer UPDATE no banco
    if (MODO_EXECUTAR && codigoValidacao) {
      try {
        const updateBody = {
          codigo_validacao: codigoValidacao,
          updated_at: new Date().toISOString(),
        };

        // Vincular xml_url (usar o XML de documentação como principal)
        if (xmlDocUrl && !diploma.xml_url) {
          updateBody.xml_url = xmlDocUrl;
        }

        // Vincular url_verificacao se encontrada
        if (urlVerificacao) {
          updateBody.url_verificacao = urlVerificacao;
        }

        await supabaseRequest(
          "PATCH",
          `/rest/v1/diplomas?id=eq.${diploma.id}`,
          updateBody
        );
        stats.atualizados++;
      } catch (err) {
        stats.erros++;
        console.error(`   ❌ Erro ao atualizar ${cpf}: ${err.message}`);
      }
    }

    // Progresso
    if ((stats.codigoEncontrado + stats.codigoNaoEncontrado) % 20 === 0) {
      console.log(`   ⏳ Processados: ${stats.codigoEncontrado + stats.codigoNaoEncontrado}/${pastas.length}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RELATÓRIO FINAL
  // ─────────────────────────────────────────────────────────────────────────

  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║                    📊 RELATÓRIO FINAL                       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  console.log(`📋 Total de pastas KIT:            ${stats.total}`);
  console.log(`✅ Códigos encontrados:             ${stats.codigoEncontrado}`);
  console.log(`❌ Códigos NÃO encontrados:         ${stats.codigoNaoEncontrado}`);
  console.log(`🌐 URLs de verificação encontradas: ${stats.urlEncontrada}`);
  console.log(`⏭️  Já tinham código (pulados):      ${stats.jaTemCodigo}`);
  console.log(`🔍 Diploma não encontrado no DB:    ${stats.diplomaNaoBanco}`);
  console.log();

  if (MODO_EXECUTAR) {
    console.log(`✅ Diplomas ATUALIZADOS:            ${stats.atualizados}`);
    console.log(`❌ Erros ao atualizar:              ${stats.erros}`);
  } else {
    console.log(`📌 Diplomas A ATUALIZAR:            ${stats.codigoEncontrado}`);
  }

  // Mostrar exemplos dos códigos encontrados
  const comCodigo = resultados.filter((r) => r.codigoValidacao);
  if (comCodigo.length > 0) {
    console.log("\n────────────────────────────────────────────────────────────────");
    console.log("📝 EXEMPLOS DE CÓDIGOS ENCONTRADOS:");
    console.log("────────────────────────────────────────────────────────────────\n");

    for (const r of comCodigo.slice(0, 10)) {
      console.log(`   ${r.cpf} — ${r.nome}`);
      console.log(`     Código: ${r.codigoValidacao}`);
      console.log(`     Fonte: ${r.fonteXml}.xml`);
      if (r.urlVerificacao) console.log(`     URL: ${r.urlVerificacao}`);
      console.log();
    }

    if (comCodigo.length > 10) {
      console.log(`   ... e mais ${comCodigo.length - 10} diplomas com código\n`);
    }
  }

  // Mostrar quem NÃO tem código
  if (semCodigo.length > 0) {
    console.log(`\n⚠️  CPFs SEM CÓDIGO DE VALIDAÇÃO (${semCodigo.length}):`);
    for (const cpf of semCodigo) {
      console.log(`   → ${cpf}`);
    }
  }

  // Agrupar por formato de código para análise
  const formatos = {};
  for (const r of comCodigo) {
    // Extrair padrão: ex "1606.XXX.12chars"
    const partes = r.codigoValidacao.split(".");
    const formato = partes.length >= 3
      ? `1606.${partes[1].length}dig.${partes[2].length}hex`
      : `formato_outro: ${r.codigoValidacao.substring(0, 20)}`;
    if (!formatos[formato]) formatos[formato] = 0;
    formatos[formato]++;
  }

  if (Object.keys(formatos).length > 0) {
    console.log("\n📊 FORMATOS DE CÓDIGO ENCONTRADOS:");
    for (const [formato, count] of Object.entries(formatos)) {
      console.log(`   ${formato}: ${count} diplomas`);
    }
  }

  // Salvar relatório
  const relatorioPath = path.resolve(__dirname, "relatorio-codigos-validacao.json");
  fs.writeFileSync(relatorioPath, JSON.stringify({ stats, resultados, semCodigo }, null, 2));
  console.log(`\n💾 Relatório salvo em: ${relatorioPath}`);

  if (!MODO_EXECUTAR) {
    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║  📌 Este foi apenas o DIAGNÓSTICO.                         ║");
    console.log("║  Para atualizar o banco, execute com: --executar            ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");
  } else {
    console.log("\n✅ Execução concluída!");
  }
}

main().catch((err) => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});
