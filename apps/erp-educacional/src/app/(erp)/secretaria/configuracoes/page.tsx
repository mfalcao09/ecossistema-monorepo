"use client";

import Link from "next/link";
import { FileText, ChevronRight } from "lucide-react";

const SECOES = [
  {
    label: "Modelos de Documentos",
    description: "Configure o timbrado, colunas, aparência e margens dos documentos emitidos pela secretaria.",
    href: "/secretaria/configuracoes/documentos",
    icon: FileText,
    cor: "bg-amber-500",
  },
];

export default function SecretariaConfiguracoesPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Configurações da Secretaria</h1>
        <p className="text-sm text-gray-500 mt-1">Configure os modelos e padrões visuais dos documentos.</p>
      </div>

      <div className="space-y-3">
        {SECOES.map((secao) => {
          const Icon = secao.icon;
          return (
            <Link
              key={secao.href}
              href={secao.href}
              className="group flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-4 hover:border-amber-200 hover:shadow-sm transition-all"
            >
              <div className={`w-10 h-10 rounded-xl ${secao.cor} flex items-center justify-center flex-shrink-0`}>
                <Icon size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{secao.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{secao.description}</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-amber-400 transition-colors flex-shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
