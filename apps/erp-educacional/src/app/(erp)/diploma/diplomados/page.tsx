"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, Pencil, Trash2, Sparkles, Search,
  UserCheck, GraduationCap, UserPlus, Award,
  ChevronRight, X, Loader2, Mail,
  FileText, MapPin, AlertCircle,
} from "lucide-react";
import SmartCPFInput from "@/components/ai/SmartCPFInput";
import AIAssistant from "@/components/ai/AIAssistant";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Filiacao {
  id?: string;
  nome: string;
  nome_social: string;
  sexo: string;
  ordem: number;
}

interface Diplomado {
  id: string;
  nome: string;
  nome_social: string;
  cpf: string;
  ra: string;
  email: string;
  telefone: string;
  data_nascimento: string;
  sexo: string;
  nacionalidade: string;
  naturalidade_municipio: string;
  naturalidade_uf: string;
  codigo_municipio_ibge: string; // Obrigatório XSD v1.05
  rg_numero: string;
  rg_orgao_expedidor: string;
  rg_uf: string;
  created_at: string;
  filiacoes: Filiacao[];
  diplomas: { id: string; status: string }[];
}

const UF_OPTIONS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS",
  "MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC",
  "SP","SE","TO",
];

const FORM_VAZIO = {
  nome: "", nome_social: "", cpf: "", ra: "", email: "",
  telefone: "", data_nascimento: "", sexo: "",
  nacionalidade: "Brasileira",
  naturalidade_municipio: "", naturalidade_uf: "",
  codigo_municipio_ibge: "", // Código IBGE 7 dígitos — obrigatório XSD v1.05
  rg_numero: "", rg_orgao_expedidor: "", rg_uf: "",
  filiacoes: [
    { nome: "", nome_social: "", sexo: "F", ordem: 1 },
    { nome: "", nome_social: "", sexo: "M", ordem: 2 },
  ],
};

// ─── Formatadores ─────────────────────────────────────────────────────────────

function formatCPF(cpf: string) {
  const n = cpf.replace(/\D/g, "");
  return n.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

function formatDate(d: string) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
}

function getDiplomasCount(d: Diplomado) {
  if (!d.diplomas || d.diplomas.length === 0) return 0;
  return d.diplomas.length;
}

// ─── Componente NaturalidadeTab ───────────────────────────────────────────────
// Aba de naturalidade com lookup automático de código IBGE via API pública
interface NaturalidadeTabProps {
  form: typeof FORM_VAZIO;
  setForm: React.Dispatch<React.SetStateAction<typeof FORM_VAZIO>>;
}

