"use client";

import { useState } from "react";
import { Search, Loader2, CheckCircle2, Sparkles } from "lucide-react";

interface CNPJData {
  nome: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
}

interface SmartCNPJInputProps {
  value: string;
  onChange: (value: string) => void;
  onDataFetched: (data: CNPJData) => void;
  label?: string;
  required?: boolean;
}

export default function SmartCNPJInput({
  value,
  onChange,
  onDataFetched,
  label = "CNPJ",
  required = true,
}: SmartCNPJInputProps) {
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState("");

  function formatCNPJ(val: string): string {
    const numbers = val.replace(/\D/g, "").slice(0, 14);
    return numbers
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCNPJ(e.target.value);
    onChange(formatted);
    setFetched(false);
    setError("");
  }

  async function handleSearch() {
    const cnpjClean = value.replace(/\D/g, "");
    if (cnpjClean.length !== 14) {
      setError("CNPJ deve ter 14 dígitos");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/cnpj/${cnpjClean}`
      );

      if (!response.ok) throw new Error("CNPJ não encontrado");

      const data = await response.json();
      onDataFetched(data);
      setFetched(true);
      setSource(data.fonte || "api");
    } catch {
      setError("Não foi possível buscar os dados em nenhuma API. Preencha manualmente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            onChange={handleChange}
            placeholder="00.000.000/0000-00"
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              fetched
                ? "border-green-400 bg-green-50"
                : error
                  ? "border-red-400 bg-red-50"
                  : "border-gray-300"
            }`}
          />
          {fetched && (
            <CheckCircle2
              size={16}
              className="absolute right-3 top-2.5 text-green-500"
            />
          )}
        </div>
        <button
          onClick={handleSearch}
          disabled={loading || value.replace(/\D/g, "").length !== 14}
          className="flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Sparkles size={16} />
          )}
          Buscar
        </button>
      </div>
      {fetched && (
        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
          <Sparkles size={12} />
          Dados preenchidos automaticamente{source.startsWith("cache") ? " (cache local)" : ` via ${source}`}
        </p>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
