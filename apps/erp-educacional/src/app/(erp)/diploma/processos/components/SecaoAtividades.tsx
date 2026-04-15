"use client";

import { ClipboardList, Trash2 } from "lucide-react";
import { Secao, CampoInput } from "./ui-helpers";
import type { EstadoRevisao, AtividadeComplementar, DocenteInfo } from "../types";

interface SecaoAtividadesProps {
  revisao: EstadoRevisao;
  setRevisao: (revisao: EstadoRevisao) => void;
  secaoAberta: boolean;
  onToggle: (id: string) => void;
  readOnly?: boolean;
}

export function SecaoAtividades({
  revisao,
  setRevisao,
  secaoAberta,
  onToggle,
  readOnly,
}: SecaoAtividadesProps) {
  const handleAdd = () => {
    const newAtividade: AtividadeComplementar = {
      id: `ativ-${Date.now()}`,
      codigo: "",
      data_inicio: "",
      data_fim: "",
      tipo: "",
      ch_hora_relogio: "",
      descricao: "",
      docentes: [],
    };
    setRevisao({
      ...revisao,
      atividades_complementares: [
        ...revisao.atividades_complementares,
        newAtividade,
      ],
    });
  };

  const handleRemove = (id: string) => {
    setRevisao({
      ...revisao,
      atividades_complementares: revisao.atividades_complementares.filter(
        (a) => a.id !== id
      ),
    });
  };

  const handleChange = (
    id: string,
    field: keyof AtividadeComplementar,
    value: any
  ) => {
    setRevisao({
      ...revisao,
      atividades_complementares: revisao.atividades_complementares.map((a) =>
        a.id === id ? { ...a, [field]: value } : a
      ),
    });
  };

  const handleDocenteAdd = (id: string) => {
    const atividade = revisao.atividades_complementares.find((a) => a.id === id);
    if (!atividade) return;

    const newDocentes = [
      ...(atividade.docentes || []),
      { nome: "", titulacao: "", cpf: "", lattes: "" },
    ];
    handleChange(id, "docentes", newDocentes);
  };

  const handleDocenteRemove = (id: string, docIndex: number) => {
    const atividade = revisao.atividades_complementares.find((a) => a.id === id);
    if (!atividade) return;

    const newDocentes = (atividade.docentes || []).filter(
      (_, i) => i !== docIndex
    );
    handleChange(id, "docentes", newDocentes);
  };

  const handleDocenteChange = (
    id: string,
    docIndex: number,
    field: keyof DocenteInfo,
    value: string
  ) => {
    const atividade = revisao.atividades_complementares.find((a) => a.id === id);
    if (!atividade) return;

    const newDocentes = (atividade.docentes || []).map((d, i) =>
      i === docIndex ? { ...d, [field]: value } : d
    );
    handleChange(id, "docentes", newDocentes);
  };

  return (
    <Secao
      id="secao-atividades"
      titulo="Atividades Complementares"
      icone={<ClipboardList size={18} className="text-purple-600" />}
      aberta={secaoAberta}
      onToggle={onToggle}
    >
      <div className="space-y-4">
        {revisao.atividades_complementares.length > 0 ? (
          revisao.atividades_complementares.map((ativ) => (
            <div
              key={ativ.id}
              className="p-4 border border-gray-200 rounded-lg bg-white space-y-4"
            >
              <div className="flex items-start justify-between">
                <h4 className="text-sm font-semibold text-gray-800">
                  {ativ.codigo || ativ.tipo || "Atividade Complementar"}
                </h4>
                {!readOnly && (
                  <button
                    onClick={() => handleRemove(ativ.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded"
                    title="Remover atividade"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {/* Campos principais */}
              <div className="grid grid-cols-2 gap-4">
                <CampoInput
                  label="Código"
                  value={ativ.codigo || ""}
                  onChange={(val) => handleChange(ativ.id, "codigo", val)}
                  readonly={readOnly}
                />
                <CampoInput
                  label="Tipo"
                  value={ativ.tipo || ""}
                  onChange={(val) => handleChange(ativ.id, "tipo", val)}
                  readonly={readOnly}
                />
                <CampoInput
                  label="Data Início"
                  value={ativ.data_inicio || ""}
                  onChange={(val) =>
                    handleChange(ativ.id, "data_inicio", val)
                  }
                  tipo="date"
                  readonly={readOnly}
                />
                <CampoInput
                  label="Data Fim"
                  value={ativ.data_fim || ""}
                  onChange={(val) => handleChange(ativ.id, "data_fim", val)}
                  tipo="date"
                  readonly={readOnly}
                />
              </div>

              <CampoInput
                label="Carga Horária"
                value={ativ.ch_hora_relogio || ""}
                onChange={(val) =>
                  handleChange(ativ.id, "ch_hora_relogio", val)
                }
                readonly={readOnly}
              />

              <CampoInput
                label="Descrição"
                value={ativ.descricao || ""}
                onChange={(val) =>
                  handleChange(ativ.id, "descricao", val)
                }
                readonly={readOnly}
              />

              {/* Docentes */}
              <div className="border-t pt-4">
                <h5 className="text-xs font-bold text-gray-700 mb-3">
                  Docentes
                </h5>
                {(ativ.docentes || []).length > 0 ? (
                  <div className="space-y-2">
                    {ativ.docentes?.map((doc, idx) => (
                      <div
                        key={idx}
                        className="flex gap-3 items-end p-2 bg-gray-50 rounded border border-gray-200"
                      >
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <CampoInput
                            label="Nome"
                            value={doc.nome || ""}
                            onChange={(val) =>
                              handleDocenteChange(
                                ativ.id,
                                idx,
                                "nome",
                                val
                              )
                            }
                            readonly={readOnly}
                          />
                          <CampoInput
                            label="Titulação"
                            value={doc.titulacao || ""}
                            onChange={(val) =>
                              handleDocenteChange(
                                ativ.id,
                                idx,
                                "titulacao",
                                val
                              )
                            }
                            readonly={readOnly}
                          />
                        </div>
                        {!readOnly && (
                          <button
                            onClick={() =>
                              handleDocenteRemove(ativ.id, idx)
                            }
                            className="px-2 py-1 text-red-500 hover:bg-red-50 rounded border border-red-200 text-xs font-medium"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    Nenhum docente. Clique em Adicionar.
                  </p>
                )}
                {!readOnly && (
                  <button
                    onClick={() => handleDocenteAdd(ativ.id)}
                    className="mt-2 px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded text-xs font-medium hover:bg-purple-100"
                  >
                    + Docente
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-gray-400 italic py-4">
            Nenhuma atividade complementar. Clique em Adicionar para incluir.
          </p>
        )}

        {!readOnly && (
          <button
            onClick={handleAdd}
            className="w-full px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium hover:bg-purple-100"
          >
            + Adicionar Atividade
          </button>
        )}
      </div>
    </Secao>
  );
}
