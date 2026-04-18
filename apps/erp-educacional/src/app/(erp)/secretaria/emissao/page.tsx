"use client";

import Link from "next/link";
import { FileText, ChevronRight, GraduationCap } from "lucide-react";

const TIPOS = [
  {
    label: "Histórico Escolar Digital",
    description: "Emita o histórico escolar completo de um aluno com timbrado e assinaturas digitais.",
    href: "/secretaria/emissao/historico",
    icon: GraduationCap,
    cor: "bg-amber-500",
    disponivel: true,
  },
  {
    label: "Atestado de Matrícula",
    description: "Declare que o aluno está regularmente matriculado no curso.",
    href: "/secretaria/emissao/atestado",
    icon: FileText,
    cor: "bg-gray-300",
    disponivel: false,
  },
];

export default function EmissaoPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Emissão de Documentos</h1>
        <p className="text-sm text-gray-500 mt-1">Escolha o tipo de documento a emitir.</p>
      </div>

      <div className="space-y-3">
        {TIPOS.map((tipo) => {
          const Icon = tipo.icon;
          return tipo.disponivel ? (
            <Link
              key={tipo.href}
              href={tipo.href}
              className="group flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-4 hover:border-amber-200 hover:shadow-sm transition-all"
            >
              <div className={`w-10 h-10 rounded-xl ${tipo.cor} flex items-center justify-center flex-shrink-0`}>
                <Icon size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{tipo.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{tipo.description}</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-amber-400 transition-colors flex-shrink-0" />
            </Link>
          ) : (
            <div
              key={tipo.href}
              className="flex items-center gap-4 bg-white rounded-xl border border-gray-100 p-4 opacity-50 cursor-not-allowed"
            >
              <div className={`w-10 h-10 rounded-xl ${tipo.cor} flex items-center justify-center flex-shrink-0`}>
                <Icon size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{tipo.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{tipo.description}</p>
              </div>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex-shrink-0">Em breve</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
