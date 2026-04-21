"use client";

import { MessageSquare, Clock, CheckCircle2, AlertCircle, Inbox, Zap, Users, Radio } from "lucide-react";
import Link from "next/link";

const stats = [
  { label: "Conversas Abertas",    value: "–", icon: MessageSquare, cor: "bg-green-500", corBg: "bg-green-50", corTexto: "text-green-700", href: "/atendimento/conversas?status=open" },
  { label: "Aguardando Resposta",  value: "–", icon: Clock,          cor: "bg-amber-500", corBg: "bg-amber-50", corTexto: "text-amber-700", href: "/atendimento/conversas?status=pending" },
  { label: "Resolvidas Hoje",       value: "–", icon: CheckCircle2,   cor: "bg-blue-500",  corBg: "bg-blue-50",  corTexto: "text-blue-700",  href: "/atendimento/conversas?status=resolved" },
  { label: "Não Atribuídas",        value: "–", icon: AlertCircle,    cor: "bg-red-500",   corBg: "bg-red-50",   corTexto: "text-red-700",   href: "/atendimento/conversas?assignee=none" },
];

const acoes = [
  { label: "Ver Conversas",      descricao: "Lista completa de conversas por canal",         icon: Inbox, href: "/atendimento/conversas", cor: "bg-green-500" },
  { label: "Gerenciar Contatos", descricao: "Alunos, candidatos, responsáveis",              icon: Users, href: "/atendimento/contatos",  cor: "bg-blue-500" },
  { label: "Configurar Canais",  descricao: "WhatsApp, Instagram, Messenger",                icon: Radio, href: "/atendimento/canais",     cor: "bg-purple-500" },
  { label: "Automações",         descricao: "Regras de roteamento e respostas automáticas", icon: Zap,   href: "/atendimento/automacoes", cor: "bg-amber-500" },
];

export function LegacyHome() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Atendimento</h1>
        <p className="text-sm text-gray-500 mt-1">Central de atendimento omnichannel — WhatsApp, Instagram e mais</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} href={s.href} className="block">
              <div className={`rounded-xl p-4 ${s.corBg} border border-transparent hover:border-gray-200 transition-colors`}>
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-8 h-8 rounded-lg ${s.cor} flex items-center justify-center`}>
                    <Icon size={15} className="text-white" />
                  </div>
                </div>
                <p className={`text-2xl font-bold ${s.corTexto}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            </Link>
          );
        })}
      </div>
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Acesso Rápido</h2>
        <div className="grid grid-cols-2 gap-3">
          {acoes.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.label}
                href={a.href}
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <div className={`w-9 h-9 rounded-xl ${a.cor} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={17} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{a.label}</p>
                  <p className="text-xs text-gray-400">{a.descricao}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
