import {
  MessageCircle,
  QrCode,
  Instagram,
  Facebook,
  Mail,
  Send,
  Globe,
  Smartphone,
  ThumbsDown,
  type LucideIcon,
} from "lucide-react";

export type TipoCanal =
  | "whatsapp-cloud"
  | "whatsapp-qr"
  | "instagram"
  | "messenger"
  | "email"
  | "telegram"
  | "webchat"
  | "sms"
  | "reclame-aqui";

export type StatusDisponibilidade = "disponivel" | "em-breve";

export type BadgeTipo =
  | "recomendado"
  | "atencao"
  | "info"
  | "neutro"
  | "futuro";

export interface CanalCatalogo {
  id: TipoCanal;
  nome: string;
  descricao: string;
  icone: LucideIcon;
  corBg: string;
  status: StatusDisponibilidade;
  badge: { texto: string; tipo: BadgeTipo };
  ajuda: string;
  fluxoConexao:
    | "meta-cloud-api"
    | "qr-baileys"
    | "oauth-facebook"
    | "imap-smtp"
    | "bot-token"
    | "embed-script"
    | "creditos"
    | "credenciais";
  previsao?: string;
}

export const CANAIS: CanalCatalogo[] = [
  {
    id: "whatsapp-cloud",
    nome: "WhatsApp Cloud API",
    descricao: "Conexão oficial Meta. Templates HSM, sem risco de banimento.",
    icone: MessageCircle,
    corBg: "bg-green-600",
    status: "disponivel",
    badge: { texto: "Recomendado", tipo: "recomendado" },
    ajuda:
      "Requer conta Meta Business + WABA aprovada. Suporta janela de 24h e templates oficiais. Custo por conversa cobrado pela Meta.",
    fluxoConexao: "meta-cloud-api",
  },
  {
    id: "whatsapp-qr",
    nome: "WhatsApp QR Code",
    descricao: "Conexão não-oficial via Baileys. Para números maturados.",
    icone: QrCode,
    corBg: "bg-emerald-500",
    status: "disponivel",
    badge: { texto: "Risco de banimento", tipo: "atencao" },
    ajuda:
      "Use apenas em números com mínimo 3-5 dias de uso intenso (maturação). A Meta pode banir números não-oficiais sem aviso.",
    fluxoConexao: "qr-baileys",
  },
  {
    id: "instagram",
    nome: "Instagram Direct",
    descricao: "Mensagens diretas do Instagram via OAuth Facebook.",
    icone: Instagram,
    corBg: "bg-pink-500",
    status: "disponivel",
    badge: { texto: "OAuth Facebook", tipo: "info" },
    ajuda:
      "Requer página do Facebook vinculada à conta Instagram Business e permissões de mensagens.",
    fluxoConexao: "oauth-facebook",
  },
  {
    id: "messenger",
    nome: "Facebook Messenger",
    descricao: "Mensagens da página do Facebook.",
    icone: Facebook,
    corBg: "bg-blue-600",
    status: "disponivel",
    badge: { texto: "OAuth Facebook", tipo: "info" },
    ajuda: "Conectado junto com a permissão de mensagens da página Facebook.",
    fluxoConexao: "oauth-facebook",
  },
  {
    id: "email",
    nome: "E-mail",
    descricao: "Atendimento por e-mail (Gmail, Outlook, IMAP).",
    icone: Mail,
    corBg: "bg-amber-500",
    status: "disponivel",
    badge: { texto: "Beta", tipo: "info" },
    ajuda:
      "Suporta OAuth Google/Microsoft ou IMAP/SMTP manual. Cada thread vira uma conversa.",
    fluxoConexao: "imap-smtp",
  },
  {
    id: "telegram",
    nome: "Telegram",
    descricao: "Bot do Telegram via @BotFather.",
    icone: Send,
    corBg: "bg-sky-500",
    status: "disponivel",
    badge: { texto: "Bot Token", tipo: "neutro" },
    ajuda:
      "Crie um bot no @BotFather, copie o token e cole aqui. Sem custo, sem aprovação.",
    fluxoConexao: "bot-token",
  },
  {
    id: "webchat",
    nome: "Webchat",
    descricao: "Chat embutido no site institucional via script.",
    icone: Globe,
    corBg: "bg-indigo-500",
    status: "em-breve",
    badge: { texto: "Em desenvolvimento", tipo: "futuro" },
    ajuda:
      "Widget de chat embutido com snippet HTML. Inclui horário de atendimento e formulário pré-chat.",
    fluxoConexao: "embed-script",
    previsao: "Fase 2",
  },
  {
    id: "sms",
    nome: "SMS",
    descricao: "Mensagens SMS via gateway (Twilio, Zenvia).",
    icone: Smartphone,
    corBg: "bg-slate-500",
    status: "em-breve",
    badge: { texto: "Em desenvolvimento", tipo: "futuro" },
    ajuda:
      "Cobrado por mensagem enviada via gateway. Útil para 2FA e notificações.",
    fluxoConexao: "creditos",
    previsao: "Fase 3",
  },
  {
    id: "reclame-aqui",
    nome: "Reclame Aqui",
    descricao: "Atendimento de reclamações no portal Reclame Aqui.",
    icone: ThumbsDown,
    corBg: "bg-red-500",
    status: "em-breve",
    badge: { texto: "Em desenvolvimento", tipo: "futuro" },
    ajuda:
      "Integração com painel Reclame Aqui para responder reclamações dentro do ERP.",
    fluxoConexao: "credenciais",
    previsao: "Fase 3",
  },
];

export const BADGE_STYLES: Record<BadgeTipo, string> = {
  recomendado: "bg-green-100 text-green-700 ring-1 ring-green-200",
  atencao: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
  info: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
  neutro: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  futuro: "bg-violet-100 text-violet-700 ring-1 ring-violet-200",
};

export const CORES_CANAL = [
  { nome: "Verde", valor: "#16a34a" },
  { nome: "Esmeralda", valor: "#10b981" },
  { nome: "Rosa", valor: "#ec4899" },
  { nome: "Azul", valor: "#2563eb" },
  { nome: "Âmbar", valor: "#f59e0b" },
  { nome: "Céu", valor: "#0ea5e9" },
  { nome: "Índigo", valor: "#6366f1" },
  { nome: "Violeta", valor: "#8b5cf6" },
];
