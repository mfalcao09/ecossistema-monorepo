"use client";

import { useEffect, useState, useRef } from "react";
import { PenTool, Trash2, Plus, Loader2, RefreshCw, Building2, User } from "lucide-react";
import { Secao, CampoInput } from "./ui-helpers";
import type { EstadoRevisao, Assinante } from "../types";

// Labels para cargos (mesmo do cadastro de assinantes)
const CARGO_LABELS: Record<string, string> = {
  reitor: "Reitor(a)",
  reitor_exercicio: "Reitor(a) em Exercício",
  responsavel_registro: "Responsável pelo Registro",
  coordenador_curso: "Coordenador(a) de Curso",
  subcoordenador_curso: "Subcoordenador(a) de Curso",
  coordenador_exercicio: "Coordenador(a) em Exercício",
  chefe_registro: "Chefe do Registro",
  chefe_registro_exercicio: "Chefe do Registro em Exercício",
  secretario_decano: "Secretário(a)/Decano",
  outro: "Outro",
};

function formatCPF(cpf: string) {
  const n = cpf?.replace(/\D/g, "") || "";
  if (n.length === 11) return n.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  if (n.length === 14) return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  return cpf;
}

interface AssinanteBD {
  id: string;
  nome: string;
  cpf: string;
  cargo: string;
  outro_cargo: string | null;
  tipo_certificado: "eCPF" | "eCNPJ";
  ordem_assinatura: number;
  ativo: boolean;
}

interface SecaoAssinantesProps {
  revisao: EstadoRevisao;
  setRevisao: (revisao: EstadoRevisao | ((prev: EstadoRevisao) => EstadoRevisao)) => void;
  secaoAberta: boolean;
  onToggle: (id: string) => void;
  readOnly?: boolean;
}

