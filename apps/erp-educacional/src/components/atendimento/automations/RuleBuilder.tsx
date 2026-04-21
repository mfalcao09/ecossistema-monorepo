"use client";

import { useState } from "react";
import { Plus, Trash2, Play } from "lucide-react";

const EVENTS = [
  { value: "message_received", label: "Mensagem recebida" },
  { value: "conversation_created", label: "Conversa criada" },
  { value: "conversation_status_changed", label: "Status da conversa mudou" },
  { value: "tag_added", label: "Etiqueta adicionada" },
  { value: "deal_stage_changed", label: "Negócio mudou de etapa" },
  { value: "scheduled_message_sent", label: "Mensagem agendada enviada" },
  { value: "time_elapsed", label: "Tempo decorrido" },
];

const OPERATORS = [
  { value: "equals", label: "igual a" },
  { value: "not_equals", label: "diferente de" },
  { value: "contains", label: "contém (use | para múltiplas palavras)" },
  { value: "regex_match", label: "casa regex" },
  { value: "gt", label: "maior que" },
  { value: "lt", label: "menor que" },
  { value: "in", label: "está em (JSON array)" },
  { value: "has_tag", label: "tem etiqueta (label_id)" },
  { value: "queue_is", label: "fila é (queue_id)" },
  { value: "time_since", label: "tempo desde (minutos)" },
];

const ACTIONS = [
  { value: "assign_agent", label: "Atribuir agente" },
  { value: "set_queue", label: "Definir fila" },
  { value: "add_tag", label: "Adicionar etiqueta" },
  { value: "remove_tag", label: "Remover etiqueta" },
  { value: "create_deal", label: "Criar negócio" },
  { value: "move_deal_stage", label: "Mover etapa do negócio" },
  { value: "send_message", label: "Enviar mensagem" },
  { value: "trigger_n8n", label: "Disparar fluxo n8n" },
  { value: "call_webhook", label: "Chamar webhook externo" },
];

export type Condition = { field: string; op: string; value: unknown };
export type Action = { type: string; [k: string]: unknown };

export type RuleDraft = {
  name: string;
  description: string;
  event_name: string;
  conditions: Condition[];
  conditions_logic: "AND" | "OR";
  actions: Action[];
  active: boolean;
};

export function emptyDraft(): RuleDraft {
  return {
    name: "",
    description: "",
    event_name: "message_received",
    conditions: [],
    conditions_logic: "AND",
    actions: [],
    active: true,
  };
}

type Props = {
  initial?: RuleDraft;
  onSubmit: (draft: RuleDraft) => void | Promise<void>;
  onCancel: () => void;
  onTest?: () => void | Promise<void>;
  submitLabel?: string;
};

