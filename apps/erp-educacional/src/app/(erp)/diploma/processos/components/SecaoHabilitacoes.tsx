"use client";

import { Award, Trash2, Plus } from "lucide-react";
import { Secao, CampoInput } from "./ui-helpers";
import type { EstadoRevisao, Habilitacao } from "../types";

interface SecaoHabilitacoesProps {
  revisao: EstadoRevisao;
  setRevisao: (revisao: EstadoRevisao) => void;
  secaoAberta: boolean;
  onToggle: (id: string) => void;
  readOnly?: boolean;
}

export function SecaoHabilitacoes({
  revisao,
  setRevisao,
  secaoAberta,
  onToggle,
  readOnly,
}: SecaoHabilitacoesProps) {
  const handleHabilitacaoChange = (id: string, campo: keyof Habilitacao, valor: string) => {
    setRevisao({
      ...revisao,
      habilitacoes: revisao.habilitacoes.map((h) =>
        h.id === id ? { ...h, [campo]: valor } : h
      ),
    });
  };

  const handleAddHabilitacao = () => {
    const novoId = `habilitacao-${Date.now()}`;
    setRevisao({
      ...revisao,
      habilitacoes: [
        ...revisao.habilitacoes,
        {
          id: novoId,
          nome: "",
          data: "",
        },
      ],
    });
  };

  const handleDeleteHabilitacao = (id: string) => {
    setRevisao({
      ...revisao,
      habilitacoes: revisao.habilitacoes.filter((h) => h.id !== id),
    });
  };

  return (
    <Secao
      id="sec-12-habilitacoes"
      titulo="Habilitações"
      icone={<Award size={16} className="text-cyan-600" />}
      aberta={secaoAberta}
      onToggle={onToggle}
    >
      <div className="space-y-4">
        {revisao.habilitacoes.length === 0 ? (
          <p className="text-sm text-gray-500 italic mb-4">
            Nenhuma habilitação registrada.
          </p>
        ) : (
          <div className="space-y-3 mb-4">
            {revisao.habilitacoes.map((habilitacao) => (
              <div
                key={habilitacao.id}
                className="bg-gray-50 p-4 rounded-lg border border-gray-200"
              >
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <CampoInput
                    label="Nome"
                    value={habilitacao.nome}
                    onChange={(val) =>
                      handleHabilitacaoChange(habilitacao.id, "nome", val)
                    }
                    obrigatorio
                    placeholder="Nome da habilitação"
                    readonly={readOnly}
                  />
                  <CampoInput
                    label="Data"
                    value={habilitacao.data}
                    onChange={(val) =>
                      handleHabilitacaoChange(habilitacao.id, "data", val)
                    }
                    obrigatorio
                    tipo="date"
                    readonly={readOnly}
                  />
                </div>

                {/* Delete button */}
                {!readOnly && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleDeleteHabilitacao(habilitacao.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 size={14} />
                      Remover
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add button */}
        {!readOnly && (
          <button
            onClick={handleAddHabilitacao}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors border border-cyan-200"
          >
            <Plus size={14} />
            Adicionar Habilitação
          </button>
        )}
      </div>
    </Secao>
  );
}
