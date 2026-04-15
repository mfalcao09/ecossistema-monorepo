"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, Sparkles, Search } from "lucide-react";

interface InstituicaoMEC {
  codigo_mec: string;
  nome: string;
  sigla?: string;
  categoria?: string;
  organizacao?: string;
  situacao?: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
}

interface MantenedoraMEC {
  codigo_mec: string;
  nome: string;
  cnpj: string;
  natureza_juridica?: string;
  representante_legal?: string;
}

export interface MECVinculoData {
  ies: InstituicaoMEC;
  mantenedora: MantenedoraMEC;
  fonte: string;
}

interface SmartCodigoMECInputProps {
  value: string;
  onChange: (value: string) => void;
  onDataFetched: (data: MECVinculoData) => void;
  label?: string;
  required?: boolean;
}

export default function SmartCodigoMECInput({
  value,
  onChange,
  onDataFetched,
  label = "Código MEC",
  required = false,
}: SmartCodigoMECInputProps) {
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const numbers = e.target.value.replace(/\D/g, "");
    onChange(numbers);
    setFetched(false);
    setError("");
  }

  async function handleSearch() {
    const codigoClean = value.replace(/\D/g, "");
    if (!codigoClean) {
      setError("Digite o código MEC");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/mec/${codigoClean}`);

      if (!response.ok) throw new Error("IES não encontrada");

      const data = await response.json();

      // A API agora retorna { ies: {...}, mantenedora: {...}, fonte: "..." }
      if (data.ies && data.mantenedora) {
        onDataFetched(data);
        setFetched(true);
        setSource(data.fonte || "e-mec");
      } else {
        throw new Error("Formato inesperado");
      }
    } catch {
      setError("IES não encontrada. Preencha os dados manualmente.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (value.replace(/\D/g, "").length > 0) {
        handleSearch();
      }
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
            onKeyDown={handleKeyDown}
            placeholder="Ex: 1606"
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              fetched
                ? "border-green-400 bg-green-50"
                : error
                  ? "border-amber-400 bg-amber-50"
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
          type="button"
          onClick={handleSearch}
          disabled={loading || !value.replace(/\D/g, "")}
          className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Search size={16} />
          )}
          Buscar
        </button>
      </div>
      {fetched && (
        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
          <Sparkles size={12} />
          IES + Mantenedora encontradas
          {source.startsWith("cache") ? " (cache local)" : ` via ${source}`}
        </p>
      )}
      {error && (
        <p className="text-xs text-amber-600 mt-1">{error}</p>
      )}
    </div>
  );
}
