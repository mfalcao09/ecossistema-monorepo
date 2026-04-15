#!/usr/bin/env node
/**
 * ============================================================================
 * VINCULAR ASSINATURAS — Extrai assinaturas dos XMLs e vincula no Supabase
 * ============================================================================
 *
 * CONTEXTO:
 *   Os 157 diplomas legados já estão importados no banco (diplomados + diplomas).
 *   O SEVAL (IES Emissora, ordem 1) já foi inserido para todos os 157.
 *   PORÉM, os signatários PF (Nilton, Camila, Turine) e a UFMS (Registradora)
 *   NÃO foram inseridos porque variam por diploma.
 *
 * O QUE ESTE SCRIPT FAZ:
 *   1. Lê cada {CPF}_diploma.xml de reference/xmls-legado/KITs/{CPF}/
 *   2. Extrai os blocos <ds:Signature> usando indexOf (não regex — funciona em XMLs 6MB+)
 *   3. De cada assinatura, extrai: CN (nome), CPF/CNPJ, SigningTime
 *   4. Mapeia para os assinantes cadastrados no banco
 *   5. Aplica regras de ordenação: PF emissora=1, SEVAL=2, PFs registradora=3,4..., UFMS=última
 *   6. Insere em fluxo_assinaturas (pula SEVAL que já existe)
 *
 * MODO DIAGNÓSTICO (padrão na primeira execução):
 *   node scripts/vincular-assinaturas.cjs --diagnostico
 *   → Apenas analisa os XMLs e mostra relatório, NÃO insere nada
 *
 * MODO EXECUÇÃO:
 *   node scripts/vincular-assinaturas.cjs --executar
 *   → Insere as assinaturas no banco de dados
 *
 * COMO USAR:
 *   1. cd diploma-digital
 *   2. node scripts/vincular-assinaturas.cjs --diagnostico    (primeiro!)
 *   3. Revise o relatório
 *   4. node scripts/vincular-assinaturas.cjs --executar       (quando estiver ok)
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

// Modo de operação
const args = process.argv.slice(2);
const MODO_EXECUTAR = args.includes("--executar");
const MODO_DIAGNOSTICO = !MODO_EXECUTAR; // padrão

if (MODO_DIAGNOSTICO) {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  🔍 MODO DIAGNÓSTICO — Apenas analisa, NÃO insere nada     ║");
  console.log("║  Para inserir, use: --executar                              ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
} else {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  ⚡ MODO EXECUÇÃO — Vai inserir assinaturas no banco!       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSINANTES CADASTRADOS (do banco de dados)
// ─────────────────────────────────────────────────────────────────────────────

const ASSINANTES = {
  // PJ — IES Emissora (SEVAL)
  "02175672000163": {
    id: "c0bf8ed1-4b32-4aa9-8ea7-fab4cc276e74",
    nome: "SOCIEDADE EDUCACIONAL VALE DO APORE LTDA",
    tipo: "emissora",
  },
  // PF — Signatários pela EMISSORA (assinam ANTES da SEVAL)
  "78498872120": {
    id: "91e1a758-3ff3-4110-a9cc-984b374e0287",
    nome: "ALECIANA VASCONCELOS ORTEGA",
    tipo: "signatario_emissora",
  },
  "79190561872": {
    id: "cd2db66b-5bc5-47ed-84e1-900ca93f5e1e",
    nome: "NILZA ALVES CANGUCU",
    tipo: "signatario_emissora",
  },
  // PF — Signatários pela REGISTRADORA
  "36541842191": {
    id: "01292905-6405-4167-915d-3de0eb8b99f6",
    nome: "NILTON SANTOS MATTOS",
    tipo: "signatario_pf",
  },
  "27245773882": {
    id: "d38e1d99-000b-45b6-b451-145208bd5790",
    nome: "CAMILA CELESTE BRANDAO FERREIRA ITAVO",
    tipo: "signatario_pf",
  },
  "07032797857": {
    id: "58b02066-4146-4c6e-8c8a-5f79f879f94e",
    nome: "MARCELO AUGUSTO SANTOS TURINE",
    tipo: "signatario_pf",
  },
  // PJ — IES Registradora (UFMS)
  "15461510000133": {
    id: "a285fa85-7657-4b61-926b-a7d1b9ea1942",
    nome: "FUNDACAO UNIVERSIDADE FEDERAL DE MATO GROSSO DO SUL",
    tipo: "registradora",
  },
};

const CNPJ_SEVAL = "02175672000163";
const CNPJ_UFMS = "15461510000133";

// ─────────────────────────────────────────────────────────────────────────────
// EXTRATOR DE ASSINATURAS — Usa indexOf em vez de regex (funciona em XMLs 6MB+)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Encontra a primeira ocorrência de uma tag no XML, tentando COM e SEM namespace.
 * Ex: procura "<ds:Signature" primeiro, depois "<Signature" se não achar.
 */
