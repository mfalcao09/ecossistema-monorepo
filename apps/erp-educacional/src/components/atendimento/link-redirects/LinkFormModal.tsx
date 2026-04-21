"use client";

import { useEffect, useState } from "react";
import { X, Plus, Trash2, GripVertical } from "lucide-react";
import type { DistributionMode, LinkNumber, LinkRedirect } from "./types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing: LinkRedirect | null;
}

const DEFAULT_HOUR_RANGES = ["0-8", "8-12", "12-18", "18-24"];

export default function LinkFormModal({ open, onClose, onSaved, editing }: Props) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [greeting, setGreeting] = useState("");
  const [active, setActive] = useState(true);
  const [distribution, setDistribution] = useState<DistributionMode>("sequential");
  const [numbers, setNumbers] = useState<LinkNumber[]>([{ number: "", label: "", weight: 1, active: true }]);
  const [order, setOrder] = useState<number[]>([]);
  const [ranges, setRanges] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setSlug(editing.slug);
      setName(editing.name);
      setGreeting(editing.greeting ?? "");
      setActive(editing.active);
      setDistribution(editing.distribution);
      setNumbers(editing.numbers.length ? editing.numbers : [{ number: "", label: "", weight: 1, active: true }]);
      setOrder(editing.schedule_config.order ?? []);
      setRanges(editing.schedule_config.ranges ?? {});
    } else {
      setSlug("");
      setName("");
      setGreeting("");
      setActive(true);
      setDistribution("sequential");
      setNumbers([{ number: "", label: "", weight: 1, active: true }]);
      setOrder([]);
      setRanges({});
    }
  }, [open, editing]);

  if (!open) return null;

  const updateNumber = (i: number, patch: Partial<LinkNumber>) => {
    setNumbers((prev) => prev.map((n, idx) => (idx === i ? { ...n, ...patch } : n)));
  };
  const addNumber = () =>
    setNumbers((prev) => [...prev, { number: "", label: "", weight: 1, active: true }]);
  const removeNumber = (i: number) =>
    setNumbers((prev) => prev.filter((_, idx) => idx !== i));

  const moveOrder = (i: number, dir: -1 | 1) => {
    setOrder((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const handleSave = async () => {
    setError(null);
    if (!slug.trim() || !name.trim()) {
      setError("slug e nome obrigatórios.");
      return;
    }
    const cleanNumbers = numbers
      .map((n) => ({
        number: n.number.replace(/\D/g, ""),
        label: n.label?.trim() || undefined,
        weight: n.weight ?? 1,
        active: n.active !== false,
      }))
      .filter((n) => n.number.length >= 10);
    if (cleanNumbers.length === 0) {
      setError("Adicione ao menos 1 número válido (10-15 dígitos).");
      return;
    }

    const schedule_config: Record<string, unknown> = {};
    if (distribution === "ordered") schedule_config.order = order.length ? order : cleanNumbers.map((_, i) => i);
    if (distribution === "by_hour") {
      schedule_config.ranges = ranges;
      schedule_config.tz = "America/Sao_Paulo";
    }

    setSaving(true);
    try {
      const payload = {
        slug: slug.trim().toLowerCase(),
        name: name.trim(),
        greeting: greeting.trim() || null,
        numbers: cleanNumbers,
        distribution,
        schedule_config,
        active,
      };
      const url = editing
        ? `/api/atendimento/link-redirects/${editing.id}`
        : "/api/atendimento/link-redirects";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.erro ?? "Erro ao salvar.");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">
            {editing ? "Editar link" : "Novo link de redirecionamento"}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <X size={16} />
          </button>
        </header>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700">Slug (URL)</label>
              <div className="flex items-center mt-1">
                <span className="text-xs text-gray-400 mr-1">/l/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  placeholder="atendimento"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-300 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700">Nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Landing FIC 2026"
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-300"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700">Mensagem pré-preenchida (opcional)</label>
            <textarea
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              placeholder="Olá! Tenho interesse em saber mais sobre..."
              rows={2}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-300"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-700">Números (WhatsApp)</label>
              <button
                onClick={addNumber}
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <Plus size={11} /> Adicionar
              </button>
            </div>
            <div className="space-y-2">
              {numbers.map((n, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <span className="text-[10px] font-mono text-gray-400 w-6">#{i}</span>
                  <input
                    type="text"
                    value={n.number}
                    onChange={(e) => updateNumber(i, { number: e.target.value })}
                    placeholder="556799999999"
                    className="flex-1 min-w-0 border border-gray-200 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-indigo-300"
                  />
                  <input
                    type="text"
                    value={n.label ?? ""}
                    onChange={(e) => updateNumber(i, { label: e.target.value })}
                    placeholder="Rótulo"
                    className="w-28 border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-300"
                  />
                  {distribution === "random" && (
                    <input
                      type="number"
                      value={n.weight ?? 1}
                      min={1}
                      onChange={(e) => updateNumber(i, { weight: Number(e.target.value) })}
                      className="w-14 border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-300"
                      title="Peso (random)"
                    />
                  )}
                  <label className="flex items-center gap-1 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={n.active !== false}
                      onChange={(e) => updateNumber(i, { active: e.target.checked })}
                    />
                    ativo
                  </label>
                  <button
                    onClick={() => removeNumber(i)}
                    className="text-gray-400 hover:text-red-600"
                    title="Remover"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700 mb-2 block">Distribuição</label>
            <div className="grid grid-cols-4 gap-2">
              {([
                { v: "sequential", title: "Sequencial", desc: "Round-robin" },
                { v: "random", title: "Aleatório", desc: "Ponderado" },
                { v: "ordered", title: "Ordem fixa", desc: "Lista ordenada" },
                { v: "by_hour", title: "Por horário", desc: "Faixa do dia" },
              ] as const).map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setDistribution(opt.v)}
                  className={`p-2 rounded-lg border text-left transition-colors ${
                    distribution === opt.v ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <p className="text-xs font-bold">{opt.title}</p>
                  <p className="text-[10px] text-gray-500">{opt.desc}</p>
                </button>
              ))}
            </div>

            {distribution === "ordered" && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-1">
                <p className="text-xs font-semibold text-gray-700 mb-1">Ordem (primeiro ativo vence)</p>
                {(order.length ? order : numbers.map((_, i) => i)).map((idx, i) => (
                  <div key={`${idx}-${i}`} className="flex items-center gap-2 text-xs">
                    <GripVertical size={11} className="text-gray-400" />
                    <span className="flex-1">
                      #{idx} {numbers[idx]?.label ? `(${numbers[idx].label})` : ""}
                    </span>
                    <button onClick={() => moveOrder(i, -1)} className="text-gray-400 hover:text-gray-900">↑</button>
                    <button onClick={() => moveOrder(i, 1)} className="text-gray-400 hover:text-gray-900">↓</button>
                  </div>
                ))}
                {order.length === 0 && (
                  <button
                    onClick={() => setOrder(numbers.map((_, i) => i))}
                    className="text-xs text-indigo-600 mt-1"
                  >
                    Definir ordem agora
                  </button>
                )}
              </div>
            )}

            {distribution === "by_hour" && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-2">
                <p className="text-xs font-semibold text-gray-700">Faixa horária → número (America/Sao_Paulo)</p>
                {DEFAULT_HOUR_RANGES.map((range) => (
                  <div key={range} className="flex items-center gap-2 text-xs">
                    <span className="w-16 font-mono">{range}h</span>
                    <select
                      value={ranges[range] ?? ""}
                      onChange={(e) =>
                        setRanges((prev) => ({
                          ...prev,
                          [range]: Number(e.target.value),
                        }))
                      }
                      className="border border-gray-200 rounded px-2 py-1 text-xs"
                    >
                      <option value="">Selecione</option>
                      {numbers.map((n, i) => (
                        <option key={i} value={i}>
                          #{i} {n.label || n.number}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Link ativo
          </label>

          {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>}
        </div>

        <footer className="p-3 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-sm bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 rounded-lg"
          >
            {saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar link"}
          </button>
        </footer>
      </div>
    </div>
  );
}
