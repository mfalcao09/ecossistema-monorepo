"use client";

import { useEffect, useState, useCallback } from "react";
import { Zap, Plus, Play, History, Power, Trash2 } from "lucide-react";
import { RuleBuilder, emptyDraft, type RuleDraft } from "@/components/atendimento/automations/RuleBuilder";

type Rule = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  event_name: string;
  conditions: unknown[];
  conditions_logic: "AND" | "OR";
  actions: unknown[];
  execution_count: number;
  last_executed_at: string | null;
};

type Execution = {
  id: string;
  triggered_by_event: string;
  actions_run: unknown;
  status: string;
  error: string | null;
  dry_run: boolean;
  executed_at: string;
};

export default function AutomacoesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState<false | "new" | string>(false);
  const [editingDraft, setEditingDraft] = useState<RuleDraft | null>(null);
  const [execDrawer, setExecDrawer] = useState<{ ruleId: string; executions: Execution[] } | null>(null);
  const [flash, setFlash] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/atendimento/automation-rules", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setRules(data.rules ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const openBuilder = (mode: "new" | string) => {
    if (mode === "new") {
      setEditingDraft(emptyDraft());
    } else {
      const r = rules.find((x) => x.id === mode);
      if (!r) return;
      setEditingDraft({
        name: r.name,
        description: r.description ?? "",
        event_name: r.event_name,
        conditions: (r.conditions as RuleDraft["conditions"]) ?? [],
        conditions_logic: r.conditions_logic ?? "AND",
        actions: (r.actions as RuleDraft["actions"]) ?? [],
        active: r.active,
      });
    }
    setBuilderOpen(mode);
  };

  const saveRule = async (draft: RuleDraft) => {
    try {
      const url = builderOpen === "new"
        ? "/api/atendimento/automation-rules"
        : `/api/atendimento/automation-rules/${builderOpen}`;
      const method = builderOpen === "new" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro ?? "Erro ao salvar");
      setFlash({ type: "ok", msg: builderOpen === "new" ? "Regra criada." : "Regra atualizada." });
      setBuilderOpen(false);
      setEditingDraft(null);
      await reload();
    } catch (err) {
      setFlash({ type: "err", msg: (err as Error).message });
    }
  };

  const toggleActive = async (rule: Rule) => {
    await fetch(`/api/atendimento/automation-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !rule.active }),
    });
    await reload();
  };

  const removeRule = async (rule: Rule) => {
    if (!confirm(`Deletar regra "${rule.name}"?`)) return;
    await fetch(`/api/atendimento/automation-rules/${rule.id}`, { method: "DELETE" });
    await reload();
  };

  const testRule = async (rule: Rule) => {
    const res = await fetch(`/api/atendimento/automation-rules/${rule.id}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.ok) {
      setFlash({
        type: "ok",
        msg: `Dry-run: ${data.executed}/${data.matched} regra(s) executada(s). Veja o log.`,
      });
    } else {
      setFlash({ type: "err", msg: data.erro ?? "Erro no teste." });
    }
  };

  const openExecutions = async (ruleId: string) => {
    const res = await fetch(`/api/atendimento/automation-rules/${ruleId}`, { cache: "no-store" });
    const data = await res.json();
    if (res.ok) {
      setExecDrawer({ ruleId, executions: data.executions ?? [] });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automações</h1>
          <p className="text-sm text-gray-500 mt-1">
            Regras IF/THEN — 7 gatilhos, 10 operadores, 9 ações
          </p>
        </div>
        <button
          onClick={() => openBuilder("new")}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
        >
          <Plus size={15} />
          Nova automação
        </button>
      </div>

      {flash && (
        <div className={`rounded-lg px-4 py-2 text-sm ${
          flash.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        }`}>
          {flash.msg}
          <button onClick={() => setFlash(null)} className="float-right text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {builderOpen && editingDraft && (
        <RuleBuilder
          initial={editingDraft}
          onSubmit={saveRule}
          onCancel={() => { setBuilderOpen(false); setEditingDraft(null); }}
          onTest={builderOpen !== "new" ? () => testRule(rules.find((r) => r.id === builderOpen)!) : undefined}
          submitLabel={builderOpen === "new" ? "Criar" : "Atualizar"}
        />
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Carregando…</p>
      ) : rules.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
          <Zap className="mx-auto text-gray-300" size={36} />
          <p className="text-sm text-gray-500 mt-3">Nenhuma regra ainda. Crie a primeira automação.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:shadow-sm transition-shadow"
            >
              <div className={`w-9 h-9 rounded-lg ${r.active ? "bg-green-500" : "bg-gray-300"} flex items-center justify-center flex-shrink-0`}>
                <Zap size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => openBuilder(r.id)}
                  className="text-sm font-semibold text-gray-900 text-left hover:text-green-700"
                >
                  {r.name}
                </button>
                <p className="text-xs text-gray-500 truncate">
                  {r.description ?? <span className="italic">sem descrição</span>} · <span className="font-mono">{r.event_name}</span>
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {r.execution_count} execução(ões){r.last_executed_at ? ` · última: ${new Date(r.last_executed_at).toLocaleString("pt-BR")}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  title="Log de execuções"
                  onClick={() => openExecutions(r.id)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100"
                >
                  <History size={15} />
                </button>
                <button
                  title="Testar (dry-run)"
                  onClick={() => testRule(r)}
                  className="p-1.5 text-gray-400 hover:text-amber-600 rounded hover:bg-gray-100"
                >
                  <Play size={15} />
                </button>
                <button
                  title={r.active ? "Desativar" : "Ativar"}
                  onClick={() => toggleActive(r)}
                  className={`p-1.5 rounded hover:bg-gray-100 ${r.active ? "text-green-600" : "text-gray-400"}`}
                >
                  <Power size={15} />
                </button>
                <button
                  title="Deletar"
                  onClick={() => removeRule(r)}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-gray-100"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Execution drawer */}
      {execDrawer && (
        <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setExecDrawer(null)}>
          <div
            className="absolute right-0 top-0 bottom-0 w-[420px] bg-white shadow-2xl overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Log de execuções</h3>
              <button onClick={() => setExecDrawer(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            {execDrawer.executions.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Nenhuma execução ainda.</p>
            ) : (
              <div className="space-y-2">
                {execDrawer.executions.map((e) => (
                  <div key={e.id} className="text-xs border border-gray-200 rounded p-2">
                    <div className="flex items-center justify-between">
                      <span className={`font-mono ${
                        e.status === "success" ? "text-green-600"
                        : e.status === "partial" ? "text-amber-600"
                        : "text-red-600"
                      }`}>
                        {e.status}{e.dry_run ? " (dry-run)" : ""}
                      </span>
                      <span className="text-gray-400">{new Date(e.executed_at).toLocaleString("pt-BR")}</span>
                    </div>
                    {e.error && <p className="text-red-600 mt-1">{e.error}</p>}
                    <pre className="mt-1 bg-gray-50 p-1.5 rounded text-[10px] overflow-x-auto">
                      {JSON.stringify(e.actions_run, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
