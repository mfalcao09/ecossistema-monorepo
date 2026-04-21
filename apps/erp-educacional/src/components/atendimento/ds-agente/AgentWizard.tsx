"use client";

import { useState } from "react";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Bot,
  SlidersHorizontal,
  Tag,
  CheckCircle2,
} from "lucide-react";

interface Label {
  id: string;
  title: string;
  color: string;
}

interface WizardData {
  name: string;
  description: string;
  model: string;
  system_prompt: string;
  temperature: number;
  max_tokens: number;
  max_history: number;
  delay_seconds: number;
  split_messages: boolean;
  process_images: boolean;
  handoff_on_human: boolean;
  handoff_keywords: string[];
  activation_tags: string[];
  tag_logic: "AND" | "OR";
  channels: string[];
  enabled: boolean;
}

interface AgentWizardProps {
  labels: Label[];
  onSave: (data: WizardData) => Promise<void>;
  onClose: () => void;
  initial?: Partial<WizardData>;
  editMode?: boolean;
}

const DEFAULT_SYSTEM_PROMPT = `Você é a assistente virtual da Secretaria da FIC — Faculdades Integradas de Cassilândia.
Responda com cordialidade e objetividade às dúvidas dos alunos sobre matrícula, grade curricular, calendário acadêmico e regulamento.
Seja sempre claro e direto. Se não souber a resposta ou o assunto for muito específico, oriente o aluno a falar com um atendente.
Nunca prometa descontos, preços específicos ou prazos que não estejam na base de conhecimento.`;

const TEMPLATES = [
  { label: "Secretaria FIC (padrão)", value: DEFAULT_SYSTEM_PROMPT },
  {
    label: "Suporte Financeiro",
    value: `Você é assistente de suporte financeiro da FIC. Ajude alunos com dúvidas sobre mensalidades, boletos e negociações. Nunca confirme valores específicos sem consultar o setor financeiro.`,
  },
  {
    label: "Orientação Acadêmica",
    value: `Você é orientador acadêmico virtual da FIC. Ajude alunos com dúvidas sobre disciplinas, grades curriculares, TCC e estágios. Encaminhe casos de trancamento ou jubilamento para a secretaria.`,
  },
];

const STEPS = [
  { label: "Identidade", icon: Bot },
  { label: "Prompt", icon: Bot },
  { label: "Parâmetros", icon: SlidersHorizontal },
  { label: "Ativação", icon: Tag },
];