export function SecaoAssinantes({
  revisao,
  setRevisao,
  secaoAberta,
  onToggle,
  readOnly = false,
}: SecaoAssinantesProps) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const jaCarregou = useRef(false);

  // ── Auto-carregar assinantes cadastrados ao montar ──────────────────
  useEffect(() => {
    if (jaCarregou.current) return;
    // Só carregar se os campos estão vazios (processo novo)
    if (revisao.assinantes_diploma.length > 0 || revisao.ecnpj_emissora) return;

    carregarAssinantes();
  }, []);

  async function carregarAssinantes() {
    setCarregando(true);
    setErro("");
    jaCarregou.current = true;

    try {
      const resp = await fetch("/api/assinantes");
      if (!resp.ok) throw new Error("Erro ao buscar assinantes");
      const lista: AssinanteBD[] = await resp.json();

      if (!Array.isArray(lista) || lista.length === 0) {
        setErro("Nenhum assinante cadastrado. Configure os assinantes em Diploma → Assinantes.");
        return;
      }

      // Filtrar somente ativos
      const ativos = lista.filter((a) => a.ativo);
      if (ativos.length === 0) {
        setErro("Nenhum assinante ativo encontrado.");
        return;
      }

      // Separar eCPF e eCNPJ
      const ecpfs = ativos
        .filter((a) => a.tipo_certificado === "eCPF")
        .sort((a, b) => a.ordem_assinatura - b.ordem_assinatura);

      const ecnpj = ativos.find((a) => a.tipo_certificado === "eCNPJ");

      // Montar assinantes para o formulário
      const assinantesForm: Assinante[] = ecpfs.map((a) => ({
        id: a.id,
        nome: a.nome,
        cpf: a.cpf,
        cargo: a.outro_cargo || CARGO_LABELS[a.cargo] || a.cargo,
      }));

      // Usar forma funcional para evitar stale closure (race condition com extração IA)
      setRevisao((prev: EstadoRevisao) => ({
        ...prev,
        assinantes_diploma: assinantesForm,
        ecnpj_emissora: ecnpj ? formatCPF(ecnpj.cpf) : "",
      }));
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar assinantes");
    } finally {
      setCarregando(false);
    }
  }

  const handleEcnpjChange = (valor: string) => {
    setRevisao({
      ...revisao,
      ecnpj_emissora: valor,
    });
  };

  const handleAssinanteChange = (id: string, campo: keyof Assinante, valor: string) => {
    setRevisao({
      ...revisao,
      assinantes_diploma: revisao.assinantes_diploma.map((a) =>
        a.id === id ? { ...a, [campo]: valor } : a
      ),
    });
  };

  const handleAddAssinante = () => {
    const novoId = `assinante-${Date.now()}`;
    setRevisao({
      ...revisao,
      assinantes_diploma: [
        ...revisao.assinantes_diploma,
        {
          id: novoId,
          nome: "",
          cpf: "",
          cargo: "",
        },
      ],
    });
  };

  const handleDeleteAssinante = (id: string) => {
    setRevisao({
      ...revisao,
      assinantes_diploma: revisao.assinantes_diploma.filter((a) => a.id !== id),
    });
  };

  return (
    <Secao
      id="sec-10-assinantes"
      titulo="Assinantes do Diploma"
      icone={<PenTool size={16} className="text-rose-600" />}
      aberta={secaoAberta}
      onToggle={onToggle}
    >
      <div className="space-y-5">
        {/* Status de carregamento */}
        {carregando && (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
            <Loader2 size={14} className="animate-spin" />
            Carregando assinantes cadastrados...
          </div>
        )}

        {/* Erro */}
        {erro && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
            {erro}
          </div>
        )}

        {/* e-CNPJ da IES Emissora */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={14} className="text-indigo-500" />
            <span className="text-xs font-bold text-gray-700">e-CNPJ da IES Emissora</span>
          </div>
          <CampoInput
            label=""
            value={revisao.ecnpj_emissora}
            onChange={handleEcnpjChange}
            tipo="text"
            placeholder="Preenchido automaticamente do cadastro"
            readonly={readOnly}
          />
          {revisao.ecnpj_emissora && (
            <p className="text-xs text-green-600 mt-1">
              ✓ e-CNPJ carregado do cadastro de assinantes
            </p>
          )}
        </div>

        {/* Lista de Assinantes (eCPF) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <User size={14} className="text-blue-500" />
              <h3 className="text-xs font-bold text-gray-700">Assinantes (e-CPF)</h3>
              {revisao.assinantes_diploma.length > 0 && (
                <span className="text-xs text-gray-400">
                  ({revisao.assinantes_diploma.length} assinante{revisao.assinantes_diploma.length > 1 ? "s" : ""})
                </span>
              )}
            </div>
            {!carregando && !readOnly && (
              <button
                onClick={() => {
                  jaCarregou.current = false;
                  setRevisao({ ...revisao, assinantes_diploma: [], ecnpj_emissora: "" });
                  setTimeout(() => carregarAssinantes(), 100);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                title="Recarregar assinantes do cadastro"
              >
                <RefreshCw size={12} />
                Recarregar
              </button>
            )}
          </div>

          {revisao.assinantes_diploma.length === 0 && !carregando ? (
            <p className="text-sm text-gray-500 italic mb-4">Nenhum assinante adicionado.</p>
          ) : (
            <div className="space-y-3 mb-4">
              {revisao.assinantes_diploma.map((assinante, idx) => (
                <div
                  key={assinante.id}
                  className="bg-gray-50 p-4 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      eCPF
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <CampoInput
                      label="Nome"
                      value={assinante.nome}
                      onChange={(val) =>
                        handleAssinanteChange(assinante.id, "nome", val)
                      }
                      obrigatorio
                      placeholder="Nome completo"
                      readonly={readOnly}
                    />
                    <CampoInput
                      label="CPF"
                      value={formatCPF(assinante.cpf)}
                      onChange={(val) =>
                        handleAssinanteChange(assinante.id, "cpf", val)
                      }
                      obrigatorio
                      placeholder="000.000.000-00"
                      tipo="text"
                      readonly={readOnly}
                    />
                    <CampoInput
                      label="Cargo"
                      value={assinante.cargo}
                      onChange={(val) =>
                        handleAssinanteChange(assinante.id, "cargo", val)
                      }
                      obrigatorio
                      placeholder="Ex: Reitor"
                      readonly={readOnly}
                    />
                  </div>

                  {/* Delete button */}
                  <div className="flex justify-end">
                    {!readOnly && (
                      <button
                        onClick={() => handleDeleteAssinante(assinante.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 size={14} />
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add button */}
          {!readOnly && (
            <button
              onClick={handleAddAssinante}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-rose-200"
            >
              <Plus size={14} />
              Adicionar Assinante
            </button>
          )}
        </div>
      </div>
    </Secao>
  );
}
