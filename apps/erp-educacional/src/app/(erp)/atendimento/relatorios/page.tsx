"use client";

import { BarChart2, TrendingUp, Clock, Star, Users } from "lucide-react";

const metricas = [
  { label: "Tempo Médio de Resposta",  icon: Clock,      valor: "–", unidade: "min",  cor: "text-blue-600",  bgCor: "bg-blue-50" },
  { label: "Volume por Canal",          icon: BarChart2,  valor: "–", unidade: "conv", cor: "text-green-600", bgCor: "bg-green-50" },
  { label: "CSAT (Satisfação)",         icon: Star,       valor: "–", unidade: "/5",   cor: "text-amber-600", bgCor: "bg-amber-50" },
  { label: "Conversas por Agente",      icon: Users,      valor: "–", unidade: "avg",  cor: "text-purple-600",bgCor: "bg-purple-50" },
];

export default function RelatoriosPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
        <p className="text-sm text-gray-500 mt-1">
          Métricas de atendimento da FIC
        </p>
      </div>

      {/* Placeholder das métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metricas.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className={`rounded-xl p-4 ${m.bgCor} opacity-60`}>
              <div className="flex items-center justify-between mb-3">
                <div className={`w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center`}>
                  <Icon size={15} className={m.cor} />
                </div>
              </div>
              <p className={`text-2xl font-bold ${m.cor}`}>{m.valor}</p>
              <p className="text-xs text-gray-500 mt-0.5">{m.label}</p>
            </div>
          );
        })}
      </div>

      {/* Banner */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center">
        <TrendingUp size={36} className="mx-auto mb-3 text-gray-300" />
        <p className="font-semibold text-gray-500">Relatórios disponíveis no Sprint 8</p>
        <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
          Após os Sprints 2–7 (integração WhatsApp, dashboard, multi-canal, CRM e automações),
          os relatórios mostrarão dados reais de atendimento da FIC.
        </p>
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {[
            "Tempo médio de resposta",
            "Volume por canal",
            "Relatório semanal automático",
            "CSAT",
            "Performance por agente",
          ].map((item) => (
            <span key={item} className="text-xs bg-white border border-gray-200 text-gray-500 px-2 py-1 rounded-full">
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