function NaturalidadeTab({ form, setForm }: NaturalidadeTabProps) {
  const [buscandoIbge, setBuscandoIbge] = useState(false);
  const [ibgeStatus, setIbgeStatus] = useState<"idle" | "ok" | "not_found">("idle");

  async function buscarCodigoIbge() {
    const municipio = form.naturalidade_municipio.trim();
    const uf = form.naturalidade_uf;
    if (!municipio || !uf) return;

    setBuscandoIbge(true);
    setIbgeStatus("idle");

    try {
      // API pública do IBGE — sem chave necessária
      const res = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`
      );
      const municipios: { id: number; nome: string }[] = await res.json();

      const normalize = (s: string) =>
        s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

      const encontrado = municipios.find(
        (m) => normalize(m.nome) === normalize(municipio)
      );

      if (encontrado) {
        setForm((p) => ({ ...p, codigo_municipio_ibge: String(encontrado.id) }));
        setIbgeStatus("ok");
      } else {
        setIbgeStatus("not_found");
      }
    } catch {
      setIbgeStatus("not_found");
    } finally {
      setBuscandoIbge(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <MapPin size={18} className="text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-700">Local de Nascimento</h3>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Nacionalidade</label>
        <input
          type="text"
          value={form.nacionalidade}
          onChange={(e) => setForm((p) => ({ ...p, nacionalidade: e.target.value }))}
          placeholder="Ex: Brasileira"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Município de Nascimento</label>
          <input
            type="text"
            value={form.naturalidade_municipio}
            onChange={(e) => {
              setForm((p) => ({ ...p, naturalidade_municipio: e.target.value, codigo_municipio_ibge: "" }));
              setIbgeStatus("idle");
            }}
            placeholder="Ex: Cassilândia"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">UF</label>
          <select
            value={form.naturalidade_uf}
            onChange={(e) => {
              setForm((p) => ({ ...p, naturalidade_uf: e.target.value, codigo_municipio_ibge: "" }));
              setIbgeStatus("idle");
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Selecione</option>
            {UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </div>
      </div>

      {/* Campo IBGE com lookup automático */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-semibold text-gray-700">
            Código IBGE do Município{" "}
            <span className="text-red-500">*</span>
            <span className="text-xs font-normal text-gray-400 ml-1">(obrigatório XSD v1.05)</span>
          </label>
          <button
            type="button"
            onClick={buscarCodigoIbge}
            disabled={buscandoIbge || !form.naturalidade_municipio || !form.naturalidade_uf}
            className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 disabled:text-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {buscandoIbge ? (
              <><Loader2 size={12} className="animate-spin" /> Buscando...</>
            ) : (
              <><Sparkles size={12} /> Buscar código IBGE automaticamente</>
            )}
          </button>
        </div>
        <div className="relative">
          <input
            type="text"
            value={form.codigo_municipio_ibge}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 7);
              setForm((p) => ({ ...p, codigo_municipio_ibge: val }));
              setIbgeStatus("idle");
            }}
            placeholder="Ex: 3509502 (Cassilândia/MS)"
            maxLength={7}
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 pr-8 ${
              ibgeStatus === "ok"
                ? "border-green-400 bg-green-50"
                : ibgeStatus === "not_found"
                ? "border-red-300 bg-red-50"
                : "border-gray-300"
            }`}
          />
          {ibgeStatus === "ok" && (
            <span className="absolute right-3 top-2.5 text-green-500 text-xs font-bold">✓</span>
          )}
        </div>
        {ibgeStatus === "ok" && (
          <p className="text-xs text-green-600 mt-1">
            ✓ Código IBGE encontrado e preenchido automaticamente
          </p>
        )}
        {ibgeStatus === "not_found" && (
          <p className="text-xs text-red-600 mt-1">
            Município não encontrado para a UF selecionada. Verifique a grafia ou preencha manualmente consultando{" "}
            <a
              href="https://cidades.ibge.gov.br"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              cidades.ibge.gov.br
            </a>.
          </p>
        )}
        <p className="text-xs text-gray-400 mt-1">
          O código IBGE tem 7 dígitos e identifica unicamente o município. É exigido pelo XSD do Diploma Digital MEC.
          Preencha o município e a UF acima, depois clique em &quot;Buscar código IBGE automaticamente&quot;.
        </p>
      </div>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function DiplomadosPage() {
  const [diplomados, setDiplomados] = useState<Diplomado[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Diplomado | null>(null);
  const [abaAtiva, setAbaAtiva] = useState(0);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [cpfDuplicado, setCpfDuplicado] = useState(false);

  // ── Carregar diplomados ──────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/diplomados${search ? `?search=${encodeURIComponent(search)}` : ""}`);
      const data = await res.json();
      setDiplomados(Array.isArray(data) ? data : []);
    } catch {
      setDiplomados([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { carregar(); }, [carregar]);

  // ── Estatísticas ─────────────────────────────────────────────────────────
  const totalDiplomados = diplomados.length;
  const novosEsteMes = diplomados.filter((d) => {
    const criado = new Date(d.created_at);
    const agora = new Date();
    return criado.getMonth() === agora.getMonth() && criado.getFullYear() === agora.getFullYear();
  }).length;
  const totalDiplomas = diplomados.reduce((acc, d) => acc + getDiplomasCount(d), 0);
  const semDiplomas = diplomados.filter((d) => getDiplomasCount(d) === 0).length;

  // ── Abrir modal ───────────────────────────────────────────────────────────
  function abrirModal(diplomado?: Diplomado) {
    if (diplomado) {
      setEditando(diplomado);
      const filiacoes = diplomado.filiacoes && diplomado.filiacoes.length > 0
        ? [...diplomado.filiacoes]
        : FORM_VAZIO.filiacoes;
      while (filiacoes.length < 2) {
        filiacoes.push({ nome: "", nome_social: "", sexo: filiacoes.length === 0 ? "F" : "M", ordem: filiacoes.length + 1 });
      }
      setForm({
        ...FORM_VAZIO,
        ...diplomado,
        cpf: formatCPF(diplomado.cpf),
        filiacoes,
      });
    } else {
      setEditando(null);
      setForm(FORM_VAZIO);
    }
    setAbaAtiva(0);
    setErro("");
    setCpfDuplicado(false);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setEditando(null);
    setForm(FORM_VAZIO);
    setErro("");
  }

  // ── Salvar ────────────────────────────────────────────────────────────────
  async function salvar() {
    if (!form.nome.trim() || !form.cpf || !form.data_nascimento || !form.sexo) {
      setErro("Preencha os campos obrigatórios: Nome, CPF, Data de Nascimento e Sexo.");
      setAbaAtiva(0);
      return;
    }
    if (cpfDuplicado && !editando) {
      setErro("CPF já cadastrado. Verifique antes de prosseguir.");
      setAbaAtiva(0);
      return;
    }

    setSalvando(true);
    setErro("");

    try {
      const payload = { ...form };
      const url = editando ? `/api/diplomados/${editando.id}` : "/api/diplomados";
      const method = editando ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao salvar");
      }

      fecharModal();
      carregar();
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setSalvando(false);
    }
  }

  // ── Excluir ───────────────────────────────────────────────────────────────
  async function excluir(id: string, nome: string) {
    if (!confirm(`Confirma a exclusão de ${nome}? Esta ação não pode ser desfeita.`)) return;
    await fetch(`/api/diplomados/${id}`, { method: "DELETE" });
    carregar();
  }

  // ── Atualizar filiação ────────────────────────────────────────────────────
  function atualizarFiliacao(idx: number, campo: string, valor: string) {
    setForm((prev) => {
      const filiacoes = [...prev.filiacoes];
      filiacoes[idx] = { ...filiacoes[idx], [campo]: valor };
      return { ...prev, filiacoes };
    });
  }

  const abas = ["Dados Pessoais", "Documentos", "Filiação", "Naturalidade"];

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={28} className="text-primary-500" />
            Diplomados
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gerencie os diplomas com diploma publicado
          </p>
        </div>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Users size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-2xl font-bold text-gray-900">{totalDiplomados}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <UserPlus size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Este mês</p>
              <p className="text-2xl font-bold text-gray-900">{novosEsteMes}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Award size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Diplomas publicados</p>
              <p className="text-2xl font-bold text-gray-900">{totalDiplomas}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg">
              <AlertCircle size={20} className="text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Sem diploma</p>
              <p className="text-2xl font-bold text-gray-900">{semDiplomas}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Busca */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, CPF, RA ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-primary-400" />
          </div>
        ) : diplomados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 bg-gray-50 rounded-full mb-4">
              <Users size={32} className="text-gray-300" />
            </div>
            <h3 className="text-base font-semibold text-gray-700 mb-1">
              {search ? "Nenhum resultado encontrado" : "Nenhum diplomado cadastrado"}
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              {search
                ? "Tente outros termos de busca."
                : "Comece cadastrando os alunos que receberão seus diplomas."}
            </p>
            {!search && (
              <button
                onClick={() => abrirModal()}
                className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                <Sparkles size={16} />
                Cadastrar primeiro diplomado
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {diplomados.map((d) => {
              const nDiplomas = getDiplomasCount(d);
              return (
                <div
                  key={d.id}
                  className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${d.sexo === "F" ? "bg-pink-100 text-pink-700" : "bg-blue-100 text-blue-700"}`}>
                      {d.nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{d.nome}</p>
                        {d.nome_social && (
                          <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                            Nome social: {d.nome_social}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <FileText size={11} /> CPF: {formatCPF(d.cpf)}
                        </span>
                        {d.ra && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <GraduationCap size={11} /> RA: {d.ra}
                          </span>
                        )}
                        {d.email && (
                          <span className="text-xs text-gray-400 flex items-center gap-1 hidden sm:flex">
                            <Mail size={11} /> {d.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${nDiplomas > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {nDiplomas} {nDiplomas === 1 ? "diploma" : "diplomas"}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => abrirModal(d)}
                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => excluir(d.id, d.nome)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 hidden group-hover:block" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MODAL ─────────────────────────────────────────────────────────── */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editando ? "Editar Diplomado" : "Novo Diplomado"}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {editando ? `Editando: ${editando.nome}` : "Preencha os dados do aluno diplomado"}
                </p>
              </div>
              <button onClick={fecharModal} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={22} />
              </button>
            </div>

            <div className="flex border-b border-gray-200 px-6">
              {abas.map((aba, idx) => (
                <button
                  key={aba}
                  onClick={() => setAbaAtiva(idx)}
                  className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                    abaAtiva === idx
                      ? "border-primary-500 text-primary-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {aba}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">

              {/* ABA 0 — Dados Pessoais */}
              {abaAtiva === 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <SmartCPFInput
                      value={form.cpf}
                      onChange={(v) => setForm((p) => ({ ...p, cpf: v }))}
                      onDuplicataEncontrada={() => setCpfDuplicado(true)}
                      disabled={!!editando}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Nome Completo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.nome}
                      onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                      placeholder="Nome conforme documento oficial"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Nome Social <span className="text-xs font-normal text-gray-400">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={form.nome_social}
                      onChange={(e) => setForm((p) => ({ ...p, nome_social: e.target.value }))}
                      placeholder="Nome pelo qual prefere ser chamado"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Data de Nascimento <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={form.data_nascimento}
                        onChange={(e) => setForm((p) => ({ ...p, data_nascimento: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Sexo <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={form.sexo}
                        onChange={(e) => setForm((p) => ({ ...p, sexo: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Selecione</option>
                        <option value="F">Feminino</option>
                        <option value="M">Masculino</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">RA</label>
                      <input
                        type="text"
                        value={form.ra}
                        onChange={(e) => setForm((p) => ({ ...p, ra: e.target.value }))}
                        placeholder="Registro Acadêmico"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Telefone</label>
                      <input
                        type="text"
                        value={form.telefone}
                        onChange={(e) => setForm((p) => ({ ...p, telefone: e.target.value }))}
                        placeholder="(00) 00000-0000"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">E-mail</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="email@exemplo.com"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              )}

              {/* ABA 1 — Documentos */}
              {abaAtiva === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={18} className="text-gray-400" />
                    <h3 className="text-sm font-semibold text-gray-700">Documento de Identidade (RG)</h3>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Número do RG</label>
                    <input
                      type="text"
                      value={form.rg_numero}
                      onChange={(e) => setForm((p) => ({ ...p, rg_numero: e.target.value }))}
                      placeholder="Ex: 12.345.678-9"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Órgão Expedidor</label>
                      <input
                        type="text"
                        value={form.rg_orgao_expedidor}
                        onChange={(e) => setForm((p) => ({ ...p, rg_orgao_expedidor: e.target.value }))}
                        placeholder="Ex: SSP, DETRAN, SESP"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">UF do RG</label>
                      <select
                        value={form.rg_uf}
                        onChange={(e) => setForm((p) => ({ ...p, rg_uf: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Selecione</option>
                        {UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mt-4">
                    <p className="text-xs text-blue-700">
                      <strong>ℹ️ Informação:</strong> O RG é opcional mas recomendado. Ele pode ser exigido em alguns processos de validação do diploma digital.
                    </p>
                  </div>
                </div>
              )}

              {/* ABA 2 — Filiação */}
              {abaAtiva === 2 && (
                <div className="space-y-6">
                  {[0, 1].map((idx) => {
                    const f = form.filiacoes[idx];
                    const label = idx === 0 ? "Mãe / Responsável 1" : "Pai / Responsável 2";
                    const icone = idx === 0 ? "👩" : "👨";
                    return (
                      <div key={idx} className="border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-lg">{icone}</span>
                          <h3 className="text-sm font-semibold text-gray-700">{label}</h3>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Nome completo</label>
                            <input
                              type="text"
                              value={f?.nome || ""}
                              onChange={(e) => atualizarFiliacao(idx, "nome", e.target.value)}
                              placeholder="Nome do responsável"
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">
                              Nome social <span className="text-xs text-gray-400">(opcional)</span>
                            </label>
                            <input
                              type="text"
                              value={f?.nome_social || ""}
                              onChange={(e) => atualizarFiliacao(idx, "nome_social", e.target.value)}
                              placeholder="Nome social (se houver)"
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-xs text-gray-500">
                      Os dados de filiação são exigidos pelo MEC no XML do Diploma Digital. Informe ao menos o nome da mãe quando disponível.
                    </p>
                  </div>
                </div>
              )}

              {/* ABA 3 — Naturalidade */}
              {abaAtiva === 3 && (
                <NaturalidadeTab form={form} setForm={setForm} />
              )}

              {/* Mensagem de erro */}
              {erro && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{erro}</p>
                </div>
              )}
            </div>

            {/* Footer do modal */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
              <div className="flex gap-2">
                {abaAtiva > 0 && (
                  <button
                    onClick={() => setAbaAtiva((a) => a - 1)}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    ← Anterior
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={fecharModal}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                {abaAtiva < abas.length - 1 ? (
                  <button
                    onClick={() => setAbaAtiva((a) => a + 1)}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
                  >
                    Próximo <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    onClick={salvar}
                    disabled={salvando}
                    className="flex items-center gap-2 px-5 py-2 text-sm bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
                  >
                    {salvando ? (
                      <><Loader2 size={16} className="animate-spin" /> Salvando...</>
                    ) : (
                      <><UserCheck size={16} /> {editando ? "Salvar alterações" : "Cadastrar diplomado"}</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assistente IA */}
      <AIAssistant
        context="diplomados"
        placeholder="Pergunte sobre o cadastro de diplomados..."
        suggestions={[
          "Como cadastrar um diplomado?",
          "O nome social é obrigatório?",
          "Como importar vários diplomados de uma vez?",
          "Quais dados são exigidos pelo MEC?",
        ]}
      />
    </div>
  );
}
