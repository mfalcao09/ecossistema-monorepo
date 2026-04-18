/**
 * Testes de integração do CFO-FIC — mocks de Supabase e SC-29 proxy.
 * Roda sem credenciais reais: `pnpm test` ou `vitest run`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks globais
// ---------------------------------------------------------------------------

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: 'cobranca-uuid' }, error: null }),
    })),
  })),
}));

// Mock fetch (SC-29 proxy)
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSupabase(overrides: Record<string, unknown> = {}) {
  const { createClient } = vi.mocked(
    await import('@supabase/supabase-js')
  );
  return createClient as unknown as ReturnType<typeof createClient>;
}

function mockSupabaseQuery(result: unknown) {
  const { createClient } = await import('@supabase/supabase-js');
  const sb = (createClient as unknown as () => ReturnType<typeof createClient>)();
  const from = sb.from as ReturnType<typeof vi.fn>;
  from.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue(result),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'cobranca-uuid' }, error: null }),
    }),
  });
}

// ---------------------------------------------------------------------------
// check_inadimplentes
// ---------------------------------------------------------------------------

describe('check_inadimplentes', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('retorna lista de inadimplentes com totalizadores', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const mockSb = (createClient as unknown as () => unknown)() as {
      from: ReturnType<typeof vi.fn>;
    };

    const mockData = [
      {
        aluno_id: 'a1',
        nome: 'João Silva',
        cpf_hash: 'hash1',
        curso: 'Direito',
        curso_id: 'c1',
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
        curso_id: 'c2',
        dias_atraso: 35,
        mensalidade_valor: 900,
        cobranca_ativa_id: 'cob2',
        whatsapp_hash: 'w2',
      },
    ];

    mockSb.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    });

    const { checkInadimplentes } = await import('../tools/check_inadimplentes.js');
    const result = await checkInadimplentes.handler({ dias_min: 15 });

    expect(result.count).toBe(2);
    expect(result.total_valor).toBeGreaterThan(0);
    expect(result.alunos[0]?.aluno_id).toBe('a1');
    expect(result.alunos[1]?.dias_atraso).toBe(35);
  });
});

// ---------------------------------------------------------------------------
// emit_boleto_aluno
// ---------------------------------------------------------------------------

describe('emit_boleto_aluno', () => {
  it('chama SC-29 com payload correto e salva cobrança no Supabase', async () => {
    // Sem boleto existente
    const { createClient } = await import('@supabase/supabase-js');
    const mockSb = (createClient as unknown as () => unknown)() as {
      from: ReturnType<typeof vi.fn>;
    };

    mockSb.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'aluno-uuid',
          nome: 'Carlos Ferreira',
          cpf: '12345678900',
          email: 'carlos@fic.edu.br',
          whatsapp_jid: '5567999999999@s.whatsapp.net',
        },
        error: null,
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'nova-cobranca-uuid' },
          error: null,
        }),
      }),
    });

    // Mock SC-29 proxy
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 200,
        body: {
          codigoSolicitacao: 'inter-abc123',
          pix: { qrcode: '00020126580014br.gov.bcb.pix...' },
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

    // Verifica que SC-29 foi chamado com payload Inter correto
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('credentials-proxy'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('INTER_CLIENT_ID'),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// disparar_regua_cobranca — casos Art. II
// ---------------------------------------------------------------------------

describe('disparar_regua_cobranca', () => {
  it('executa sem aprovação com 5 alunos e R$8k', async () => {
    const alunos5 = Array.from({ length: 5 }, (_, i) => ({
      aluno_id: `a${i}`,
      nome: `Aluno ${i}`,
      cpf_hash: `hash${i}`,
      curso: 'Direito',
      curso_id: 'c1',
      dias_atraso: 20,
      mensalidade_valor: 1200,
      cobranca_ativa_id: `cob${i}`,
      whatsapp_hash: `w${i}`,
    }));

    vi.doMock('../tools/check_inadimplentes.js', () => ({
      checkInadimplentes: {
        handler: vi.fn().mockResolvedValue({
          count: 5,
          total_valor: 8000,
          alunos: alunos5.map((a) => ({
            aluno_id: a.aluno_id,
            nome: a.nome,
            cpf_hash: a.cpf_hash,
            curso: a.curso,
            dias_atraso: a.dias_atraso,
            valor_devido: 1600,
            cobranca_ativa_id: a.cobranca_ativa_id,
            whatsapp_hash: a.whatsapp_hash,
          })),
        }),
      },
    }));

    vi.doMock('../tools/send_whatsapp_cobranca.js', () => ({
      sendWhatsappCobranca: {
        handler: vi.fn().mockResolvedValue({ sent: true, message_id: 'msg-id' }),
      },
    }));

    const { dispararReguaCobranca } = await import('../tools/disparar_regua_cobranca.js');
    const result = await dispararReguaCobranca.handler({ dias_min: 15, dry_run: false });

    expect(result.status).toBe('completed');
    expect(result.total_alunos).toBe(5);
  });

  it('retorna pending_approval com 15 alunos e R$15k (Art. II)', async () => {
    vi.doMock('../tools/check_inadimplentes.js', () => ({
      checkInadimplentes: {
        handler: vi.fn().mockResolvedValue({
          count: 15,
          total_valor: 15000,
          alunos: Array.from({ length: 15 }, (_, i) => ({
            aluno_id: `a${i}`,
            dias_atraso: 20,
            valor_devido: 1000,
            cobranca_ativa_id: `cob${i}`,
          })),
        }),
      },
    }));

    const { dispararReguaCobranca } = await import('../tools/disparar_regua_cobranca.js');
    const result = await dispararReguaCobranca.handler({ dias_min: 15, dry_run: false });

    expect(result.status).toBe('pending_approval');
    expect(result.reason).toContain('Art. II');
  });

  it('dry_run retorna plano sem enviar mensagens', async () => {
    vi.doMock('../tools/check_inadimplentes.js', () => ({
      checkInadimplentes: {
        handler: vi.fn().mockResolvedValue({
          count: 3,
          total_valor: 3000,
          alunos: Array.from({ length: 3 }, (_, i) => ({
            aluno_id: `a${i}`,
            dias_atraso: 20,
            valor_devido: 1000,
            cobranca_ativa_id: `cob${i}`,
          })),
        }),
      },
    }));

    const { dispararReguaCobranca } = await import('../tools/disparar_regua_cobranca.js');
    const result = await dispararReguaCobranca.handler({ dias_min: 15, dry_run: true });

    expect(result.status).toBe('dry_run');
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// send_whatsapp_cobranca — idempotência
// ---------------------------------------------------------------------------

describe('send_whatsapp_cobranca — idempotência', () => {
  it('não envia se já enviou hoje no mesmo estágio', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const mockSb = (createClient as unknown as () => unknown)() as {
      from: ReturnType<typeof vi.fn>;
    };

    mockSb.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'comunicacao-existente' },
        error: null,
      }),
    });

    const { sendWhatsappCobranca } = await import('../tools/send_whatsapp_cobranca.js');
    const result = await sendWhatsappCobranca.handler({
      aluno_id: 'a1',
      estagio: 'vencido-15d',
      cobranca_id: 'cob1',
    });

    expect(result.sent).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.skip_reason).toContain('enviado hoje');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
