/**
 * Spec 07 — C-Suite Template Instantiation
 * Verifica que create-csuite-agent gera agente válido.
 * PODE RODAR LOCALMENTE — sem dependência de infra live.
 *
 * RESULTADO: ✅ Verificado em S17 — CLI funcional, agent.config.yaml correto.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, rmSync, mkdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { load as yamlLoad } from 'js-yaml';

const MONOREPO_ROOT = resolve(import.meta.dirname, '../../');
const TEST_OUTPUT_DIR = '/tmp/e2e-s17-csuite-test';

describe('07 — C-Suite Template Instantiation', () => {
  beforeAll(() => {
    if (existsSync(TEST_OUTPUT_DIR)) rmSync(TEST_OUTPUT_DIR, { recursive: true });
    mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(TEST_OUTPUT_DIR)) rmSync(TEST_OUTPUT_DIR, { recursive: true });
  });

  test('create-csuite-agent CLI existe e é executável', () => {
    const cliPath = resolve(MONOREPO_ROOT, 'packages/c-suite-templates/bin/create-csuite-agent.js');
    expect(existsSync(cliPath)).toBe(true);
  });

  test('create-csuite-agent --business klesis --role ceo gera agente válido', async () => {
    const { execa } = await import('execa');
    const cliPath = resolve(MONOREPO_ROOT, 'packages/c-suite-templates/bin/create-csuite-agent.js');
    const targetDir = `${TEST_OUTPUT_DIR}/klesis-ceo`;

    const { exitCode, stdout } = await execa('node', [
      cliPath,
      '--business', 'klesis',
      '--role', 'ceo',
      '--target-dir', targetDir,
    ]);

    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/ceo-klesis/);

    const configPath = `${targetDir}/agent.config.yaml`;
    expect(existsSync(configPath)).toBe(true);

    const cfg = yamlLoad(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    expect(cfg.agent_id).toBe('ceo-klesis');
    expect(cfg.business_id).toBe('klesis');
    expect(cfg.variant).toBe('educacao'); // auto-detectado
    expect(cfg.model).toBe('claude-sonnet-4-6');
  });

  test('create-csuite-agent --business fic --role cfo gera CFO-FIC', async () => {
    const { execa } = await import('execa');
    const cliPath = resolve(MONOREPO_ROOT, 'packages/c-suite-templates/bin/create-csuite-agent.js');
    const targetDir = `${TEST_OUTPUT_DIR}/fic-cfo`;

    const { exitCode } = await execa('node', [
      cliPath,
      '--business', 'fic',
      '--role', 'cfo',
      '--target-dir', targetDir,
    ]);

    expect(exitCode).toBe(0);

    const cfg = yamlLoad(
      readFileSync(`${targetDir}/agent.config.yaml`, 'utf-8')
    ) as Record<string, unknown>;

    expect(cfg.agent_id).toBe('cfo-fic');
    expect(cfg.business_id).toBe('fic');
    expect(cfg.variant).toBe('educacao');
  });

  test('create-csuite-agent --list retorna todos os templates disponíveis', async () => {
    const { execa } = await import('execa');
    const cliPath = resolve(MONOREPO_ROOT, 'packages/c-suite-templates/bin/create-csuite-agent.js');

    const { exitCode, stdout } = await execa('node', [cliPath, '--list']);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/ceo|cfo|cao|cmo/i);
  });

  test('templates CEO-IA e CFO-IA existem no repo', () => {
    const ceoPath = resolve(MONOREPO_ROOT, 'packages/c-suite-templates/templates/c-suite/CEO-IA');
    const cfoPath = resolve(MONOREPO_ROOT, 'packages/c-suite-templates/templates/c-suite/CFO-IA');
    expect(existsSync(ceoPath)).toBe(true);
    expect(existsSync(cfoPath)).toBe(true);
  });

  test('CFO-FIC instanciado em apps/fic/agents/cfo/', () => {
    const path = resolve(MONOREPO_ROOT, 'apps/fic/agents/cfo/agent.config.yaml');
    expect(existsSync(path)).toBe(true);

    const cfg = yamlLoad(readFileSync(path, 'utf-8')) as Record<string, unknown>;
    expect(cfg.agent_id).toMatch(/cfo/i);
    expect(cfg.business_id).toBe('fic');
  });
});
