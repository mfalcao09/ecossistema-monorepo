"use client";

import React from "react";
import { GraduationCap } from "lucide-react";
import { Secao, CampoInput, CampoSelect } from "./ui-helpers";
import type { EstadoRevisao, DadosExtraidos } from "../types";

interface SecaoAcademicosProps {
  revisao: EstadoRevisao;
  setRevisao: React.Dispatch<React.SetStateAction<EstadoRevisao>>;
  dadosExtraidos?: DadosExtraidos;
  secaoAberta: boolean;
  onToggle: (id: string) => void;
  readOnly?: boolean;
}

export function SecaoAcademicos({
  revisao,
  setRevisao,
  dadosExtraidos,
  secaoAberta,
  onToggle,
  readOnly,
}: SecaoAcademicosProps) {
  const handleChange = (field: keyof EstadoRevisao, value: any) => {
    setRevisao((prev) => ({ ...prev, [field]: value }));
  };

  const handleAreaAdd = () => {
    setRevisao((prev) => ({
      ...prev,
      areas: [
        ...prev.areas,
        { id: `area-${Date.now()}`, codigo: "", nome: "" },
      ],
    }));
  };

  const handleAreaRemove = (id: string) => {
    setRevisao((prev) => ({
      ...prev,
      areas: prev.areas.filter((a) => a.id !== id),
    }));
  };

  const handleAreaChange = (id: string, field: string, value: string) => {
    setRevisao((prev) => ({
      ...prev,
      areas: prev.areas.map((a) =>
        a.id === id ? { ...a, [field]: value } : a
      ),
    }));
  };

  const handleEnadeChange = (field: string, value: string) => {
    handleChange(field as keyof EstadoRevisao, value);
  };

  return (
    <Secao
      id="secao-academicos"
      titulo="Dados Acadêmicos / Histórico"
      icone={<GraduationCap size={18} className="text-amber-600" />}
      aberta={secaoAberta}
      onToggle={onToggle}
    >
      <div className="space-y-6">
        {/* Grid principal */}
        <div className="grid grid-cols-2 gap-4">
          <CampoInput
            label="Forma de Acesso"
            value={revisao.forma_acesso}
            onChange={(val) => handleChange("forma_acesso", val)}
            obrigatorio
            sugestaoIA={dadosExtraidos?.forma_acesso}
            readonly={readOnly}
          />
          <CampoInput
            label="Data de Ingresso"
            value={revisao.data_ingresso}
            onChange={(val) => handleChange("data_ingresso", val)}
            tipo="date"
            obrigatorio
            sugestaoIA={dadosExtraidos?.data_ingresso}
            readonly={readOnly}
          />
          <CampoInput
            label="Data de Conclusão"
            value={revisao.data_conclusao}
            onChange={(val) => handleChange("data_conclusao", val)}
            tipo="date"
            obrigatorio
            sugestaoIA={dadosExtraidos?.data_conclusao}
            readonly={readOnly}
          />
          <CampoInput
            label="Situação Atual Discente"
            value={revisao.situacao_discente}
            onChange={() => {}} // readonly, auto-filled
            readonly
            obrigatorio
          />
          <CampoInput
            label="Período Letivo Formatura"
            value={revisao.periodo_letivo}
            onChange={(val) => handleChange("periodo_letivo", val)}
            readonly={readOnly}
          />
          <CampoInput
            label="Código Currículo"
            value={revisao.codigo_curriculo}
            onChange={(val) => handleChange("codigo_curriculo", val)}
            obrigatorio
            sugestaoIA={dadosExtraidos?.codigo_curriculo}
            readonly={readOnly}
          />
          <CampoInput
            label="Carga Horária Curso (prevista)"
            value={revisao.carga_horaria_curso}
            onChange={(val) => handleChange("carga_horaria_curso", val)}
            obrigatorio
            sugestaoIA={dadosExtraidos?.carga_horaria_curso}
            readonly={readOnly}
          />
          <CampoInput
            label="Carga Horária Integralizada (cumprida)"
            value={revisao.carga_horaria_integralizada}
            onChange={(val) => handleChange("carga_horaria_integralizada", val)}
            obrigatorio
            readonly={readOnly}
          />
          <CampoInput
            label="Hora-Aula (minutos)"
            value={revisao.hora_aula}
            onChange={(val) => handleChange("hora_aula", val)}
            placeholder="Campo interno — não obrigatório no XSD"
            sugestaoIA={dadosExtraidos?.hora_aula}
            readonly={readOnly}
          />
          <CampoInput
            label="Data Emissão Histórico"
            value={revisao.data_emissao_historico}
            onChange={(val) => handleChange("data_emissao_historico", val)}
            tipo="date"
            obrigatorio
            readonly={readOnly}
          />
          <CampoInput
            label="Hora Emissão Histórico"
            value={revisao.hora_emissao_historico}
            onChange={(val) => handleChange("hora_emissao_historico", val)}
            tipo="time"
            obrigatorio
            readonly={readOnly}
          />
        </div>

        {/* Sub-seção ENADE */}
        <div className="border-t pt-4">
          <h4 className="text-xs font-bold text-gray-700 mb-4">ENADE</h4>
          <div className="grid grid-cols-2 gap-4">
            <CampoSelect
              label="Situação do Curso"
              value={revisao.enade_situacao}
              onChange={(val) => {
                handleEnadeChange("enade_situacao", val);
                // Se curso não selecionado, limpar condição
                if (val === "CursoNaoSelecionado") {
                  handleEnadeChange("enade_condicao", "");
                }
              }}
              opcoes={[
                { valor: "CursoSelecionado", label: "Curso Selecionado" },
                { valor: "CursoNaoSelecionado", label: "Curso Não Selecionado" },
              ]}
              obrigatorio
              sugestaoIA={dadosExtraidos?.situacao_enade}
              readonly={readOnly}
            />
            {revisao.enade_situacao === "CursoSelecionado" && (
              <CampoSelect
                label="Situação do Aluno"
                value={revisao.enade_condicao}
                onChange={(val) => handleEnadeChange("enade_condicao", val)}
                opcoes={[
                  { valor: "Regular", label: "Regular" },
                  { valor: "Irregular", label: "Irregular" },
                ]}
                obrigatorio
                sugestaoIA={dadosExtraidos?.enade_condicao}
                readonly={readOnly}
              />
            )}
            <CampoInput
              label="Edição/Ano"
              value={revisao.enade_edicao}
              onChange={(val) => handleEnadeChange("enade_edicao", val)}
              sugestaoIA={dadosExtraidos?.enade_edicao}
              readonly={readOnly}
            />
          </div>
        </div>

        {/* Sub-seção Áreas */}
        <div className="border-t pt-4">
          <h4 className="text-xs font-bold text-gray-700 mb-4">Áreas</h4>
          <div className="mb-4">
            <CampoInput
              label="Nome para Áreas"
              value={revisao.nome_para_areas}
              onChange={(val) => handleChange("nome_para_areas", val)}
              readonly={readOnly}
            />
          </div>

          {revisao.areas.length > 0 ? (
            <div className="space-y-3">
              {revisao.areas.map((area) => (
                <div
                  key={area.id}
                  className="flex gap-3 items-end p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <CampoInput
                      label="Código"
                      value={area.codigo}
                      onChange={(val) =>
                        handleAreaChange(area.id, "codigo", val)
                      }
                      readonly={readOnly}
                    />
                    <CampoInput
                      label="Nome"
                      value={area.nome}
                      onChange={(val) =>
                        handleAreaChange(area.id, "nome", val)
                      }
                      readonly={readOnly}
                    />
                  </div>
                  {!readOnly && (
                    <button
                      onClick={() => handleAreaRemove(area.id)}
                      className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg border border-red-200 text-sm font-medium"
                    >
                      Remover
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">
              Nenhuma área. Clique em Adicionar para incluir.
            </p>
          )}

          {!readOnly && (
            <button
              onClick={handleAreaAdd}
              className="mt-3 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-100"
            >
              + Adicionar Área
            </button>
          )}
        </div>
      </div>
    </Secao>
  );
}