function encontrarTag(xml, tagName, pos = 0) {
  // Tentar com namespace ds:
  let idx = xml.indexOf(`<ds:${tagName}`, pos);
  if (idx !== -1) return { idx, prefix: "ds:" };

  // Tentar sem namespace
  idx = xml.indexOf(`<${tagName}`, pos);
  if (idx !== -1) return { idx, prefix: "" };

  return { idx: -1, prefix: "" };
}

/**
 * Extrai blocos <Signature>...</Signature> usando indexOf.
 * Funciona com e sem namespace (ds:Signature ou Signature).
 * Robusto para XMLs de 6MB+ em linha única.
 */
function extrairBlocosSignature(xml) {
  const blocos = [];
  let pos = 0;

  // Detectar o prefixo usado no primeiro Signature
  const primeira = encontrarTag(xml, "Signature", 0);
  if (primeira.idx === -1) return blocos;

  const prefix = primeira.prefix;
  const TAG_OPEN = `<${prefix}Signature`;
  const TAG_CLOSE = `</${prefix}Signature>`;

  while (true) {
    const inicio = xml.indexOf(TAG_OPEN, pos);
    if (inicio === -1) break;

    const fim = xml.indexOf(TAG_CLOSE, inicio);
    if (fim === -1) break;

    const fimCompleto = fim + TAG_CLOSE.length;
    blocos.push(xml.substring(inicio, fimCompleto));
    pos = fimCompleto;
  }

  return blocos;
}

/**
 * Extrai conteúdo de uma tag do bloco, tentando COM e SEM namespace.
 * Retorna o texto entre <tag> e </tag>, ou null.
 */
function extrairConteudoTag(bloco, tagName, namespaces) {
  // namespaces = ["ds:", "xades:", ""] — tenta cada um
  for (const ns of namespaces) {
    const open = `<${ns}${tagName}>`;
    const close = `</${ns}${tagName}>`;
    const si = bloco.indexOf(open);
    if (si !== -1) {
      const ei = bloco.indexOf(close, si);
      if (ei !== -1) {
        return bloco.substring(si + open.length, ei).trim();
      }
    }
  }
  return null;
}

/**
 * De um bloco <Signature>, extrai CN e SigningTime.
 * Funciona com qualquer combinação de namespace (ds:, xades:, ou sem prefixo).
 */
function parsarBlocoSignature(bloco) {
  // Extrair X509SubjectName — tenta ds:, sem prefixo
  const subjectName = extrairConteudoTag(bloco, "X509SubjectName", ["ds:", ""]);
  if (!subjectName) return null;

  // Extrair CN do SubjectName
  const cnMatch = subjectName.match(/CN=([^,]+)/);
  if (!cnMatch) return null;

  const cnCompleto = cnMatch[1].trim();
  const partes = cnCompleto.split(":");
  const nome = partes[0]?.trim() ?? cnCompleto;
  const cpfCnpj = (partes[1]?.trim() ?? "").replace(/\D/g, "");
  const tipoPessoa = cpfCnpj.length === 14 ? "pj" : "pf";

  // Extrair SigningTime — tenta xades:, sem prefixo
  const signingTime = extrairConteudoTag(bloco, "SigningTime", ["xades:", ""]);

  return { cn: cnCompleto, nome, cpfCnpj, tipoPessoa, signingTime };
}

/**
 * Extrai TODAS as assinaturas de um XML de diploma.
 * Retorna array ordenado conforme aparecem no XML.
 */
function extrairAssinaturas(xml) {
  const blocos = extrairBlocosSignature(xml);
  const resultado = [];

  for (let i = 0; i < blocos.length; i++) {
    const parsed = parsarBlocoSignature(blocos[i]);
    if (parsed) {
      resultado.push({ ...parsed, ordemNoXml: i + 1 });
    }
  }

  return resultado;
}

