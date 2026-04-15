"use client";

import { Scale, ChevronDown, ChevronUp } from "lucide-react";
import { CampoInput } from "./ui-helpers";
import type { EstadoRevisao } from "../types";

interface SecaoDecisaoJudicialProps {
  revisao: EstadoRevisao;
  setRevisao: (revisao: EstadoRevisao) => void;
  secaoAberta: boolean;
  onToggle: (id: string) => void;
  readOnly?: boolean;
}

export function SecaoDecisaoJudicial({
  revisao,
  setRevisao,
  secaoAberta,
  onToggle,
  readOnly,
}: SecaoDecisaoJudicialProps) {
  const handleToggleDecisao = () => {
    setRevisao({
      ...revisao,
      decisao_judicial: !revisao.decisao_judicial,
    });
  };

  const handleProcessoChange = (valor: string) => {
    setRevisao({
      ...revisao,
      dj_numero_processo: valor,
    });
  };

  const handleJuizChange = (valor: string) => {
    setRevisao({
      ...revisao,
      dj_nome_juiz: valor,
    });
  };

  const handleDecisaoChange = (valor: string) => {
    setRevisao({
      ...revisao,
      dj_decisao: valor,
    });
  };

  const handleDeclaracoesChange = (valor: string) => {
    setRevisao({
      ...revisao,
      dj_declaracoes: valor,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
      {/* Header com toggle */}
      <button
        onClick={handleToggleDecisao}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Scale size={16} className="text-slate-600" />
          <span className="text-sm font-bold text-gray-800">
            Decisão Judicial
          </span>
          {revisao.decisao_judicial && (
            <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium">
              Ativo
            </span>
          )}
        </div>
        {secaoAberta && revisao.decisao_judicial ? (
          <ChevronUp size={16} className="text-gray-400" />
        ) : (
          <ChevronDown size={16} className="text-gray-400" />
        )}
      </button>

      {/* Checkbox de ativação */}
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={revisao.decisao_judicial}
            onChange={handleToggleDecisao}
            disabled={readOnly}
            className="rounded border-gray-300 text-slate-600 focus:ring-slate-500 focus:ring-2"
          />
          <span className="text-sm font-medium text-gray-700">
            Emissão por Decisão Judicial?
          </span>
        </label>
      </div>

      {/* Campos condicionais */}
      {revisao.decisao_judicial && secaoAberta && (
        <div className="px-5 pb-5 pt-4 space-y-4">
          <CampoInput
            label="Número do Processo Judicial"
            value={revisao.dj_numero_processo}
            onChange={handleProcessoChange}
            tipo="text"
            placeholder="Ex: 0000000-00.0000.0.00.0000"
            readonly={readOnly}
          />

          <CampoInput
            label="Nome do Juiz"
            value={revisao.dj_nome_juiz}
            onChange={handleJuizChange}
            tipo="text"
            placeholder="Nome completo do juiz"
            readonly={readOnly}
          />

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Decisão
            </label>
            <textarea
              value={revisao.dj_decisao}
              onChange={(e) => handleDecisaoChange(e.target.value)}
              placeholder="Texto da decisão judicial"
              rows={4}
              readOnly={readOnly}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Declarações Acerca do Processo
            </label>
            <textarea
              value={revisao.dj_declaracoes}
              onChange={(e) => handleDeclaracoesChange(e.target.value)}
              placeholder="Declarações e informações complementares"
              rows={4}
              readOnly={readOnly}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}
