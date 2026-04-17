import { describe, it, expect } from 'vitest';
import { roleLayer } from '../../src/layers/04-role.js';
import { makeAgentConfig, ROLE_DIR } from '../fixtures.js';
import { RoleTemplateNotFoundError } from '../../src/types.js';

describe('L4 — roleLayer', () => {
  it('loads CFO-IA base template', () => {
    const out = roleLayer(makeAgentConfig({ role: 'cfo-ia' }), {
      baseDir: ROLE_DIR,
    });
    expect(out).toContain('CFO-IA');
    expect(out).toContain('fluxo de caixa');
    expect(out).toContain('enviar_mensagem_cobranca');
    expect(out).toContain('emitir_boleto_massa_acima_10k');
    expect(out).toContain('taxa_inadimplencia');
  });

  it('merges variant educacao onto cfo-ia', () => {
    const out = roleLayer(
      makeAgentConfig({ role: 'cfo-ia', role_variant: 'educacao' }),
      { baseDir: ROLE_DIR },
    );
    expect(out).toContain('calendário acadêmico');
    expect(out).toContain('conceder_bolsa_integral');
    // base responsabilities ainda presentes
    expect(out).toContain('régua de cobrança');
    // variant-only KPI
    expect(out).toContain('inadimplencia_mensalidades');
  });

  it('loads nested director template', () => {
    const out = roleLayer(
      makeAgentConfig({ role: 'directors/d-governanca' }),
      { baseDir: ROLE_DIR },
    );
    expect(out).toContain('D-Governanca');
    expect(out).toContain('Art. IV');
  });

  it('throws for missing role', () => {
    expect(() =>
      roleLayer(makeAgentConfig({ role: 'nao-existe' }), {
        baseDir: ROLE_DIR,
      }),
    ).toThrow(RoleTemplateNotFoundError);
  });
});
