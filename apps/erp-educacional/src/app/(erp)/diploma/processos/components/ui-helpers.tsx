"use client";

import { ChevronDown, ChevronUp, Sparkles, AlertTriangle } from "lucide-react";
import type { CampoIA } from "../types";

// ── Seção colapsável ────────────────────────────────────────────────────────
interface SecaoProps {
  id: string;
  titulo: string;
  icone: React.ReactNode;
  aberta: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
  badge?: string;
  readonly?: boolean;
}

export function Secao({ id, titulo, icone, aberta, onToggle, children, badge, readonly }: SecaoProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icone}
          <span className="text-sm font-bold text-gray-800">{titulo}</span>
          {readonly && (
            <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-medium">
              Auto-preenchido
            </span>
          )}
          {badge && (
            <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
              {badge}
            </span>
          )}
        </div>
        {aberta ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {aberta && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Campo de input com sugestão IA ──────────────────────────────────────────
interface CampoInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  obrigatorio?: boolean;
  tipo?: "text" | "date" | "email" | "tel" | "time";
  placeholder?: string;
  sugestaoIA?: CampoIA;
  readonly?: boolean;
  destaque?: boolean;  // amarelo para campos pendentes
  mascara?: string;
}

export function CampoInput({
  label, value, onChange, obrigatorio, tipo = "text",
  placeholder, sugestaoIA, readonly, destaque
}: CampoInputProps) {
  const borderClass = destaque && !value
    ? "border-amber-400 bg-amber-50/50"
    : readonly
    ? "border-gray-200 bg-gray-50"
    : "border-gray-300";

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">
        {label} {obrigatorio && <span className="text-red-500">*</span>}
        {destaque && !value && (
          <AlertTriangle size={10} className="inline ml-1 text-amber-500" />
        )}
      </label>
      <input
        type={tipo}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readonly}
        className={`w-full border ${borderClass} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 ${readonly ? "cursor-not-allowed text-gray-500" : ""}`}
      />
      {sugestaoIA?.valor && (
        <p className="text-xs text-violet-500 mt-1 flex items-center gap-1">
          <Sparkles size={10} /> IA: {sugestaoIA.valor} ({sugestaoIA.confianca}%)
        </p>
      )}
    </div>
  );
}

// ── Campo select ────────────────────────────────────────────────────────────
interface CampoSelectProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  opcoes: { valor: string; label: string }[];
  obrigatorio?: boolean;
  placeholder?: string;
  sugestaoIA?: CampoIA;
  readonly?: boolean;
}

export function CampoSelect({
  label, value, onChange, opcoes, obrigatorio,
  placeholder, sugestaoIA, readonly
}: CampoSelectProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">
        {label} {obrigatorio && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={readonly}
        className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 ${readonly ? "bg-gray-50 cursor-not-allowed text-gray-500" : ""}`}
      >
        <option value="">{placeholder || "Selecione"}</option>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>{o.label}</option>
        ))}
      </select>
      {sugestaoIA?.valor && (
        <p className="text-xs text-violet-500 mt-1 flex items-center gap-1">
          <Sparkles size={10} /> IA: {sugestaoIA.valor} ({sugestaoIA.confianca}%)
        </p>
      )}
    </div>
  );
}

// ── Campo somente leitura (para seções auto-preenchidas) ────────────────────
interface CampoReadonlyProps {
  label: string;
  value?: string;
  obrigatorio?: boolean;
}

export function CampoReadonly({ label, value, obrigatorio }: CampoReadonlyProps) {
  const vazio = !value || value.trim() === "";
  return (
    <div className={`p-3 rounded-lg border ${vazio && obrigatorio ? "border-red-200 bg-red-50/50" : "border-gray-200 bg-gray-50"}`}>
      <p className="text-xs font-semibold text-gray-500 mb-1">
        {label} {obrigatorio && <span className="text-red-500">*</span>}
      </p>
      {vazio ? (
        <p className="text-sm text-red-400 italic">
          {obrigatorio ? "⚠ Preencher no cadastro" : "—"}
        </p>
      ) : (
        <p className="text-sm font-medium text-gray-700">{value}</p>
      )}
    </div>
  );
}

// ── Card de campo extraído (com confiança) ──────────────────────────────────
interface CampoExtraidoProps {
  label: string;
  dado?: CampoIA;
}

export function CampoExtraido({ label, dado }: CampoExtraidoProps) {
  return (
    <div className={`p-3 rounded-lg border ${dado?.valor ? "border-emerald-200 bg-emerald-50/50" : "border-gray-200 bg-gray-50"}`}>
      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
      {dado?.valor ? (
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-800">{dado.valor}</p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
            dado.confianca >= 80 ? "bg-emerald-100 text-emerald-600" :
            dado.confianca >= 60 ? "bg-amber-100 text-amber-600" :
            "bg-red-100 text-red-600"
          }`}>
            {dado.confianca}%
          </span>
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">Não extraído</p>
      )}
    </div>
  );
}

// ── UF options ──────────────────────────────────────────────────────────────
export const UF_OPTIONS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
].map(uf => ({ valor: uf, label: uf }));

// ── Sexo options ────────────────────────────────────────────────────────────
export const SEXO_OPTIONS = [
  { valor: "Masculino", label: "Masculino" },
  { valor: "Feminino", label: "Feminino" },
];

// ── Modalidade options ──────────────────────────────────────────────────────
export const MODALIDADE_OPTIONS = [
  { valor: "Presencial", label: "Presencial" },
  { valor: "EaD", label: "EaD" },
  { valor: "Semipresencial", label: "Semipresencial" },
];

// ── Turno options ───────────────────────────────────────────────────────────
export const TURNO_OPTIONS = [
  { valor: "Matutino", label: "Matutino" },
  { valor: "Vespertino", label: "Vespertino" },
  { valor: "Noturno", label: "Noturno" },
  { valor: "Integral", label: "Integral" },
];
