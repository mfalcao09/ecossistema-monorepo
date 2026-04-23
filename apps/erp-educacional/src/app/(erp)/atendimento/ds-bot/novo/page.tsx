"use client";

/**
 * DS Bot — criação (3 formas: zero, template, import).
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Upload } from "lucide-react";

interface TemplateInfo {
  slug: string;
  name: string;
  description: string;
}

type Mode = "blank" | "template" | "import";

export default function NewBotPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("blank");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState<
    "keyword" | "tag_added" | "new_conversation" | "manual"
  >("manual");
  const [triggerValue, setTriggerValue] = useState("");
  const [channels, setChannels] = useState<string[]>(["whatsapp"]);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [templateSlug, setTemplateSlug] = useState<string>("");
  const [importPayload, setImportPayload] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/atendimento/ds-bots")
      .then((r) => r.json())
      .then((j) => setTemplates(j.templates ?? []));
  }, []);

  const toggleChannel = (c: string) => {
    setChannels((cur) =>
      cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c],
    );
  };

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      let body: Record<string, unknown> = {
        name: name || "Novo bot",
        description,
        trigger_type: triggerType,
        trigger_value: triggerValue || undefined,
        channels,
        source: mode,
      };
      if (mode === "template") {
        if (!templateSlug) {
          setError("Escolha um template.");
          setSaving(false);
          return;
        }
        body.template_slug = templateSlug;
      }
      if (mode === "import") {
        try {
          const parsed = JSON.parse(importPayload);
          body.flow = parsed.flow_json ?? parsed.flow;
          body.start_node_id = parsed.start_node_id;
        } catch {
          setError("JSON inválido.");
          setSaving(false);
          return;
        }
      }
      const res = await fetch("/api/atendimento/ds-bots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Falha ao criar.");
        setSaving(false);
        return;
      }
      router.push(`/atendimento/ds-bot/${j.bot.id}/editor`);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/atendimento/ds-bot"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-3"
      >
        <ArrowLeft size={14} /> Voltar
      </Link>
      <h1 className="text-2xl font-bold mb-1">Novo DS Bot</h1>
      <p className="text-sm text-gray-500 mb-6">Escolha como começar.</p>

      <div className="grid grid-cols-3 gap-2 mb-6">
        {(
          [
            { v: "blank", label: "Do zero" },
            { v: "template", label: "De template" },
            { v: "import", label: "Importar JSON" },
          ] as const
        ).map((o) => (
          <button
            key={o.v}
            onClick={() => setMode(o.v)}
            className={`border rounded-lg px-3 py-2 text-sm font-medium ${mode === o.v ? "bg-violet-50 border-violet-400 text-violet-700" : "hover:bg-gray-50"}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="bg-white border rounded-lg p-5 space-y-4">
        <Field label="Nome">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </Field>
        <Field label="Descrição">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border rounded px-3 py-2"
            rows={2}
          />
        </Field>

        {mode !== "template" && mode !== "import" && (
          <>
            <Field label="Gatilho">
              <select
                value={triggerType}
                onChange={(e) =>
                  setTriggerType(e.target.value as typeof triggerType)
                }
                className="w-full border rounded px-3 py-2"
              >
                <option value="manual">Manual</option>
                <option value="keyword">Palavra-chave</option>
                <option value="tag_added">Tag adicionada</option>
                <option value="new_conversation">Nova conversa</option>
              </select>
            </Field>
            {(triggerType === "keyword" || triggerType === "tag_added") && (
              <Field
                label={
                  triggerType === "keyword" ? "Palavra-chave" : "Nome da tag"
                }
              >
                <input
                  value={triggerValue}
                  onChange={(e) => setTriggerValue(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </Field>
            )}
            <Field label="Canais">
              <div className="flex gap-2 flex-wrap">
                {["whatsapp", "instagram", "facebook"].map((c) => (
                  <label
                    key={c}
                    className="flex items-center gap-1 text-sm border rounded px-2 py-1 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={channels.includes(c)}
                      onChange={() => toggleChannel(c)}
                    />
                    {c}
                  </label>
                ))}
              </div>
            </Field>
          </>
        )}

        {mode === "template" && (
          <Field label="Template">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {templates.map((t) => (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() => {
                    setTemplateSlug(t.slug);
                    setName(t.name);
                    setDescription(t.description);
                  }}
                  className={`text-left border rounded-lg px-3 py-2 ${templateSlug === t.slug ? "border-violet-400 bg-violet-50" : "hover:bg-gray-50"}`}
                >
                  <div className="font-medium text-sm">{t.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {t.description}
                  </div>
                </button>
              ))}
            </div>
          </Field>
        )}

        {mode === "import" && (
          <Field label="Cole o JSON exportado">
            <textarea
              value={importPayload}
              onChange={(e) => setImportPayload(e.target.value)}
              rows={10}
              className="w-full border rounded px-3 py-2 font-mono text-xs"
              placeholder='{"schema":"ds-bot@1","flow_json":{"nodes":[...],"edges":[...]}}'
            />
            <label className="mt-2 inline-flex items-center gap-1 text-xs text-violet-600 cursor-pointer">
              <Upload size={12} />
              <span>Selecionar arquivo .json</span>
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = (ev) =>
                    setImportPayload(String(ev.target?.result ?? ""));
                  reader.readAsText(f);
                }}
              />
            </label>
          </Field>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Link
            href="/atendimento/ds-bot"
            className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 text-sm bg-violet-600 text-white rounded disabled:opacity-50 hover:bg-violet-700"
          >
            {saving ? "Criando..." : "Criar bot"}
          </button>
        </div>
      </div>
    </div>
  );
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
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
