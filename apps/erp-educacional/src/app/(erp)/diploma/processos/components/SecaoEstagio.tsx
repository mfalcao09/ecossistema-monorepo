"use client";

import { Briefcase, Trash2 } from "lucide-react";
import { Secao, CampoInput } from "./ui-helpers";
import type { EstadoRevisao, Estagio, DocenteInfo } from "../types";

interface SecaoEstagioProps {
  revisao: EstadoRevisao;
  setRevisao: (revisao: EstadoRevisao) => void;
  secaoAberta: boolean;
  onToggle: (id: string) => void;
  readOnly?: boolean;
}

export function SecaoEstagio({
  revisao,
  setRevisao,
  secaoAberta,
  onToggle,
  readOnly,
}: SecaoEstagioProps) {
  const handleAdd = () => {
    const newEstagio: Estagio = {
      id: `est-${Date.now()}`,
      codigo_unidade_curricular: "",
      data_inicio: "",
      data_fim: "",
      concedente_cnpj: "",
      concedente_razao_social: "",
      concedente_nome_fantasia: "",
      ch_hora_relogio: "",
      descricao: "",
      docentes: [],
    };
    setRevisao({
      ...revisao,
      estagios: [...revisao.estagios, newEstagio],
    });
  };

  const handleRemove = (id: string) => {
    setRevisao({
      ...revisao,
      estagios: revisao.estagios.filter((e) => e.id !== id),
    });
  };

  const handleChange = (
    id: string,
    field: keyof Estagio,
    value: any
  ) => {
    setRevisao({
      ...revisao,
      estagios: revisao.estagios.map((e) =>
        e.id === id ? { ...e, [field]: value } : e
      ),
    });
  };

  const handleDocenteAdd = (id: string) => {
    const estagio = revisao.estagios.find((e) => e.id === id);
    if (!estagio) return;

    const newDocentes = [
      ...(estagio.docentes || []),
      { nome: "", titulacao: "", cpf: "", lattes: "" },
    ];
    handleChange(id, "docentes", newDocentes);
  };

  const handleDocenteRemove = (id: string, docIndex: number) => {
    const estagio = revisao.estagios.find((e) => e.id === id);
    if (!estagio) return;

    const newDocentes = (estagio.docentes || []).filter(
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
    const estagio = revisao.estagios.find((e) => e.id === id);
    if (!estagio) return;

    const newDocentes = (estagio.docentes || []).map((d, i) =>
      i === docIndex ? { ...d, [field]: value } : d
    );
    handleChange(id, "docentes", newDocentes);
  };

  return (
    <Secao
      id="secao-estagio"
      titulo="Estágio"
      icone={<Briefcase size={18} className="text-orange-600" />}
      aberta={secaoAberta}
      onToggle={onToggle}
    >
      <div className="space-y-4">
        {revisao.estagios.length > 0 ? (
          revisao.estagios.map((estagio) => (
            <div
              key={estagio.id}
              className="p-4 border border-gray-200 rounded-lg bg-white space-y-4"
            >
              <div className="flex items-start justify-between">
                <h4 className="text-sm font-semibold text-gray-800">
                  {estagio.concedente_razao_social ||
                    estagio.concedente_nome_fantasia ||
                    "Estágio"}
                </h4>
                {!readOnly && (
                  <button
                    onClick={() => handleRemove(estagio.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded"
                    title="Remover estágio"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {/* Dados gerais */}
              <div className="grid grid-cols-2 gap-4">
                <CampoInput
                  label="Código UC"
                  value={estagio.codigo_unidade_curricular || ""}
                  onChange={(val) =>
                    handleChange(estagio.id, "codigo_unidade_curricular", val)
                  }
                  readonly={readOnly}
                />
                <CampoInput
                  label="Carga Horária"
                  value={estagio.ch_hora_relogio || ""}
                  onChange={(val) =>
                    handleChange(estagio.id, "ch_hora_relogio", val)
                  }
                  readonly={readOnly}
                />
                <CampoInput
                  label="Data Início"
                  value={estagio.data_inicio || ""}
                  onChange={(val) =>
                    handleChange(estagio.id, "data_inicio", val)
                  }
                  tipo="date"
                  readonly={readOnly}
                />
                <CampoInput
                  label="Data Fim"
                  value={estagio.data_fim || ""}
                  onChange={(val) =>
                    handleChange(estagio.id, "data_fim", val)
                  }
                  tipo="date"
                  readonly={readOnly}
                />
              </div>

              {/* Concedente */}
              <div className="border-t pt-4">
                <h5 className="text-xs font-bold text-gray-700 mb-3">
                  Concedente
                </h5>
                <div className="grid grid-cols-1 gap-3">
                  <CampoInput
                    label="CNPJ"
                    value={estagio.concedente_cnpj || ""}
                    onChange={(val) =>
                      handleChange(estagio.id, "concedente_cnpj", val)
                    }
                    readonly={readOnly}
                  />
                  <CampoInput
                    label="Razão Social"
                    value={estagio.concedente_razao_social || ""}
                    onChange={(val) =>
                      handleChange(estagio.id, "concedente_razao_social", val)
                    }
                    readonly={readOnly}
                  />
                  <CampoInput
                    label="Nome Fantasia"
                    value={estagio.concedente_nome_fantasia || ""}
                    onChange={(val) =>
                      handleChange(estagio.id, "concedente_nome_fantasia", val)
                    }
                    readonly={readOnly}
                  />
                </div>
              </div>

              {/* Descrição */}
              <CampoInput
                label="Descrição"
                value={estagio.descricao || ""}
                onChange={(val) =>
                  handleChange(estagio.id, "descricao", val)
                }
                readonly={readOnly}
              />

              {/* Docentes Orientadores */}
              <div className="border-t pt-4">
                <h5 className="text-xs font-bold text-gray-700 mb-3">
                  Docentes Orientadores
                </h5>
                {(estagio.docentes || []).length > 0 ? (
                  <div className="space-y-2">
                    {estagio.docentes?.map((doc, idx) => (
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
                                estagio.id,
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
                                estagio.id,
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
                              handleDocenteRemove(estagio.id, idx)
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
                    Nenhum docente orientador. Clique em Adicionar.
                  </p>
                )}
                {!readOnly && (
                  <button
                    onClick={() => handleDocenteAdd(estagio.id)}
                    className="mt-2 px-3 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded text-xs font-medium hover:bg-orange-100"
                  >
                    + Docente Orientador
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-gray-400 italic py-4">
            Nenhum estágio registrado.
          </p>
        )}

        {!readOnly && (
          <button
            onClick={handleAdd}
            className="w-full px-4 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-sm font-medium hover:bg-orange-100"
          >
            + Adicionar Estágio
          </button>
        )}
      </div>
    </Secao>
  );
}