export function AgentWizard({
  labels,
  onSave,
  onClose,
  initial,
  editMode = false,
}: AgentWizardProps) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [data, setData] = useState<WizardData>({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    model: initial?.model ?? "gpt-4o-mini",
    system_prompt: initial?.system_prompt ?? DEFAULT_SYSTEM_PROMPT,
    temperature: initial?.temperature ?? 0.7,
    max_tokens: initial?.max_tokens ?? 200,
    max_history: initial?.max_history ?? 10,
    delay_seconds: initial?.delay_seconds ?? 2,
    split_messages: initial?.split_messages ?? true,
    process_images: initial?.process_images ?? false,
    handoff_on_human: initial?.handoff_on_human ?? true,
    handoff_keywords: initial?.handoff_keywords ?? [
      "falar com atendente",
      "humano",
      "pessoa real",
    ],
    activation_tags: initial?.activation_tags ?? [],
    tag_logic: initial?.tag_logic ?? "OR",
    channels: initial?.channels ?? ["whatsapp"],
    enabled: initial?.enabled ?? false,
  });

  function set<K extends keyof WizardData>(key: K, value: WizardData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  function toggleTag(id: string) {
    set(
      "activation_tags",
      data.activation_tags.includes(id)
        ? data.activation_tags.filter((t) => t !== id)
        : [...data.activation_tags, id],
    );
  }

  function toggleChannel(ch: string) {
    set(
      "channels",
      data.channels.includes(ch)
        ? data.channels.filter((c) => c !== ch)
        : [...data.channels, ch],
    );
  }

  async function handleSave() {
    if (!data.name.trim()) {
      setError("Nome é obrigatório");
      setStep(0);
      return;
    }
    if (!data.system_prompt.trim()) {
      setError("System prompt é obrigatório");
      setStep(1);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(data);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const canNext = [
    data.name.trim().length > 0,
    data.system_prompt.trim().length > 0,
    true,
    true,
  ];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {editMode ? "Editar Agente IA" : "Novo Agente IA"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              DS Agente — GPT-4o + RAG
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        {/* Steps */}
        <div className="flex border-b border-gray-100">
          {STEPS.map((s, i) => (
            <button
              key={i}
              onClick={() =>
                i < step || canNext[step] ? setStep(i) : undefined
              }
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                i === step
                  ? "border-b-2 border-indigo-600 text-indigo-600"
                  : i < step
                    ? "text-green-600"
                    : "text-gray-400"
              }`}
            >
              {i < step ? (
                <CheckCircle2 size={16} className="text-green-500" />
              ) : (
                <s.icon size={16} />
              )}
              {s.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Step 0 — Identidade */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Nome do agente *
                </label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Ex: FIC Secretaria"
                  value={data.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Descrição
                </label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  rows={2}
                  placeholder="Descreva o propósito deste agente"
                  value={data.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Modelo LLM
                </label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={data.model}
                  onChange={(e) => set("model", e.target.value)}
                >
                  <option value="gpt-4o-mini">
                    GPT-4o mini (recomendado — custo baixo)
                  </option>
                  <option value="gpt-4o">
                    GPT-4o (maior qualidade — custo maior)
                  </option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo (legado)</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 1 — System prompt */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Template pré-definido
                </label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  onChange={(e) => {
                    if (e.target.value) set("system_prompt", e.target.value);
                  }}
                  defaultValue=""
                >
                  <option value="">— Selecionar template —</option>
                  {TEMPLATES.map((t) => (
                    <option key={t.label} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  System prompt *
                  <span className="font-normal text-gray-400 ml-2">
                    (a base de conhecimento RAG é injetada automaticamente)
                  </span>
                </label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono resize-y"
                  rows={10}
                  value={data.system_prompt}
                  onChange={(e) => set("system_prompt", e.target.value)}
                  placeholder="Você é..."
                />
                <p className="text-xs text-gray-400 mt-1">
                  {data.system_prompt.length} chars · ~
                  {Math.ceil(data.system_prompt.length / 4)} tokens
                </p>
              </div>
            </div>
          )}

          {/* Step 2 — Parâmetros */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Temperature{" "}
                    <span className="font-normal text-gray-400">
                      ({data.temperature})
                    </span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1.5}
                    step={0.1}
                    value={data.temperature}
                    onChange={(e) =>
                      set("temperature", parseFloat(e.target.value))
                    }
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>Preciso</span>
                    <span>Criativo</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Máx. tokens resposta
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={2000}
                    step={50}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    value={data.max_tokens}
                    onChange={(e) =>
                      set("max_tokens", parseInt(e.target.value))
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Histórico de mensagens
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    value={data.max_history}
                    onChange={(e) =>
                      set("max_history", parseInt(e.target.value))
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Delay antes de enviar (s)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    value={data.delay_seconds}
                    onChange={(e) =>
                      set("delay_seconds", parseInt(e.target.value))
                    }
                  />
                </div>
              </div>

              <div className="space-y-3">
                {[
                  {
                    key: "split_messages" as const,
                    label: "Quebrar resposta em múltiplas mensagens",
                    sub: "Simula digitação humana",
                  },
                  {
                    key: "handoff_on_human" as const,
                    label: "Hand-off quando atendente humano responder",
                    sub: "Desativa IA por 60 min após resposta humana",
                  },
                  {
                    key: "process_images" as const,
                    label: "Processar imagens (Vision)",
                    sub: "Envia imagens recebidas ao GPT-4o Vision",
                  },
                ].map(({ key, label, sub }) => (
                  <label
                    key={key}
                    className="flex items-start gap-3 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={data[key] as boolean}
                      onChange={(e) => set(key, e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                        {label}
                      </p>
                      <p className="text-xs text-gray-400">{sub}</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Keywords de hand-off */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Palavras-chave para hand-off
                  <span className="font-normal text-gray-400 ml-2">
                    (uma por linha)
                  </span>
                </label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  rows={3}
                  value={data.handoff_keywords.join("\n")}
                  onChange={(e) =>
                    set(
                      "handoff_keywords",
                      e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </div>
            </div>
          )}

          {/* Step 3 — Ativação */}
          {step === 3 && (
            <div className="space-y-5">
              {/* Canais */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Canais ativos
                </label>
                <div className="flex flex-wrap gap-2">
                  {["whatsapp", "instagram", "telegram", "email"].map((ch) => (
                    <button
                      key={ch}
                      onClick={() => toggleChannel(ch)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-colors ${
                        data.channels.includes(ch)
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags de ativação */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-700">
                    Tags de ativação
                    <span className="font-normal text-gray-400 ml-2">
                      (vazio = qualquer conversa)
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Lógica:</span>
                    {(["OR", "AND"] as const).map((l) => (
                      <button
                        key={l}
                        onClick={() => set("tag_logic", l)}
                        className={`px-2 py-0.5 rounded text-xs font-bold transition-colors ${
                          data.tag_logic === l
                            ? "bg-indigo-600 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {labels.map((lb) => (
                    <label
                      key={lb.id}
                      className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={data.activation_tags.includes(lb.id)}
                        onChange={() => toggleTag(lb.id)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: lb.color }}
                      />
                      <span className="text-sm text-gray-700">{lb.title}</span>
                    </label>
                  ))}
                </div>
                {data.activation_tags.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Ativa quando a conversa tiver{" "}
                    {data.tag_logic === "OR" ? "qualquer" : "todas as"} tag(s)
                    selecionada(s).
                  </p>
                )}
              </div>

              {/* Ativar imediatamente */}
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-indigo-200 bg-indigo-50">
                <input
                  type="checkbox"
                  checked={data.enabled}
                  onChange={(e) => set("enabled", e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <p className="text-sm font-semibold text-indigo-900">
                    Ativar agente ao salvar
                  </p>
                  <p className="text-xs text-indigo-600 mt-0.5">
                    Recomendado deixar desativado até validar no Playground.
                  </p>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <button
            onClick={() => (step > 0 ? setStep(step - 1) : onClose())}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ChevronLeft size={16} />
            {step === 0 ? "Cancelar" : "Anterior"}
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => (canNext[step] ? setStep(step + 1) : undefined)}
              disabled={!canNext[step]}
              className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              Próximo <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              {saving
                ? "Salvando…"
                : editMode
                  ? "Salvar alterações"
                  : "Criar agente"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
