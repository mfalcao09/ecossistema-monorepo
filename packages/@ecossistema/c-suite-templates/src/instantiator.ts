/**
 * Instantiator — cria uma instância de agente a partir de um template C-Suite
 *
 * Não copia templates inteiros. Estratégia:
 * 1. Copia a variant do C-Suite (ou base dos diretores)
 * 2. Copia o evolved-config-seed
 * 3. Gera agent.config.yaml com referências ao template original
 */

import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

import type {
  AgentConfig,
  InstantiateOptions,
  InstantiateResult,
  BusinessId,
  Variant,
} from './types.js';

import {
  BUSINESS_VARIANT_MAP,
  BUSINESS_SUPABASE_MAP,
  DEFAULT_MCPS_CSUITE,
  DEFAULT_MCPS_DIRECTOR,
} from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const REPO_ROOT = path.join(__dirname, '..', '..', '..', '..');

/**
 * Instancia um agente a partir do template.
 * Escreve os arquivos em targetDir (default derivado de business + role).
 */
export async function instantiate(opts: InstantiateOptions): Promise<InstantiateResult> {
  const { business, role } = opts;
  const isDirector = role.startsWith('d-');

  const variant = opts.variant ?? (isDirector ? undefined : autoDetectVariant(business));
  const targetDir = opts.targetDir ?? deriveTargetDir(business, role);
  const filesCreated: string[] = [];

  await fs.mkdirp(targetDir);

  const roleKey = roleToTemplateKey(role);
  const roleDir = isDirector ? 'directors' : 'c-suite';
  const templateDir = path.join(TEMPLATES_DIR, roleDir, roleKey);

  // Verifica se template existe
  if (!(await fs.pathExists(templateDir))) {
    throw new Error(
      `Template não encontrado: ${templateDir}\n` +
      `Role "${role}" pode não ter template implementado ainda. ` +
      `Templates disponíveis: CEO-IA, CFO-IA, D-Governanca, claudinho`
    );
  }

  // 1. Copia variant (apenas para C-Suite com variant)
  if (!isDirector && variant) {
    const variantSrc = path.join(templateDir, 'variants', `${variant}.md`);
    const variantDst = path.join(targetDir, 'variant.md');
    if (await fs.pathExists(variantSrc)) {
      await fs.copy(variantSrc, variantDst);
      filesCreated.push(variantDst);
    }
  }

  // 2. Copia evolved-config-seed
  const seedSrc = path.join(templateDir, 'evolved-config-seed');
  const seedDst = path.join(targetDir, 'evolved-config');
  if (await fs.pathExists(seedSrc)) {
    await fs.copy(seedSrc, seedDst);
    const seedFiles = await listFilesRecursive(seedDst);
    filesCreated.push(...seedFiles);
  }

  // 3. Gera agent.config.yaml
  const config = buildAgentConfig({ business, role, roleKey, roleDir, variant, targetDir });
  const configPath = path.join(targetDir, 'agent.config.yaml');
  await fs.writeFile(configPath, yaml.dump(config, { lineWidth: 100 }));
  filesCreated.push(configPath);

  const agentId = config.agent_id;

  return { targetDir, agentId, filesCreated };
}

function buildAgentConfig(params: {
  business: BusinessId;
  role: string;
  roleKey: string;
  roleDir: string;
  variant?: Variant;
  targetDir: string;
}): AgentConfig {
  const { business, role, roleKey, roleDir, variant } = params;
  const isDirector = role.startsWith('d-');

  const agentId = isDirector
    ? `${role}-ecosystem`
    : `${role}-${business}`;

  const name = isDirector
    ? `${roleKey} (Ecossistema)`
    : `${roleKey} ${business.toUpperCase()}`;

  const templateBase = `@ecossistema/c-suite-templates/templates/${roleDir}/${roleKey}`;

  return {
    agent_id: agentId,
    name,
    role: role as any,
    business_id: business,
    variant,
    model: isDirector ? 'claude-sonnet-4-6' : 'claude-sonnet-4-6',
    permission_mode: 'default',
    supabase_project: BUSINESS_SUPABASE_MAP[business],

    prompt: {
      base: `${templateBase}/base-prompt.md`,
      ...(variant ? { variant: './variant.md' } : {}),
      evolved_config_path: './evolved-config',
    },

    hooks: `${templateBase}/hooks.ts`,
    skills: `${templateBase}/skills.yaml`,

    mcps: [
      ...(isDirector ? DEFAULT_MCPS_DIRECTOR : DEFAULT_MCPS_CSUITE),
      `${business}-mcp`,
    ],
  };
}

function roleToTemplateKey(role: string): string {
  if (role.startsWith('d-')) {
    // d-governanca → D-Governanca
    const name = role.slice(2);
    return `D-${name.charAt(0).toUpperCase()}${name.slice(1)}`;
  }
  if (role === 'claudinho') return 'claudinho';
  // cfo → CFO-IA
  return `${role.toUpperCase()}-IA`;
}

function autoDetectVariant(business: BusinessId): Variant {
  return BUSINESS_VARIANT_MAP[business];
}

function deriveTargetDir(business: BusinessId, role: string): string {
  const isDirector = role.startsWith('d-');
  if (isDirector) {
    return path.join(REPO_ROOT, 'apps', 'orchestrator', 'agents', 'directors', role);
  }
  if (role === 'claudinho') {
    return path.join(REPO_ROOT, 'apps', 'orchestrator', 'agents', 'claudinho');
  }
  return path.join(REPO_ROOT, 'apps', business, 'agents', role);
}

async function listFilesRecursive(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}
