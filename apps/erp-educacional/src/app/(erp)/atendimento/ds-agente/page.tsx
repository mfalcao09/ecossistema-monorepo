"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bot,
  Plus,
  RefreshCw,
  Loader2,
  AlertCircle,
  LayoutGrid,
  ListFilter,
} from "lucide-react";
import {
  AgentCard,
  type AgentData,
} from "@/components/atendimento/ds-agente/AgentCard";
import { AgentWizard } from "@/components/atendimento/ds-agente/AgentWizard";
import { KnowledgePanel } from "@/components/atendimento/ds-agente/KnowledgePanel";
import { PlaygroundPanel } from "@/components/atendimento/ds-agente/PlaygroundPanel";

interface Label {
  id: string;
  title: string;
  color: string;
}

type Tab = "agentes" | "logs";

interface Execution {
  id: string;
  agent_id: string;
  input_text: string;
  output_text: string | null;
  tokens_used: number;
  latency_ms: number;
  handoff_triggered: boolean;
  skipped: boolean;
  skip_reason: string | null;
  error: string | null;
  executed_at: string;
}

export default function DsAgentePage() {
  const [tab, setTab] = useState<Tab>("agentes");
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modais
  const [showWizard, setShowWizard] = useState(false);
  const [editAgent, setEditAgent] = useState<AgentData | null>(null);
  const [knowledgeAgent, setKnowledgeAgent] = useState<AgentData | null>(null);
  const [playgroundAgent, setPlaygroundAgent] = useState<AgentData | null>(
    null,
  );

  // Logs
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsFilter, setLogsFilter] = useState<"all" | "handoff" | "error">(
    "all",
  );

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [aRes, lRes] = await Promise.all([
        fetch("/api/atendimento/ds-agentes"),
        fetch("/api/atendimento/labels"),
      ]);
      const aJson = await aRes.json();
      const lJson = await lRes.json();
      setAgents(aJson.agents ?? []);
      setLabels(lJson.labels ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  async function loadLogs() {
    setLogsLoading(true);
    try {
      // Busca execuções de todos os agentes (últimas 200)
      const ids = agents.map((a) => a.id);
      if (ids.length === 0) {
        setExecutions([]);
        return;
      }

      // Usa o endpoint de detalhe de cada agente para pegar execuções
      // (alternativa: endpoint dedicado — P-135)
      const results = await Promise.all(
        ids.slice(0, 5).map((id) =>
          fetch(`/api/atendimento/ds-agentes/${id}`)
            .then((r) => r.json())
            .then((j) => (j.executions ?? []) as Execution[]),
        ),
      );
      const all = results
        .flat()
        .sort(
          (a, b) =>
            new Date(b.executed_at).getTime() -
            new Date(a.executed_at).getTime(),
        );
      setExecutions(all.slice(0, 200));
    } finally {
      setLogsLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "logs" && agents.length > 0) loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, agents]);

  async function handleToggle(id: string, enabled: boolean) {
    await fetch(`/api/atendimento/ds-agentes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, enabled } : a)));
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover este agente e toda a base de conhecimento?")) return;
    await fetch(`/api/atendimento/ds-agentes/${id}`, { method: "DELETE" });
    setAgents((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleSave(
    data: Parameters<typeof AgentWizard>[0]["onSave"] extends (
      d: infer D,
    ) => unknown
      ? D
      : never,
  ) {
    const url = editAgent
      ? `/api/atendimento/ds-agentes/${editAgent.id}`
      : "/api/atendimento/ds-agentes";
    const method = editAgent ? "PATCH" : "POST";

    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.erro ?? "Erro ao salvar");
    await loadAgents();
    setEditAgent(null);
  }

  const filteredExecutions = executions.filter((e) => {
    if (logsFilter === "handoff") return e.handoff_triggered;
    if (logsFilter === "error") return !!e.error;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Bot size={20} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">DS Agente</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              IA autônoma com RAG · GPT-4o + base FIC
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadAgents}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => {
              setEditAgent(null);
              setShowWizard(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} /> Novo agente
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {(
          [
            { id: "agentes", label: "Agentes", icon: LayoutGrid },
            { id: "logs", label: "Logs de execução", icon: ListFilter },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Tab: Agentes */}
      {tab === "agentes" && (
        <>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-12 justify-center">
              <Loader2 size={18} className="animate-spin" /> Carregando agentes…
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {!loading && !error && agents.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Bot size={32} className="text-indigo-300" />
              </div>
              <h3 className="text-base font-semibold text-gray-700 mb-2">
                Nenhum agente IA criado
              </h3>
              <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">
                Crie um agente para responder alunos automaticamente via RAG com
                base no regulamento e FAQ da FIC.
              </p>
              <button
                onClick={() => setShowWizard(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
              >
                <Plus size={16} /> Criar primeiro agente
              </button>
            </div>
          )}

          {!loading && agents.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onEdit={(a) => {
                    setEditAgent(a);
                    setShowWizard(true);
                  }}
                  onDelete={handleDelete}
                  onToggle={handleToggle}
                  onPlayground={setPlaygroundAgent}
                  onKnowledge={setKnowledgeAgent}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Tab: Logs */}
      {tab === "logs" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-semibold text-gray-600">
              Filtrar:
            </span>
            {(["all", "handoff", "error"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setLogsFilter(f)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  logsFilter === f
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f === "all" ? "Todas" : f === "handoff" ? "Hand-off" : "Erros"}
              </button>
            ))}
          </div>

          {logsLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center">
              <Loader2 size={16} className="animate-spin" /> Carregando logs…
            </div>
          )}

          {!logsLoading && filteredExecutions.length === 0 && (
            <p className="text-sm text-gray-400 py-8 text-center">
              Nenhuma execução encontrada.
            </p>
          )}

          {!logsLoading && filteredExecutions.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">
                      Quando
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">
                      Input
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">
                      Status
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">
                      Tokens
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">
                      Latência
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredExecutions.map((exec) => (
                    <tr
                      key={exec.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(exec.executed_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-gray-800 max-w-xs truncate">
                        {exec.input_text}
                      </td>
                      <td className="px-4 py-3">
                        {exec.error ? (
                          <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                            <AlertCircle size={11} /> Erro
                          </span>
                        ) : exec.handoff_triggered ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-semibold">
                            Hand-off
                          </span>
                        ) : exec.skipped ? (
                          <span className="text-gray-400">
                            Pulado: {exec.skip_reason ?? "—"}
                          </span>
                        ) : (
                          <span className="text-green-600 font-medium">OK</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        {exec.tokens_used > 0 ? exec.tokens_used : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        {exec.latency_ms > 0 ? `${exec.latency_ms}ms` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modais */}
      {showWizard && (
        <AgentWizard
          labels={labels}
          onSave={handleSave}
          onClose={() => {
            setShowWizard(false);
            setEditAgent(null);
          }}
          initial={
            editAgent
              ? {
                  ...editAgent,
                  description: editAgent.description ?? undefined,
                }
              : undefined
          }
          editMode={!!editAgent}
        />
      )}

      {knowledgeAgent && (
        <KnowledgePanel
          agentId={knowledgeAgent.id}
          agentName={knowledgeAgent.name}
          onClose={() => setKnowledgeAgent(null)}
        />
      )}

      {playgroundAgent && (
        <PlaygroundPanel
          agentId={playgroundAgent.id}
          agentName={playgroundAgent.name}
          onClose={() => setPlaygroundAgent(null)}
        />
      )}
    </div>
  );
}
