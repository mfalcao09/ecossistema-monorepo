"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  PenTool, Plus, ShieldCheck, AlertCircle, Sparkles,
  Pencil, Trash2, X, Loader2, CheckCircle2, GripVertical,
  ArrowRight, Users, Building2, Info, ChevronLeft,
  Settings2, ChevronDown, ChevronUp, Save,
} from "lucide-react";

// ─── Constantes ───────────────────────────────────────────────────────────────

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
};

const CARGOS_ECPF = [
  "reitor",
  "reitor_exercicio",
  "responsavel_registro",
  "coordenador_curso",
  "subcoordenador_curso",
  "coordenador_exercicio",
  "chefe_registro",
  "chefe_registro_exercicio",
  "secretario_decano",
];

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Assinante {
  id: string;
  nome: string;
  cpf: string;
  cargo: string;
  outro_cargo: string | null;
  tipo_certificado: "eCPF" | "eCNPJ";
  ordem_assinatura: number;
  ativo: boolean;
  instituicao_id: string;
}

interface Instituicao {
  id: string;
  nome: string;
  tipo: string;
}

const FORM_VAZIO = {
  nome: "",
  cpf: "",
  cargo: "reitor" as string,
  outro_cargo: "",
  tipo_certificado: "eCPF" as "eCPF" | "eCNPJ",
};

