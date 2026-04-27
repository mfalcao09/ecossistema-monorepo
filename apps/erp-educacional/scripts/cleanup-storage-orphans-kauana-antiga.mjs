#!/usr/bin/env node
/**
 * Cleanup de arquivos órfãos no storage `processo-arquivos` —
 * processo Kauana antiga (78c0648f) que foi deletado do DB em 2026-04-27.
 *
 * Contexto: o trigger `storage.protect_delete()` impede DELETE direto na
 * tabela storage.objects. Esse script usa a Storage API (com service_role)
 * pra limpar os arquivos órfãos.
 *
 * Comportamento:
 *   1) Lista todos arquivos no diretório `1dc67914.../a45d403a.../`
 *   2) Cross-checa com `processo_arquivos.storage_path` no DB
 *   3) Deleta APENAS os que não têm referência (idempotente, seguro)
 *
 * Uso (precisa da service_role secret — não anon key):
 *   SUPABASE_SERVICE_ROLE_KEY=<sk_...> node scripts/cleanup-storage-orphans-kauana-antiga.mjs
 *
 * Onde pegar a service_role:
 *   https://supabase.com/dashboard/project/ifdnjieklngcfodmtied/settings/api
 *   → "Project API keys" → "service_role" (secret) → copy
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://ifdnjieklngcfodmtied.supabase.co";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY não definida.");
  console.error(
    "   Painel: https://supabase.com/dashboard/project/ifdnjieklngcfodmtied/settings/api",
  );
  process.exit(1);
}

const supa = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TENANT = "1dc67914-fdbc-4a07-9154-703a474c5f93";
const USER = "a45d403a-2329-4289-9f73-c32c3657b69e";
const DIR = `${TENANT}/${USER}`;
const BUCKET = "processo-arquivos";

console.log(`🔎 Listando ${BUCKET}/${DIR}/ ...`);
const { data: list, error: listErr } = await supa.storage
  .from(BUCKET)
  .list(DIR, { limit: 1000 });

if (listErr) {
  console.error("❌ Erro ao listar:", listErr.message);
  process.exit(1);
}
console.log(`   Encontrados: ${list.length} arquivos no diretório.`);

if (list.length === 0) {
  console.log("✅ Nada a limpar.");
  process.exit(0);
}

// Cross-check com DB: storage_path no banco é `<userId>/<file>` (sem tenant prefix)
const dbPaths = list.map((f) => `${USER}/${f.name}`);
const { data: refs, error: refErr } = await supa
  .from("processo_arquivos")
  .select("storage_path")
  .in("storage_path", dbPaths);

if (refErr) {
  console.error("❌ Erro ao verificar refs no DB:", refErr.message);
  process.exit(1);
}

const referenciados = new Set((refs ?? []).map((r) => r.storage_path));
const seguros = list.filter((f) => !referenciados.has(`${USER}/${f.name}`));

console.log(
  `   Referenciados no DB: ${referenciados.size} (NÃO serão deletados)`,
);
console.log(`   Órfãos seguros pra deletar: ${seguros.length}`);

if (seguros.length === 0) {
  console.log("✅ Nada órfão pra limpar.");
  process.exit(0);
}

const fullPaths = seguros.map((f) => `${DIR}/${f.name}`);
console.log(`🗑️  Deletando ${fullPaths.length} arquivos do storage...`);

// remove() aceita lista — chunkamos em 100 por chamada pra ficar seguro
let total = 0;
const erros = [];
for (let i = 0; i < fullPaths.length; i += 100) {
  const chunk = fullPaths.slice(i, i + 100);
  const { data, error } = await supa.storage.from(BUCKET).remove(chunk);
  if (error) {
    console.error(`❌ Erro no batch ${i / 100 + 1}:`, error.message);
    erros.push(error.message);
    continue;
  }
  total += data?.length ?? 0;
  data?.forEach((f) => console.log(`   - ${f.name}`));
}

console.log(`\n✅ Concluído. Deletados: ${total} arquivos.`);
if (erros.length > 0) {
  console.error(`⚠️  ${erros.length} erros — re-execute o script.`);
  process.exit(1);
}
