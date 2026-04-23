"use client";

import {
  NODE_LABELS,
  type DsBotNode,
  type DsBotNodeType,
  type ConditionalClause,
  type ConditionalOperator,
} from "@/lib/atendimento/ds-bot-types";

interface Props {
  node: DsBotNode | null;
  onChange: (updater: (data: DsBotNode["data"]) => DsBotNode["data"]) => void;
  onDelete: () => void;
}

export default function NodeConfigDrawer({ node, onChange, onDelete }: Props) {
  if (!node) {
    return (
      <aside className="w-80 shrink-0 border-l border-gray-200 bg-gray-50 p-4 overflow-y-auto">
        <p className="text-sm text-gray-500">Selecione um node para editar.</p>
      </aside>
    );
  }

  const setField = (key: string, value: unknown) => {
    onChange(
      (d) =>
        ({
          ...(d as Record<string, unknown>),
          [key]: value,
        }) as DsBotNode["data"],
    );
  };

  return (
    <aside className="w-80 shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">{node.type}</div>
          <div className="text-sm font-semibold">
            {NODE_LABELS[node.type as DsBotNodeType] ?? node.type}
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="text-xs text-red-600 hover:text-red-700 border border-red-200 rounded px-2 py-1"
        >
          Remover
        </button>
      </div>
      <div className="p-4 space-y-3">
        <NodeForm node={node} setField={setField} />
      </div>
    </aside>
  );
}

