/**
 * @ecossistema/billing
 *
 * Motor de cobrança reutilizável. Lógica genérica (Inter, idempotência, webhook HMAC)
 * vive aqui no ECOSYSTEM. Dados específicos (aluno, comprador) ficam no DB do projeto.
 *
 * Responsável: Sessão D (docs/sessions/BRIEFING-SESSAO-D-billing.md)
 */

export interface InterClientOptions {
  clientId: string;
  clientSecret: string;
  certPath: string;
  sandbox: boolean;
}

export interface BoletoInput {
  alunoId: string;
  mesRef: string;   // 'YYYY-MM'
  valor: number;
  vencimento: Date;
  descricao: string;
}

// STUB — Sessão D implementa
export function createInterClient(_opts: InterClientOptions) {
  throw new Error('Not implemented — Sessão D deve completar (ver BRIEFING-SESSAO-D-billing.md)');
}

export async function emitirBoleto(_input: BoletoInput) {
  throw new Error('Not implemented — Sessão D');
}

export function validarHmac(_payload: string, _signature: string, _secret: string): boolean {
  throw new Error('Not implemented — Sessão D');
}
