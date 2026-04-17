import { describe, it, expect, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { writeFileSync, readFileSync, rmSync } from 'node:fs';
import { evolvedConfigLayer } from '../../src/layers/06-evolved-config.js';
import {
  makeAgentConfig,
  makeEvolvedConfigDir,
  cleanupDir,
} from '../fixtures.js';
import {
  ConstitutionTamperedError,
  EvolvedConfigMissingError,
} from '../../src/types.js';
import { sha256 } from '../../src/utils.js';

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length) cleanupDir(tempDirs.pop()!);
});

function makeAgent() {
  const evolved = makeEvolvedConfigDir();
  tempDirs.push(evolved);
  return { evolved, cfg: makeAgentConfig({ evolved_config_path: evolved }) };
}

describe('L6 — evolvedConfigLayer', () => {
  it('renders constitution + persona + user-profile sections', () => {
    const { cfg } = makeAgent();
    const out = evolvedConfigLayer(cfg);
    expect(out).toContain('Configuração Evoluída');
    expect(out).toContain('22 Artigos');
    expect(out).toContain('Art. XXII');
    expect(out).toContain('### Persona');
    expect(out).toContain('### Profile do Usuário');
    expect(out).toContain('Marcelo Silva');
    expect(out).toContain('Business as Mission');
  });

  it('includes strategies subblocks', () => {
    const { cfg } = makeAgent();
    const out = evolvedConfigLayer(cfg);
    expect(out).toContain('task-patterns');
    expect(out).toContain('tool-preferences');
    expect(out).toContain('error-recovery');
  });

  it('validates constitution hash and accepts correct one', () => {
    const { cfg, evolved } = makeAgent();
    const constitutionPath = resolve(evolved, 'constitution.md');
    const hash = sha256(readFileSync(constitutionPath, 'utf-8'));
    expect(() =>
      evolvedConfigLayer(cfg, { constitutionExpectedHash: hash }),
    ).not.toThrow();
  });

  it('throws ConstitutionTamperedError when file modified', () => {
    const { cfg, evolved } = makeAgent();
    const constitutionPath = resolve(evolved, 'constitution.md');
    const original = readFileSync(constitutionPath, 'utf-8');
    const originalHash = sha256(original);
    // Modifica o arquivo
    writeFileSync(constitutionPath, original + '\n## Artigo XXIII — Backdoor', 'utf-8');
    expect(() =>
      evolvedConfigLayer(cfg, { constitutionExpectedHash: originalHash }),
    ).toThrowError(ConstitutionTamperedError);
  });

  it('throws EvolvedConfigMissingError when persona.md absent', () => {
    const { cfg, evolved } = makeAgent();
    rmSync(resolve(evolved, 'persona.md'));
    expect(() => evolvedConfigLayer(cfg)).toThrowError(
      EvolvedConfigMissingError,
    );
  });
});
