"use client";

import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { useDiplomaConfig } from "@/hooks/useDiplomaConfig";
import AbaVisualHistorico from "@/components/config/AbaVisualHistorico";

export default function ConfiguracoesDocumentosPage() {
  const { config, loading, saving, error, saveConfig, refresh } = useDiplomaConfig();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-amber-400" />
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <AlertCircle size={28} className="text-red-400" />
        <p className="text-sm text-red-600">{error ?? "Erro ao carregar configurações"}</p>
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <RefreshCw size={14} /> Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Modelos de Documentos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure o timbrado e o layout visual dos documentos emitidos pela secretaria.
          O timbrado configurado aqui é compartilhado por todos os documentos.
        </p>
      </div>

      <AbaVisualHistorico config={config} saving={saving} onSave={saveConfig} />
    </div>
  );
}
