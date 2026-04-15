"use client";

import { useState, useCallback } from "react";
import { Search, Loader2, CheckCircle2, AlertCircle, UserCheck, XCircle } from "lucide-react";

interface Diplomado {
  id: string;
  nome: string;
  cpf: string;
  ra: string;
  email: string;
}

interface SmartCPFInputProps {
  value: string;
  onChange: (value: string) => void;
  onDuplicataEncontrada?: (diplomado: Diplomado) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
}

// Validação de CPF
function validarCPF(cpf: string): boolean {
  const c = cpf.replace(/\D/g, "");
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(c[i]) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(c[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(c[i]) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  return rev === parseInt(c[10]);
}

function formatCPF(val: string): string {
  const n = val.replace(/\D/g, "").slice(0, 11);
  return n
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export default function SmartCPFInput({
  value,
  onChange,
  onDuplicataEncontrada,
  label = "CPF",
  required = true,
  disabled = false,
}: SmartCPFInputProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "valid" | "invalid" | "duplicate">("idle");
  const [duplicata, setDuplicata] = useState<Diplomado | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const checkCPF = useCallback(async (cpf: string) => {
    const limpo = cpf.replace(/\D/g, "");
    if (limpo.length !== 11) return;

    if (!validarCPF(limpo)) {
      setStatus("invalid");
      setErrorMsg("CPF inválido. Verifique os dígitos.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/diplomados?cpf=${limpo}`);
      const data = await res.json();

      if (data && data.length > 0) {
        setStatus("duplicate");
        setDuplicata(data[0]);
        onDuplicataEncontrada?.(data[0]);
      } else {
        setStatus("valid");
        setDuplicata(null);
      }
    } catch {
      setStatus("valid"); // em caso de erro, deixa prosseguir
    } finally {
      setLoading(false);
    }
  }, [onDuplicataEncontrada]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCPF(e.target.value);
    onChange(formatted);
    setStatus("idle");
    setDuplicata(null);
    setErrorMsg("");

    const limpo = formatted.replace(/\D/g, "");
    if (limpo.length === 11) {
      checkCPF(formatted);
    }
  }

  const borderClass = {
    idle: "border-gray-300",
    valid: "border-green-400 bg-green-50",
    invalid: "border-red-400 bg-red-50",
    duplicate: "border-yellow-400 bg-yellow-50",
  }[status];

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder="000.000.000-00"
          disabled={disabled}
          className={`w-full border rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors ${borderClass} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        />
        <div className="absolute right-3 top-2.5">
          {loading && <Loader2 size={16} className="text-gray-400 animate-spin" />}
          {!loading && status === "valid" && <CheckCircle2 size={16} className="text-green-500" />}
          {!loading && status === "invalid" && <XCircle size={16} className="text-red-500" />}
          {!loading && status === "duplicate" && <AlertCircle size={16} className="text-yellow-500" />}
          {!loading && status === "idle" && value.replace(/\D/g,"").length > 0 && (
            <Search size={16} className="text-gray-300" />
          )}
        </div>
      </div>

      {/* Feedback de status */}
      {status === "valid" && (
        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
          <CheckCircle2 size={12} /> CPF válido e disponível
        </p>
      )}
      {status === "invalid" && (
        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
          <XCircle size={12} /> {errorMsg}
        </p>
      )}
      {status === "duplicate" && duplicata && (
        <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <UserCheck size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-yellow-800">CPF já cadastrado</p>
              <p className="text-xs text-yellow-700 mt-0.5">
                {duplicata.nome} — RA: {duplicata.ra || "—"}
              </p>
              <p className="text-xs text-yellow-600">{duplicata.email}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
