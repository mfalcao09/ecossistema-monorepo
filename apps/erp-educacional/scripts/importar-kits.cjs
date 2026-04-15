#!/usr/bin/env node
/**
 * ============================================================================
 * IMPORTAÇÃO DIRETA DOS 157 KITs LEGADOS → Supabase
 * ============================================================================
 *
 * Este script lê os KITs de reference/xmls-legado/KITs/ e importa direto no
 * banco de dados Supabase, sem precisar da ferramenta web.
 *
 * COMO USAR:
 *   1. Abra o terminal na raiz do projeto diploma-digital
 *   2. Execute: node scripts/importar-kits.cjs
 *   3. Aguarde — leva alguns minutos para processar 157 KITs
 *   4. No final, será exibido um relatório completo
 *
 * PRÉ-REQUISITOS:
 *   - Node.js 18+
 *   - Arquivo .env.local na raiz com SUPABASE_SERVICE_ROLE_KEY
 *   - Pasta reference/xmls-legado/KITs/ com os KITs organizados por CPF
 *
 * O QUE O SCRIPT FAZ:
 *   - Lê cada pasta CPF dentro de KITs/
 *   - Parseia o {CPF}_diploma.xml para extrair dados do diplomado
 *   - Insere registro na tabela 'diplomados' (ou reutiliza se já existe por CPF)
 *   - Insere registro na tabela 'diplomas' com is_legado=true, status='registrado'
 *   - Faz upload dos 3 arquivos para Supabase Storage (bucket: documentos-digitais)
 *   - Cria fluxo_assinaturas com os assinantes já cadastrados
 *   - Gera relatório final em scripts/relatorio-importacao.json
 *
 * ============================================================================
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO — Lê do .env.local
// ─────────────────────────────────────────────────────────────────────────────

// Carrega .env.local manualmente (sem dependências extras)
function carregarEnv() {
  const envPath = path.resolve(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("❌ Arquivo .env.local não encontrado na raiz do projeto!");
    console.error("   Esperado em:", envPath);
    process.exit(1);
  }
  const linhas = fs.readFileSync(envPath, "utf8").split("\n");
  const env = {};
  for (const linha of linhas) {
    const match = linha.match(/^([^#=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim();
    }
  }
  return env;
}

const env = carregarEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY; // Service role para bypass RLS

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrados no .env.local!");
  process.exit(1);
}

const KITS_DIR = path.resolve(__dirname, "..", "reference", "xmls-legado", "KITs");
const BUCKET = "documentos-digitais";
const STORAGE_PREFIX = "legado"; // Pasta no bucket: legado/{CPF}/

// ─────────────────────────────────────────────────────────────────────────────
// MAPEAMENTO DE CURSOS (do banco de dados)
// ─────────────────────────────────────────────────────────────────────────────

// Cursos já cadastrados no Supabase — mapeia nome do XML → UUID do curso
const CURSOS_MAP = {
  // Nomes normalizados → ID
  "administração":      "001556c8-862d-450a-9ff7-4377c81bf5a3",
  "administracao":      "001556c8-862d-450a-9ff7-4377c81bf5a3",
  "enfermagem":         "ede6adc2-bf52-47a0-a5bf-f7dcf87e6bc4",
  "fisioterapia":       "78ae9855-de70-4321-81cb-05105ae0c1b5",
  "ciências contábeis": "4d6a6db4-1a61-4aa5-a3bf-fe410aac63a7",
  "ciencias contabeis": "4d6a6db4-1a61-4aa5-a3bf-fe410aac63a7",
  "pedagogia":          "5765771d-bb7f-4554-a122-9a56a90eee64",
  // Educação Física tem dois: licenciatura e bacharelado
  "educação física":    null, // Decidido pelo grau
  "educacao fisica":    null,
};

// Ed. Física: bacharel vs licenciado
const EDFISICA_BACH = "1893bf9d-3dec-44c2-a7b5-4aa65312f999";  // grau: bacharel
const EDFISICA_LIC  = "d74ba238-9c0b-429a-a6b0-ebe6dff2cc13";  // grau: licenciado
const EDFISICA_BACH2 = "7f31b0d5-ba65-4723-8583-5498bdea1ef8"; // Bacharelado em Educação Física

// Assinantes já cadastrados
const ASSINANTES = {
  "02175672000163": { id: "c0bf8ed1-4b32-4aa9-8ea7-fab4cc276e74", nome: "SOCIEDADE EDUCACIONAL VALE DO APORE LTDA" },
  "36541842191":    { id: "01292905-6405-4167-915d-3de0eb8b99f6", nome: "NILTON SANTOS MATTOS" },
  "27245773882":    { id: "d38e1d99-000b-45b6-b451-145208bd5790", nome: "CAMILA CELESTE BRANDAO FERREIRA ITAVO" },
  "07032797857":    { id: "58b02066-4146-4c6e-8c8a-5f79f879f94e", nome: "MARCELO AUGUSTO SANTOS TURINE" },
  "15461510000133": { id: "a285fa85-7657-4b61-926b-a7d1b9ea1942", nome: "FUNDACAO UNIVERSIDADE FEDERAL DE MATO GROSSO DO SUL" },
  "78498872120":    { id: "91e1a758-3ff3-4110-a9cc-984b374e0287", nome: "ALECIANA VASCONCELOS ORTEGA" },
};

// CNPJs especiais para regras de assinatura
const CNPJ_SEVAL = "02175672000163"; // IES Emissora
const CNPJ_UFMS  = "15461510000133"; // IES Registradora

// ─────────────────────────────────────────────────────────────────────────────
// PARSER DE XML (mesma lógica do lote/route.ts)
// ─────────────────────────────────────────────────────────────────────────────

function extrairValorXml(xml, tag) {
  const regex = new RegExp(`<[^>]*:?${tag}[^>]*>([^<]*)<`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() || null : null;
}

function extrairAtributoXml(xml, tag, attr) {
  const regex = new RegExp(`<[^>]*:?${tag}[^>]*\\s${attr}="([^"]*)"`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() || null : null;
}

function extrairValorXmlBloco(xml, blocoPai, tagFilha) {
  const blocoRegex = new RegExp(
    `<[^>]*:?${blocoPai}[^>]*>([\\s\\S]*?)<\\/[^>]*:?${blocoPai}>`, "i"
  );
  const blocoMatch = xml.match(blocoRegex);
  if (!blocoMatch) return null;
  const tagRegex = new RegExp(`<[^>]*:?${tagFilha}[^>]*>([^<]*)<`, "i");
  const tagMatch = blocoMatch[1].match(tagRegex);
  return tagMatch ? tagMatch[1].trim() || null : null;
}

function normalizar(s) {
  return s.toLowerCase().replace(
    /\b(\w)/g,
    (c, _, offset) => {
      const lower = ["de", "da", "do", "das", "dos", "e", "a", "o"];
      if (offset === 0) return c.toUpperCase();
      const word = s.toLowerCase().slice(offset, offset + 4);
      for (const l of lower) {
        if (word.startsWith(l + " ") || word === l) return c;
      }
      return c.toUpperCase();
    }
  );
}

function normalizarNomeCurso(nome) {
  if (!nome) return nome;
  const upper = nome.toUpperCase();
  const mapeamento = {
    "ENFERMAGEM": "Enfermagem",
    "ADMINISTRACAO": "Administração",
    "ADMINISTRAÇÃO": "Administração",
    "PEDAGOGIA": "Pedagogia",
    "DIREITO": "Direito",
    "CIENCIAS CONTABEIS": "Ciências Contábeis",
    "CIÊNCIAS CONTÁBEIS": "Ciências Contábeis",
    "SERVICO SOCIAL": "Serviço Social",
    "SERVIÇO SOCIAL": "Serviço Social",
    "EDUCAÇÃO FÍSICA": "Educação Física",
    "EDUCACAO FISICA": "Educação Física",
    "FISIOTERAPIA": "Fisioterapia",
  };
  return mapeamento[upper] ?? normalizar(nome);
}

function normalizarData(d) {
  if (!d) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const br = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return d;
}

function extrairAssinaturasXml(xml) {
  const resultado = [];
  const sigRegex = /<ds:Signature[\s>][\s\S]*?<\/ds:Signature>/g;
  let sigMatch;
  let ordem = 0;

  while ((sigMatch = sigRegex.exec(xml)) !== null) {
    ordem++;
    const bloco = sigMatch[0];
    const subjectMatch = bloco.match(/<ds:X509SubjectName>([^<]+)<\/ds:X509SubjectName>/);
    if (!subjectMatch) continue;
    const subjectName = subjectMatch[1];
    const cnMatch = subjectName.match(/CN=([^,]+)/);
    if (!cnMatch) continue;
    const cnCompleto = cnMatch[1].trim();
    const partes = cnCompleto.split(":");
    const nome = partes[0]?.trim() ?? cnCompleto;
    const cpfCnpj = (partes[1]?.trim() ?? "").replace(/\D/g, "");
    const tipoPessoa = cpfCnpj.length === 14 ? "pj" : "pf";
    const sigTimeMatch = bloco.match(/<xades:SigningTime>([^<]+)<\/xades:SigningTime>/);
    const signingTime = sigTimeMatch ? sigTimeMatch[1].trim() : null;
    resultado.push({ cn: cnCompleto, nome, cpfCnpj, tipoPessoa, signingTime, ordemNoXml: ordem });
  }
  return resultado;
}

function parsarDiplomaXml(xml) {
  try {
    const xsdVersao = extrairAtributoXml(xml, "DiplomaDigital", "versaoXSD")
      ?? extrairAtributoXml(xml, "curriculo", "versaoXSD") ?? "1.05";

    const nome =
      extrairValorXml(xml, "Nome") ??
      extrairValorXml(xml, "NomeDiplomado") ??
      extrairAtributoXml(xml, "Diplomado", "Nome") ?? "";

    const cpf =
      extrairValorXml(xml, "CPF") ??
      extrairAtributoXml(xml, "Diplomado", "CPF") ??
      extrairAtributoXml(xml, "DadosDiplomado", "CPF") ?? "";

    if (!nome || !cpf) return null;

    const dataNasc = extrairAtributoXml(xml, "Diplomado", "DataNascimento")
      ?? extrairValorXml(xml, "DataNascimento");

    const naturalidade = extrairAtributoXml(xml, "Diplomado", "Naturalidade")
      ?? extrairValorXml(xml, "Naturalidade");

    const naturalidadeUF = extrairAtributoXml(xml, "Diplomado", "UFNaturalidade")
      ?? extrairAtributoXml(xml, "Diplomado", "UF");

    const nomeSocial = extrairAtributoXml(xml, "Diplomado", "NomeSocial")
      ?? extrairValorXml(xml, "NomeSocial");

    const nomeCurso = extrairAtributoXml(xml, "Curso", "NomeCurso")
      ?? extrairValorXml(xml, "NomeCurso")
      ?? extrairAtributoXml(xml, "DadosCurso", "NomeCurso") ?? "";

    const grau = extrairAtributoXml(xml, "Curso", "Grau")
      ?? extrairAtributoXml(xml, "Curso", "grau")
      ?? extrairValorXml(xml, "Grau");

    const habilitacao = extrairAtributoXml(xml, "Curso", "Habilitacao")
      ?? extrairValorXml(xml, "Habilitacao");

    const modalidade = extrairAtributoXml(xml, "Curso", "Modalidade")
      ?? extrairValorXml(xml, "Modalidade");

    const chRaw = extrairAtributoXml(xml, "Curso", "CargaHoraria")
      ?? extrairValorXml(xml, "CargaHoraria");
    const cargaHoraria = chRaw ? parseInt(chRaw) : null;

    const dataConclusao = extrairAtributoXml(xml, "DadosDiploma", "DataConclusaoCurso")
      ?? extrairValorXml(xml, "DataConclusaoCurso")
      ?? extrairAtributoXml(xml, "Diploma", "DataConclusao");

    const dataColacao = extrairAtributoXml(xml, "DadosDiploma", "DataColacaoGrau")
      ?? extrairValorXml(xml, "DataColacaoGrau");

    const dataIngresso = normalizarData(
      extrairValorXmlBloco(xml, "IngressoCurso", "Data")
      ?? extrairValorXml(xml, "DataIngresso")
    );
    const formaAcesso = extrairValorXmlBloco(xml, "IngressoCurso", "FormaAcesso")
      ?? extrairValorXml(xml, "FormaAcesso");

    const codigoValidacao = extrairAtributoXml(xml, "DiplomaDigital", "CodigoValidacao")
      ?? extrairValorXml(xml, "CodigoValidacao");

    // IES Emissora
    const iesEmissora = {
      nome: extrairValorXmlBloco(xml, "IesEmissora", "Nome"),
      codigoMEC: extrairValorXmlBloco(xml, "IesEmissora", "CodigoMEC"),
      cnpj: extrairValorXmlBloco(xml, "IesEmissora", "CNPJ"),
    };

    // IES Registradora
    const iesRegistradora = {
      nome: extrairValorXmlBloco(xml, "IesRegistradora", "Nome"),
      codigoMEC: extrairValorXmlBloco(xml, "IesRegistradora", "CodigoMEC"),
      cnpj: extrairValorXmlBloco(xml, "IesRegistradora", "CNPJ"),
    };

    // Livro de registro
    const livroRegistro = extrairValorXml(xml, "LivroRegistro");
    const numeroRegistro = extrairValorXml(xml, "NumeroRegistro");
    const processo = extrairValorXml(xml, "ProcessoDoDiploma");
    const dataExpedicao = normalizarData(extrairValorXml(xml, "DataExpedicaoDiploma"));
    const dataRegistro = normalizarData(extrairValorXml(xml, "DataRegistroDiploma"));

    // Assinaturas
    const assinaturas = extrairAssinaturasXml(xml);

    return {
      nome: normalizar(nome),
      cpf: cpf.replace(/\D/g, ""),
      dataNascimento: normalizarData(dataNasc),
      naturalidade: naturalidade ? normalizar(naturalidade) : null,
      naturalidadeUF: naturalidadeUF?.toUpperCase() ?? null,
      nomeSocial: nomeSocial ? normalizar(nomeSocial) : null,
      nomeCurso: normalizarNomeCurso(nomeCurso),
      grau: grau ?? null,
      habilitacao: habilitacao ?? null,
      modalidade: modalidade ?? null,
      cargaHoraria,
      dataConclusao: normalizarData(dataConclusao),
      dataColacao: normalizarData(dataColacao),
      dataIngresso,
      formaAcesso,
      codigoValidacao,
      xsdVersao,
      iesEmissora,
      iesRegistradora,
      livroRegistro,
      numeroRegistro,
      processo,
      dataExpedicao,
      dataRegistro,
      assinaturas,
    };
  } catch (err) {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTE HTTP PARA SUPABASE (sem dependências externas)
// ─────────────────────────────────────────────────────────────────────────────

function supabaseRequest(method, pathStr, body, contentType) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathStr, SUPABASE_URL);
    const isHttps = url.protocol === "https:";
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Prefer": method === "POST" ? "return=representation" : "return=minimal",
      },
    };

    if (body && contentType) {
      options.headers["Content-Type"] = contentType;
    } else if (body && typeof body === "object" && !(body instanceof Buffer)) {
      options.headers["Content-Type"] = "application/json";
    }

    const reqModule = isHttps ? https : http;
    const req = reqModule.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = raw;
        }
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
        } else {
          resolve(parsed);
        }
      });
    });
    req.on("error", reject);
    if (body) {
      if (body instanceof Buffer) {
        req.write(body);
      } else if (typeof body === "string") {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

// PostgREST API helpers
async function dbSelect(tabela, filtros) {
  const params = new URLSearchParams(filtros);
  return supabaseRequest("GET", `/rest/v1/${tabela}?${params}`);
}

async function dbInsert(tabela, dados) {
  return supabaseRequest("POST", `/rest/v1/${tabela}`, dados);
}

async function storageUpload(bucket, filePath, fileBuffer, contentType) {
  return new Promise((resolve, reject) => {
    const url = new URL(`/storage/v1/object/${bucket}/${filePath}`, SUPABASE_URL);
    const isHttps = url.protocol === "https:";
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": contentType,
        "x-upsert": "true", // Sobrescreve se já existe
        "Content-Length": fileBuffer.length,
      },
    };
    const reqModule = isHttps ? https : http;
    const req = reqModule.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        if (res.statusCode >= 400) {
          reject(new Error(`Upload ${res.statusCode}: ${raw}`));
        } else {
          resolve(raw);
        }
      });
    });
    req.on("error", reject);
    req.write(fileBuffer);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// RESOLUÇÃO DE CURSO
// ─────────────────────────────────────────────────────────────────────────────

function resolverCursoId(nomeCurso, grau) {
  const chave = nomeCurso.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .trim();

  // Educação Física — depende do grau
  if (chave.includes("educacao fisica") || chave.includes("educação física") || chave.includes("educacao fisica")) {
    const grauLower = (grau ?? "").toLowerCase();
    if (grauLower.includes("licenciad") || grauLower.includes("licenciatura")) {
      return EDFISICA_LIC;
    }
    // Para bacharelado, usa o "Bacharelado em Educação Física" (7f31...)
    return EDFISICA_BACH2;
  }

  // Busca direta
  const id = CURSOS_MAP[chave];
  if (id) return id;

  // Busca parcial
  for (const [key, val] of Object.entries(CURSOS_MAP)) {
    if (val && chave.includes(key)) return val;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTAÇÃO PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

async function importarKits() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║     IMPORTAÇÃO DIRETA DOS KITs LEGADOS → Supabase          ║");
  console.log("║     FIC — Faculdades Integradas de Cassilândia              ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // Verificar pasta de KITs
  if (!fs.existsSync(KITS_DIR)) {
    console.error("❌ Pasta de KITs não encontrada:", KITS_DIR);
    process.exit(1);
  }

  // Listar todas as pastas CPF
  const pastas = fs.readdirSync(KITS_DIR).filter((nome) => {
    const fullPath = path.join(KITS_DIR, nome);
    return fs.statSync(fullPath).isDirectory() && /^\d{11}$/.test(nome);
  });

  console.log(`📂 ${pastas.length} KITs encontrados em ${KITS_DIR}\n`);

  if (pastas.length === 0) {
    console.error("❌ Nenhum KIT encontrado!");
    process.exit(1);
  }

  // Contadores
  const relatorio = {
    total: pastas.length,
    importados: 0,
    erros: 0,
    duplicatas: 0,
    cursosNaoEncontrados: 0,
    xmlInvalidos: 0,
    uploadsFalhos: 0,
    assinaturasVinculadas: 0,
    assinaturasPendentes: 0,
    detalhes: [],
    cursosNaoMapeados: new Set(),
  };

  // Processar cada KIT
  for (let i = 0; i < pastas.length; i++) {
    const cpfPasta = pastas[i];
    const kitDir = path.join(KITS_DIR, cpfPasta);
    const progresso = `[${i + 1}/${pastas.length}]`;

    try {
      // Verificar arquivos do KIT
      const diplomaPath = path.join(kitDir, `${cpfPasta}_diploma.xml`);
      const historicoPath = path.join(kitDir, `${cpfPasta}_historico.xml`);
      const rvddPath = path.join(kitDir, `${cpfPasta}_rvdd.pdf`);

      const temDiploma = fs.existsSync(diplomaPath);
      const temHistorico = fs.existsSync(historicoPath);
      const temRvdd = fs.existsSync(rvddPath);

      if (!temDiploma) {
        console.log(`${progresso} ⚠️  ${cpfPasta} — XML diploma não encontrado, pulando`);
        relatorio.erros++;
        relatorio.detalhes.push({ cpf: cpfPasta, status: "erro", motivo: "XML diploma não encontrado" });
        continue;
      }

      // Ler e parsear XML do diploma
      const xmlConteudo = fs.readFileSync(diplomaPath, "utf8");
      const dados = parsarDiplomaXml(xmlConteudo);

      if (!dados || !dados.nome || !dados.cpf) {
        console.log(`${progresso} ⚠️  ${cpfPasta} — XML inválido (não foi possível extrair dados)`);
        relatorio.xmlInvalidos++;
        relatorio.detalhes.push({ cpf: cpfPasta, status: "erro", motivo: "XML inválido — parse falhou" });
        continue;
      }

      // Verificar se já existe no banco (por CPF)
      const existentes = await dbSelect("diplomados", {
        "cpf": `eq.${dados.cpf}`,
        "select": "id",
      });

      let diplomadoId;

      if (existentes && existentes.length > 0) {
        // Diplomado já existe — reutilizar
        diplomadoId = existentes[0].id;
        console.log(`${progresso} ♻️  ${dados.nome} (${dados.cpf}) — diplomado já existe, reutilizando`);
      } else {
        // data_nascimento é NOT NULL — precisamos de um fallback
        const dataNasc = dados.dataNascimento || "1990-01-01";

        // Inserir novo diplomado
        const novoDiplomado = await dbInsert("diplomados", {
          nome: dados.nome,
          cpf: dados.cpf,
          data_nascimento: dataNasc,
          nome_social: dados.nomeSocial || null,
          nacionalidade: "Brasileira",
          naturalidade_municipio: dados.naturalidade || null,
          naturalidade_uf: dados.naturalidadeUF || null,
        });

        if (!novoDiplomado || novoDiplomado.length === 0) {
          throw new Error("Falha ao inserir diplomado");
        }
        diplomadoId = novoDiplomado[0].id;
      }

      // Resolver curso
      const cursoId = resolverCursoId(dados.nomeCurso, dados.grau);
      if (!cursoId) {
        console.log(`${progresso} ⚠️  ${dados.nome} — curso "${dados.nomeCurso}" (grau: ${dados.grau}) não mapeado!`);
        relatorio.cursosNaoEncontrados++;
        relatorio.cursosNaoMapeados.add(`${dados.nomeCurso} (grau: ${dados.grau})`);
        relatorio.detalhes.push({
          cpf: dados.cpf,
          nome: dados.nome,
          status: "erro",
          motivo: `Curso não mapeado: ${dados.nomeCurso} (grau: ${dados.grau})`,
        });
        continue;
      }

      // Verificar se já existe diploma para este diplomado+curso
      const diplomasExistentes = await dbSelect("diplomas", {
        "diplomado_id": `eq.${diplomadoId}`,
        "curso_id": `eq.${cursoId}`,
        "select": "id",
      });

      if (diplomasExistentes && diplomasExistentes.length > 0) {
        console.log(`${progresso} ♻️  ${dados.nome} — diploma já existe para este curso, pulando`);
        relatorio.duplicatas++;
        relatorio.detalhes.push({ cpf: dados.cpf, nome: dados.nome, status: "duplicata" });
        continue;
      }

      // ── Upload dos arquivos para Storage ──
      const storagePaths = {};

      try {
        if (temDiploma) {
          const buf = fs.readFileSync(diplomaPath);
          await storageUpload(BUCKET, `${STORAGE_PREFIX}/${dados.cpf}/${dados.cpf}_diploma.xml`, buf, "application/xml");
          storagePaths.diploma = `${STORAGE_PREFIX}/${dados.cpf}/${dados.cpf}_diploma.xml`;
        }
        if (temHistorico) {
          const buf = fs.readFileSync(historicoPath);
          await storageUpload(BUCKET, `${STORAGE_PREFIX}/${dados.cpf}/${dados.cpf}_historico.xml`, buf, "application/xml");
          storagePaths.historico = `${STORAGE_PREFIX}/${dados.cpf}/${dados.cpf}_historico.xml`;
        }
        if (temRvdd) {
          const buf = fs.readFileSync(rvddPath);
          await storageUpload(BUCKET, `${STORAGE_PREFIX}/${dados.cpf}/${dados.cpf}_rvdd.pdf`, buf, "application/pdf");
          storagePaths.rvdd = `${STORAGE_PREFIX}/${dados.cpf}/${dados.cpf}_rvdd.pdf`;
        }
      } catch (uploadErr) {
        console.log(`${progresso} ⚠️  ${dados.nome} — erro no upload: ${uploadErr.message.substring(0, 80)}`);
        relatorio.uploadsFalhos++;
        // Continua mesmo com erro de upload — os dados vão pro banco
      }

      // ── Inserir diploma ──
      const novoDiploma = await dbInsert("diplomas", {
        curso_id: cursoId,
        diplomado_id: diplomadoId,
        status: "registrado",
        is_legado: true,
        data_conclusao: dados.dataConclusao || null,
        data_colacao_grau: dados.dataColacao || null,
        data_expedicao: dados.dataExpedicao || null,
        data_ingresso: dados.dataIngresso || null,
        forma_acesso: dados.formaAcesso || null,
        codigo_validacao: dados.codigoValidacao || null,
        versao_xsd: "1.06",
        legado_versao_xsd: dados.xsdVersao || "1.05",
        legado_importado_em: new Date().toISOString(),
        legado_fonte: "importacao-direta-script",
        legado_xml_dados_path: storagePaths.diploma || null,
        legado_xml_documentos_path: storagePaths.historico || null,
        legado_rvdd_original_path: storagePaths.rvdd || null,
        numero_registro: dados.numeroRegistro || null,
        processo_registro: dados.processo || null,
        data_registro: dados.dataRegistro || null,
        carga_horaria_integralizada: dados.cargaHoraria || null,
        emissora_nome: dados.iesEmissora?.nome || null,
        emissora_codigo_mec: dados.iesEmissora?.codigoMEC || null,
        emissora_cnpj: dados.iesEmissora?.cnpj || null,
        registradora_nome: dados.iesRegistradora?.nome || null,
        registradora_codigo_mec: dados.iesRegistradora?.codigoMEC || null,
        registradora_cnpj: dados.iesRegistradora?.cnpj || null,
        titulo_conferido: dados.grau || null,
        ambiente: "producao",
      });

      if (!novoDiploma || novoDiploma.length === 0) {
        throw new Error("Falha ao inserir diploma");
      }

      const diplomaId = novoDiploma[0].id;

      // ── Criar fluxo de assinaturas ──
      if (dados.assinaturas && dados.assinaturas.length > 0) {
        const emissora = [];
        const signatarios = [];
        const registradora = [];

        for (const ass of dados.assinaturas) {
          if (ass.cpfCnpj === CNPJ_SEVAL) {
            emissora.push(ass);
          } else if (ass.cpfCnpj === CNPJ_UFMS) {
            registradora.push(ass);
          } else {
            signatarios.push(ass);
          }
        }

        const fluxoOrdenado = [...emissora, ...signatarios, ...registradora];
        let vinculados = 0;

        for (let j = 0; j < fluxoOrdenado.length; j++) {
          const ass = fluxoOrdenado[j];
          const assinanteBanco = ASSINANTES[ass.cpfCnpj];
          if (!assinanteBanco) {
            relatorio.assinaturasPendentes++;
            continue;
          }

          try {
            await dbInsert("fluxo_assinaturas", {
              diploma_id: diplomaId,
              assinante_id: assinanteBanco.id,
              ordem: j + 1,
              status: "assinado",
              data_assinatura: ass.signingTime || null,
              tipo_certificado: ass.tipoPessoa === "pj" ? "ICP-Brasil e-CNPJ A3" : "ICP-Brasil A3",
            });
            vinculados++;
          } catch (assErr) {
            // Pode ser constraint violation se já existe — ignora
          }
        }
        relatorio.assinaturasVinculadas += vinculados;
      }

      console.log(`${progresso} ✅ ${dados.nome} (${dados.cpf}) — ${dados.nomeCurso} — importado!`);
      relatorio.importados++;
      relatorio.detalhes.push({
        cpf: dados.cpf,
        nome: dados.nome,
        curso: dados.nomeCurso,
        status: "importado",
        diplomaId,
        diplomadoId,
        arquivos: storagePaths,
        assinaturas: dados.assinaturas?.length || 0,
      });

    } catch (err) {
      console.log(`${progresso} ❌ ${cpfPasta} — ERRO: ${err.message.substring(0, 120)}`);
      relatorio.erros++;
      relatorio.detalhes.push({ cpf: cpfPasta, status: "erro", motivo: err.message.substring(0, 200) });
    }

    // Pequena pausa a cada 10 KITs para não sobrecarregar a API
    if ((i + 1) % 10 === 0) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // ── Relatório final ──
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                    RELATÓRIO FINAL                          ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
  console.log(`📊 Total de KITs processados:    ${relatorio.total}`);
  console.log(`✅ Importados com sucesso:        ${relatorio.importados}`);
  console.log(`♻️  Duplicatas (já existiam):      ${relatorio.duplicatas}`);
  console.log(`❌ Erros:                         ${relatorio.erros}`);
  console.log(`⚠️  XMLs inválidos:                ${relatorio.xmlInvalidos}`);
  console.log(`📦 Uploads falhos:                ${relatorio.uploadsFalhos}`);
  console.log(`🔐 Assinaturas vinculadas:        ${relatorio.assinaturasVinculadas}`);
  console.log(`⏳ Assinaturas pendentes:         ${relatorio.assinaturasPendentes}`);

  if (relatorio.cursosNaoMapeados.size > 0) {
    console.log(`\n⚠️  Cursos não mapeados:`);
    for (const c of relatorio.cursosNaoMapeados) {
      console.log(`   - ${c}`);
    }
  }

  // Salvar relatório em arquivo
  const relatorioPath = path.resolve(__dirname, "relatorio-importacao.json");
  relatorio.cursosNaoMapeados = [...relatorio.cursosNaoMapeados];
  fs.writeFileSync(relatorioPath, JSON.stringify(relatorio, null, 2), "utf8");
  console.log(`\n💾 Relatório salvo em: ${relatorioPath}`);

  console.log("\n🎉 Importação concluída!");
}

// ─────────────────────────────────────────────────────────────────────────────
// EXECUÇÃO
// ─────────────────────────────────────────────────────────────────────────────

importarKits().catch((err) => {
  console.error("\n💥 Erro fatal:", err);
  process.exit(1);
});
