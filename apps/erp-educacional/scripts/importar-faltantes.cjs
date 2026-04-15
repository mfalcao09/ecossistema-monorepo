#!/usr/bin/env node
/**
 * ============================================================================
 * FIX: Importar os 6 KITs que falharam (cursos História e Turismo)
 * ============================================================================
 *
 * COMO USAR:
 *   node scripts/importar-faltantes.cjs
 *
 * Este script re-processa apenas os KITs cujos diplomados não têm diploma
 * ainda no banco. Os cursos de História e Turismo já foram criados.
 * ============================================================================
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// ── Carregar .env.local ──
function carregarEnv() {
  const envPath = path.resolve(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) { console.error("❌ .env.local não encontrado!"); process.exit(1); }
  const env = {};
  for (const linha of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = linha.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

const env = carregarEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const KITS_DIR = path.resolve(__dirname, "..", "reference", "xmls-legado", "KITs");
const BUCKET = "documentos-digitais";
const STORAGE_PREFIX = "legado";

// ── Todos os cursos (incluindo História e Turismo novos) ──
const CURSOS_MAP = {
  "administração":      "001556c8-862d-450a-9ff7-4377c81bf5a3",
  "administracao":      "001556c8-862d-450a-9ff7-4377c81bf5a3",
  "enfermagem":         "ede6adc2-bf52-47a0-a5bf-f7dcf87e6bc4",
  "fisioterapia":       "78ae9855-de70-4321-81cb-05105ae0c1b5",
  "ciências contábeis": "4d6a6db4-1a61-4aa5-a3bf-fe410aac63a7",
  "ciencias contabeis": "4d6a6db4-1a61-4aa5-a3bf-fe410aac63a7",
  "pedagogia":          "5765771d-bb7f-4554-a122-9a56a90eee64",
  "história":           "3141e308-85af-4211-a57f-5dddef9819ac",
  "historia":           "3141e308-85af-4211-a57f-5dddef9819ac",
  "turismo":            "3b44ccd2-798b-4073-bd45-eaec2581f8a0",
};
const EDFISICA_BACH  = "7f31b0d5-ba65-4723-8583-5498bdea1ef8";
const EDFISICA_LIC   = "d74ba238-9c0b-429a-a6b0-ebe6dff2cc13";

// Assinantes
const ASSINANTES = {
  "02175672000163": { id: "c0bf8ed1-4b32-4aa9-8ea7-fab4cc276e74" },
  "36541842191":    { id: "01292905-6405-4167-915d-3de0eb8b99f6" },
  "27245773882":    { id: "d38e1d99-000b-45b6-b451-145208bd5790" },
  "07032797857":    { id: "58b02066-4146-4c6e-8c8a-5f79f879f94e" },
  "15461510000133": { id: "a285fa85-7657-4b61-926b-a7d1b9ea1942" },
  "78498872120":    { id: "91e1a758-3ff3-4110-a9cc-984b374e0287" },
};
const CNPJ_SEVAL = "02175672000163";
const CNPJ_UFMS  = "15461510000133";

// ── Parser XML (cópia do importar-kits.cjs) ──
function extrairValorXml(xml, tag) {
  const m = xml.match(new RegExp(`<[^>]*:?${tag}[^>]*>([^<]*)<`, "i"));
  return m ? m[1].trim() || null : null;
}
function extrairAtributoXml(xml, tag, attr) {
  const m = xml.match(new RegExp(`<[^>]*:?${tag}[^>]*\\s${attr}="([^"]*)"`, "i"));
  return m ? m[1].trim() || null : null;
}
function extrairValorXmlBloco(xml, blocoPai, tagFilha) {
  const bm = xml.match(new RegExp(`<[^>]*:?${blocoPai}[^>]*>([\\s\\S]*?)<\\/[^>]*:?${blocoPai}>`, "i"));
  if (!bm) return null;
  const tm = bm[1].match(new RegExp(`<[^>]*:?${tagFilha}[^>]*>([^<]*)<`, "i"));
  return tm ? tm[1].trim() || null : null;
}
function normalizar(s) {
  return s.toLowerCase().replace(/\b(\w)/g, (c, _, offset) => {
    const lower = ["de", "da", "do", "das", "dos", "e", "a", "o"];
    if (offset === 0) return c.toUpperCase();
    const word = s.toLowerCase().slice(offset, offset + 4);
    for (const l of lower) { if (word.startsWith(l + " ") || word === l) return c; }
    return c.toUpperCase();
  });
}
function normalizarNomeCurso(nome) {
  if (!nome) return nome;
  const map = {
    "ENFERMAGEM":"Enfermagem","ADMINISTRACAO":"Administração","ADMINISTRAÇÃO":"Administração",
    "PEDAGOGIA":"Pedagogia","CIENCIAS CONTABEIS":"Ciências Contábeis","CIÊNCIAS CONTÁBEIS":"Ciências Contábeis",
    "EDUCAÇÃO FÍSICA":"Educação Física","EDUCACAO FISICA":"Educação Física",
    "FISIOTERAPIA":"Fisioterapia","HISTÓRIA":"História","HISTORIA":"História","TURISMO":"Turismo",
  };
  return map[nome.toUpperCase()] ?? normalizar(nome);
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
  let sigMatch, ordem = 0;
  while ((sigMatch = sigRegex.exec(xml)) !== null) {
    ordem++;
    const bloco = sigMatch[0];
    const sub = bloco.match(/<ds:X509SubjectName>([^<]+)<\/ds:X509SubjectName>/);
    if (!sub) continue;
    const cn = sub[1].match(/CN=([^,]+)/);
    if (!cn) continue;
    const partes = cn[1].trim().split(":");
    const nome = partes[0]?.trim() ?? cn[1].trim();
    const cpfCnpj = (partes[1]?.trim() ?? "").replace(/\D/g, "");
    const tipoPessoa = cpfCnpj.length === 14 ? "pj" : "pf";
    const st = bloco.match(/<xades:SigningTime>([^<]+)<\/xades:SigningTime>/);
    resultado.push({ cn: cn[1].trim(), nome, cpfCnpj, tipoPessoa, signingTime: st?.[1]?.trim() ?? null, ordemNoXml: ordem });
  }
  return resultado;
}
function parsarDiplomaXml(xml) {
  try {
    const xsdVersao = extrairAtributoXml(xml, "DiplomaDigital", "versaoXSD") ?? "1.05";
    const nome = extrairValorXml(xml, "Nome") ?? extrairValorXml(xml, "NomeDiplomado") ?? "";
    const cpf = (extrairValorXml(xml, "CPF") ?? "").replace(/\D/g, "");
    if (!nome || !cpf) return null;
    return {
      nome: normalizar(nome), cpf,
      dataNascimento: normalizarData(extrairAtributoXml(xml, "Diplomado", "DataNascimento") ?? extrairValorXml(xml, "DataNascimento")),
      nomeCurso: normalizarNomeCurso(extrairAtributoXml(xml, "Curso", "NomeCurso") ?? extrairValorXml(xml, "NomeCurso") ?? ""),
      grau: extrairAtributoXml(xml, "Curso", "Grau") ?? extrairValorXml(xml, "Grau"),
      modalidade: extrairAtributoXml(xml, "Curso", "Modalidade") ?? extrairValorXml(xml, "Modalidade"),
      cargaHoraria: parseInt(extrairAtributoXml(xml, "Curso", "CargaHoraria") ?? extrairValorXml(xml, "CargaHoraria") ?? "0") || null,
      dataConclusao: normalizarData(extrairAtributoXml(xml, "DadosDiploma", "DataConclusaoCurso") ?? extrairValorXml(xml, "DataConclusaoCurso")),
      dataColacao: normalizarData(extrairAtributoXml(xml, "DadosDiploma", "DataColacaoGrau") ?? extrairValorXml(xml, "DataColacaoGrau")),
      dataIngresso: normalizarData(extrairValorXmlBloco(xml, "IngressoCurso", "Data") ?? extrairValorXml(xml, "DataIngresso")),
      formaAcesso: extrairValorXmlBloco(xml, "IngressoCurso", "FormaAcesso") ?? extrairValorXml(xml, "FormaAcesso"),
      codigoValidacao: extrairAtributoXml(xml, "DiplomaDigital", "CodigoValidacao") ?? extrairValorXml(xml, "CodigoValidacao"),
      xsdVersao,
      iesEmissora: { nome: extrairValorXmlBloco(xml, "IesEmissora", "Nome"), codigoMEC: extrairValorXmlBloco(xml, "IesEmissora", "CodigoMEC"), cnpj: extrairValorXmlBloco(xml, "IesEmissora", "CNPJ") },
      iesRegistradora: { nome: extrairValorXmlBloco(xml, "IesRegistradora", "Nome"), codigoMEC: extrairValorXmlBloco(xml, "IesRegistradora", "CodigoMEC"), cnpj: extrairValorXmlBloco(xml, "IesRegistradora", "CNPJ") },
      numeroRegistro: extrairValorXml(xml, "NumeroRegistro"),
      processo: extrairValorXml(xml, "ProcessoDoDiploma"),
      dataExpedicao: normalizarData(extrairValorXml(xml, "DataExpedicaoDiploma")),
      dataRegistro: normalizarData(extrairValorXml(xml, "DataRegistroDiploma")),
      assinaturas: extrairAssinaturasXml(xml),
    };
  } catch { return null; }
}

// ── HTTP client ──
function supabaseRequest(method, pathStr, body, contentType) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathStr, SUPABASE_URL);
    const isHttps = url.protocol === "https:";
    const opts = {
      hostname: url.hostname, port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search, method,
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Prefer": method === "POST" ? "return=representation" : "return=minimal" },
    };
    if (body && contentType) opts.headers["Content-Type"] = contentType;
    else if (body && typeof body === "object" && !(body instanceof Buffer)) opts.headers["Content-Type"] = "application/json";
    const req = (isHttps ? https : http).request(opts, (res) => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let parsed; try { parsed = JSON.parse(raw); } catch { parsed = raw; }
        res.statusCode >= 400 ? reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`)) : resolve(parsed);
      });
    });
    req.on("error", reject);
    if (body) req.write(body instanceof Buffer ? body : typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}
async function dbSelect(tabela, filtros) { return supabaseRequest("GET", `/rest/v1/${tabela}?${new URLSearchParams(filtros)}`); }
async function dbInsert(tabela, dados) { return supabaseRequest("POST", `/rest/v1/${tabela}`, dados); }
function storageUpload(bucket, filePath, buf, ct) {
  return new Promise((resolve, reject) => {
    const url = new URL(`/storage/v1/object/${bucket}/${filePath}`, SUPABASE_URL);
    const opts = {
      hostname: url.hostname, port: 443, path: url.pathname, method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": ct, "x-upsert": "true", "Content-Length": buf.length },
    };
    const req = https.request(opts, (res) => {
      const c = []; res.on("data", d => c.push(d));
      res.on("end", () => { const r = Buffer.concat(c).toString(); res.statusCode >= 400 ? reject(new Error(r)) : resolve(r); });
    });
    req.on("error", reject); req.write(buf); req.end();
  });
}

function resolverCursoId(nomeCurso, grau) {
  const chave = nomeCurso.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (chave.includes("educacao fisica")) {
    return (grau ?? "").toLowerCase().includes("licenciad") ? EDFISICA_LIC : EDFISICA_BACH;
  }
  const id = CURSOS_MAP[chave];
  if (id) return id;
  for (const [key, val] of Object.entries(CURSOS_MAP)) {
    if (val && chave.includes(key)) return val;
  }
  return null;
}

// ── CPFs que faltam (sem diploma no banco) ──
const CPFS_FALTANTES = ["02952374147","02617745147","03788699140","00328392197","03324349150","71603905120"];

async function main() {
  console.log("🔧 Importando 6 KITs faltantes (História + Turismo)...\n");

  let ok = 0, erros = 0;

  for (const cpf of CPFS_FALTANTES) {
    const kitDir = path.join(KITS_DIR, cpf);
    const diplomaPath = path.join(kitDir, `${cpf}_diploma.xml`);
    const historicoPath = path.join(kitDir, `${cpf}_historico.xml`);
    const rvddPath = path.join(kitDir, `${cpf}_rvdd.pdf`);

    if (!fs.existsSync(diplomaPath)) { console.log(`⚠️  ${cpf} — XML diploma não encontrado`); erros++; continue; }

    try {
      const xml = fs.readFileSync(diplomaPath, "utf8");
      const dados = parsarDiplomaXml(xml);
      if (!dados) { console.log(`⚠️  ${cpf} — parse falhou`); erros++; continue; }

      // Buscar diplomado existente
      const existentes = await dbSelect("diplomados", { "cpf": `eq.${dados.cpf}`, "select": "id" });
      let diplomadoId;
      if (existentes && existentes.length > 0) {
        diplomadoId = existentes[0].id;
      } else {
        const novo = await dbInsert("diplomados", {
          nome: dados.nome, cpf: dados.cpf, data_nascimento: dados.dataNascimento || "1990-01-01",
          nacionalidade: "Brasileira",
        });
        diplomadoId = novo[0].id;
      }

      const cursoId = resolverCursoId(dados.nomeCurso, dados.grau);
      if (!cursoId) { console.log(`⚠️  ${dados.nome} — curso "${dados.nomeCurso}" (${dados.grau}) não mapeado!`); erros++; continue; }

      // Upload
      const storagePaths = {};
      try {
        if (fs.existsSync(diplomaPath)) {
          await storageUpload(BUCKET, `${STORAGE_PREFIX}/${dados.cpf}/${dados.cpf}_diploma.xml`, fs.readFileSync(diplomaPath), "application/xml");
          storagePaths.diploma = `${STORAGE_PREFIX}/${dados.cpf}/${dados.cpf}_diploma.xml`;
        }
        if (fs.existsSync(historicoPath)) {
          await storageUpload(BUCKET, `${STORAGE_PREFIX}/${dados.cpf}/${dados.cpf}_historico.xml`, fs.readFileSync(historicoPath), "application/xml");
          storagePaths.historico = `${STORAGE_PREFIX}/${dados.cpf}/${dados.cpf}_historico.xml`;
        }
        if (fs.existsSync(rvddPath)) {
          await storageUpload(BUCKET, `${STORAGE_PREFIX}/${dados.cpf}/${dados.cpf}_rvdd.pdf`, fs.readFileSync(rvddPath), "application/pdf");
          storagePaths.rvdd = `${STORAGE_PREFIX}/${dados.cpf}/${dados.cpf}_rvdd.pdf`;
        }
      } catch (ue) { console.log(`  ⚠️  upload falhou: ${ue.message.substring(0,80)}`); }

      // Inserir diploma
      const novoDiploma = await dbInsert("diplomas", {
        curso_id: cursoId, diplomado_id: diplomadoId, status: "registrado", is_legado: true,
        data_conclusao: dados.dataConclusao, data_colacao_grau: dados.dataColacao,
        data_expedicao: dados.dataExpedicao, data_ingresso: dados.dataIngresso,
        forma_acesso: dados.formaAcesso, codigo_validacao: dados.codigoValidacao,
        versao_xsd: "1.06", legado_versao_xsd: dados.xsdVersao || "1.05",
        legado_importado_em: new Date().toISOString(), legado_fonte: "importacao-fix-faltantes",
        legado_xml_dados_path: storagePaths.diploma || null,
        legado_xml_documentos_path: storagePaths.historico || null,
        legado_rvdd_original_path: storagePaths.rvdd || null,
        numero_registro: dados.numeroRegistro, processo_registro: dados.processo,
        data_registro: dados.dataRegistro, carga_horaria_integralizada: dados.cargaHoraria,
        emissora_nome: dados.iesEmissora?.nome, emissora_codigo_mec: dados.iesEmissora?.codigoMEC,
        emissora_cnpj: dados.iesEmissora?.cnpj, registradora_nome: dados.iesRegistradora?.nome,
        registradora_codigo_mec: dados.iesRegistradora?.codigoMEC, registradora_cnpj: dados.iesRegistradora?.cnpj,
        titulo_conferido: dados.grau, ambiente: "producao",
      });

      const diplomaId = novoDiploma[0].id;

      // Assinaturas
      if (dados.assinaturas?.length > 0) {
        const emissora = [], sigs = [], reg = [];
        for (const a of dados.assinaturas) {
          if (a.cpfCnpj === CNPJ_SEVAL) emissora.push(a);
          else if (a.cpfCnpj === CNPJ_UFMS) reg.push(a);
          else sigs.push(a);
        }
        const fluxo = [...emissora, ...sigs, ...reg];
        for (let j = 0; j < fluxo.length; j++) {
          const ab = ASSINANTES[fluxo[j].cpfCnpj];
          if (!ab) continue;
          try {
            await dbInsert("fluxo_assinaturas", {
              diploma_id: diplomaId, assinante_id: ab.id, ordem: j + 1,
              status: "assinado", data_assinatura: fluxo[j].signingTime,
              tipo_certificado: fluxo[j].tipoPessoa === "pj" ? "ICP-Brasil e-CNPJ A3" : "ICP-Brasil A3",
            });
          } catch {}
        }
      }

      console.log(`✅ ${dados.nome} (${dados.cpf}) — ${dados.nomeCurso} — importado!`);
      ok++;
    } catch (err) {
      console.log(`❌ ${cpf} — ${err.message.substring(0, 120)}`);
      erros++;
    }
  }

  console.log(`\n📊 Resultado: ${ok} importados, ${erros} erros`);
}

main().catch(e => { console.error("💥", e); process.exit(1); });
