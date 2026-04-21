"use client";

import { useState } from "react";
import {
  Bot,
  ToggleLeft,
  ToggleRight,
  Zap,
  BookOpen,
  PlayCircle,
  Trash2,
  Settings,
} from "lucide-react";

export interface AgentData {
  id: string;
  name: string;
  description: string | null;
  model: string;
  enabled: boolean;
  activation_tags: string[];
  tag_logic: "AND" | "OR";
  channels: string[];
  executions_last_24h: number;
  created_at: string;
}

interface AgentCardProps {
  agent: AgentData;
  onEdit: (agent: AgentData) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  onPlayground: (agent: AgentData) => void;
  onKnowledge: (agent: AgentData) => void;
}

export function AgentCard({
  agent,
  onEdit,
  onDelete,
  onToggle,
  onPlayground,
  onKnowledge,
}: AgentCardProps) {
  const [toggling, setToggling] = useState(false);

  async function handleToggle() {
    setToggling(true);
    try {
      await onToggle(agent.id, !agent.enabled);
    } finally {
      setToggling(false);
    }
  }

  const modelLabel =
    agent.model === "gpt-4o-mini" ? "GPT-4o mini" : agent.model;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              agent.enabled ? "bg-indigo-100" : "bg-gray-100"
            }`}
          >
            <Bot
              size={20}
              className={agent.enabled ? "text-indigo-600" : "text-gray-400"}
            />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm leading-tight">
              {agent.name}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">{modelLabel}</p>
          </div>
        </div>

        {/* Toggle ativo/inativo */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          title={agent.enabled ? "Desativar agente" : "Ativar agente"}
          className="text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-40"
        >
          {agent.enabled ? (
            <ToggleRight size={28} className="text-indigo-600" />
          ) : (
            <ToggleLeft size={28} />
          )}
        </button>
      </div>

      {/* Descrição */}
      {agent.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">
          {agent.description}
        </p>
      )}

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full leading-none ${
            agent.enabled
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {agent.enabled ? "ATIVO" : "INATIVO"}
        </span>

        {agent.channels.map((ch) => (
          <span
            key={ch}
            className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 leading-none uppercase"
          >
            {ch}
          </span>
        ))}

        {agent.activation_tags.length === 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 leading-none">
            Sem filtro de tag
          </span>
        )}
      </div>

      {/* Métricas */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-4">
        <Zap size={12} className="text-amber-500" />
        <span>
          <span className="font-semibold text-gray-700">
            {agent.executions_last_24h}
          </span>{" "}
          execuções nas últimas 24h
        </span>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-1 pt-3 border-t border-gray-100">
        <button
          onClick={() => onPlayground(agent)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
        >
          <PlayCircle size={14} /> Playground
        </button>
        <button
          onClick={() => onKnowledge(agent)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <BookOpen size={14} /> Conhecimento
        </button>
        <button
          onClick={() => onEdit(agent)}
          className="px-2.5 py-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
          title="Editar"
        >
          <Settings size={14} />
        </button>
        <button
          onClick={() => onDelete(agent.id)}
          className="px-2.5 py-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Deletar"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
