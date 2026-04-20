/**
 * Importa deals reais do Nexvy para o ERP (S4).
 *
 * Uso:
 *   pnpm tsx apps/erp-educacional/scripts/nexvy_import.ts \
 *        --csv /caminho/export-nexvy.csv \
 *        --pipeline-key ATND \
 *        --dry-run
 *
 * Flags:
 *   --csv <path>         CSV exportado do Nexvy (console.nexvy.tech → API → export)
 *   --pipeline-key <k>   Chave da pipeline alvo (default ATND)
 *   --dry-run            Valida e imprime plano; não escreve no DB
 *   --rollback <run-id>  Desfaz uma importação anterior via tag import_run_id
 *
 * CSV esperado (colunas mínimas):
 *   contact_name, contact_phone, contact_email, deal_title,
 *   stage_name, assignee_email, value, source, tags, created_at
 *
 * Stage mapping: tenta casar `stage_name` (case-insensitive) com
 * pipeline_stages.name da pipeline alvo. Linhas sem match vão para a 1ª stage.
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

interface CliArgs {
  csv?: string;
  pipelineKey?: string;
  dryRun?: boolean;
  rollback?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--csv")           out.csv         = argv[++i];
    if (a === "--pipeline-key")  out.pipelineKey = argv[++i];
    if (a === "--dry-run")       out.dryRun      = true;
    if (a === "--rollback")      out.rollback    = argv[++i];
  }
  return out;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = (cols[i] ?? "").trim();
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  // Parser simples, respeita aspas duplas e escapes ""
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { inQuotes = false; continue; }
      cur += ch;
    } else {
      if (ch === ',') { out.push(cur); cur = ""; continue; }
      if (ch === '"') { inQuotes = true; continue; }
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function normalizePhoneBR(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55")) return digits;
  if (digits.length >= 10)     return "55" + digits;
  return digits;
}

function parseValueToCents(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d,.-]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return Math.round(num * 100);
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Env SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY obrigatórias");
    process.exit(2);
  }

  const supabase = createClient(url, key);

  if (args.rollback) {
    await rollback(supabase, args.rollback);
    return;
  }

  if (!args.csv) {
    console.error("--csv <path> é obrigatório");
    process.exit(2);
  }

  const abs = path.resolve(args.csv);
  if (!fs.existsSync(abs)) {
    console.error(`CSV não encontrado: ${abs}`);
    process.exit(2);
  }

  const rows = parseCSV(fs.readFileSync(abs, "utf-8"));
  console.log(`\n🟢 ${rows.length} linhas lidas de ${abs}`);

  const pipelineKey = args.pipelineKey ?? "ATND";
  const { data: pipeline, error: errPipe } = await supabase
    .from("pipelines")
    .select("id, key, name, pipeline_stages(id, name, sort_order)")
    .eq("key", pipelineKey)
    .single();
  if (errPipe || !pipeline) {
    console.error(`Pipeline "${pipelineKey}" não encontrada. Rode a migration S4 primeiro.`);
    process.exit(2);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stages = (pipeline as any).pipeline_stages as Array<{ id: string; name: string; sort_order: number }>;
  stages.sort((a, b) => a.sort_order - b.sort_order);
  const firstStage = stages[0];

  const stageMap: Record<string, string> = {};
  for (const s of stages) stageMap[s.name.toLowerCase()] = s.id;

  const importRunId = randomUUID();
  console.log(`📦 Import run id: ${importRunId}`);

  let countContacts = 0;
  let countDeals = 0;
  const errors: Array<{ row: number; error: string }> = [];

  for (const [idx, row] of rows.entries()) {
    const phone = normalizePhoneBR(row.contact_phone ?? row.phone ?? "");
    const name  = (row.contact_name ?? row.name ?? "").trim() || phone || null;
    const dealTitle = (row.deal_title ?? row.title ?? name ?? "").trim();

    if (!phone && !name) {
      errors.push({ row: idx + 2, error: "Linha sem phone nem name — ignorada" });
      continue;
    }
    if (!dealTitle) {
      errors.push({ row: idx + 2, error: "deal_title obrigatório" });
      continue;
    }

    const stageName = (row.stage_name ?? "").trim().toLowerCase();
    const stageId   = stageMap[stageName] ?? firstStage.id;

    if (args.dryRun) {
      console.log(`[dry] contato=${name} phone=${phone} stage=${stageName || "→" + firstStage.name}`);
      countContacts++; countDeals++;
      continue;
    }

    // 1. Upsert contato por phone
    let contactId: string | null = null;
    if (phone) {
      const { data: existing } = await supabase
        .from("atendimento_contacts")
        .select("id")
        .eq("phone_number", phone)
        .maybeSingle();

      if (existing?.id) {
        contactId = existing.id;
      } else {
        const { data: created, error: errC } = await supabase
          .from("atendimento_contacts")
          .insert({
            name,
            phone_number: phone,
            source: row.source ?? "nexvy_import",
          })
          .select("id")
          .single();
        if (errC) { errors.push({ row: idx + 2, error: `contato: ${errC.message}` }); continue; }
        contactId = created!.id;
        countContacts++;
      }
    }

    // 2. Insere deal
    const { error: errD } = await supabase
      .from("deals")
      .insert({
        pipeline_id:  pipeline.id,
        stage_id:     stageId,
        contact_id:   contactId,
        title:        dealTitle,
        value_cents:  parseValueToCents(row.value ?? ""),
        source:       row.source ?? "nexvy_import",
        custom_fields: {
          import_run_id: importRunId,
          nexvy_original: row,
        },
      });

    if (errD) { errors.push({ row: idx + 2, error: `deal: ${errD.message}` }); continue; }
    countDeals++;
  }

  console.log(`\n✅ Concluído: ${countContacts} contatos novos · ${countDeals} deals`);
  if (errors.length) {
    console.log(`\n⚠️  ${errors.length} linha(s) com erro:`);
    for (const e of errors.slice(0, 20)) console.log(`   linha ${e.row}: ${e.error}`);
    if (errors.length > 20) console.log(`   …+${errors.length - 20} erro(s) suprimidos`);
  }

  if (!args.dryRun) {
    console.log(`\n🔁 Para desfazer: pnpm tsx scripts/nexvy_import.ts --rollback ${importRunId}`);
  }
}

async function rollback(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, runId: string
) {
  console.log(`Rolling back import run ${runId}…`);
  const { error, count } = await supabase
    .from("deals")
    .delete({ count: "exact" })
    .eq("custom_fields->>import_run_id", runId);

  if (error) {
    console.error("Rollback falhou:", error.message);
    process.exit(2);
  }
  console.log(`Removidos ${count ?? 0} deals.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
