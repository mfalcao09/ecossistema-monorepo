#!/usr/bin/env node
/**
 * DIAGNÓSTICO EXPANDIDO: Verifica assinaturas em TODOS os XMLs de um KIT
 * (diploma.xml E historico.xml) para descobrir onde estão os signatários PF
 * (Nilton, Camila, Turine) e a UFMS.
 *
 * USO: node scripts/debug-todos-xmls.cjs
 */

const fs = require("fs");
const path = require("path");

const KITS_DIR = path.resolve(__dirname, "..", "reference", "xmls-legado", "KITs");

// Pega 3 pastas CPF para ter uma amostra
const pastas = fs.readdirSync(KITS_DIR).filter((d) => {
  return fs.statSync(path.join(KITS_DIR, d)).isDirectory() && /^\d{11}$/.test(d);
});

function extrairConteudoTag(bloco, tagName, namespaces) {
  for (const ns of namespaces) {
    const open = `<${ns}${tagName}>`;
    const close = `</${ns}${tagName}>`;
    const si = bloco.indexOf(open);
    if (si !== -1) {
      const ei = bloco.indexOf(close, si);
      if (ei !== -1) return bloco.substring(si + open.length, ei).trim();
    }
  }
  return null;
}

function extrairAssinaturas(xml) {
  const resultado = [];

  // Detectar prefixo
  let prefix = "";
  if (xml.indexOf("<ds:Signature") !== -1) prefix = "ds:";

  const TAG_OPEN = `<${prefix}Signature`;
  const TAG_CLOSE = `</${prefix}Signature>`;
  let pos = 0;

  while (true) {
    const inicio = xml.indexOf(TAG_OPEN, pos);
    if (inicio === -1) break;
    const fim = xml.indexOf(TAG_CLOSE, inicio);
    if (fim === -1) break;
    const fimCompleto = fim + TAG_CLOSE.length;
    const bloco = xml.substring(inicio, fimCompleto);
    pos = fimCompleto;

    const subjectName = extrairConteudoTag(bloco, "X509SubjectName", ["ds:", ""]);
    if (!subjectName) continue;

    const cnMatch = subjectName.match(/CN=([^,]+)/);
    if (!cnMatch) continue;

    const cnCompleto = cnMatch[1].trim();
    const partes = cnCompleto.split(":");
    const nome = partes[0]?.trim() ?? cnCompleto;
    const cpfCnpj = (partes[1]?.trim() ?? "").replace(/\D/g, "");

    const signingTime = extrairConteudoTag(bloco, "SigningTime", ["xades:", ""]);

    resultado.push({ nome, cpfCnpj, signingTime });
  }

  return resultado;
}

// Analisar 5 KITs como amostra
const amostra = pastas.slice(0, 5);

for (const cpf of amostra) {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`📁 KIT: ${cpf}`);
  console.log(`${"═".repeat(70)}`);

  const dir = path.join(KITS_DIR, cpf);
  const arquivos = fs.readdirSync(dir).filter((f) => f.endsWith(".xml"));

  for (const arq of arquivos) {
    const xmlPath = path.join(dir, arq);
    const xml = fs.readFileSync(xmlPath, "utf8");
    const tamanho = (xml.length / 1024).toFixed(0);

    // Detectar tipo do XML
    let tipo = "desconhecido";
    if (xml.includes("DocumentacaoAcademicaRegistro")) tipo = "DocAcademica";
    else if (xml.includes("DiplomaDigital")) tipo = "DiplomaDigital";
    else if (xml.includes("HistoricoEscolar")) tipo = "Historico";

    const assinaturas = extrairAssinaturas(xml);

    console.log(`\n  📄 ${arq} (${tamanho} KB) — Tipo: ${tipo}`);
    console.log(`     Assinaturas encontradas: ${assinaturas.length}`);

    for (let i = 0; i < assinaturas.length; i++) {
      const a = assinaturas[i];
      const tipoDoc = a.cpfCnpj.length === 14 ? "CNPJ" : "CPF";
      console.log(`     ${i + 1}. ${a.nome} (${tipoDoc}: ${a.cpfCnpj}) — ${a.signingTime || "sem data"}`);
    }
  }
}

console.log(`\n\n${"═".repeat(70)}`);
console.log("✅ Diagnóstico concluído!");
console.log("Copie e cole a saída para o Claude.");
