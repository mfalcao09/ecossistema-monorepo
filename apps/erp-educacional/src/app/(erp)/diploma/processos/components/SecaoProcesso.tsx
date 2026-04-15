"use client";

import { useEffect } from "react";
import { FolderOpen } from "lucide-react";
import type { EstadoRevisao, DadosExtraidos, Curso } from "../types";
import { Secao, CampoInput, CampoSelect, TURNO_OPTIONS } from "./ui-helpers";

interface SecaoProcessoProps {
  revisao: EstadoRevisao;
  setRevisao: (revisao: EstadoRevisao) => void;
  dadosExtraidos?: DadosExtraidos;
  cursos: Curso[];
  secaoAberta: boolean;
  onToggle: (id: string) => void;
  readOnly?: boolean;
}

export function SecaoProcesso({
  revisao,
  setRevisao,
  dadosExtraidos,
  cursos,
  secaoAberta,
  onToggle,
  readOnly,
}: SecaoProcessoProps) {
  // Auto-update nome from CPF + nome_aluno
  useEffect(() => {
    if (revisao.cpf && revisao.nome_aluno) {
      const novoNome = `${revisao.cpf} - ${revisao.nome_aluno}`;
      if (revisao.nome !== novoNome) {
        setRevisao({ ...revisao, nome: novoNome });
      }
    }
  }, [revisao.cpf, revisao.nome_aluno, revisao.nome, setRevisao]);

  return (
    <Secao
      id="secao-processo"
      titulo="Dados do Processo"
      icone={<FolderOpen size={18} className="text-violet-600" />}
      aberta={secaoAberta}
      onToggle={onToggle}
    >
      <div className="space-y-4">
        {/* Nome do Processo - READONLY, auto-composed */}
        <CampoInput
          label="Nome do Processo"
          value={revisao.nome}
          onChange={() => {}} // readonly
          readonly={true}
          obrigatorio={true}
          sugestaoIA={dadosExtraidos?.nome_processo}
        />

        {/* Curso - dropdown */}
        <CampoSelect
          label="Curso"
          value={revisao.curso_id}
          onChange={(val) => setRevisao({ ...revisao, curso_id: val })}
          opcoes={cursos.map((c) => ({ valor: c.id, label: c.nome }))}
          obrigatorio={true}
          placeholder="Selecione um curso"
          sugestaoIA={dadosExtraidos?.curso}
          readonly={readOnly}
        />

        {/* Turno - select */}
        <CampoSelect
          label="Turno"
          value={revisao.turno}
          onChange={(val) => setRevisao({ ...revisao, turno: val })}
          opcoes={TURNO_OPTIONS}
          obrigatorio={true}
          sugestaoIA={dadosExtraidos?.turno}
          readonly={readOnly}
        />

        {/* Período Letivo - text */}
        <CampoInput
          label="Período Letivo"
          value={revisao.periodo_letivo}
          onChange={(val) => setRevisao({ ...revisao, periodo_letivo: val })}
          obrigatorio={false}
          placeholder="ex: 2024.1 (opcional — cada disciplina tem seu período)"
          sugestaoIA={dadosExtraidos?.periodo_letivo}
          readonly={readOnly}
        />

        {/* Data de Colação - date */}
        <CampoInput
          label="Data de Colação"
          value={revisao.data_colacao}
          onChange={(val) => setRevisao({ ...revisao, data_colacao: val })}
          tipo="date"
          obrigatorio={true}
          sugestaoIA={dadosExtraidos?.data_colacao}
          readonly={readOnly}
        />
      </div>
    </Secao>
  );
}