function formatCPF(cpf: string) {
  const n = cpf.replace(/\D/g, "");
  if (n.length !== 11) return cpf;
  return n.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

// ─── Wizard de Onboarding ─────────────────────────────────────────────────────

function OnboardingWizard({ onConcluir }: { onConcluir: () => void }) {
  const [passo, setPasso] = useState(1);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Indicador de progresso */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1, 2, 3].map((p) => (
          <div key={p} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              p < passo
                ? "bg-primary-500 text-white"
                : p === passo
                ? "bg-primary-500 text-white ring-4 ring-primary-100"
                : "bg-gray-200 text-gray-400"
            }`}>
              {p < passo ? <CheckCircle2 size={16} /> : p}
            </div>
            {p < 3 && (
              <div className={`w-16 h-1 rounded-full transition-all ${p < passo ? "bg-primary-500" : "bg-gray-200"}`} />
            )}
          </div>
        ))}
      </div>

      {/* ── PASSO 1: Quem precisa assinar ────────────────────────────────── */}
      {passo === 1 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Users size={22} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Passo 1 de 3</p>
              <h2 className="text-xl font-bold text-gray-900">Quem precisa assinar os diplomas?</h2>
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-6 ml-[52px]">
            Cada diploma tem <strong>5 assinaturas digitais</strong>: 2 da Emissora (FIC) e 3 da Registradora (UFMS).
          </p>

          {/* Grupo: Emissora (FIC) */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Emissora — FIC / SEVAL</span>
              <span className="text-xs text-gray-400">(ordens 1–2)</span>
            </div>
            <div className="space-y-3">
              {/* eCPF Emissora */}
              <div className="flex items-start gap-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-blue-500 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">1</div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">e-CPF A3</span>
                    <span className="text-sm font-semibold text-gray-800">Responsável da Emissora</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Diretor(a) Geral da FIC — pessoa física com certificado ICP-Brasil A3 (token físico, não aceita A1).
                  </p>
                </div>
              </div>

              {/* eCNPJ Emissora */}
              <div className="flex items-start gap-4 p-4 bg-blue-50 border-2 border-blue-300 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">2</div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">e-CNPJ A3</span>
                    <span className="text-sm font-semibold text-gray-800">Chancela institucional — FIC/SEVAL</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Certificado da FIC (CNPJ da SEVAL). Último a assinar <strong>no grupo da emissora</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Grupo: Registradora (UFMS) */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="w-2 h-2 rounded-full bg-indigo-600" />
              <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Registradora — UFMS</span>
              <span className="text-xs text-gray-400">(ordens 3–5)</span>
            </div>
            <div className="space-y-3">
              {/* eCPF 1 Registradora */}
              <div className="flex items-start gap-4 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-indigo-500 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">3</div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">e-CPF A3</span>
                    <span className="text-sm font-semibold text-gray-800">1º responsável da Registradora</span>
                  </div>
                  <p className="text-xs text-gray-500">Pessoa física responsável pelo registro na UFMS.</p>
                </div>
              </div>

              {/* eCPF 2 Registradora */}
              <div className="flex items-start gap-4 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-indigo-500 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">4</div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">e-CPF A3</span>
                    <span className="text-sm font-semibold text-gray-800">2º responsável da Registradora</span>
                  </div>
                  <p className="text-xs text-gray-500">Segunda pessoa física da UFMS.</p>
                </div>
              </div>

              {/* eCNPJ Registradora — ÚLTIMO DE TODOS */}
              <div className="flex items-start gap-4 p-4 bg-indigo-50 border-2 border-indigo-400 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-indigo-700 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">5</div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">e-CNPJ A3</span>
                    <span className="text-sm font-semibold text-gray-800">Chancela institucional — UFMS (ÚLTIMO)</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Certificado da UFMS. Deve ser o <strong>último a assinar de todos</strong>, chancelando todo o processo.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-6">
            <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              <strong>Certificado A3 é obrigatório.</strong> Certificados A1 (arquivo) não são aceitos pelo MEC para Diplomas Digitais. Cada assinante precisa de seu token físico (smartcard ou pendrive) no momento da assinatura.
            </p>
          </div>

          <button
            onClick={() => setPasso(2)}
            className="w-full flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-xl font-semibold text-sm transition-colors"
          >
            Entendi, ver a ordem correta
            <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* ── PASSO 2: Qual é a ordem ───────────────────────────────────────── */}
      {passo === 2 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <ShieldCheck size={22} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Passo 2 de 3</p>
              <h2 className="text-xl font-bold text-gray-900">A regra de ouro da ordem</h2>
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-8 ml-[52px]">
            O XSD v1.05 do MEC é rígido: o <strong>e-CNPJ sempre assina por último</strong> em cada instituição.
          </p>

          {/* Diagrama visual da linha do tempo */}
          <div className="relative mb-8">
            {/* Grupo Emissora */}
            <div className="mb-4">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2 px-1">Emissora (FIC)</p>
              <div className="flex items-start gap-2">
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-10 h-10 rounded-full bg-blue-500 text-white text-sm font-bold flex items-center justify-center shadow-md">1</div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 w-full text-center">
                    <span className="text-xs font-bold text-blue-700 block mb-1">e-CPF A3</span>
                    <span className="text-xs text-gray-600">Diretor(a)</span>
                  </div>
                </div>
                <div className="flex items-center pt-5 text-gray-300">→</div>
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center shadow-md">2</div>
                  <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-3 w-full text-center">
                    <span className="text-xs font-bold text-blue-700 block mb-1">e-CNPJ A3</span>
                    <span className="text-xs text-blue-600 font-semibold">FIC/SEVAL</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Grupo Registradora */}
            <div>
              <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide mb-2 px-1">Registradora (UFMS)</p>
              <div className="flex items-start gap-2">
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-10 h-10 rounded-full bg-indigo-500 text-white text-sm font-bold flex items-center justify-center shadow-md">3</div>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 w-full text-center">
                    <span className="text-xs font-bold text-indigo-700 block mb-1">e-CPF A3</span>
                    <span className="text-xs text-gray-600">Resp. 1</span>
                  </div>
                </div>
                <div className="flex items-center pt-5 text-gray-300">→</div>
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-10 h-10 rounded-full bg-indigo-500 text-white text-sm font-bold flex items-center justify-center shadow-md">4</div>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 w-full text-center">
                    <span className="text-xs font-bold text-indigo-700 block mb-1">e-CPF A3</span>
                    <span className="text-xs text-gray-600">Resp. 2</span>
                  </div>
                </div>
                <div className="flex items-center pt-5 text-gray-300">→</div>
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-10 h-10 rounded-full bg-indigo-700 text-white text-xs font-bold flex items-center justify-center shadow-md ring-4 ring-indigo-100">5</div>
                  <div className="bg-indigo-50 border-2 border-indigo-400 rounded-xl p-3 w-full text-center">
                    <span className="text-xs font-bold text-indigo-700 block mb-1">e-CNPJ A3</span>
                    <span className="text-xs text-indigo-600 font-semibold">UFMS</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 mb-8">
            <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" />
              <p className="text-xs text-green-700">
                <strong>O sistema cuida da ordem automaticamente.</strong> Basta cadastrar os assinantes com o papel correto (emissora ou registradora) e o sistema organiza a sequência.
              </p>
            </div>
            <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                Dentro de cada grupo, o <strong>e-CNPJ é sempre o último</strong>. Os e-CPFs podem ser reordenados livremente com arraste.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setPasso(1)}
              className="flex items-center gap-2 px-5 py-3 border border-gray-300 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft size={16} />
              Voltar
            </button>
            <button
              onClick={() => setPasso(3)}
              className="flex-1 flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-xl font-semibold text-sm transition-colors"
            >
              Começar a cadastrar
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── PASSO 3: Resumo e início do cadastro ─────────────────────────── */}
      {passo === 3 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-xl">
              <PenTool size={22} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">Passo 3 de 3</p>
              <h2 className="text-xl font-bold text-gray-900">Pronto para cadastrar!</h2>
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-6 ml-[52px]">
            Revise o checklist abaixo antes de começar. Você pode cadastrar os assinantes em qualquer ordem — o sistema organizará a posição automaticamente.
          </p>

          {/* Checklist */}
          <div className="space-y-3 mb-8">
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
              <div className="w-6 h-6 rounded-full border-2 border-blue-400 flex items-center justify-center flex-shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Emissora (FIC): 1 e-CPF + 1 e-CNPJ</p>
                <p className="text-xs text-gray-500">Diretor(a) Geral + certificado institucional da FIC/SEVAL.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-200">
              <div className="w-6 h-6 rounded-full border-2 border-indigo-400 flex items-center justify-center flex-shrink-0">
                <Building2 size={13} className="text-indigo-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Registradora (UFMS): 2 e-CPF + 1 e-CNPJ</p>
                <p className="text-xs text-gray-500">Responsáveis pelo registro + certificado institucional da UFMS.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
              <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Tenha os dados em mãos</p>
                <p className="text-xs text-amber-600">Nome completo, CPF e cargo de cada assinante, conforme constam nos certificados digitais.</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setPasso(2)}
              className="flex items-center gap-2 px-5 py-3 border border-gray-300 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft size={16} />
              Voltar
            </button>
            <button
              onClick={onConcluir}
              className="flex-1 flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-xl font-semibold text-sm transition-colors"
            >
              <Plus size={18} />
              Cadastrar primeiro assinante
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Modal de Cadastro / Edição ───────────────────────────────────────────────

interface ModalAssinanteProps {
  editando: Assinante | null;
  instituicaoId: string;
  totalEcnpjAtual: number;
  onSalvar: (assinante: Assinante) => void;
  onFechar: () => void;
}

function ModalAssinante({ editando, instituicaoId, totalEcnpjAtual, onSalvar, onFechar }: ModalAssinanteProps) {
  const [form, setForm] = useState({
    ...FORM_VAZIO,
    ...(editando
      ? {
          nome: editando.nome,
          cpf: formatCPF(editando.cpf),
          cargo: editando.cargo,
          outro_cargo: editando.outro_cargo ?? "",
          tipo_certificado: editando.tipo_certificado,
        }
      : {}),
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [iesEmissora, setIesEmissora] = useState<{ nome: string; cnpj: string } | null>(null);
  const [carregandoIes, setCarregandoIes] = useState(false);

  // Se já existe um eCNPJ e não estamos editando esse eCNPJ, alertar
  const jaTemEcnpj = totalEcnpjAtual > 0 && form.tipo_certificado === "eCNPJ"
    && !(editando?.tipo_certificado === "eCNPJ");

  const isEcnpj = form.tipo_certificado === "eCNPJ";

  // Quando selecionar eCNPJ, puxar dados da IES emissora do banco
  useEffect(() => {
    if (!isEcnpj) return;
    // Se já está editando eCNPJ com dados, não precisa buscar
    if (editando?.tipo_certificado === "eCNPJ" && editando.nome) return;

    setCarregandoIes(true);
    fetch(`/api/cadastro/ies?tipo=emissora`)
      .then((r) => r.json())
      .then((lista: Array<{ nome: string; cnpj: string }>) => {
        if (Array.isArray(lista) && lista.length > 0) {
          const ies = lista[0];
          setIesEmissora(ies);
          // Auto-preencher nome e CNPJ da IES
          const cnpjFmt = ies.cnpj?.replace(/\D/g, "") ?? "";
          setForm((p) => ({
            ...p,
            nome: ies.nome || p.nome,
            cpf: cnpjFmt.length === 14
              ? cnpjFmt.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
              : cnpjFmt,
          }));
        }
      })
      .catch(() => {})
      .finally(() => setCarregandoIes(false));
  }, [isEcnpj, editando]);

  function formatCNPJ(val: string) {
    const n = val.replace(/\D/g, "").slice(0, 14);
    if (n.length === 14) return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    return n;
  }

  async function salvar() {
    const nomeLimpo = form.nome.trim();
    const docLimpo = form.cpf.replace(/\D/g, "");

    if (!nomeLimpo) { setErro("Informe o nome completo."); return; }

    if (isEcnpj) {
      if (docLimpo.length !== 14) { setErro("CNPJ inválido — informe os 14 dígitos."); return; }
    } else {
      if (docLimpo.length !== 11) { setErro("CPF inválido — informe os 11 dígitos."); return; }
      if (!form.cargo) { setErro("Selecione o cargo."); return; }
    }

    setSalvando(true);
    setErro("");

    try {
      const payload = {
        nome: nomeLimpo,
        cpf: docLimpo,
        cargo: isEcnpj ? "outro" : form.cargo,
        outro_cargo: isEcnpj ? "IES Emissora" : (form.cargo === "outro" ? form.outro_cargo.trim() : null),
        tipo_certificado: form.tipo_certificado,
        instituicao_id: instituicaoId,
        ativo: true,
      };

      const url = editando ? `/api/assinantes/${editando.id}` : "/api/assinantes";
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

      const salvo: Assinante = await res.json();
      onSalvar(salvo);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {editando ? "Editar Assinante" : "Novo Assinante"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Preencha os dados conforme constam no certificado digital
            </p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X size={22} />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Tipo de certificado — campo mais importante, vem primeiro */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tipo de Certificado ICP-Brasil <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(["eCPF", "eCNPJ"] as const).map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, tipo_certificado: tipo }))}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    form.tipo_certificado === tipo
                      ? tipo === "eCNPJ"
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {tipo === "eCPF"
                      ? <Users size={16} className={form.tipo_certificado === "eCPF" ? "text-blue-600" : "text-gray-400"} />
                      : <Building2 size={16} className={form.tipo_certificado === "eCNPJ" ? "text-indigo-600" : "text-gray-400"} />
                    }
                    <span className={`font-bold text-sm ${
                      form.tipo_certificado === tipo
                        ? tipo === "eCNPJ" ? "text-indigo-700" : "text-blue-700"
                        : "text-gray-700"
                    }`}>{tipo}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {tipo === "eCPF"
                      ? "Pessoa física (Reitor, Diretor...)"
                      : "Instituição — assina por último"}
                  </p>
                </button>
              ))}
            </div>

            {/* Aviso se já tem eCNPJ */}
            {jaTemEcnpj && (
              <div className="mt-2 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Já existe um assinante com e-CNPJ cadastrado. Geralmente só é necessário um. Tem certeza que deseja adicionar outro?
                </p>
              </div>
            )}

            {/* Lembrete contextual para eCNPJ */}
            {form.tipo_certificado === "eCNPJ" && !jaTemEcnpj && (
              <div className="mt-2 flex items-start gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                <Sparkles size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-700">
                  O e-CNPJ representa a FIC como instituição e será posicionado <strong>automaticamente como o último assinante</strong>.
                </p>
              </div>
            )}
          </div>

          {/* Nome — para eCNPJ vem da IES emissora (readonly) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {isEcnpj ? "Razão Social da IES" : "Nome Completo"} <span className="text-red-500">*</span>
            </label>
            {carregandoIes ? (
              <div className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50">
                <Loader2 size={14} className="animate-spin text-gray-400" />
                <span className="text-sm text-gray-400">Buscando dados da IES emissora...</span>
              </div>
            ) : (
              <input
                type="text"
                value={form.nome}
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                readOnly={isEcnpj && !!iesEmissora}
                placeholder={isEcnpj ? "Razão social da instituição" : "Nome conforme consta no certificado digital"}
                className={`w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  isEcnpj && iesEmissora ? "bg-gray-50 text-gray-600 cursor-not-allowed" : ""
                }`}
              />
            )}
            {isEcnpj && iesEmissora && (
              <p className="mt-1 text-xs text-gray-400 flex items-center gap-1">
                <Info size={12} /> Dados da IES emissora cadastrada
              </p>
            )}
          </div>

          {/* CPF ou CNPJ — muda conforme tipo de certificado */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {isEcnpj ? "CNPJ" : "CPF"} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.cpf}
              readOnly={isEcnpj && !!iesEmissora}
              onChange={(e) => {
                if (isEcnpj) {
                  setForm((p) => ({ ...p, cpf: formatCNPJ(e.target.value) }));
                } else {
                  const nums = e.target.value.replace(/\D/g, "").slice(0, 11);
                  const fmt = nums.length === 11
                    ? nums.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")
                    : nums;
                  setForm((p) => ({ ...p, cpf: fmt }));
                }
              }}
              placeholder={isEcnpj ? "00.000.000/0000-00" : "000.000.000-00"}
              className={`w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                isEcnpj && iesEmissora ? "bg-gray-50 text-gray-600 cursor-not-allowed" : ""
              }`}
            />
          </div>

          {/* Cargo — só aparece para eCPF */}
          {!isEcnpj && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Cargo <span className="text-red-500">*</span>
              </label>
              <select
                value={form.cargo}
                onChange={(e) => setForm((p) => ({ ...p, cargo: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {CARGOS_ECPF.map((c) => (
                  <option key={c} value={c}>{CARGO_LABELS[c]}</option>
                ))}
                <option value="outro">Outro cargo...</option>
              </select>

              {form.cargo === "outro" && (
                <input
                  type="text"
                  value={form.outro_cargo}
                  onChange={(e) => setForm((p) => ({ ...p, outro_cargo: e.target.value }))}
                  placeholder="Descreva o cargo"
                  className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              )}
            </div>
          )}

          {/* Erro */}
          {erro && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{erro}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 pb-6">
          <button
            onClick={onFechar}
            className="px-4 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {salvando && <Loader2 size={14} className="animate-spin" />}
            {editando ? "Salvar alterações" : "Cadastrar assinante"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function AssinantesPage() {
  const [assinantes, setAssinantes] = useState<Assinante[]>([]);
  const [loading, setLoading] = useState(true);
  const [instituicaoId, setInstituicaoId] = useState<string>("");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Assinante | null>(null);
  const [modoWizard, setModoWizard] = useState(false);

  // Fluxo Padrão
  const [fluxoExpandido, setFluxoExpandido] = useState(false);
  const [ordemPadrao, setOrdemPadrao] = useState<string[]>([]);
  const [salvandoFluxo, setSalvandoFluxo] = useState(false);
  const [fluxoSalvo, setFluxoSalvo] = useState(false);
  const dragFluxoRef = useRef<number | null>(null);

  // Drag-and-drop state
  const dragIdxRef = useRef<number | null>(null);

  // ── Carregar instituição e assinantes ──────────────────────────────────────
  const carregar = useCallback(async (instId?: string) => {
    setLoading(true);
    try {
      const idParaUsar = instId ?? instituicaoId;
      const url = idParaUsar
        ? `/api/assinantes?instituicao_id=${idParaUsar}`
        : "/api/assinantes";
      const res = await fetch(url);
      const data = await res.json();
      setAssinantes(Array.isArray(data) ? data : []);
    } catch {
      setAssinantes([]);
    } finally {
      setLoading(false);
    }
  }, [instituicaoId]);

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/instituicoes");
        const inst: Instituicao[] = await res.json();
        const emissoras = inst.filter(
          (i) => i.tipo === "ies_emissora" || i.tipo === "emissora"
        );
        const id = emissoras[0]?.id ?? inst[0]?.id ?? "";
        setInstituicaoId(id);
        await carregar(id);
      } catch {
        await carregar();
      }
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Ativar wizard quando lista está vazia e carregamento concluiu
  useEffect(() => {
    if (!loading && assinantes.length === 0) {
      setModoWizard(true);
    } else if (assinantes.length > 0) {
      setModoWizard(false);
    }
  }, [loading, assinantes.length]);

  // ── Validação de conformidade MEC ─────────────────────────────────────────
  // Ordenar: eCPFs primeiro, eCNPJ por último
  const assinantesOrdenados = [
    ...assinantes.filter((a) => a.tipo_certificado !== "eCNPJ"),
    ...assinantes.filter((a) => a.tipo_certificado === "eCNPJ"),
  ];

  const totalEcpf = assinantes.filter((a) => a.tipo_certificado === "eCPF").length;
  const totalEcnpj = assinantes.filter((a) => a.tipo_certificado === "eCNPJ").length;
  const conformeMec = totalEcpf >= 2 && totalEcnpj >= 1;

  // ── Drag-and-drop (apenas entre eCPFs) ────────────────────────────────────
  function handleDragStart(idx: number) {
    dragIdxRef.current = idx;
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    const from = dragIdxRef.current;
    if (from === null || from === idx) return;

    // Só permite mover dentro dos eCPFs — não pode ir para depois de um eCNPJ
    const eCpfs = assinantesOrdenados.filter((a) => a.tipo_certificado !== "eCNPJ");
    const fromItem = assinantesOrdenados[from];
    const toItem = assinantesOrdenados[idx];

    // Bloqueia se tentar arrastar eCNPJ ou tentar arrastar para cima de eCNPJ
    if (fromItem?.tipo_certificado === "eCNPJ" || toItem?.tipo_certificado === "eCNPJ") return;

    const novo = [...assinantesOrdenados];
    const [item] = novo.splice(from, 1);
    novo.splice(idx, 0, item);

    // Recalcula ordem_assinatura: eCPFs ganham ordens 1..n, eCNPJs ganham n+1..
    const reordenados = novo.map((a, i) => ({ ...a, ordem_assinatura: i + 1 }));
    setAssinantes(reordenados);
    dragIdxRef.current = idx;

    // Persistir nova ordem no banco (fire-and-forget)
    const eCpfsNovos = reordenados.filter((a) => a.tipo_certificado !== "eCNPJ");
    eCpfsNovos.forEach((a) => {
      fetch(`/api/assinantes/${a.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordem_assinatura: a.ordem_assinatura }),
      }).catch(() => {});
    });
  }

  // ── Atualizar ordem após salvar novo assinante ─────────────────────────────
  async function handleSalvar(_assinante: Assinante) {
    // Recarrega a lista e recalcula ordens no banco
    await carregar();
    // Garante que eCNPJ fica na última ordem
    const lista = await fetch(
      instituicaoId ? `/api/assinantes?instituicao_id=${instituicaoId}` : "/api/assinantes"
    ).then((r) => r.json()) as Assinante[];

    if (!Array.isArray(lista)) return;

    const eCpfs = lista.filter((a) => a.tipo_certificado !== "eCNPJ");
    const eCnpjs = lista.filter((a) => a.tipo_certificado === "eCNPJ");
    const todos = [...eCpfs, ...eCnpjs];

    // Atualiza ordens se necessário
    for (let i = 0; i < todos.length; i++) {
      if (todos[i].ordem_assinatura !== i + 1) {
        await fetch(`/api/assinantes/${todos[i].id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ordem_assinatura: i + 1 }),
        }).catch(() => {});
      }
    }

    setAssinantes(todos.map((a, i) => ({ ...a, ordem_assinatura: i + 1 })));
    setModalAberto(false);
    setEditando(null);
  }

  async function excluir(id: string, nome: string) {
    if (!confirm(`Confirma a exclusão de "${nome}"? Esta ação não pode ser desfeita.`)) return;
    await fetch(`/api/assinantes/${id}`, { method: "DELETE" });
    carregar();
  }

  // Inicializa a ordem padrão com os assinantes na sequência atual
  useEffect(() => {
    if (assinantesOrdenados.length > 0 && ordemPadrao.length === 0) {
      setOrdemPadrao(assinantesOrdenados.map((a) => a.id));
    }
  }, [assinantesOrdenados]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDragFluxoStart(idx: number) {
    dragFluxoRef.current = idx;
  }

  function handleDragFluxoOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    const from = dragFluxoRef.current;
    if (from === null || from === idx) return;
    const fromId = ordemPadrao[from];
    const toId = ordemPadrao[idx];
    const fromIsEcnpj = assinantes.find((a) => a.id === fromId)?.tipo_certificado === "eCNPJ";
    const toIsEcnpj   = assinantes.find((a) => a.id === toId)?.tipo_certificado === "eCNPJ";
    if (fromIsEcnpj || toIsEcnpj) return;
    const novo = [...ordemPadrao];
    const [item] = novo.splice(from, 1);
    novo.splice(idx, 0, item);
    setOrdemPadrao(novo);
    dragFluxoRef.current = idx;
  }

  async function salvarFluxoPadrao() {
    setSalvandoFluxo(true);
    try {
      await fetch("/api/config/ordem-assinatura", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordem_assinatura_padrao: ordemPadrao }),
      });
      setFluxoSalvo(true);
      setFluxoExpandido(false);
      setTimeout(() => setFluxoSalvo(false), 3000);
    } catch {
      // silencioso — não bloqueia o usuário
    } finally {
      setSalvandoFluxo(false);
    }
  }

  function abrirModal(assinante?: Assinante) {
    setEditando(assinante ?? null);
    setModalAberto(true);
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={32} className="animate-spin text-primary-400" />
      </div>
    );
  }

  // MODO WIZARD — lista vazia
  if (modoWizard) {
    return (
      <div className="p-6">
        {/* Header mínimo */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Configurar Assinantes</h1>
          <p className="text-gray-500 text-sm">Vamos configurar quem assina os Diplomas Digitais da FIC</p>
        </div>

        <OnboardingWizard
          onConcluir={() => {
            setModoWizard(false);
            setModalAberto(true);
          }}
        />

        {/* Modal abre por cima do wizard ao concluir */}
        {modalAberto && (
          <ModalAssinante
            editando={null}
            instituicaoId={instituicaoId}
            totalEcnpjAtual={totalEcnpj}
            onSalvar={handleSalvar}
            onFechar={() => {
              setModalAberto(false);
              // Se ainda vazia, volta para wizard
              if (assinantes.length === 0) setModoWizard(true);
            }}
          />
        )}
      </div>
    );
  }

  // MODO NORMAL — lista preenchida
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assinantes</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Responsáveis pela assinatura digital dos diplomas da FIC
          </p>
        </div>
        <button
          onClick={() => abrirModal()}
          className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus size={18} />
          Adicionar assinante
        </button>
      </div>

      {/* Painel de conformidade MEC */}
      <div className={`rounded-xl border p-4 flex items-start gap-3 ${
        conformeMec ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
      }`}>
        {conformeMec
          ? <CheckCircle2 size={20} className="text-green-500 shrink-0 mt-0.5" />
          : <AlertCircle size={20} className="text-amber-500 shrink-0 mt-0.5" />
        }
        <div className="flex-1">
          <p className={`text-sm font-semibold ${conformeMec ? "text-green-800" : "text-amber-800"}`}>
            {conformeMec
              ? "Composição de assinantes em conformidade com o XSD v1.05 ✓"
              : "Composição ainda não atende ao requisito mínimo do MEC"
            }
          </p>
          <p className={`text-xs mt-0.5 ${conformeMec ? "text-green-700" : "text-amber-700"}`}>
            Requisito: <strong>≥ 2 e-CPF A3</strong> + <strong>1 e-CNPJ A3</strong> (sempre o último).
            {" "}Situação atual: <strong>{totalEcpf} e-CPF</strong>, <strong>{totalEcnpj} e-CNPJ</strong>.
            {!conformeMec && totalEcpf < 2 && ` Faltam ${2 - totalEcpf} e-CPF.`}
            {!conformeMec && totalEcnpj === 0 && " Falta o e-CNPJ institucional."}
          </p>
        </div>
      </div>

      {/* Lista de assinantes com drag-and-drop */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

        <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Ordem de assinatura
          </span>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400">{assinantes.length} assinante(s)</span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <GripVertical size={12} /> Arraste para reordenar os e-CPF
            </span>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {assinantesOrdenados.map((a, idx) => {
            const isEcnpj = a.tipo_certificado === "eCNPJ";
            const cargoLabel = CARGO_LABELS[a.cargo] ?? a.outro_cargo ?? a.cargo;

            return (
              <div
                key={a.id}
                draggable={!isEcnpj}
                onDragStart={() => !isEcnpj && handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={() => { dragIdxRef.current = null; }}
                className={`flex items-center gap-4 px-5 py-4 transition-colors group ${
                  isEcnpj
                    ? "bg-indigo-50/50"
                    : "hover:bg-gray-50 cursor-grab active:cursor-grabbing"
                }`}
              >
                {/* Handle de drag (só para eCPF) */}
                <div className="flex-shrink-0">
                  {isEcnpj
                    ? <div className="w-5 h-5 text-indigo-300"><GripVertical size={16} className="opacity-30" /></div>
                    : <GripVertical size={16} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
                  }
                </div>

                {/* Número de ordem */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  isEcnpj ? "bg-indigo-600 text-white" : "bg-blue-100 text-blue-700"
                }`}>
                  {idx + 1}
                </div>

                {/* Dados */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{a.nome}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      isEcnpj ? "bg-indigo-100 text-indigo-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {a.tipo_certificado}
                    </span>
                    {isEcnpj && (
                      <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-medium">
                        Último a assinar
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-500">{cargoLabel}</span>
                    <span className="text-xs text-gray-400">CPF: {formatCPF(a.cpf)}</span>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => abrirModal(a)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => excluir(a.id, a.nome)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé com legenda */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-400" />
            <span className="text-xs text-gray-500">e-CPF — reordenável</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-indigo-600" />
            <span className="text-xs text-gray-500">e-CNPJ — fixo na última posição</span>
          </div>
        </div>
      </div>

      {/* Requisitos técnicos (colapsado) */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <ShieldCheck size={16} className="text-indigo-500" />
          Requisitos técnicos — XSD v1.05
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-600">
          <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
            <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <span><strong>Apenas A3</strong> — Certificados A1 (arquivo) não são aceitos pelo MEC</span>
          </div>
          <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
            <AlertCircle size={14} className="text-blue-500 shrink-0 mt-0.5" />
            <span><strong>XAdES AD-RA</strong> — Padrão obrigatório para assinatura dos XMLs</span>
          </div>
          <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
            <AlertCircle size={14} className="text-green-500 shrink-0 mt-0.5" />
            <span><strong>API de assinatura</strong> — BRy, Certisign ou Soluti (a contratar)</span>
          </div>
        </div>
      </div>

      {/* ── Fluxo de Assinatura Padrão ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Cabeçalho clicável */}
        <button
          type="button"
          onClick={() => setFluxoExpandido((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Settings2 size={16} className="text-gray-400" />
            <span className="text-sm font-semibold text-gray-800">Fluxo de assinatura padrão</span>
            {fluxoSalvo && (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <CheckCircle2 size={11} />
                Salvo
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              Aplicado a todos os diplomas por padrão
            </span>
            {fluxoExpandido
              ? <ChevronUp size={16} className="text-gray-400" />
              : <ChevronDown size={16} className="text-gray-400" />
            }
          </div>
        </button>

        {/* Visualização compacta (quando recolhido) */}
        {!fluxoExpandido && ordemPadrao.length > 0 && (
          <div className="px-5 pb-4 flex items-center gap-2 flex-wrap">
            {ordemPadrao.map((id, idx) => {
              const a = assinantes.find((x) => x.id === id);
              if (!a) return null;
              const isEcnpj = a.tipo_certificado === "eCNPJ";
              return (
                <div key={id} className="flex items-center gap-1">
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                    isEcnpj ? "bg-indigo-100 text-indigo-700" : "bg-blue-50 text-blue-700"
                  }`}>
                    <span className="font-bold">{idx + 1}.</span>
                    {a.nome.split(" ")[0]}
                    <span className="opacity-60">({a.tipo_certificado})</span>
                  </div>
                  {idx < ordemPadrao.length - 1 && <span className="text-gray-300 text-xs">→</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* Editor expandido */}
        {fluxoExpandido && (
          <div className="px-5 pb-5 space-y-3 border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-500">
              Arraste para reordenar os e-CPF. O e-CNPJ é sempre o último e não pode ser movido. Este fluxo será o padrão para novos processos — cada processo pode ter um fluxo próprio no futuro.
            </p>

            <div className="space-y-2">
              {ordemPadrao.map((id, idx) => {
                const a = assinantes.find((x) => x.id === id);
                if (!a) return null;
                const isEcnpj = a.tipo_certificado === "eCNPJ";
                const cargoLabel = CARGO_LABELS[a.cargo] ?? a.outro_cargo ?? a.cargo;

                return (
                  <div
                    key={id}
                    draggable={!isEcnpj}
                    onDragStart={() => !isEcnpj && handleDragFluxoStart(idx)}
                    onDragOver={(e) => handleDragFluxoOver(e, idx)}
                    onDragEnd={() => { dragFluxoRef.current = null; }}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                      isEcnpj
                        ? "bg-indigo-50 border-indigo-200 cursor-not-allowed"
                        : "bg-primary-50 border-primary-200 cursor-grab active:cursor-grabbing"
                    }`}
                  >
                    <GripVertical size={15} className={isEcnpj ? "text-indigo-200" : "text-gray-400"} />
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      isEcnpj ? "bg-indigo-600 text-white" : "bg-primary-500 text-white"
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-900">{a.nome}</span>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                          isEcnpj ? "bg-indigo-100 text-indigo-700" : "bg-blue-100 text-blue-700"
                        }`}>{a.tipo_certificado}</span>
                        {isEcnpj && <span className="text-xs text-indigo-500 font-medium">🔒 fixo</span>}
                      </div>
                      <span className="text-xs text-gray-500">{cargoLabel}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={salvarFluxoPadrao}
                disabled={salvandoFluxo}
                className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {salvandoFluxo
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Save size={14} />
                }
                {salvandoFluxo ? "Salvando..." : "Salvar fluxo padrão"}
              </button>
              <button
                onClick={() => setFluxoExpandido(false)}
                className="px-4 py-2 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de cadastro/edição */}
      {modalAberto && (
        <ModalAssinante
          editando={editando}
          instituicaoId={instituicaoId}
          totalEcnpjAtual={totalEcnpj}
          onSalvar={handleSalvar}
          onFechar={() => { setModalAberto(false); setEditando(null); }}
        />
      )}
    </div>
  );
}
