/**
 * Generator — wrapper CLI-friendly sobre instantiator
 * Expõe a lógica para uso programático (além do bin/create-csuite-agent.js)
 */

import path from 'path';
import fs from 'fs-extra';
import { instantiate } from './instantiator.js';
import type { AgentRole, BusinessId, Variant, InstantiateResult } from './types.js';

export interface GenerateOptions {
  business: BusinessId;
  role: string;
  variant?: Variant;
  targetDir?: string;
  verbose?: boolean;
}

/**
 * Gera um agente C-Suite ou Diretor de Área.
 * Retorna os arquivos criados.
 */
export async function generate(opts: GenerateOptions): Promise<InstantiateResult> {
  if (opts.verbose) {
    console.log(`\n🔧 Gerando agente: ${opts.role} para ${opts.business}`);
    if (opts.variant) console.log(`   Variant: ${opts.variant}`);
  }

  const result = await instantiate({
    business: opts.business as BusinessId,
    role: opts.role as AgentRole,
    variant: opts.variant,
    targetDir: opts.targetDir,
  });

  if (opts.verbose) {
    console.log(`\n✅ Agente criado: ${result.agentId}`);
    console.log(`   Diretório: ${result.targetDir}`);
    console.log(`   Arquivos criados:`);
    for (const file of result.filesCreated) {
      const rel = path.relative(process.cwd(), file);
      console.log(`     - ${rel}`);
    }
  }

  return result;
}

/**
 * Lista todos os templates disponíveis
 */
export async function listTemplates(): Promise<{
  cSuite: string[];
  directors: string[];
  others: string[];
}> {
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const templatesDir = path.join(__dirname, '..', 'templates');

  const cSuiteDir = path.join(templatesDir, 'c-suite');
  const directorsDir = path.join(templatesDir, 'directors');

  const cSuite = (await fs.pathExists(cSuiteDir))
    ? (await fs.readdir(cSuiteDir)).filter(d =>
        fs.statSync(path.join(cSuiteDir, d)).isDirectory()
      )
    : [];

  const directors = (await fs.pathExists(directorsDir))
    ? (await fs.readdir(directorsDir)).filter(d =>
        fs.statSync(path.join(directorsDir, d)).isDirectory()
      )
    : [];

  const others = ['claudinho'];

  return { cSuite, directors, others };
}
