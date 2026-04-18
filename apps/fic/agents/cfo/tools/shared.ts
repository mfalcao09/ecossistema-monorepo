/**
 * Helpers compartilhados entre as tools do CFO-FIC.
 *
 * Supabase: projeto FIC (ifdnjieklngcfodmtied)
 * SC-29 Modo B: proxy Edge Function — credenciais nunca expostas ao agente
 */

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Supabase client (FIC)
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env['SUPABASE_FIC_URL'] ?? 'https://ifdnjieklngcfodmtied.supabase.co';
const SUPABASE_KEY = process.env['SUPABASE_FIC_SERVICE_KEY'] ?? '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------------------------------------------------------------
// SC-29 Modo B — credential proxy
// ---------------------------------------------------------------------------

const CREDENTIALS_PROXY_URL =
  process.env['CREDENTIALS_PROXY_URL'] ??
  `${SUPABASE_URL}/functions/v1/credentials-proxy`;

const SUPABASE_ANON_KEY = process.env['SUPABASE_FIC_ANON_KEY'] ?? '';

export interface ProxyTarget {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface CredentialsProxyOptions {
  credential_name: string;
  project: string;
  target: ProxyTarget;
}

export interface CredentialsProxyResult {
  status: number;
  body: unknown;
}

/**
 * Chama SC-29 Modo B.
 * O agente nunca vê as credenciais — a Edge Function faz o call externo.
 */
export async function credentialsProxy(
  opts: CredentialsProxyOptions
): Promise<CredentialsProxyResult> {
  const resp = await fetch(CREDENTIALS_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(opts),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`SC-29 proxy falhou [${resp.status}]: ${text.slice(0, 300)}`);
  }

  return resp.json() as Promise<CredentialsProxyResult>;
}

// ---------------------------------------------------------------------------
// Inter: sandbox vs produção
// ---------------------------------------------------------------------------

const INTER_AMBIENTE = process.env['INTER_AMBIENTE'] ?? 'sandbox';

export const INTER_BASE_URL =
  INTER_AMBIENTE === 'sandbox'
    ? 'https://cdpj.partners.uatinter.co'
    : 'https://cdpj.partners.bancointer.com.br';

// ---------------------------------------------------------------------------
// Evolution API
// ---------------------------------------------------------------------------

export const EVOLUTION_API_URL =
  process.env['EVOLUTION_API_URL'] ?? 'https://evo.exemplo.com';

export const EVOLUTION_INSTANCE =
  process.env['EVOLUTION_INSTANCE'] ?? 'fic-sandbox';

// ---------------------------------------------------------------------------
// Tipos de domínio
// ---------------------------------------------------------------------------

export interface Aluno {
  id: string;
  nome: string;
  cpf: string;         // nunca logar
  email: string | null;
  whatsapp_jid: string | null;
  endereco?: {
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
  };
}

export interface Cobranca {
  id: string;
  aluno_id: string;
  mes_ref: string;
  valor: number;
  status: string;
  inter_cobranca_id: string | null;
  pix_qrcode: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export async function fetchAluno(aluno_id: string): Promise<Aluno> {
  const { data, error } = await supabase
    .from('alunos')
    .select('id, nome, cpf, email, whatsapp_jid, endereco')
    .eq('id', aluno_id)
    .single();

  if (error || !data) {
    throw new Error(`Aluno não encontrado: ${aluno_id} — ${error?.message}`);
  }

  return data as Aluno;
}

export async function fetchCobranca(cobranca_id: string): Promise<Cobranca> {
  const { data, error } = await supabase
    .from('cobrancas')
    .select('id, aluno_id, mes_ref, valor, status, inter_cobranca_id, pix_qrcode')
    .eq('id', cobranca_id)
    .single();

  if (error || !data) {
    throw new Error(`Cobrança não encontrada: ${cobranca_id} — ${error?.message}`);
  }

  return data as Cobranca;
}

/**
 * Calcula data de vencimento (dia 10) para um mes_ref "YYYY-MM".
 */
export function calcDataVencimento(mes_ref: string): string {
  const [ano, mes] = mes_ref.split('-');
  return `${ano}-${mes}-10`;
}

/**
 * Determina estágio da régua de cobrança pelo número de dias de atraso.
 */
export function computeEstagio(
  dias_atraso: number
): 'lembrete-3d' | 'vencido-1d' | 'vencido-15d' | 'vencido-30d' {
  if (dias_atraso < 0) return 'lembrete-3d';
  if (dias_atraso <= 1) return 'vencido-1d';
  if (dias_atraso <= 15) return 'vencido-15d';
  return 'vencido-30d';
}

/** Tipo genérico de tool compatível com Anthropic tool_use format. */
export interface ToolDef<TInput = Record<string, unknown>, TOutput = unknown> {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (input: TInput) => Promise<TOutput>;
}
