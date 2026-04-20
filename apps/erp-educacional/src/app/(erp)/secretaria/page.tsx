"use client";

import Link from "next/link";
import { ScrollText, FileText, Settings2, ChevronRight } from "lucide-react";

const CARDS = [
  {
    title: "Emissão de Documentos",
    description: "Emita histórico escolar, atestados e declarações para alunos.",
    icon: FileText,
    cor: "bg-amber-500",
    corBg: "bg-amber-50",
    corTexto: "text-amber-700",
    href: "/secretaria/emissao",
    itens: ["Histórico Escolar Digital", "Atestado de Matrícula (em breve)", "Declarações (em breve)"],
  },
  {
    title: "Configurações",
    description: "Configure modelos, timbrado e layout dos documentos emitidos.",
    icon: Settings2,
    cor: "bg-slate-500",
    corBg: "bg-slate-50",
    corTexto: "text-slate-700",
    href: "/secretaria/configuracoes",
    itens: ["Modelos de Documentos", "Timbrado e Margens"],
  },
];

export default function SecretariaDashboard() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
            <ScrollText size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Secretaria</h1>
            <p className="text-sm text-gray-500">Emissão e gestão de documentos acadêmicos</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group bg-white rounded-2xl border border-gray-200 p-6 hover:border-amber-200 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-11 h-11 rounded-xl ${card.cor} flex items-center justify-center`}>
                  <Icon size={20} className="text-white" />
                </div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-amber-400 transition-colors mt-1" />
              </div>
              <h2 className="text-base font-bold text-gray-900 mb-1">{card.title}</h2>
              <p className="text-sm text-gray-500 mb-4">{card.description}</p>
              <ul className="space-y-1">
                {card.itens.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-gray-500">
                    <span className={`w-1.5 h-1.5 rounded-full ${card.cor} flex-shrink-0`} />
                    {item}
                  </li>
                ))}
              </ul>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
