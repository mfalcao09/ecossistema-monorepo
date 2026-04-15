"use client";

import { Users, Search, Plus, Upload } from "lucide-react";

export default function ContatosPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contatos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Alunos, candidatos e responsáveis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <Upload size={14} />
            Importar CSV
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
            <Plus size={15} />
            Novo Contato
          </button>
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome, telefone ou e-mail…"
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Estado vazio */}
      <div className="text-center py-20 text-gray-400">
        <Users size={40} className="mx-auto mb-4 opacity-30" />
        <p className="font-medium text-gray-500">Nenhum contato cadastrado</p>
        <p className="text-sm mt-1">
          Contatos são criados automaticamente ao receber uma mensagem,
          ou você pode importar via CSV
        </p>
        <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700 font-medium">
          <span>📋</span>
          Sprint 5 — CRM de Contatos completo
        </div>
      </div>
    </div>
  );
}
