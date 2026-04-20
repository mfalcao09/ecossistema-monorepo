import { describe, it, expect } from 'vitest';
import { billingMcpTools } from '../src/mcp-tools.js';

describe('billingMcpTools', () => {
  it('exporta array de ferramentas não-vazio', () => {
    expect(billingMcpTools).toBeInstanceOf(Array);
    expect(billingMcpTools.length).toBeGreaterThan(0);
  });

  it('todas as ferramentas têm name, description e input_schema', () => {
    for (const tool of billingMcpTools) {
      expect(tool.name, `${tool.name} deve ter name`).toBeTruthy();
      expect(tool.description, `${tool.name} deve ter description`).toBeTruthy();
      expect(tool.input_schema, `${tool.name} deve ter input_schema`).toBeDefined();
      expect(tool.input_schema.type).toBe('object');
      expect(tool.input_schema.properties).toBeDefined();
    }
  });

  it('nomes das ferramentas são únicos', () => {
    const names = billingMcpTools.map((t) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('billing_emitir_boleto tem campos obrigatórios corretos', () => {
    const tool = billingMcpTools.find((t) => t.name === 'billing_emitir_boleto');
    expect(tool).toBeDefined();
    expect(tool!.input_schema.required).toEqual(
      expect.arrayContaining(['alunoId', 'mesRef', 'valor', 'vencimento', 'descricao']),
    );
  });

  it('billing_listar_cobrancas tem enum de status válidos', () => {
    const tool = billingMcpTools.find((t) => t.name === 'billing_listar_cobrancas');
    expect(tool).toBeDefined();
    const statusProp = tool!.input_schema.properties['status'];
    expect(statusProp?.enum).toEqual(
      expect.arrayContaining(['EMITIDO', 'PAGO', 'CANCELADO', 'VENCIDO', 'EM_ABERTO', 'EXPIRADO']),
    );
  });

  it('billing_verificar_webhook tem payload e signature como required', () => {
    const tool = billingMcpTools.find((t) => t.name === 'billing_verificar_webhook');
    expect(tool).toBeDefined();
    expect(tool!.input_schema.required).toEqual(expect.arrayContaining(['payload', 'signature']));
  });

  it('billing_consultar_saldo não exige parâmetros', () => {
    const tool = billingMcpTools.find((t) => t.name === 'billing_consultar_saldo');
    expect(tool).toBeDefined();
    expect(tool!.input_schema.required ?? []).toHaveLength(0);
  });

  it('todos os nomes seguem convenção billing_*', () => {
    for (const tool of billingMcpTools) {
      expect(tool.name).toMatch(/^billing_/);
    }
  });
});
