/**
 * CFO-FIC — Tools registry
 * Exporta as 5 tools do agente para uso no orchestrator e testes.
 */

export { checkInadimplentes } from './check_inadimplentes.js';
export { emitBoletoAluno } from './emit_boleto_aluno.js';
export { sendWhatsappCobranca } from './send_whatsapp_cobranca.js';
export { gerarRelatorioInadimplencia } from './gerar_relatorio_inadimplencia.js';
export { dispararReguaCobranca } from './disparar_regua_cobranca.js';

export type { CheckInadimplentesInput, CheckInadimplentesOutput, AlunoInadimplente } from './check_inadimplentes.js';
export type { EmitBoletoAlunoInput, EmitBoletoAlunoOutput } from './emit_boleto_aluno.js';
export type { SendWhatsappCobrancaInput, SendWhatsappCobrancaOutput, EstagioCobranca } from './send_whatsapp_cobranca.js';
export type { GerarRelatorioInput, RelatorioOutput } from './gerar_relatorio_inadimplencia.js';
export type { DispararReguaInput, DispararReguaOutput } from './disparar_regua_cobranca.js';

import { checkInadimplentes } from './check_inadimplentes.js';
import { emitBoletoAluno } from './emit_boleto_aluno.js';
import { sendWhatsappCobranca } from './send_whatsapp_cobranca.js';
import { gerarRelatorioInadimplencia } from './gerar_relatorio_inadimplencia.js';
import { dispararReguaCobranca } from './disparar_regua_cobranca.js';

/** Array de tools no formato Anthropic tool_use (para passar ao ManagedAgent). */
export const CFO_FIC_TOOLS = [
  checkInadimplentes,
  emitBoletoAluno,
  sendWhatsappCobranca,
  gerarRelatorioInadimplencia,
  dispararReguaCobranca,
] as const;
