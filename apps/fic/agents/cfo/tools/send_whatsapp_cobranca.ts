/**
 * Tool: send_whatsapp_cobranca
 * Envia mensagem de cobrança via WhatsApp (Evolution API + SC-29 Modo B).
 * Idempotente: registra em comunicacoes e verifica duplicata antes de enviar.
 */

import {
  supabase,
  fetchAluno,
  fetchCobranca,
  credentialsProxy,
  META_GRAPH_URL,
  META_PHONE_NUMBER_ID,
  type ToolDef,
} from './shared.js';

export type EstagioCobranca =
  | 'lembrete-3d'
  | 'vencido-1d'
  | 'vencido-15d'
  | 'vencido-30d';

export interface SendWhatsappCobrancaInput {
  aluno_id: string;
  estagio: EstagioCobranca;
  cobranca_id: string;
}

export interface SendWhatsappCobrancaOutput {
  sent: boolean;
  message_id: string | null;
  skipped?: boolean;
  skip_reason?: string;
}

const TEMPLATES: Record<EstagioCobranca, (ctx: TemplateCtx) => string> = {
  'lembrete-3d': ({ nome, valor, vencimento }) =>
    `Olá, ${nome}! 👋\n\nPassando para lembrar que sua mensalidade da FIC no valor de *R$ ${valor}* vence em *${vencimento}*.\n\nPague em dia e evite juros! 😊\n\nQualquer dúvida, estamos à disposição.\n\n_FIC — Faculdades Integradas de Cassilândia_`,

  'vencido-1d': ({ nome, valor, pix_qrcode }) =>
    `Olá, ${nome}.\n\nIdentificamos que sua mensalidade da FIC no valor de *R$ ${valor}* está em atraso.\n\n${pix_qrcode ? `📱 *PIX:* \`${pix_qrcode.slice(0, 40)}...\`\n\n` : ''}Regularize hoje para evitar encargos adicionais. Qualquer dúvida, entre em contato.\n\n_FIC — Financeiro_`,

  'vencido-15d': ({ nome, valor }) =>
    `Prezado(a) ${nome},\n\nSua mensalidade da FIC no valor de *R$ ${valor}* encontra-se em atraso há mais de 15 dias.\n\nSolicito que entre em contato com o setor financeiro para regularizar sua situação o quanto antes e evitar encaminhamento para cobrança formal.\n\n📞 Setor Financeiro FIC\n\n_FIC — Faculdades Integradas de Cassilândia_`,

  'vencido-30d': ({ nome, valor }) =>
    `Prezado(a) ${nome},\n\nInformamos que sua mensalidade da FIC no valor de *R$ ${valor}* encontra-se em atraso há mais de 30 dias.\n\nEste é um aviso formal. Caso não haja regularização nos próximos dias, seu caso será encaminhado para análise de cobrança extrajudicial.\n\nEntre em contato IMEDIATAMENTE com o setor financeiro.\n\n_FIC — Departamento Financeiro_`,
};

interface TemplateCtx {
  nome: string;
  valor: string;
  vencimento: string;
  pix_qrcode: string | null;
}

function formatBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const sendWhatsappCobranca: ToolDef<
  SendWhatsappCobrancaInput,
  SendWhatsappCobrancaOutput
> = {
  name: 'send_whatsapp_cobranca',
  description:
    'Envia mensagem de cobrança via WhatsApp (Meta Cloud API). ' +
    'Idempotente: não envia se já enviou no mesmo dia para o mesmo estágio. ' +
    'Estágios: lembrete-3d (3d antes), vencido-1d, vencido-15d, vencido-30d.',
  input_schema: {
    type: 'object',
    required: ['aluno_id', 'estagio', 'cobranca_id'],
    properties: {
      aluno_id: { type: 'string', description: 'UUID do aluno' },
      estagio: {
        type: 'string',
        enum: ['lembrete-3d', 'vencido-1d', 'vencido-15d', 'vencido-30d'],
        description: 'Estágio da régua de cobrança',
      },
      cobranca_id: { type: 'string', description: 'UUID da cobrança ativa' },
    },
  },
  handler: async ({ aluno_id, estagio, cobranca_id }) => {
    // Idempotência: verifica envio do dia
    const hoje = new Date().toISOString().slice(0, 10);
    const { data: jaEnviado } = await supabase
      .from('comunicacoes')
      .select('id')
      .eq('aluno_id', aluno_id)
      .eq('estagio', estagio)
      .eq('canal', 'whatsapp')
      .eq('status', 'enviado')
      .gte('created_at', `${hoje}T00:00:00Z`)
      .maybeSingle();

    if (jaEnviado) {
      return {
        sent: false,
        message_id: null,
        skipped: true,
        skip_reason: `Já enviado hoje (${estagio})`,
      };
    }

    const [aluno, cobranca] = await Promise.all([
      fetchAluno(aluno_id),
      fetchCobranca(cobranca_id),
    ]);

    if (!aluno.whatsapp_jid) {
      await supabase.from('comunicacoes').insert({
        aluno_id,
        cobranca_id,
        tipo: 'cobranca_inadimplencia',
        canal: 'whatsapp',
        estagio,
        status: 'sem_contato',
        conteudo: 'whatsapp_jid ausente',
      });
      return { sent: false, message_id: null, skipped: true, skip_reason: 'sem whatsapp_jid' };
    }

    const ctx: TemplateCtx = {
      nome: aluno.nome.split(' ')[0] ?? aluno.nome,
      valor: formatBRL(cobranca.valor),
      vencimento: cobranca.mes_ref ? `10/${cobranca.mes_ref.split('-')[1]}/${cobranca.mes_ref.split('-')[0]}` : '',
      pix_qrcode: cobranca.pix_qrcode,
    };

    const text = TEMPLATES[estagio](ctx);

    const phone = (aluno.whatsapp_jid ?? '').split('@')[0];

    // SC-29 Modo B: proxy chama Meta Cloud API com token do vault
    const result = await credentialsProxy({
      credential_name: 'META_WHATSAPP_TOKEN',
      project: 'fic',
      target: {
        method: 'POST',
        url: `${META_GRAPH_URL}/${META_PHONE_NUMBER_ID}/messages`,
        headers: { 'Content-Type': 'application/json' },
        body: {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone,
          type: 'text',
          text: { preview_url: false, body: text },
        },
      },
    });

    const body = result.body as Record<string, unknown>;
    const messages = body['messages'] as Array<Record<string, string>> | undefined;
    const message_id = messages?.[0]?.['id'] ?? null;

    await supabase.from('comunicacoes').insert({
      aluno_id,
      cobranca_id,
      tipo: 'cobranca_inadimplencia',
      canal: 'whatsapp',
      estagio,
      status: 'enviado',
      conteudo: text.slice(0, 500),
      message_id,
    });

    return { sent: true, message_id };
  },
};
