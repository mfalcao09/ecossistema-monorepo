"use client";

import { Building2, RefreshCw } from "lucide-react";
import type { DadosEmissoraCadastro } from "../types";
import { Secao, CampoReadonly } from "./ui-helpers";

interface IESOption {
  id: string;
  nome: string;
  tipo: string;
}

interface SecaoEmissoraProps {
  dadosEmissora: DadosEmissoraCadastro | null;
  secaoAberta: boolean;
  onToggle: (id: string) => void;
  listaIES?: IESOption[];
  iesId?: string;
  onSelectIES?: (id: string) => void;
}

export function SecaoEmissora({
  dadosEmissora,
  secaoAberta,
  onToggle,
  listaIES,
  iesId,
  onSelectIES,
}: SecaoEmissoraProps) {
  if (!dadosEmissora) {
    return (
      <Secao
        id="secao-emissora"
        titulo="Instituição Emissora"
        icone={<Building2 size={18} className="text-indigo-600" />}
        aberta={secaoAberta}
        onToggle={onToggle}
        readonly={true}
      >
        <div className="p-4 space-y-4">
          {listaIES && listaIES.length > 0 && onSelectIES ? (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Selecione a IES Emissora
              </label>
              <select
                value={iesId || ""}
                onChange={(e) => onSelectIES(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
              >
                <option value="">— Selecione uma IES —</option>
                {listaIES
                  .filter((i) => i.tipo === "emissora" || i.tipo === "mantenedora_emissora")
                  .map((ies) => (
                    <option key={ies.id} value={ies.id}>
                      {ies.nome} ({ies.tipo})
                    </option>
                  ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">
                Ou selecione um curso — a IES será preenchida automaticamente.
              </p>
            </div>
          ) : (
            <p className="text-center text-gray-500 text-sm">
              Selecione um curso para preencher os dados da IES automaticamente.
            </p>
          )}
        </div>
      </Secao>
    );
  }

  return (
    <Secao
      id="secao-emissora"
      titulo="Instituição Emissora"
      icone={<Building2 size={18} className="text-indigo-600" />}
      aberta={secaoAberta}
      onToggle={onToggle}
      readonly={true}
    >
      <div className="space-y-6">
        {/* Dados da IES */}
        <div>
          <h3 className="text-sm font-bold text-gray-800 mb-4">Dados da IES</h3>
          <div className="grid grid-cols-2 gap-4">
            <CampoReadonly
              label="Nome"
              value={dadosEmissora.nome}
              obrigatorio={true}
            />
            <CampoReadonly
              label="Código MEC"
              value={dadosEmissora.codigo_mec}
              obrigatorio={true}
            />
            <CampoReadonly
              label="CNPJ"
              value={dadosEmissora.cnpj}
              obrigatorio={true}
            />
          </div>
        </div>

        {/* Endereço */}
        <div className="border-t pt-6">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Endereço</h3>
          <div className="grid grid-cols-2 gap-4">
            <CampoReadonly
              label="CEP"
              value={dadosEmissora.endereco?.cep}
              obrigatorio={false}
            />
            <CampoReadonly
              label="Logradouro"
              value={dadosEmissora.endereco?.logradouro}
              obrigatorio={false}
            />
            <CampoReadonly
              label="Número"
              value={dadosEmissora.endereco?.numero}
              obrigatorio={false}
            />
            <CampoReadonly
              label="Complemento"
              value={dadosEmissora.endereco?.complemento}
              obrigatorio={false}
            />
            <CampoReadonly
              label="Bairro"
              value={dadosEmissora.endereco?.bairro}
              obrigatorio={false}
            />
            <CampoReadonly
              label="Município"
              value={dadosEmissora.endereco?.municipio}
              obrigatorio={false}
            />
            <CampoReadonly
              label="Código Município"
              value={dadosEmissora.endereco?.codigo_municipio}
              obrigatorio={false}
            />
            <CampoReadonly
              label="UF"
              value={dadosEmissora.endereco?.uf}
              obrigatorio={false}
            />
          </div>
        </div>

        {/* Credenciamento */}
        {dadosEmissora.credenciamento && (
          <div className="border-t pt-6">
            <h3 className="text-sm font-bold text-gray-800 mb-4">Credenciamento</h3>
            <div className="grid grid-cols-2 gap-4">
              <CampoReadonly
                label="Tipo"
                value={dadosEmissora.credenciamento.tipo}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Número"
                value={dadosEmissora.credenciamento.numero}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Data"
                value={dadosEmissora.credenciamento.data}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Veículo Publicação"
                value={dadosEmissora.credenciamento.veiculo_publicacao}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Número DOU"
                value={dadosEmissora.credenciamento.numero_dou}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Data Publicação"
                value={dadosEmissora.credenciamento.data_publicacao}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Seção Publicação"
                value={dadosEmissora.credenciamento.secao_publicacao}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Página Publicação"
                value={dadosEmissora.credenciamento.pagina_publicacao}
                obrigatorio={false}
              />
            </div>
          </div>
        )}

        {/* Recredenciamento - conditional */}
        {dadosEmissora.recredenciamento && (
          <div className="border-t pt-6">
            <h3 className="text-sm font-bold text-gray-800 mb-4">Recredenciamento</h3>
            <div className="grid grid-cols-2 gap-4">
              <CampoReadonly
                label="Tipo"
                value={dadosEmissora.recredenciamento.tipo}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Número"
                value={dadosEmissora.recredenciamento.numero}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Data"
                value={dadosEmissora.recredenciamento.data}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Veículo Publicação"
                value={dadosEmissora.recredenciamento.veiculo_publicacao}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Número DOU"
                value={dadosEmissora.recredenciamento.numero_dou}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Data Publicação"
                value={dadosEmissora.recredenciamento.data_publicacao}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Seção Publicação"
                value={dadosEmissora.recredenciamento.secao_publicacao}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Página Publicação"
                value={dadosEmissora.recredenciamento.pagina_publicacao}
                obrigatorio={false}
              />
            </div>
          </div>
        )}

        {/* Renovação Recredenciamento - conditional */}
        {dadosEmissora.renovacao_recredenciamento && (
          <div className="border-t pt-6">
            <h3 className="text-sm font-bold text-gray-800 mb-4">
              Renovação Recredenciamento
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <CampoReadonly
                label="Tipo"
                value={dadosEmissora.renovacao_recredenciamento.tipo}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Número"
                value={dadosEmissora.renovacao_recredenciamento.numero}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Data"
                value={dadosEmissora.renovacao_recredenciamento.data}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Veículo Publicação"
                value={dadosEmissora.renovacao_recredenciamento.veiculo_publicacao}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Número DOU"
                value={dadosEmissora.renovacao_recredenciamento.numero_dou}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Data Publicação"
                value={dadosEmissora.renovacao_recredenciamento.data_publicacao}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Seção Publicação"
                value={dadosEmissora.renovacao_recredenciamento.secao_publicacao}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Página Publicação"
                value={dadosEmissora.renovacao_recredenciamento.pagina_publicacao}
                obrigatorio={false}
              />
            </div>
          </div>
        )}

        {/* Mantenedora */}
        {dadosEmissora.mantenedora && (
          <div className="border-t pt-6">
            <h3 className="text-sm font-bold text-gray-800 mb-4">Mantenedora</h3>
            <div className="grid grid-cols-2 gap-4">
              <CampoReadonly
                label="Razão Social"
                value={dadosEmissora.mantenedora.razao_social}
                obrigatorio={false}
              />
              <CampoReadonly
                label="CNPJ"
                value={dadosEmissora.mantenedora.cnpj}
                obrigatorio={false}
              />
              <CampoReadonly
                label="CEP"
                value={dadosEmissora.mantenedora.endereco?.cep}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Logradouro"
                value={dadosEmissora.mantenedora.endereco?.logradouro}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Número"
                value={dadosEmissora.mantenedora.endereco?.numero}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Complemento"
                value={dadosEmissora.mantenedora.endereco?.complemento}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Bairro"
                value={dadosEmissora.mantenedora.endereco?.bairro}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Município"
                value={dadosEmissora.mantenedora.endereco?.municipio}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Código Município"
                value={dadosEmissora.mantenedora.endereco?.codigo_municipio}
                obrigatorio={false}
              />
              <CampoReadonly
                label="UF"
                value={dadosEmissora.mantenedora.endereco?.uf}
                obrigatorio={false}
              />
            </div>
          </div>
        )}

        {/* Termo de Responsabilidade */}
        {dadosEmissora.termo_responsabilidade && (
          <div className="border-t pt-6">
            <h3 className="text-sm font-bold text-gray-800 mb-4">
              Termo de Responsabilidade
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <CampoReadonly
                label="Nome"
                value={dadosEmissora.termo_responsabilidade.nome}
                obrigatorio={false}
              />
              <CampoReadonly
                label="CPF"
                value={dadosEmissora.termo_responsabilidade.cpf}
                obrigatorio={false}
              />
              <CampoReadonly
                label="Cargo"
                value={dadosEmissora.termo_responsabilidade.cargo}
                obrigatorio={false}
              />
            </div>
          </div>
        )}
      </div>
    </Secao>
  );
}
