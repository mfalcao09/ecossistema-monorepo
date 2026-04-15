"use client";

import { Radio, Plus, MessageCircle, Instagram, Facebook, Send } from "lucide-react";

const canaisDisponiveis = [
  {
    nome: "WhatsApp",
    descricao: "Via Meta Cloud API (oficial)",
    icon: MessageCircle,
    cor: "bg-green-500",
    badge: "Sprint 2",
    disponivel: false,
  },
  {
    nome: "Instagram",
    descricao: "Instagram Direct Messages",
    icon: Instagram,
    cor: "bg-pink-500",
    badge: "Sprint 4",
    disponivel: false,
  },
  {
    nome: "Messenger",
    descricao: "Facebook Messenger",
    icon: Facebook,
    cor: "bg-blue-600",
    badge: "Sprint 4",
    disponivel: false,
  },
  {
    nome: "Telegram",
    descricao: "Bot do Telegram",
    icon: Send,
    cor: "bg-sky-500",
    badge: "Futuro",
    disponivel: false,
  },
];

export default function CanaisPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Canais</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure os canais de atendimento da FIC
          </p>
        </div>
        <button
          disabled
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium opacity-50 cursor-not-allowed"
        >
          <Plus size={15} />
          Adicionar Canal
        </button>
      </div>

      {/* Grade de canais */}
      <div className="grid grid-cols-1 gap-3">
        {canaisDisponiveis.map((canal) => {
          const Icon = canal.icon;
          return (
            <div
              key={canal.nome}
              className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 opacity-60"
            >
              <div className={`w-11 h-11 rounded-xl ${canal.cor} flex items-center justify-center flex-shrink-0`}>
                <Icon size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{canal.nome}</p>
                <p className="text-xs text-gray-400">{canal.descricao}</p>
              </div>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full font-medium">
                {canal.badge}
              </span>
            </div>
          );
        })}
      </div>

      {/* Banner informativo */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <Radio size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Sprint 2 — Integração WhatsApp</p>
            <p className="text-sm text-amber-700 mt-0.5">
              O primeiro canal (WhatsApp via Meta Cloud API) será configurado no Sprint 2,
              incluindo webhook, validação HMAC-SHA256 e suporte a templates HSM.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
