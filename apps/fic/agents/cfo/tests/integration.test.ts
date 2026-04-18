/**
 * Testes de integração do CFO-FIC — mocks de Supabase e SC-29 proxy.
 * Roda sem credenciais reais: `pnpm test`
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks globais (ESM: vi.mock é hoistado automaticamente)
// ---------------------------------------------------------------------------

const mockFrom = vi.fn();
const mockFetch = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// Helpers de mock Supabase
// ---------------------------------------------------------------------------

type QueryChain = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
};

function makeChain(overrides: Partial<QueryChain> = {}): QueryChain {
  const chain: QueryChain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
  // Garante que select/insert retornam o próprio chain para encadeamento
  chain.select.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.gte.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  return chain;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReturnValue(makeChain());
});

afterEach(() => {
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// check_inadimplentes
// ---------------------------------------------------------------------------

describe('check_inadimplentes', () => {
  it('retorna lista de inadimplentes com totalizadores corretos', async () => {
    const mockData = [
      {
        aluno_id: 'a1',
        nome: 'João Silva',
        cpf_hash: 'hash1',
        curso: 'Direito',
        curso_id: null,
        dias_atraso: 20,
        mensalidade_valor: 1200,
        cobranca_ativa_id: 'cob1',
        whatsapp_hash: 'w1',
      },
      {
        aluno_id: 'a2',
        nome: 'Maria Santos',
        cpf_hash: 'hash2',
        curso: 'Pedagogia',
        curso_id: null,
        dias_atraso: 35,
        mensalidade_valor: 900,
        cobranca_ativa_id: 'cob2',
        whatsapp_hash: 'w2',
      },
    ];

    const chain = makeChain({
      limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    });
    chain.select.mockReturnValue(chain);
    chain.gte.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    mockFrom.mockReturnValue(chain);

    const { checkInadimplentes } = await import('../tools/check_inadimplentes.js');
    const result = await checkInadimplentes.handler({ dias_min: 15 });

    expect(result.count).toBe(2);
    expect(result.total_valor).toBeGreaterThan(0);
    expect(result.alunos[0]?.aluno_id).toBe('a1');
    expect(result.alunos[1]?.dias_atraso).toBe(35);
  });

  it('retorna lista vazia quando não há inadimplentes', async () => {
    const chain = makeChain({
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    chain.select.mockReturnValue(chain);
    chain.gte.mockReturnValue(chain);
    mockFrom.mockReturnValue(chain);

    const { checkInadimplentes } = await import('../tools/check_inadimplentes.js');
    const result = await checkInadimplentes.handler({ dias_min: 30 });

    expect(result.count).toBe(0);
    expect(result.total_valor).toBe(0);
    expect(result.alunos).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// emit_boleto_aluno — chama SC-29 com payload correto
// ---------------------------------------------------------------------------

describe('emit_boleto_aluno', () => {
  it('emite boleto via SC-29 e salva cobrança no Supabase', async () => {
    const alunoData = {
      id: 'aluno-uuid',
      nome: 'Carlos Ferreira',
      cpf: '12345678900',
      email: 'carlos@fic.edu.br',
      whatsapp_jid: '5567999999999@s.whatsapp.net',
      endereco: 'Rua das Acácias',
      endereco_numero: '100',
      bairro: 'Centro',
      cidade: 'Cassilândia',
      uf: 'MS',
      cep: '79540000',
    };

    const insertChain = makeChain({
      single: vi.fn().mockResolvedValue({
        data: { id: 'nova-cobranca-uuid' },
        error: null,
      }),
    });
    insertChain.select = vi.fn().mockReturnValue(insertChain);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'cobrancas') {
        // Primeiro call: check existente (maybeSingle null)
        // Segundo call: insert
        const chain = makeChain({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        });
        chain.insert = vi.fn().mockReturnValue(insertChain);
        return chain;
      }
      if (table === 'alunos') {
        return makeChain({
          single: vi.fn().mockResolvedValue({ data: alunoData, error: null }),
        });
      }
      return makeChain();
    });

    // Mock SC-29 proxy
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 200,
        body: {
          codigoSolicitacao: 'inter-abc123',
          pix: { qrcode: '00020126580014br.gov.bcb.pix0014test' },
        },
      }),
    });

    const { emitBoletoAluno } = await import('../tools/emit_boleto_aluno.js');
    const result = await emitBoletoAluno.handler({
      aluno_id: 'aluno-uuid',
      mes_ref: '2026-05',
      valor: 850,
    });

    expect(result.inter_id).toBe('inter-abc123');
    expect(result.pix_qrcode).toBeTruthy();
    expect(result.data_vencimento).toBe('2026-05-10');

    // Verifica que SC-29 foi chamado (fetch para credentials-proxy)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('credentials-proxy'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('retorna boleto existente sem chamar Inter (idempotência)', async () => {
    const boletoExistente = {
      id: 'cobranca-existente',
      inter_request_code: 'inter-existente',
      bolepix_pix_copia_cola: 'pix-code-123',
      data_vencimento: '2026-05-10',
    };

    const chain = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: boletoExistente, error: null }),
    });
    mockFrom.mockReturnValue(chain);

    const { emitBoletoAluno } = await import('../tools/emit_boleto_aluno.js');
    const result = await emitBoletoAluno.handler({
      aluno_id: 'aluno-uuid',
      mes_ref: '2026-05',
      valor: 850,
    });

    expect(result.cobranca_id).toBe('cobranca-existente');
    expect(result.inter_id).toBe('inter-existente');
    // Não deve ter chamado fetch (SC-29)
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// send_whatsapp_cobranca — idempotência
// ---------------------------------------------------------------------------

describe('send_whatsapp_cobranca — idempotência', () => {
  it('não envia se já enviou hoje no mesmo estágio', async () => {
    // Simula que já existe registro de envio hoje
    const chain = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'comunicacao-existente' },
        error: null,
      }),
    });
    mockFrom.mockReturnValue(chain);

    const { sendWhatsappCobranca } = await import('../tools/send_whatsapp_cobranca.js');
    const result = await sendWhatsappCobranca.handler({
      aluno_id: 'a1',
      estagio: 'vencido-15d',
      cobranca_id: 'cob1',
    });

    expect(result.sent).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.skip_reason).toContain('enviado hoje');
    // Não chamou Evolution API
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// disparar_regua_cobranca — Art. II guard + dry_run
// ---------------------------------------------------------------------------

describe('disparar_regua_cobranca', () => {
  it('retorna pending_approval com 15 alunos e R$15k (Art. II volume)', async () => {
    const chain = makeChain({
      limit: vi.fn().mockResolvedValue({
        data: Array.from({ length: 15 }, (_, i) => ({
          aluno_id: `a${i}`,
          nome: `Aluno ${i}`,
          cpf_hash: `hash${i}`,
          curso: 'Direito',
          curso_id: null,
          dias_atraso: 20,
          mensalidade_valor: 1000,
          cobranca_ativa_id: `cob${i}`,
          whatsapp_hash: `w${i}`,
        })),
        error: null,
      }),
    });
    mockFrom.mockReturnValue(chain);

    const { dispararReguaCobranca } = await import('../tools/disparar_regua_cobranca.js');
    const result = await dispararReguaCobranca.handler({ dias_min: 15, dry_run: false });

    expect(result.status).toBe('pending_approval');
    expect(result.reason).toContain('Art. II');
    expect(result.total_alunos).toBe(15);
  });

  it('executa sem aprovação com 5 alunos e total R$8k', async () => {
    // 5 alunos com R$1600 cada = R$8000 (abaixo do limite de R$10k e 10 alunos)
    const alunosData = Array.from({ length: 5 }, (_, i) => ({
      aluno_id: `a${i}`,
      nome: `Aluno ${i}`,
      cpf_hash: `hash${i}`,
      curso: 'Direito',
      curso_id: null,
      dias_atraso: 20,
      mensalidade_valor: 800,
      cobranca_ativa_id: `cob${i}`,
      whatsapp_hash: `w${i}`,
    }));

    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'alunos_view_inadimplencia') {
        return makeChain({
          limit: vi.fn().mockResolvedValue({ data: alunosData, error: null }),
        });
      }
      if (table === 'comunicacoes') {
        callCount++;
        // Alterna: primeiro check idempotência (null = não enviado), depois insert
        if (callCount % 2 === 1) {
          // Check idempotência: não existe envio hoje
          return makeChain({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          });
        }
        // Insert após envio
        return makeChain();
      }
      if (table === 'alunos') {
        return makeChain({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'aluno-uuid',
              nome: 'Aluno Teste',
              cpf: '000',
              email: null,
              whatsapp_jid: '5567999999@s.whatsapp.net',
              endereco: null, endereco_numero: null,
              bairro: null, cidade: null, uf: null, cep: null,
            },
            error: null,
          }),
        });
      }
      if (table === 'cobrancas') {
        return makeChain({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'cob-uuid', aluno_id: 'a0',
              mes_referencia: '2026-04-01', valor: 800,
              status: 'vencido', inter_request_code: null,
              bolepix_pix_copia_cola: null,
            },
            error: null,
          }),
        });
      }
      return makeChain();
    });

    // Mock Meta API via SC-29
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 200,
        body: { messages: [{ id: `wamid-${Math.random()}` }] },
      }),
    });

    const { dispararReguaCobranca } = await import('../tools/disparar_regua_cobranca.js');
    const result = await dispararReguaCobranca.handler({ dias_min: 15, dry_run: false });

    expect(result.status).toBe('completed');
    expect(result.total_alunos).toBe(5);
    expect(result.errors).toBe(0);
  });

  it('dry_run retorna plano sem enviar mensagens', async () => {
    const chain = makeChain({
      limit: vi.fn().mockResolvedValue({
        data: Array.from({ length: 3 }, (_, i) => ({
          aluno_id: `a${i}`,
          nome: `Aluno ${i}`,
          cpf_hash: `hash${i}`,
          curso: 'Pedagogia',
          curso_id: null,
          dias_atraso: 20,
          mensalidade_valor: 850,
          cobranca_ativa_id: `cob${i}`,
          whatsapp_hash: `w${i}`,
        })),
        error: null,
      }),
    });
    mockFrom.mockReturnValue(chain);

    const { dispararReguaCobranca } = await import('../tools/disparar_regua_cobranca.js');
    const result = await dispararReguaCobranca.handler({ dias_min: 15, dry_run: true });

    expect(result.status).toBe('dry_run');
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(3);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