/**
 * Aplica regras de ordenação:
 *   1. PF pela emissora (Nilza ou Aleciana) → ordem 1
 *   2. SEVAL (PJ emissora) → ordem 2
 *   3. PFs pela registradora (Nilton, Camila, Turine) → ordens 3, 4...
 *   4. UFMS (PJ registradora) → última ordem
 *
 * Retorna array com { assinante_id, ordem, status, tipo_certificado, data_assinatura, nome }
 */
function ordenarAssinaturas(assinaturasExtraidas) {
  const signatariosEmissora = []; // Nilza, Aleciana (PF pela SEVAL)
  const emissoras = [];           // SEVAL (PJ)
  const signatariosPf = [];       // Nilton, Camila, Turine (PF pela UFMS)
  const registradoras = [];       // UFMS (PJ)
  const desconhecidas = [];

  for (const sig of assinaturasExtraidas) {
    const assinante = ASSINANTES[sig.cpfCnpj];
    if (!assinante) {
      desconhecidas.push(sig);
      continue;
    }

    const registro = {
      assinante_id: assinante.id,
      nome: assinante.nome,
      cpfCnpj: sig.cpfCnpj,
      tipo: assinante.tipo,
      signingTime: sig.signingTime,
      ordemNoXml: sig.ordemNoXml,
    };

    if (assinante.tipo === "signatario_emissora") signatariosEmissora.push(registro);
    else if (assinante.tipo === "emissora") emissoras.push(registro);
    else if (assinante.tipo === "registradora") registradoras.push(registro);
    else signatariosPf.push(registro);
  }

  // Montar ordenação final
  const resultado = [];
  let ordem = 1;

  // 1. PF pela emissora primeiro (Nilza ou Aleciana)
  for (const se of signatariosEmissora) {
    resultado.push({ ...se, ordem: ordem++ });
  }

  // 2. Emissora PJ (SEVAL)
  for (const e of emissoras) {
    resultado.push({ ...e, ordem: ordem++ });
  }

  // 3. Signatários PF pela registradora (Nilton, Camila, Turine)
  for (const s of signatariosPf) {
    resultado.push({ ...s, ordem: ordem++ });
  }

  // 4. Registradora PJ por último (UFMS)
  for (const r of registradoras) {
    resultado.push({ ...r, ordem: ordem++ });
  }

  return { ordenados: resultado, desconhecidas };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTE HTTP PARA SUPABASE (sem dependências)
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
        "Prefer": method === "POST" ? "return=representation" : "return=minimal",
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
// BUSCAR DIPLOMAS DO BANCO (para mapear CPF → diploma_id)
// ─────────────────────────────────────────────────────────────────────────────

async function buscarDiplomasLegados() {
  // Busca paginada — Supabase limita a 1000 por request
  const todos = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const endpoint = `/rest/v1/diplomas?is_legado=eq.true&select=id,diplomado_id,diplomados(cpf)&offset=${offset}&limit=${limit}`;
    const lote = await supabaseRequest("GET", endpoint);
    if (!lote || lote.length === 0) break;
    todos.push(...lote);
    if (lote.length < limit) break;
    offset += limit;
  }

  // Mapear CPF → diploma_id
  const mapa = {};
  for (const d of todos) {
    const cpf = d.diplomados?.cpf;
    if (cpf) mapa[cpf] = d.id;
  }

  return mapa;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSCAR ASSINATURAS JÁ EXISTENTES (para não duplicar)
// ─────────────────────────────────────────────────────────────────────────────

async function buscarAssinaturasExistentes() {
  const todos = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const endpoint = `/rest/v1/fluxo_assinaturas?select=diploma_id,assinante_id,ordem&offset=${offset}&limit=${limit}`;
    const lote = await supabaseRequest("GET", endpoint);
    if (!lote || lote.length === 0) break;
    todos.push(...lote);
    if (lote.length < limit) break;
    offset += limit;
  }

  // Set de chaves para checar duplicatas: "diploma_id|assinante_id"
  const existentes = new Set();
  for (const fa of todos) {
    existentes.add(`${fa.diploma_id}|${fa.assinante_id}`);
  }
  return existentes;
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

  // Listar todas as pastas CPF
  const pastas = fs.readdirSync(KITS_DIR).filter((d) => {
    const full = path.join(KITS_DIR, d);
    return fs.statSync(full).isDirectory() && /^\d{11}$/.test(d);
  });

  console.log(`📋 Encontradas ${pastas.length} pastas de KITs\n`);

  // Buscar mapeamento CPF → diploma_id do banco
  console.log("🔍 Buscando diplomas legados do banco...");
  const cpfDiplomaMap = await buscarDiplomasLegados();
  console.log(`   → ${Object.keys(cpfDiplomaMap).length} diplomas legados encontrados\n`);

  // Buscar assinaturas já existentes
  console.log("🔍 Buscando assinaturas já existentes...");
  const existentes = await buscarAssinaturasExistentes();
  console.log(`   → ${existentes.size} registros já existem no fluxo_assinaturas\n`);

  // Estatísticas
  const stats = {
    total: pastas.length,
    processados: 0,
    xmlNaoEncontrado: 0,
    diplomaNaoBanco: 0,
    semAssinaturas: 0,
    comAssinaturas: 0,
    inseridos: 0,
    jaExistiam: 0,
    erros: 0,
    desconhecidos: [],
  };

  // Detalhamento por diploma
  const detalhes = [];

  for (const cpf of pastas) {
    const diplomaPath = path.join(KITS_DIR, cpf, `${cpf}_diploma.xml`);
    const historicoPath = path.join(KITS_DIR, cpf, `${cpf}_historico.xml`);

    // Verificar se pelo menos um XML existe
    const temDiploma = fs.existsSync(diplomaPath);
    const temHistorico = fs.existsSync(historicoPath);

    if (!temDiploma && !temHistorico) {
      stats.xmlNaoEncontrado++;
      detalhes.push({ cpf, status: "XML_NAO_ENCONTRADO" });
      continue;
    }

    // Verificar se diploma está no banco
    const diplomaId = cpfDiplomaMap[cpf];
    if (!diplomaId) {
      stats.diplomaNaoBanco++;
      detalhes.push({ cpf, status: "DIPLOMA_NAO_ENCONTRADO_NO_BANCO" });
      continue;
    }

    // Ler AMBOS os XMLs e extrair assinaturas de cada um
    const todasAssinaturas = [];

    if (temDiploma) {
      const xmlDiploma = fs.readFileSync(diplomaPath, "utf8");
      todasAssinaturas.push(...extrairAssinaturas(xmlDiploma));
    }
    if (temHistorico) {
      const xmlHistorico = fs.readFileSync(historicoPath, "utf8");
      todasAssinaturas.push(...extrairAssinaturas(xmlHistorico));
    }

    // Deduplicar por CPF/CNPJ (mesmo assinante pode aparecer em ambos XMLs)
    // Mantém a primeira ocorrência (com signingTime mais antigo)
    const vistos = new Map();
    for (const sig of todasAssinaturas) {
      if (!vistos.has(sig.cpfCnpj)) {
        vistos.set(sig.cpfCnpj, sig);
      }
    }
    const assinaturas = [...vistos.values()];

    if (assinaturas.length === 0) {
      stats.semAssinaturas++;
      detalhes.push({ cpf, diplomaId, status: "SEM_ASSINATURAS", xmlSize: 0 });
      continue;
    }

    stats.comAssinaturas++;

    // Ordenar conforme regras
    const { ordenados, desconhecidas } = ordenarAssinaturas(assinaturas);

    if (desconhecidas.length > 0) {
      for (const d of desconhecidas) {
        const key = `${d.cpfCnpj}|${d.nome}`;
        if (!stats.desconhecidos.find((x) => x === key)) {
          stats.desconhecidos.push(key);
        }
      }
    }

    const detalhe = {
      cpf,
      diplomaId,
      status: "OK",
      totalAssinaturas: assinaturas.length,
      assinantes: ordenados.map((o) => `${o.ordem}. ${o.nome} (${o.cpfCnpj})`),
      desconhecidas: desconhecidas.map((d) => `${d.nome} (${d.cpfCnpj})`),
      inseridos: 0,
      jaExistiam: 0,
    };

    // Inserir no banco (se modo execução)
    for (const sig of ordenados) {
      const chave = `${diplomaId}|${sig.assinante_id}`;

      if (existentes.has(chave)) {
        detalhe.jaExistiam++;
        stats.jaExistiam++;
        continue;
      }

      if (MODO_EXECUTAR) {
        try {
          const body = {
            diploma_id: diplomaId,
            assinante_id: sig.assinante_id,
            ordem: sig.ordem,
            status: "assinado",
            tipo_certificado: sig.tipo === "emissora" || sig.tipo === "registradora"
              ? "ICP-Brasil e-CNPJ A3"
              : "ICP-Brasil e-CPF A3",
          };

          // Adicionar data_assinatura se disponível
          if (sig.signingTime) {
            body.data_assinatura = sig.signingTime;
          }

          await supabaseRequest("POST", "/rest/v1/fluxo_assinaturas", body);
          existentes.add(chave); // Marcar como inserido
          detalhe.inseridos++;
          stats.inseridos++;
        } catch (err) {
          stats.erros++;
          console.error(`   ❌ Erro ao inserir ${sig.nome} para ${cpf}: ${err.message}`);
        }
      } else {
        detalhe.inseridos++; // No diagnóstico, conta como "seria inserido"
        stats.inseridos++;
      }
    }

    detalhes.push(detalhe);
    stats.processados++;

    // Progresso a cada 20
    if (stats.processados % 20 === 0) {
      console.log(`   ⏳ Processados: ${stats.processados}/${pastas.length}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RELATÓRIO FINAL
  // ─────────────────────────────────────────────────────────────────────────

  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║                    📊 RELATÓRIO FINAL                       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  console.log(`📋 Total de pastas KIT:          ${stats.total}`);
  console.log(`✅ Processados com sucesso:       ${stats.processados}`);
  console.log(`📝 Com assinaturas encontradas:   ${stats.comAssinaturas}`);
  console.log(`⚠️  Sem assinaturas no XML:        ${stats.semAssinaturas}`);
  console.log(`📄 XML não encontrado:            ${stats.xmlNaoEncontrado}`);
  console.log(`🔍 Diploma não encontrado no DB:  ${stats.diplomaNaoBanco}`);
  console.log();

  if (MODO_EXECUTAR) {
    console.log(`✅ Assinaturas INSERIDAS:         ${stats.inseridos}`);
  } else {
    console.log(`📌 Assinaturas A INSERIR:         ${stats.inseridos}`);
  }
  console.log(`⏭️  Já existiam (pulados):         ${stats.jaExistiam}`);
  console.log(`❌ Erros ao inserir:              ${stats.erros}`);

  if (stats.desconhecidos.length > 0) {
    console.log(`\n⚠️  Assinantes NÃO CADASTRADOS no banco (${stats.desconhecidos.length}):`);
    for (const d of stats.desconhecidos) {
      console.log(`   → ${d}`);
    }
    console.log("   ⚡ Estes precisam ser cadastrados na tabela 'assinantes' antes de vincular!");
  }

  // Detalhamento — quem assinou cada diploma
  console.log("\n────────────────────────────────────────────────────────────────");
  console.log("📝 DETALHAMENTO POR DIPLOMA:");
  console.log("────────────────────────────────────────────────────────────────\n");

  // Agrupar por combinação de assinantes para ver o padrão
  const padroes = {};
  for (const d of detalhes) {
    if (d.status !== "OK") continue;
    const key = d.assinantes.join(" | ");
    if (!padroes[key]) padroes[key] = [];
    padroes[key].push(d.cpf);
  }

  console.log("📊 PADRÕES DE ASSINATURA ENCONTRADOS:\n");
  let padNum = 0;
  for (const [padrao, cpfs] of Object.entries(padroes)) {
    padNum++;
    console.log(`  Padrão ${padNum} (${cpfs.length} diplomas):`);
    console.log(`    Assinantes: ${padrao}`);
    console.log(`    Exemplo CPFs: ${cpfs.slice(0, 3).join(", ")}${cpfs.length > 3 ? "..." : ""}`);
    console.log();
  }

  // Mostrar diplomas sem assinaturas
  const semAss = detalhes.filter((d) => d.status === "SEM_ASSINATURAS");
  if (semAss.length > 0) {
    console.log(`\n⚠️  DIPLOMAS SEM ASSINATURAS (${semAss.length}):`);
    for (const d of semAss) {
      console.log(`   → CPF ${d.cpf} (XML: ${(d.xmlSize / 1024).toFixed(0)} KB)`);
    }
  }

  // Salvar relatório JSON
  const relatorioPath = path.resolve(__dirname, "relatorio-assinaturas.json");
  fs.writeFileSync(relatorioPath, JSON.stringify({ stats, padroes, detalhes }, null, 2));
  console.log(`\n💾 Relatório salvo em: ${relatorioPath}`);

  if (MODO_DIAGNOSTICO) {
    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║  📌 Este foi apenas o DIAGNÓSTICO.                         ║");
    console.log("║  Para inserir no banco, execute com: --executar             ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");
  } else {
    console.log("\n✅ Execução concluída!");
  }
}

main().catch((err) => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});