function NodeForm({
  node,
  setField,
}: {
  node: DsBotNode;
  setField: (k: string, v: unknown) => void;
}) {
  const t = node.type as DsBotNodeType;
  const d = node.data as Record<string, unknown>;

  const TextArea = ({
    label,
    field,
    placeholder,
  }: {
    label: string;
    field: string;
    placeholder?: string;
  }) => (
    <Field label={label}>
      <textarea
        value={String(d[field] ?? "")}
        onChange={(e) => setField(field, e.target.value)}
        placeholder={placeholder}
        className="w-full border rounded px-2 py-1 text-sm"
        rows={4}
      />
    </Field>
  );
  const TextInput = ({
    label,
    field,
    placeholder,
  }: {
    label: string;
    field: string;
    placeholder?: string;
  }) => (
    <Field label={label}>
      <input
        value={String(d[field] ?? "")}
        onChange={(e) => setField(field, e.target.value)}
        placeholder={placeholder}
        className="w-full border rounded px-2 py-1 text-sm"
      />
    </Field>
  );
  const NumberInput = ({ label, field }: { label: string; field: string }) => (
    <Field label={label}>
      <input
        type="number"
        value={Number(d[field] ?? 0) || ""}
        onChange={(e) =>
          setField(
            field,
            e.target.value === "" ? undefined : Number(e.target.value),
          )
        }
        className="w-full border rounded px-2 py-1 text-sm"
      />
    </Field>
  );

  // ── Bubbles ──
  if (t === "bubble_text")
    return <TextArea label="Texto (usa {{variavel}})" field="text" />;
  if (t === "bubble_image")
    return (
      <>
        <TextInput
          label="URL da imagem"
          field="url"
          placeholder="https://..."
        />
        <TextInput label="Legenda (opcional)" field="caption" />
      </>
    );
  if (t === "bubble_video")
    return (
      <>
        <TextInput label="URL do vídeo" field="url" />
        <TextInput label="Legenda (opcional)" field="caption" />
      </>
    );
  if (t === "bubble_audio")
    return (
      <>
        <TextInput label="URL do áudio" field="url" />
        <TextInput
          label="ID biblioteca DS Voice (opcional)"
          field="voice_library_id"
        />
      </>
    );
  if (t === "bubble_embed")
    return (
      <>
        <TextInput label="URL embed" field="url" />
        <NumberInput label="Altura (px)" field="height" />
      </>
    );

  // ── Inputs ──
  if (t.startsWith("input_")) {
    return (
      <>
        <TextArea label="Pergunta" field="question" />
        <TextInput
          label="Salvar em variável"
          field="variable"
          placeholder="ex: nome"
        />
        <Field label="Obrigatória?">
          <label className="text-xs flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!d.required}
              onChange={(e) => setField("required", e.target.checked)}
            />
            Sim
          </label>
        </Field>
        {t === "input_button" && (
          <Field label="Opções (uma por linha: label|value)">
            <textarea
              value={(
                (d.options as
                  | Array<{ label: string; value: string }>
                  | undefined) ?? []
              )
                .map((o) => `${o.label}|${o.value}`)
                .join("\n")}
              onChange={(e) => {
                const opts = e.target.value
                  .split("\n")
                  .map((l) => l.trim())
                  .filter(Boolean)
                  .map((l, i) => {
                    const [label, value] = l.split("|");
                    return {
                      id: `opt-${i}`,
                      label: (label || "").trim(),
                      value: (value ?? label ?? "").trim(),
                    };
                  });
                setField("options", opts);
              }}
              className="w-full border rounded px-2 py-1 text-sm"
              rows={5}
              placeholder="Sim|yes&#10;Não|no"
            />
          </Field>
        )}
        {t === "input_text" && (
          <>
            <NumberInput label="min_length" field="min_length" />
            <NumberInput label="max_length" field="max_length" />
          </>
        )}
        {t === "input_number" && (
          <>
            <NumberInput label="min" field="min" />
            <NumberInput label="max" field="max" />
          </>
        )}
        {t === "input_file" && (
          <>
            <TextInput label="accept (mime)" field="accept" />
            <NumberInput label="max_mb" field="max_mb" />
          </>
        )}
        <NumberInput label="Timeout (segundos)" field="timeout_seconds" />
      </>
    );
  }

  // ── Flow ──
  if (t === "flow_goto")
    return <TextInput label="ID do node destino" field="target_node_id" />;
  if (t === "flow_back")
    return (
      <p className="text-xs text-gray-500">Volta ao último node visitado.</p>
    );
  if (t === "flow_end")
    return <TextInput label="Motivo (opcional)" field="reason" />;
  if (t === "flow_wait")
    return <NumberInput label="Aguardar (segundos)" field="timeout_seconds" />;

  // ── Contact ──
  if (t === "contact_add_tag" || t === "contact_remove_tag")
    return <TextInput label="Tag" field="tag" />;
  if (t === "contact_update_field")
    return (
      <>
        <TextInput
          label="Campo"
          field="field"
          placeholder="name | email | custom_xyz"
        />
        <TextInput label="Valor (usa {{variavel}})" field="value" />
      </>
    );

  // ── Message ──
  if (t === "message_waba_template")
    return (
      <>
        <TextInput label="ID do template" field="template_id" />
        <TextArea label="Variáveis (JSON)" field="variables" />
      </>
    );
  if (t === "message_ds_voice")
    return (
      <TextInput
        label="ID do item na biblioteca DS Voice"
        field="library_item_id"
      />
    );
  if (t === "message_forward")
    return <TextInput label="ID da mensagem a encaminhar" field="message_id" />;

  // ── Attendance ──
  if (t === "attendance_transfer_queue")
    return (
      <>
        <TextInput label="ID da fila" field="queue_id" />
        <TextArea label="Nota (opcional)" field="note" />
      </>
    );
  if (t === "attendance_assign_agent")
    return (
      <>
        <TextInput label="ID do agente" field="agent_id" />
        <TextArea label="Nota (opcional)" field="note" />
      </>
    );
  if (t === "attendance_open_protocol")
    return (
      <>
        <TextInput label="Assunto (usa {{variavel}})" field="subject" />
        <Field label="Prioridade">
          <select
            value={String(d.priority ?? "normal")}
            onChange={(e) => setField("priority", e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
          >
            <option value="low">Baixa</option>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
          </select>
        </Field>
      </>
    );
  if (t === "attendance_close")
    return <TextInput label="Motivo (opcional)" field="reason" />;

  // ── Logic ──
  if (t === "conditional") {
    const clauses = (d.clauses as ConditionalClause[]) ?? [];
    const ops: ConditionalOperator[] = [
      "eq",
      "neq",
      "gt",
      "gte",
      "lt",
      "lte",
      "contains",
      "not_contains",
      "starts_with",
      "ends_with",
      "is_empty",
      "is_not_empty",
    ];
    return (
      <>
        <Field label="Lógica">
          <select
            value={String(d.logic ?? "AND")}
            onChange={(e) => setField("logic", e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
          >
            <option value="AND">AND — todas precisam bater</option>
            <option value="OR">OR — pelo menos uma</option>
          </select>
        </Field>
        <Field label="Cláusulas">
          <div className="space-y-2">
            {clauses.map((c, i) => (
              <div key={i} className="border rounded p-2 bg-gray-50">
                <input
                  value={c.left}
                  placeholder="var.nome ou context.channel"
                  onChange={(e) => {
                    const copy = [...clauses];
                    copy[i] = { ...c, left: e.target.value };
                    setField("clauses", copy);
                  }}
                  className="w-full border rounded px-2 py-1 text-xs mb-1"
                />
                <div className="flex gap-1">
                  <select
                    value={c.op}
                    onChange={(e) => {
                      const copy = [...clauses];
                      copy[i] = {
                        ...c,
                        op: e.target.value as ConditionalOperator,
                      };
                      setField("clauses", copy);
                    }}
                    className="border rounded px-1 py-1 text-xs flex-shrink-0"
                  >
                    {ops.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  <input
                    value={String(c.right ?? "")}
                    placeholder="valor"
                    onChange={(e) => {
                      const copy = [...clauses];
                      copy[i] = { ...c, right: e.target.value };
                      setField("clauses", copy);
                    }}
                    className="flex-1 border rounded px-2 py-1 text-xs"
                    disabled={c.op === "is_empty" || c.op === "is_not_empty"}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setField(
                        "clauses",
                        clauses.filter((_, j) => j !== i),
                      )
                    }
                    className="text-red-600 text-xs px-2"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setField("clauses", [
                  ...clauses,
                  { left: "", op: "eq", right: "" },
                ])
              }
              className="w-full text-xs py-1 border border-dashed border-gray-300 rounded hover:bg-gray-50"
            >
              + Adicionar cláusula
            </button>
          </div>
        </Field>
      </>
    );
  }

  // ── Agent ──
  if (t === "agent_handoff")
    return (
      <>
        <TextInput label="ID do DS Agente" field="agent_id" />
        <Field label="Variáveis de contexto (uma por linha)">
          <textarea
            value={((d.context_vars as string[] | undefined) ?? []).join("\n")}
            onChange={(e) =>
              setField(
                "context_vars",
                e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
            className="w-full border rounded px-2 py-1 text-sm"
            rows={3}
          />
        </Field>
      </>
    );

  if (t === "trigger")
    return (
      <p className="text-xs text-gray-500">
        Node de início. Primeiro a executar.
      </p>
    );

  return <p className="text-xs text-gray-500">Sem configuração.</p>;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-600 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
