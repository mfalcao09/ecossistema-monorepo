"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { UserPlus, Trash2, Loader2 } from "lucide-react";
import type { EstadoRevisao, DadosExtraidos, Genitor } from "../types";
import { Secao, CampoInput, CampoSelect, UF_OPTIONS, SEXO_OPTIONS } from "./ui-helpers";

interface SecaoPessoaisProps {
  revisao: EstadoRevisao;
  setRevisao: (revisao: EstadoRevisao) => void;
  dadosExtraidos?: DadosExtraidos;
  secaoAberta: boolean;
  onToggle: (id: string) => void;
  readOnly?: boolean;
}

export function SecaoPessoais({
  revisao,
  setRevisao,
  dadosExtraidos,
  secaoAberta,
  onToggle,
  readOnly,
}: SecaoPessoaisProps) {
  // Auto-update nome from CPF + nome_aluno
  useEffect(() => {
    if (revisao.cpf && revisao.nome_aluno) {
      const novoNome = `${revisao.cpf} - ${revisao.nome_aluno}`;
      if (revisao.nome !== novoNome) {
        setRevisao({ ...revisao, nome: novoNome });
      }
    }
  }, [revisao.cpf, revisao.nome_aluno, revisao.nome, setRevisao]);

  // ── IBGE: auto-lookup código município quando município + UF mudam ──
  const [buscandoIBGE, setBuscandoIBGE] = useState(false);
  const ibgeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const buscarCodigoIBGE = useCallback(
    async (municipio: string, uf: string) => {
      if (!municipio || municipio.length < 3 || !uf) return;
      setBuscandoIBGE(true);
      try {
        const params = new URLSearchParams({ nome: municipio, uf });
        const res = await fetch(`/api/ibge-municipios?${params}`);
        if (!res.ok) throw new Error("Erro IBGE");
        const data: { codigo: string; nome: string; uf: string }[] = await res.json();
        if (data.length > 0) {
          // Buscar match exato (normalizado) ou usar o primeiro
          const nomNorm = municipio
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase();
          const exato = data.find(
            (m) =>
              m.nome
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toUpperCase() === nomNorm
          );
          const melhor = exato || data[0];
          if (melhor.codigo !== revisao.naturalidade_codigo_municipio) {
            setRevisao({
              ...revisao,
              naturalidade_codigo_municipio: melhor.codigo,
              // Se o nome veio ligeiramente diferente (acentuação), atualizar
              naturalidade_municipio: melhor.nome,
            });
          }
        }
      } catch (err) {
        console.warn("[IBGE] Erro ao buscar código município:", err);
      } finally {
        setBuscandoIBGE(false);
      }
    },
    [revisao, setRevisao]
  );

  // Debounce: aguarda 600ms após última alteração de município/UF
  useEffect(() => {
    if (ibgeTimerRef.current) clearTimeout(ibgeTimerRef.current);
    if (
      revisao.naturalidade_municipio &&
      revisao.naturalidade_municipio.length >= 3 &&
      revisao.naturalidade_uf
    ) {
      ibgeTimerRef.current = setTimeout(() => {
        buscarCodigoIBGE(revisao.naturalidade_municipio, revisao.naturalidade_uf);
      }, 600);
    }
    return () => {
      if (ibgeTimerRef.current) clearTimeout(ibgeTimerRef.current);
    };
  }, [revisao.naturalidade_municipio, revisao.naturalidade_uf, buscarCodigoIBGE]);

  const adicionarGenitor = () => {
    const novoGenitor: Genitor = {
      id: `gen-${Date.now()}`,
      nome: "",
      sexo: "Feminino",
      nome_social: "",
    };
    setRevisao({ ...revisao, genitores: [...revisao.genitores, novoGenitor] });
  };

  const removerGenitor = (id: string) => {
    if (revisao.genitores.length > 1) {
      setRevisao({
        ...revisao,
        genitores: revisao.genitores.filter((g) => g.id !== id),
      });
    }
  };

  const atualizarGenitor = (id: string, campo: keyof Genitor, valor: string) => {
    setRevisao({
      ...revisao,
      genitores: revisao.genitores.map((g) =>
        g.id === id ? { ...g, [campo]: valor } : g
      ),
    });
  };

  return (
    <Secao
      id="secao-pessoais"
      titulo="Dados Pessoais do Diplomado"
      icone={<UserPlus size={18} className="text-blue-600" />}
      aberta={secaoAberta}
      onToggle={onToggle}
    >
      <div className="space-y-6">
        {/* Grid 2 colunas - Dados Pessoais */}
        <div className="grid grid-cols-2 gap-4">
          {/* Nome Completo */}
          <CampoInput
            label="Nome Completo"
            value={revisao.nome_aluno}
            onChange={(val) => setRevisao({ ...revisao, nome_aluno: val })}
            obrigatorio={true}
            placeholder="Ex: João Silva Santos"
            sugestaoIA={dadosExtraidos?.nome_aluno}
            readonly={readOnly}
          />

          {/* Nome Social */}
          <CampoInput
            label="Nome Social"
            value={revisao.nome_social}
            onChange={(val) => setRevisao({ ...revisao, nome_social: val })}
            obrigatorio={false}
            placeholder="Opcional"
            sugestaoIA={dadosExtraidos?.nome_social}
            readonly={readOnly}
          />

          {/* CPF */}
          <CampoInput
            label="CPF"
            value={revisao.cpf}
            onChange={(val) => setRevisao({ ...revisao, cpf: val })}
            obrigatorio={true}
            placeholder="000.000.000-00"
            sugestaoIA={dadosExtraidos?.cpf}
            readonly={readOnly}
          />

          {/* Data de Nascimento */}
          <CampoInput
            label="Data de Nascimento"
            value={revisao.data_nascimento}
            onChange={(val) => setRevisao({ ...revisao, data_nascimento: val })}
            tipo="date"
            obrigatorio={true}
            sugestaoIA={dadosExtraidos?.data_nascimento}
            readonly={readOnly}
          />

          {/* Sexo */}
          <CampoSelect
            label="Sexo"
            value={revisao.sexo}
            onChange={(val) => setRevisao({ ...revisao, sexo: val })}
            opcoes={SEXO_OPTIONS}
            obrigatorio={true}
            sugestaoIA={dadosExtraidos?.sexo}
            readonly={readOnly}
          />

          {/* Nacionalidade */}
          <CampoInput
            label="Nacionalidade"
            value={revisao.nacionalidade}
            onChange={(val) => setRevisao({ ...revisao, nacionalidade: val })}
            obrigatorio={true}
            placeholder="Ex: Brasileira"
            sugestaoIA={dadosExtraidos?.nacionalidade}
            readonly={readOnly}
          />

          {/* Naturalidade - Município */}
          <CampoInput
            label="Naturalidade - Município"
            value={revisao.naturalidade_municipio}
            onChange={(val) => setRevisao({ ...revisao, naturalidade_municipio: val })}
            obrigatorio={true}
            placeholder="Ex: Cassilândia"
            sugestaoIA={dadosExtraidos?.naturalidade_municipio}
            readonly={readOnly}
          />

          {/* Naturalidade - Código Município (auto-preenchido via IBGE) */}
          <div className="relative">
            <CampoInput
              label={`Naturalidade - Código Município${buscandoIBGE ? " (buscando...)" : ""}`}
              value={revisao.naturalidade_codigo_municipio}
              onChange={(val) => setRevisao({ ...revisao, naturalidade_codigo_municipio: val })}
              obrigatorio={true}
              placeholder={buscandoIBGE ? "Consultando IBGE..." : "Auto-preenchido via IBGE"}
              sugestaoIA={dadosExtraidos?.naturalidade_codigo_municipio}
              readonly={readOnly}
            />
            {buscandoIBGE && (
              <Loader2
                size={16}
                className="absolute right-3 top-9 animate-spin text-violet-500"
              />
            )}
          </div>

          {/* Naturalidade - UF */}
          <CampoSelect
            label="Naturalidade - UF"
            value={revisao.naturalidade_uf}
            onChange={(val) => setRevisao({ ...revisao, naturalidade_uf: val })}
            opcoes={UF_OPTIONS}
            obrigatorio={true}
            sugestaoIA={dadosExtraidos?.naturalidade_uf}
            readonly={readOnly}
          />

          {/* RG - Número */}
          <CampoInput
            label="RG - Número"
            value={revisao.rg_numero}
            onChange={(val) => setRevisao({ ...revisao, rg_numero: val })}
            obrigatorio={true}
            placeholder="Ex: 1234567-8"
            sugestaoIA={dadosExtraidos?.rg}
            readonly={readOnly}
          />

          {/* RG - UF */}
          <CampoSelect
            label="RG - UF"
            value={revisao.rg_uf}
            onChange={(val) => setRevisao({ ...revisao, rg_uf: val })}
            opcoes={UF_OPTIONS}
            obrigatorio={true}
            sugestaoIA={dadosExtraidos?.rg_uf}
            readonly={readOnly}
          />

          {/* RG - Órgão Expedidor */}
          <CampoInput
            label="RG - Órgão Expedidor"
            value={revisao.rg_orgao_expedidor}
            onChange={(val) => setRevisao({ ...revisao, rg_orgao_expedidor: val })}
            obrigatorio={true}
            placeholder="Ex: SSP/SP"
            sugestaoIA={dadosExtraidos?.rg_orgao_expedidor}
            readonly={readOnly}
          />

          {/* Doc Substituto RG */}
          <CampoInput
            label="Doc Substituto RG"
            value={revisao.doc_substituto_rg}
            onChange={(val) => setRevisao({ ...revisao, doc_substituto_rg: val })}
            obrigatorio={false}
            placeholder="Opcional"
            sugestaoIA={dadosExtraidos?.doc_substituto_rg}
            readonly={readOnly}
          />

          {/* Telefone */}
          <CampoInput
            label="Telefone"
            value={revisao.telefone}
            onChange={(val) => setRevisao({ ...revisao, telefone: val })}
            obrigatorio={false}
            tipo="tel"
            placeholder="(00) 00000-0000"
            sugestaoIA={dadosExtraidos?.telefone}
            readonly={readOnly}
          />

          {/* E-mail */}
          <CampoInput
            label="E-mail"
            value={revisao.email}
            onChange={(val) => setRevisao({ ...revisao, email: val })}
            obrigatorio={false}
            tipo="email"
            placeholder="email@example.com"
            sugestaoIA={dadosExtraidos?.email}
            readonly={readOnly}
          />
        </div>

        {/* Sub-section: Filiação */}
        <div className="border-t pt-6">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Filiação</h3>

          <div className="space-y-4">
            {revisao.genitores.map((genitor) => (
              <div
                key={genitor.id}
                className="p-4 border border-gray-200 rounded-lg bg-gray-50"
              >
                <div className="grid grid-cols-3 gap-4 mb-3">
                  {/* Nome */}
                  <CampoInput
                    label="Nome"
                    value={genitor.nome}
                    onChange={(val) => atualizarGenitor(genitor.id, "nome", val)}
                    obrigatorio={true}
                    placeholder="Nome do genitor"
                    readonly={readOnly}
                  />

                  {/* Sexo */}
                  <CampoSelect
                    label="Sexo"
                    value={genitor.sexo}
                    onChange={(val) => atualizarGenitor(genitor.id, "sexo", val)}
                    opcoes={SEXO_OPTIONS}
                    obrigatorio={true}
                    readonly={readOnly}
                  />

                  {/* Nome Social */}
                  <CampoInput
                    label="Nome Social"
                    value={genitor.nome_social || ""}
                    onChange={(val) => atualizarGenitor(genitor.id, "nome_social", val)}
                    obrigatorio={false}
                    placeholder="Opcional"
                    readonly={readOnly}
                  />
                </div>

                {/* Remove button - only show if more than 1 genitor and not readOnly */}
                {revisao.genitores.length > 1 && !readOnly && (
                  <button
                    onClick={() => removerGenitor(genitor.id)}
                    className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 transition-colors"
                  >
                    <Trash2 size={14} />
                    Remover
                  </button>
                )}
              </div>
            ))}

            {/* Add button - only show if not readOnly */}
            {!readOnly && (
              <button
                onClick={adicionarGenitor}
                className="px-4 py-2 text-sm font-medium text-violet-600 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors"
              >
                + Adicionar Genitor
              </button>
            )}
          </div>
        </div>
      </div>
    </Secao>
  );
}