export function RuleBuilder({ initial, onSubmit, onCancel, onTest, submitLabel = "Salvar" }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [draft, setDraft] = useState<RuleDraft>(initial ?? emptyDraft());

  const addCondition = () => setDraft((d) => ({
    ...d,
    conditions: [...d.conditions, { field: "message.content", op: "contains", value: "" }],
  }));
  const rmCondition = (i: number) => setDraft((d) => ({
    ...d,
    conditions: d.conditions.filter((_, idx) => idx !== i),
  }));
  const updCondition = (i: number, patch: Partial<Condition>) => setDraft((d) => ({
    ...d,
    conditions: d.conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
  }));

  const addAction = () => setDraft((d) => ({
    ...d,
    actions: [...d.actions, { type: "add_tag" }],
  }));
  const rmAction = (i: number) => setDraft((d) => ({
    ...d,
    actions: d.actions.filter((_, idx) => idx !== i),
  }));
  const updAction = (i: number, patch: Partial<Action>) => setDraft((d) => ({
    ...d,
    actions: d.actions.map((a, idx) => (idx === i ? { ...a, ...patch } : a)),
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        {[1, 2, 3].map((n) => (
          <div key={n} className={`flex-1 h-1.5 rounded-full ${n <= step ? "bg-green-500" : "bg-gray-200"}`} />
        ))}
      </div>
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
        Passo {step} / 3 — {step === 1 ? "Gatilho" : step === 2 ? "Condições" : "Ações"}
      </div>

      {/* Step 1 — Gatilho */}
      {step === 1 && (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600">Nome</label>
            <input
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Ex: Auto-criar deal em msg 'matrícula'"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Descrição</label>
            <input
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Gatilho (evento)</label>
            <select
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={draft.event_name}
              onChange={(e) => setDraft({ ...draft, event_name: e.target.value })}
            >
              {EVENTS.map((e) => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Step 2 — Condições */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-600">Lógica:</span>
            <select
              className="px-2 py-1 border border-gray-300 rounded text-xs"
              value={draft.conditions_logic}
              onChange={(e) => setDraft({ ...draft, conditions_logic: e.target.value as "AND" | "OR" })}
            >
              <option value="AND">TODAS (AND)</option>
              <option value="OR">QUALQUER (OR)</option>
            </select>
          </div>

          {draft.conditions.length === 0 && (
            <p className="text-xs text-gray-400 italic">Sem condições — a regra dispara em todo evento.</p>
          )}

          {draft.conditions.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs font-mono"
                value={c.field}
                placeholder="message.content"
                onChange={(e) => updCondition(i, { field: e.target.value })}
              />
              <select
                className="px-2 py-1.5 border border-gray-300 rounded text-xs"
                value={c.op}
                onChange={(e) => updCondition(i, { op: e.target.value })}
              >
                {OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
              <input
                className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs"
                value={String(c.value ?? "")}
                onChange={(e) => updCondition(i, { value: e.target.value })}
                placeholder="valor"
              />
              <button onClick={() => rmCondition(i)} className="text-gray-400 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            onClick={addCondition}
            className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 font-medium"
          >
            <Plus size={13} /> Adicionar condição
          </button>
        </div>
      )}

      {/* Step 3 — Ações */}
      {step === 3 && (
        <div className="space-y-3">
          {draft.actions.length === 0 && (
            <p className="text-xs text-gray-400 italic">Adicione pelo menos uma ação.</p>
          )}

          {draft.actions.map((a, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <select
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs"
                  value={a.type}
                  onChange={(e) => updAction(i, { type: e.target.value })}
                >
                  {ACTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <button onClick={() => rmAction(i)} className="text-gray-400 hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
              <ActionParams action={a} onChange={(patch) => updAction(i, patch)} />
            </div>
          ))}
          <button
            onClick={addAction}
            className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 font-medium"
          >
            <Plus size={13} /> Adicionar ação
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">
          Cancelar
        </button>
        <div className="flex items-center gap-2">
          {step > 1 && (
            <button
              onClick={() => setStep((step - 1) as 1 | 2)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Voltar
            </button>
          )}
          {step < 3 && (
            <button
              onClick={() => setStep((step + 1) as 2 | 3)}
              disabled={step === 1 && !draft.name}
              className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Avançar
            </button>
          )}
          {step === 3 && (
            <>
              {onTest && (
                <button
                  onClick={() => onTest()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50"
                >
                  <Play size={13} /> Testar (dry-run)
                </button>
              )}
              <button
                onClick={() => onSubmit(draft)}
                disabled={draft.actions.length === 0}
                className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {submitLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionParams({ action, onChange }: { action: Action; onChange: (patch: Partial<Action>) => void }) {
  const t = action.type;
  if (t === "add_tag" || t === "remove_tag") {
    return (
      <input
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs font-mono"
        placeholder="label_id (uuid de atendimento_labels)"
        value={String(action.label_id ?? "")}
        onChange={(e) => onChange({ label_id: e.target.value })}
      />
    );
  }
  if (t === "set_queue") {
    return (
      <input
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs font-mono"
        placeholder="queue_id (uuid)"
        value={String(action.queue_id ?? "")}
        onChange={(e) => onChange({ queue_id: e.target.value })}
      />
    );
  }
  if (t === "assign_agent") {
    return (
      <>
        <input
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs font-mono"
          placeholder="agent_id direto (ou deixe vazio e use round_robin)"
          value={String(action.agent_id ?? "")}
          onChange={(e) => onChange({ agent_id: e.target.value || undefined })}
        />
        <input
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs font-mono mt-1"
          placeholder="round_robin: queue_id"
          value={String(action.round_robin ?? "")}
          onChange={(e) => onChange({ round_robin: e.target.value || undefined })}
        />
      </>
    );
  }
  if (t === "create_deal") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <input
          className="px-2 py-1.5 border border-gray-300 rounded text-xs font-mono"
          placeholder="pipeline_id"
          value={String(action.pipeline_id ?? "")}
          onChange={(e) => onChange({ pipeline_id: e.target.value })}
        />
        <input
          className="px-2 py-1.5 border border-gray-300 rounded text-xs font-mono"
          placeholder="stage_id"
          value={String(action.stage_id ?? "")}
          onChange={(e) => onChange({ stage_id: e.target.value })}
        />
        <input
          className="col-span-2 px-2 py-1.5 border border-gray-300 rounded text-xs"
          placeholder="Título (opcional — default: nome do contato)"
          value={String(action.title ?? "")}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </div>
    );
  }
  if (t === "move_deal_stage") {
    return (
      <input
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs font-mono"
        placeholder="new_stage_id"
        value={String(action.new_stage_id ?? "")}
        onChange={(e) => onChange({ new_stage_id: e.target.value })}
      />
    );
  }
  if (t === "send_message") {
    return (
      <div className="space-y-1">
        <input
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
          placeholder="Texto (ou use template_id)"
          value={String(action.text ?? "")}
          onChange={(e) => onChange({ text: e.target.value || undefined })}
        />
        <input
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs font-mono"
          placeholder="template_id (opcional)"
          value={String(action.template_id ?? "")}
          onChange={(e) => onChange({ template_id: e.target.value || undefined })}
        />
      </div>
    );
  }
  if (t === "trigger_n8n") {
    return (
      <input
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs font-mono"
        placeholder="integration_id (n8n_integrations.id)"
        value={String(action.integration_id ?? "")}
        onChange={(e) => onChange({ integration_id: e.target.value })}
      />
    );
  }
  if (t === "call_webhook") {
    return (
      <input
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
        placeholder="URL completa (https://...)"
        value={String(action.url ?? "")}
        onChange={(e) => onChange({ url: e.target.value })}
      />
    );
  }
  return null;
}
