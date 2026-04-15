#!/usr/bin/env node
/**
 * DIAGNÓSTICO: Mostra o formato REAL das assinaturas nos XMLs legados.
 * Roda em APENAS 1 XML para economizar tempo.
 *
 * USO: node scripts/debug-assinaturas.cjs
 */

const fs = require("fs");
const path = require("path");

const KITS_DIR = path.resolve(__dirname, "..", "reference", "xmls-legado", "KITs");

// Pega a primeira pasta CPF
const pastas = fs.readdirSync(KITS_DIR).filter((d) => {
  return fs.statSync(path.join(KITS_DIR, d)).isDirectory() && /^\d{11}$/.test(d);
});

if (pastas.length === 0) {
  console.error("Nenhuma pasta KIT encontrada!");
  process.exit(1);
}

const cpf = pastas[0];
const xmlPath = path.join(KITS_DIR, cpf, `${cpf}_diploma.xml`);
console.log(`\n📄 Analisando: ${xmlPath}`);
console.log(`📏 Tamanho: ${(fs.statSync(xmlPath).size / 1024).toFixed(0)} KB\n`);

const xml = fs.readFileSync(xmlPath, "utf8");

// ─── TESTE 1: Procurar qualquer menção a "Signature" ───
console.log("═══════════════════════════════════════════════════════");
console.log("TESTE 1: Todas as ocorrências de 'Signature' (case-insensitive)");
console.log("═══════════════════════════════════════════════════════");

const sigMatches = [];
let searchPos = 0;
const lower = xml.toLowerCase();
while (true) {
  const idx = lower.indexOf("signature", searchPos);
  if (idx === -1) break;
  // Pega 80 chars antes e 80 chars depois
  const start = Math.max(0, idx - 80);
  const end = Math.min(xml.length, idx + 80);
  const trecho = xml.substring(start, end).replace(/\n/g, "\\n");
  sigMatches.push({ pos: idx, trecho });
  searchPos = idx + 1;
  if (sigMatches.length >= 15) break; // Limitar a 15
}

if (sigMatches.length === 0) {
  console.log("❌ NENHUMA ocorrência de 'Signature' encontrada no XML!\n");
} else {
  console.log(`✅ Encontradas ${sigMatches.length} ocorrências:\n`);
  for (const m of sigMatches) {
    console.log(`  [pos ${m.pos}]: ...${m.trecho}...\n`);
  }
}

// ─── TESTE 2: Procurar tags X509 ───
console.log("═══════════════════════════════════════════════════════");
console.log("TESTE 2: Todas as ocorrências de 'X509' ou 'Certificate'");
console.log("═══════════════════════════════════════════════════════");

for (const termo of ["X509", "Certificate", "SubjectName", "SigningTime", "xades"]) {
  let count = 0;
  let sp = 0;
  let firstTrecho = "";
  while (true) {
    const idx = xml.indexOf(termo, sp);
    if (idx === -1) break;
    count++;
    if (count === 1) {
      const s = Math.max(0, idx - 40);
      const e = Math.min(xml.length, idx + 60);
      firstTrecho = xml.substring(s, e).replace(/\n/g, "\\n");
    }
    sp = idx + 1;
  }
  console.log(`  "${termo}": ${count} ocorrências`);
  if (firstTrecho) console.log(`    Exemplo: ...${firstTrecho}...\n`);
}

// ─── TESTE 3: Procurar padrões de tags com namespace ───
console.log("\n═══════════════════════════════════════════════════════");
console.log("TESTE 3: Primeiros 500 chars e últimos 500 chars do XML");
console.log("═══════════════════════════════════════════════════════");

console.log("\n--- INÍCIO ---");
console.log(xml.substring(0, 500));
console.log("\n--- FIM (últimos 500 chars) ---");
console.log(xml.substring(xml.length - 500));

// ─── TESTE 4: Todas as tags únicas com "Sign" ou "Cert" ───
console.log("\n═══════════════════════════════════════════════════════");
console.log("TESTE 4: Tags XML únicas contendo 'Sign' ou 'Cert' ou 'CN='");
console.log("═══════════════════════════════════════════════════════");

const tagRegex = /<([a-zA-Z0-9_:.-]+)[\s>\/]/g;
const tags = new Set();
let tagMatch;
while ((tagMatch = tagRegex.exec(xml)) !== null) {
  const tag = tagMatch[1];
  if (/sign|cert|cn=|subject|x509/i.test(tag)) {
    tags.add(tag);
  }
}
console.log(`Tags encontradas: ${[...tags].join(", ") || "NENHUMA"}`);

// ─── TESTE 5: O XML é tudo em 1 linha? ───
console.log("\n═══════════════════════════════════════════════════════");
console.log("TESTE 5: Estrutura do XML");
console.log("═══════════════════════════════════════════════════════");

const linhas = xml.split("\n");
console.log(`Total de linhas: ${linhas.length}`);
console.log(`Caracteres: ${xml.length}`);
if (linhas.length <= 5) {
  console.log("⚠️  XML está em poucas linhas (provavelmente 1 linha gigante)");
  for (let i = 0; i < linhas.length; i++) {
    console.log(`  Linha ${i + 1}: ${linhas[i].length} chars`);
  }
}

console.log("\n✅ Diagnóstico concluído! Copie e cole a saída para o Claude.");
