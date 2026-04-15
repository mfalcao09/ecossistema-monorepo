"use client";

import { useState } from "react";
import { Search, Sparkles, Loader2, CheckCircle2 } from "lucide-react";

interface SmartEMECInputProps {
  codigoValue: string;
  nomeValue: string;
  onCodigoChange: (value: string) => void;
  onDataFetched: (data: {
    nome?: string;
    grau?: string;
    titulo_conferido?: string;
    modalidade?: string;
    carga_horaria_total?: number;
  }) => void;
}

export default function SmartEMECInput({
  codigoValue,
  nomeValue,
  onCodigoChange,
  onDataFetched,
}: SmartEMECInputProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "suggestion" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleBuscar() {
    if (!codigoValue && !nomeValue) return;

    setLoading(true);
    setStatus("idle");

    try {
      const params = new URLSearchParams();
      if (codigoValue) params.set("codigo", codigoValue);
      if (nomeValue) params.set("nome", nomeValue);

      const res = await fetch(`/api/emec?${params.toString()}`);
      const data = await res.json();

      if (data.source === "emec") {
        // Dados reais do E-MEC
        onDataFetched({
          nome: data.nome,
          grau: data.grau,
          titulo_conferido: data.titulo_conferido,
          modalidade: data.modalidade,
          carga_horaria_total: data.carga_horaria_total,
        });
        setStatus("success");
        setMessage("Dados encontrados no E-MEC e preenchidos automaticamente!");
      } else if (data.source === "sugestao_ia") {
        // Sugestões da IA
        onDataFetched({
          grau: data.grau,
          titulo_conferido: data.titulo_conferido,
          modalidade: data.modalidade,
          carga_horaria_total: data.carga_horaria_total,
        });
        setStatus("suggestion");
        setMessage("A IA sugeriu dados com base no nome do curso. Confira e ajuste se necessário.");
      } else {
        setStatus("error");
        setMessage(data.message || "Preencha os dados manualmente.");
      }
    } catch (err) {
      console.error("Erro na busca E-MEC:", err);
      setStatus("error");
      setMessage("Erro na busca. Preencha manualmente.");
    } finally {
      setLoading(false);
      setTimeout(() => {
        setStatus("idle");
        setMessage("");
      }, 8000);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        Código E-MEC do Curso
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={codigoValue}
          onChange={(e) => onCodigoChange(e.target.value)}
          placeholder="Ex: 123456"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          type="button"
          onClick={handleBuscar}
          disabled={loading || (!codigoValue && !nomeValue)}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Search size={16} />
          )}
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {/* Status feedback */}
      {message && (
        <div
          className={`flex items-center gap-2 text-xs p-2 rounded-lg ${
            status === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : status === "suggestion"
                ? "bg-primary-50 text-primary-700 border border-primary-200"
                : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}
        >
          {status === "success" ? (
            <CheckCircle2 size={14} />
          ) : (
            <Sparkles size={14} />
          )}
          {message}
        </div>
      )}
    </div>
  );
}
