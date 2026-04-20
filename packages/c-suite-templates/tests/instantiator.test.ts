/**
 * tests/instantiator.test.ts
 *
 * Valida que o instantiador gera corretamente a estrutura de agente
 * a partir do template CFO-IA (caso principal do briefing S11).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';
import { instantiate } from '../src/instantiator.js';
import type { AgentConfig } from '../src/types.js';

const TEMP_BASE = path.join(os.tmpdir(), 'csuite-test-');

describe('instantiator', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(TEMP_BASE);
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  describe('CFO-FIC (caso principal S11)', () => {
    it('cria agent.config.yaml com campos obrigatórios', async () => {
      const result = await instantiate({
        business: 'fic',
        role: 'cfo',
        targetDir: path.join(tmpDir, 'cfo-fic'),
      });

      expect(result.agentId).toBe('cfo-fic');
      expect(result.filesCreated.length).toBeGreaterThan(0);

      const configPath = path.join(result.targetDir, 'agent.config.yaml');
      expect(await fs.pathExists(configPath)).toBe(true);

      const raw = await fs.readFile(configPath, 'utf-8');
      const config = yaml.load(raw) as AgentConfig;

      expect(config.agent_id).toBe('cfo-fic');
      expect(config.business_id).toBe('fic');
      expect(config.variant).toBe('educacao');
      expect(config.model).toBe('claude-sonnet-4-6');
      expect(config.permission_mode).toBe('default');
      expect(config.supabase_project).toBe('ifdnjieklngcfodmtied');
      expect(config.prompt.base).toContain('CFO-IA/base-prompt.md');
      expect(config.prompt.variant).toBe('./variant.md');
      expect(config.hooks).toContain('CFO-IA/hooks.ts');
      expect(config.skills).toContain('CFO-IA/skills.yaml');
    });

    it('copia variant.md (educacao) para o targetDir', async () => {
      const result = await instantiate({
        business: 'fic',
        role: 'cfo',
        targetDir: path.join(tmpDir, 'cfo-fic'),
      });

      const variantPath = path.join(result.targetDir, 'variant.md');
      expect(await fs.pathExists(variantPath)).toBe(true);

      const content = await fs.readFile(variantPath, 'utf-8');
      expect(content).toContain('Variante: CFO Educação');
      expect(content).toContain('FIC');
      expect(content).toContain('Banco Inter');
    });

    it('copia evolved-config-seed para evolved-config/', async () => {
      const result = await instantiate({
        business: 'fic',
        role: 'cfo',
        targetDir: path.join(tmpDir, 'cfo-fic'),
      });

      const configDir = path.join(result.targetDir, 'evolved-config');
      expect(await fs.pathExists(configDir)).toBe(true);

      // Verifica arquivos essenciais
      expect(await fs.pathExists(path.join(configDir, 'persona.md'))).toBe(true);
      expect(await fs.pathExists(path.join(configDir, 'user-profile.md'))).toBe(true);
      expect(await fs.pathExists(path.join(configDir, 'domain-knowledge.md'))).toBe(true);
      expect(await fs.pathExists(path.join(configDir, 'strategies', 'error-recovery.md'))).toBe(true);
      expect(await fs.pathExists(path.join(configDir, 'strategies', 'task-patterns.md'))).toBe(true);
    });

    it('inclui MCP específico do negócio', async () => {
      const result = await instantiate({
        business: 'fic',
        role: 'cfo',
        targetDir: path.join(tmpDir, 'cfo-fic'),
      });

      const configPath = path.join(result.targetDir, 'agent.config.yaml');
      const config = yaml.load(await fs.readFile(configPath, 'utf-8')) as AgentConfig;

      expect(config.mcps).toContain('fic-mcp');
      expect(config.mcps).toContain('supabase-mcp');
    });
  });

  describe('CEO-FIC', () => {
    it('cria agente CEO com variant educacao', async () => {
      const result = await instantiate({
        business: 'fic',
        role: 'ceo',
        targetDir: path.join(tmpDir, 'ceo-fic'),
      });

      expect(result.agentId).toBe('ceo-fic');
      const configPath = path.join(result.targetDir, 'agent.config.yaml');
      const config = yaml.load(await fs.readFile(configPath, 'utf-8')) as AgentConfig;

      expect(config.variant).toBe('educacao');
      expect(config.prompt.base).toContain('CEO-IA/base-prompt.md');
    });
  });

  describe('D-Governanca', () => {
    it('cria diretor sem variant (cross-business)', async () => {
      const result = await instantiate({
        business: 'ecosystem',
        role: 'd-governanca',
        targetDir: path.join(tmpDir, 'd-governanca'),
      });

      expect(result.agentId).toBe('d-governanca-ecosystem');

      const configPath = path.join(result.targetDir, 'agent.config.yaml');
      const config = yaml.load(await fs.readFile(configPath, 'utf-8')) as AgentConfig;

      expect(config.variant).toBeUndefined();
      expect(config.prompt.base).toContain('D-Governanca/base-prompt.md');
      expect(config.mcps).toContain('audit-mcp');

      // Não deve ter variant.md (diretores não têm variant)
      const variantPath = path.join(result.targetDir, 'variant.md');
      expect(await fs.pathExists(variantPath)).toBe(false);
    });
  });

  describe('auto-detect de variant', () => {
    it.each([
      ['fic', 'educacao'],
      ['klesis', 'educacao'],
      ['intentus', 'imobiliario'],
      ['splendori', 'imobiliario'],
      ['nexvy', 'saas'],
    ] as const)('%s → variant %s', async (business, expectedVariant) => {
      const result = await instantiate({
        business,
        role: 'cfo',
        targetDir: path.join(tmpDir, `cfo-${business}`),
      });

      const configPath = path.join(result.targetDir, 'agent.config.yaml');
      const config = yaml.load(await fs.readFile(configPath, 'utf-8')) as AgentConfig;
      expect(config.variant).toBe(expectedVariant);
    });
  });

  describe('template inexistente', () => {
    it('lança erro descritivo para role sem template', async () => {
      await expect(
        instantiate({
          business: 'fic',
          role: 'chro',  // não implementado ainda
          targetDir: path.join(tmpDir, 'chro-fic'),
        })
      ).rejects.toThrow(/Template não encontrado/);
    });
  });
});
