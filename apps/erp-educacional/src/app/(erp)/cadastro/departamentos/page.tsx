"use client";

import { useState, useEffect } from "react";
import {
  Building,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  Users,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import AIAssistant from "@/components/ai/AIAssistant";

// Formata CPF: 12345678901 -> 123.456.789-01
function formatCPF(cpf: string): string {
  const n = cpf.replace(/\D/g, "");
  if (n.length > 11) return cpf;
  return n
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

// Formata CNPJ
function formatCNPJ(cnpj: string): string {
  const n = cnpj.replace(/\D/g, "");
  if (n.length > 14) return cnpj;
  return n
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

// Formata telefone
function formatTelefone(tel: string): string {
  const n = tel.replace(/\D/g, "");
  if (n.length === 11) return n.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (n.length === 10) return n.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return tel;
}

interface Instituicao {
  id: string;
  nome: string;
  tipo: string;
}

interface Departamento {
  id: string;
  instituicao_id: string;
  codigo: number;
  nome: string;
  razao_social: string;
  cnpj: string;
  chefe_nome: string;
  chefe_cpf: string;
  chefe_email: string;
  chefe_telefone: string;
  utiliza_ano_semestre: boolean;
  instituicoes?: Instituicao;
}

const EMPTY_FORM = {
  instituicao_id: "",
  nome: "",
  razao_social: "",
  cnpj: "",
  chefe_nome: "",
  chefe_cpf: "",
  chefe_email: "",
  chefe_telefone: "",
  utiliza_ano_semestre: true,
};

export default function DepartamentosPage() {
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [instituicoes, setInstituicoes] = useState<Instituicao[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [aiMessage, setAiMessage] = useState("");
  const [showChefeSection, setShowChefeSection] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [deptRes, instRes] = await Promise.all([
        fetch("/api/departamentos"),
        fetch("/api/instituicoes"),
      ]);
      const deptData = await deptRes.json();
      const instData = await instRes.json();
      setDepartamentos(Array.isArray(deptData) ? deptData : []);
      // Filtra apenas unidades de ensino (emissora) para vincular
      setInstituicoes(
        Array.isArray(instData)
          ? instData.filter((i: Instituicao) => i.tipo === "emissora" || i.tipo === "registradora")
          : []
      );
    } catch (err) {
      console.error("Erro ao buscar dados:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Quando seleciona a instituição, auto-preenche razão social e CNPJ da mantenedora
  async function handleInstituicaoChange(instituicaoId: string) {
    handleChange("instituicao_id", instituicaoId);

    if (!instituicaoId) return;

    // Busca dados da instituição selecionada e tenta preencher CNPJ/razão social
    try {
      const res = await fetch("/api/instituicoes");
      const allInst = await res.json();

      // Encontra a mantenedora vinculada
      const mantenedora = allInst.find(
        (i: { tipo: string }) => i.tipo === "mantenedora_emissora" || i.tipo === "mantenedora_registradora"
      );

      if (mantenedora) {
        setForm((prev) => ({
          ...prev,
          instituicao_id: instituicaoId,
          razao_social: mantenedora.nome || prev.razao_social,
          cnpj: mantenedora.cnpj || prev.cnpj,
        }));
        setAiMessage(
          `Razao social e CNPJ preenchidos automaticamente com dados da mantenedora "${mantenedora.nome}".`
        );
        setTimeout(() => setAiMessage(""), 5000);
      }
    } catch {
      // Silently fail
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const url = editingId
        ? `/api/departamentos/${editingId}`
        : "/api/departamentos";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error("Erro ao salvar:", err);
        setAiMessage("Erro ao salvar departamento. Verifique os dados.");
        setTimeout(() => setAiMessage(""), 5000);
        setSaving(false);
        return;
      }

      setForm(EMPTY_FORM);
      setEditingId(null);
      setShowForm(false);
      fetchData();
      setAiMessage(
        editingId
          ? "Departamento atualizado com sucesso!"
          : "Departamento cadastrado com sucesso!"
      );
      setTimeout(() => setAiMessage(""), 3000);
    } catch (err) {
      console.error("Erro ao salvar:", err);
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(dept: Departamento) {
    setForm({
      instituicao_id: dept.instituicao_id || "",
      nome: dept.nome || "",
      razao_social: dept.razao_social || "",
      cnpj: dept.cnpj || "",
      chefe_nome: dept.chefe_nome || "",
      chefe_cpf: dept.chefe_cpf || "",
      chefe_email: dept.chefe_email || "",
      chefe_telefone: dept.chefe_telefone || "",
      utiliza_ano_semestre: dept.utiliza_ano_semestre ?? true,
    });
    setEditingId(dept.id);
    setShowChefeSection(!!dept.chefe_nome);
    setShowForm(true);
  }

  async function handleDelete(dept: Departamento) {
    if (!confirm(`Deseja realmente excluir o departamento "${dept.nome}"?`))
      return;

    try {
      const res = await fetch(`/api/departamentos/${dept.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchData();
        setAiMessage(`"${dept.nome}" removido com sucesso.`);
        setTimeout(() => setAiMessage(""), 3000);
      }
    } catch (err) {
      console.error("Erro ao excluir:", err);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Departamentos</h1>
          <p className="text-gray-500 mt-1">
            Gerencie os departamentos vinculados as unidades de ensino
          </p>
        </div>
        <button
          onClick={() => {
            setForm(EMPTY_FORM);
            setEditingId(null);
            setShowChefeSection(false);
            setShowForm(true);
          }}
          className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={18} />
          Novo Departamento
        </button>
      </div>

      {/* AI Message */}
      {aiMessage && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 flex items-center gap-3 animate-in">
          <Sparkles size={20} className="text-primary-500 shrink-0" />
          <p className="text-sm text-primary-700">{aiMessage}</p>
        </div>
      )}

      {/* Aviso se não tem instituição cadastrada */}
      {!loading && instituicoes.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Sparkles size={20} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Cadastre uma Unidade de Ensino primeiro
            </p>
            <p className="text-xs text-amber-600 mt-1">
              Para criar departamentos, voce precisa ter ao menos uma unidade de
              ensino cadastrada em{" "}
              <a
                href="/cadastro/ies"
                className="underline font-medium hover:text-amber-800"
              >
                Instituicoes
              </a>
              .
            </p>
          </div>
        </div>
      )}

      {/* Lista de Departamentos */}
      {!loading && departamentos.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <div className="col-span-1">Cod.</div>
            <div className="col-span-3">Nome</div>
            <div className="col-span-3">Razao Social</div>
            <div className="col-span-2">CNPJ</div>
            <div className="col-span-2">Unidade</div>
            <div className="col-span-1">Acoes</div>
          </div>

          {/* Table Body */}
          {departamentos.map((dept) => (
            <div
              key={dept.id}
              className="grid grid-cols-12 gap-4 px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors items-center"
            >
              <div className="col-span-1 text-sm font-mono text-gray-600">
                {dept.codigo}
              </div>
              <div className="col-span-3">
                <p className="text-sm font-semibold text-gray-900">
                  {dept.nome}
                </p>
                {dept.chefe_nome && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Chefe: {dept.chefe_nome}
                  </p>
                )}
              </div>
              <div className="col-span-3 text-sm text-gray-600 truncate">
                {dept.razao_social || "—"}
              </div>
              <div className="col-span-2 text-sm text-gray-600 font-mono">
                {dept.cnpj || "—"}
              </div>
              <div className="col-span-2 text-xs text-gray-500 truncate">
                {dept.instituicoes?.nome || "—"}
              </div>
              <div className="col-span-1 flex items-center gap-1">
                <button
                  onClick={() => handleEdit(dept)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                  title="Editar"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(dept)}
                  className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                  title="Excluir"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && departamentos.length === 0 && instituicoes.length > 0 && !showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Building size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">
            Nenhum departamento cadastrado
          </h3>
          <p className="text-gray-500 mt-2 max-w-md mx-auto">
            Crie departamentos como Graduacao, Pos-graduacao, Ensino Tecnico,
            etc. Eles serao vinculados a sua unidade de ensino.
          </p>
          <button
            onClick={() => {
              setForm(EMPTY_FORM);
              setEditingId(null);
              setShowForm(true);
            }}
            className="mt-6 inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Criar Primeiro Departamento
          </button>
        </div>
      )}

      {/* Modal de Formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-40 overflow-y-auto py-8">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4">
            {/* Header */}
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingId ? "Editar Departamento" : "Novo Departamento"}
                </h2>
                <p className="text-sm text-gray-500">
                  Vincule o departamento a uma unidade de ensino
                </p>
              </div>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Secao: Dados do Departamento */}
              <section>
                <h3 className="text-sm font-bold text-primary-600 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <Building size={14} />
                  Departamento
                </h3>

                <div className="space-y-4">
                  {/* Unidade de Ensino */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Unidade de Ensino <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.instituicao_id}
                      onChange={(e) =>
                        handleInstituicaoChange(e.target.value)
                      }
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Selecione uma unidade...</option>
                      {instituicoes.map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          {inst.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Nome */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Nome <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.nome}
                      onChange={(e) => handleChange("nome", e.target.value)}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Ex: Departamento de Graduacao"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Razao Social */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Razao Social
                      </label>
                      <input
                        type="text"
                        value={form.razao_social}
                        onChange={(e) =>
                          handleChange("razao_social", e.target.value)
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Razao social da mantenedora"
                      />
                    </div>

                    {/* CNPJ */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        CNPJ
                      </label>
                      <input
                        type="text"
                        value={form.cnpj}
                        onChange={(e) =>
                          handleChange("cnpj", formatCNPJ(e.target.value))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="00.000.000/0000-00"
                        maxLength={18}
                      />
                    </div>
                  </div>

                  {/* Utiliza ano/semestre */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.utiliza_ano_semestre}
                      onChange={(e) =>
                        handleChange("utiliza_ano_semestre", e.target.checked)
                      }
                      className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">
                      Esse departamento utiliza ano/semestre
                    </span>
                  </label>
                </div>
              </section>

              {/* Secao: Chefe de Departamento (colapsavel) */}
              <section className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowChefeSection(!showChefeSection)}
                  className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-emerald-600" />
                    <h3 className="text-sm font-bold text-emerald-600 uppercase tracking-wide">
                      Chefe de Departamento
                    </h3>
                  </div>
                  {showChefeSection ? (
                    <ChevronDown size={16} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={16} className="text-gray-400" />
                  )}
                </button>
                {showChefeSection && (
                  <div className="p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          Nome
                        </label>
                        <input
                          type="text"
                          value={form.chefe_nome}
                          onChange={(e) =>
                            handleChange("chefe_nome", e.target.value)
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="Nome completo"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          CPF
                        </label>
                        <input
                          type="text"
                          value={form.chefe_cpf}
                          onChange={(e) =>
                            handleChange("chefe_cpf", formatCPF(e.target.value))
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="000.000.000-00"
                          maxLength={14}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          E-mail
                        </label>
                        <input
                          type="email"
                          value={form.chefe_email}
                          onChange={(e) =>
                            handleChange("chefe_email", e.target.value)
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="email@exemplo.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          Telefone
                        </label>
                        <input
                          type="text"
                          value={form.chefe_telefone}
                          onChange={(e) =>
                            handleChange(
                              "chefe_telefone",
                              formatTelefone(e.target.value)
                            )
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="(00) 00000-0000"
                          maxLength={15}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                  className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.nome || !form.instituicao_id}
                  className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  {saving ? "Salvando..." : "Salvar Departamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Assistant */}
      <AIAssistant
        context="departamentos"
        placeholder="Pergunte sobre departamentos..."
        suggestions={[
          "Quais departamentos devo criar?",
          "Qual a diferenca entre departamento e curso?",
          "Preciso de departamento para diploma digital?",
        ]}
      />
    </div>
  );
}
