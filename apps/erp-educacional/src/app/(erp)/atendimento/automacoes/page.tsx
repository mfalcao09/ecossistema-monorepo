"use client";

import { Zap, Plus, Clock, Tag, UserCheck } from "lucide-react";

// Regras seed (espelham os INSERTs da migration)
const regrasSeed = [
  {
    nome: "Fora do Horário",
    descricao: "Envia mensagem automática fora do horário de atendimento",
    evento: "message_created",
    ativo: true,
    icon: Clock,
    cor: "bg-blue-500",
  },
  {
    nome: "Auto-Label Financeiro",
    descricao: 'Etiqueta conversas que mencionam "boleto", "mensalidade" ou "pagamento"',
    evento: "message_created",
    ativo: true,
    icon: Tag,
    cor: "bg-amber-500",
  },
];

export default function AutomacoesPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automações</h1>
          <p className="text-sm text-gray-500 mt-1">
            Regras IF/THEN para roteamento automático de conversas
          </p>
        </div>
        <button
          disabled
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium opacity-50 cursor-not-allowed"
          title="Disponível no Sprint 6"
        >
          <Plus size={15} />
          Nova Regra
        </button>
      </div>

      {/* Regras pré-cadastradas (seed) */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Regras padrão (já no banco)
        </p>
        {regrasSeed.map((regra) => {
          const Icon = regra.icon;
          return (
            <div
              key={regra.nome}
              className="flex items-center gap-4 p-4 rounded-xl border border-gray-200"
            >
              <div className={`w-9 h-9 rounded-lg ${regra.cor} flex items-center justify-center flex-shrink-0`}>
                <Icon size={16} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{regra.nome}</p>
                <p className="text-xs text-gray-400 mt-0.5">{regra.descricao}</p>
                <p className="text-xs text-gray-300 mt-1 font-mono">evento: {regra.evento}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${regra.ativo ? "bg-green-400" : "bg-gray-300"}`} />
                <span className="text-xs text-gray-500">{regra.ativo ? "Ativa" : "Inativa"}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview das automações futuras */}
      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Sprint 6 — Automações completas
        </p>
        {[
          { icon: UserCheck, label: "Atribuição automática por fila / equipe" },
          { icon: Tag, label: "Etiquetagem automática por palavras-chave" },
          { icon: Clock, label: "Escalonamento por tempo sem resposta" },
          { icon: Zap, label: "Respostas automáticas personalizadas" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2.5 text-gray-400">
            <Icon size={14} />
            <span className="text-sm">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
