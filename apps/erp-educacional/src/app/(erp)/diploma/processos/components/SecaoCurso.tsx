"use client";

import { BookOpen } from "lucide-react";
import type { DadosCursoCadastro } from "../types";
import { Secao, CampoReadonly } from "./ui-helpers";

interface SecaoCursoProps {
  dadosCurso: DadosCursoCadastro | null;
  secaoAberta: boolean;
  onToggle: (id: string) => void;
}

export function SecaoCurso({
  dadosCurso,
  secaoAberta,
  onToggle,
}: SecaoCursoProps) {
  if (!dadosCurso) {
    return (
      <Secao
        id="secao-curso"
        titulo="Dados do Curso"
        icone={<BookOpen size={18} className="text-emerald-600" />}
        aberta={secaoAberta}
        onToggle={onToggle}
        readonly={true}
      >
        <div className="p-4 text-center text-gray-500 text-sm">
          Selecione um curso para ver os dados
        </div>
      </Secao>
    );
  }

  return (
    <Secao
      id="secao-curso"
      titulo="Dados do Curso"
      icone={<BookOpen size={18} className="text-emerald-600" />}
      aberta={secaoAberta}
      onToggle={onToggle}
      readonly={true}
    >
      <div className="space-y-6">
        {/* Dados Básicos */}
        <div>
          <h3 className="text-sm font-bold text-gray-800 mb-4">Dados Básicos</h3>
          <div className="grid grid-cols-2 gap-4">
            <CampoReadonly
              label="Nome"
              value={dadosCurso.nome}
              obrigatorio={true}
            />
            <CampoReadonly
              label="Código E-MEC"
              value={dadosCurso.codigo_emec}
              obrigatorio={false}
            />
            <CampoReadonly
              label="Modalidade"
              value={dadosCurso.modalidade}
              obrigatorio={false}
            />
            <CampoReadonly
              label="Título Conferido"
              value={dadosCurso.titulo_conferido}
              obrigatorio={false}
            />
            <CampoReadonly
              label="Grau Conferido"
              value={dadosCurso.grau_conferido}
              obrigatorio={false}
            />
            <CampoReadonly
              label="Outro Título"
              value={dadosCurso.outro_titulo}
              obrigatorio={false}
            />
          </div>
        </div>

        {/* Endereço do Curso */}
        <div className="border-t pt-6">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Endereço do Curso</h3>
          <div className="grid grid-cols-2 gap-4">
            <CampoReadonly
              label="CEP"
              value={dadosCurso.endereco?.cep}
              obrigatorio={false}
            />
            <CampoReadonly
              label="Logradouro"
              value={dadosCurso.endereco?.logradouro}
              obrigatorio={false}
            />
            <CampoReadonly
              label="Número"
              value={dadosCurso.endereco?.numero}
              obrigatorio={false}
            />
            <CampoReadonly
              label="Complemento"
              value={dadosCurso.endereco?.complemento}
              obrigatorio={false}
            />
            <CampoReadonly
              label="Bairro"
              value={dadosCurso.endereco?.bairro}
              obrigatorio={false}
            />
            <CampoReadonly
              label="Município"
              value={dadosCurso.endereco?.municipio}
              obrigatorio={false}
            />
            <CampoReadonly
              label="Código Município"
              value={dadosCurso.endereco?.codigo_municipio}
              obrigatorio={false}
            />
            <CampoReadonly
              label="UF"
              value={dadosCurso.endereco?.uf}
              obrigatorio={false}
            />
          </div>
        </div>

        {/* Polo EAD - conditional */}
        {dadosCurso.polo && (
          <div className="border-t pt-6">
            <h3 className="text-sm font-bold text-gray-800 mb-4">Polo EAD</h3>
            <div className="grid grid-cols-2 gap-4">
              <CampoReadonly
                label="Nome do Polo"
                value={dadosCurso.polo.nome}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Código E-MEC"
                value={dadosCurso.polo.codigo_emec}
                obrigatorio={false}
              />
              <CampoReadonly
                label="CEP"
                value={dadosCurso.polo.endereco?.cep}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Logradouro"
                value={dadosCurso.polo.endereco?.logradouro}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Número"
                value={dadosCurso.polo.endereco?.numero}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Complemento"
                value={dadosCurso.polo.endereco?.complemento}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Bairro"
                value={dadosCurso.polo.endereco?.bairro}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Município"
                value={dadosCurso.polo.endereco?.municipio}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Código Município"
                value={dadosCurso.polo.endereco?.codigo_municipio}
                obrigatorio={false}
              />
              <CampoReadonly
                label="UF"
                value={dadosCurso.polo.endereco?.uf}
                obrigatorio={false}
              />
            </div>
          </div>
        )}

        {/* Autorização */}
        {dadosCurso.autorizacao && (
          <div className="border-t pt-6">
            <h3 className="text-sm font-bold text-gray-800 mb-4">Autorização</h3>
            <div className="grid grid-cols-2 gap-4">
              <CampoReadonly
                label="Tipo"
                value={dadosCurso.autorizacao.tipo}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Número"
                value={dadosCurso.autorizacao.numero}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Data"
                value={dadosCurso.autorizacao.data}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Veículo Publicação"
                value={dadosCurso.autorizacao.veiculo_publicacao}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Número DOU"
                value={dadosCurso.autorizacao.numero_dou}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Data Publicação"
                value={dadosCurso.autorizacao.data_publicacao}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Seção Publicação"
                value={dadosCurso.autorizacao.secao_publicacao}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Página Publicação"
                value={dadosCurso.autorizacao.pagina_publicacao}
                obrigatorio={false}
              />
            </div>
          </div>
        )}

        {/* Reconhecimento */}
        {dadosCurso.reconhecimento && (
          <div className="border-t pt-6">
            <h3 className="text-sm font-bold text-gray-800 mb-4">Reconhecimento</h3>
            <div className="grid grid-cols-2 gap-4">
              <CampoReadonly
                label="Tipo"
                value={dadosCurso.reconhecimento.tipo}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Número"
                value={dadosCurso.reconhecimento.numero}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Data"
                value={dadosCurso.reconhecimento.data}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Veículo Publicação"
                value={dadosCurso.reconhecimento.veiculo_publicacao}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Número DOU"
                value={dadosCurso.reconhecimento.numero_dou}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Data Publicação"
                value={dadosCurso.reconhecimento.data_publicacao}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Seção Publicação"
                value={dadosCurso.reconhecimento.secao_publicacao}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Página Publicação"
                value={dadosCurso.reconhecimento.pagina_publicacao}
                obrigatorio={false}
              />
            </div>
          </div>
        )}

        {/* Renovação Reconhecimento - conditional */}
        {dadosCurso.renovacao_reconhecimento && (
          <div className="border-t pt-6">
            <h3 className="text-sm font-bold text-gray-800 mb-4">
              Renovação Reconhecimento
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <CampoReadonly
                label="Tipo"
                value={dadosCurso.renovacao_reconhecimento.tipo}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Número"
                value={dadosCurso.renovacao_reconhecimento.numero}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Data"
                value={dadosCurso.renovacao_reconhecimento.data}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Veículo Publicação"
                value={dadosCurso.renovacao_reconhecimento.veiculo_publicacao}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Número DOU"
                value={dadosCurso.renovacao_reconhecimento.numero_dou}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Data Publicação"
                value={dadosCurso.renovacao_reconhecimento.data_publicacao}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Seção Publicação"
                value={dadosCurso.renovacao_reconhecimento.secao_publicacao}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Página Publicação"
                value={dadosCurso.renovacao_reconhecimento.pagina_publicacao}
                obrigatorio={false}
              />
            </div>
          </div>
        )}
      </div>
    </Secao>
  );
}
