"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Search, GraduationCap, Loader2, FileText, Download,
  Eye, AlertCircle, RefreshCw, User, X,
} from "lucide-react";
import { fetchSeguro } from "@/lib/security/fetch-seguro";

interface DiplomaResultado {
  id: string;
  diplomado_nome: string;
  diplomado_cpf: string;
  curso_nome: string;
  curso_grau: string;
  status: string;
  data_conclusao: string | null;
  is_legado: boolean;
}

function formatCPF(cpf: string) {
  const n = cpf?.replace(/\D/g, "") ?? "";
  return n.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") || cpf;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
}

const STATUS_LABEL: Record<string, string> = {
  assinado: "XMLs assinados",
  aguardando_documentos: "Aguarda documentos",
  documentos_assinados: "Docs assinados",
  registrado: "Registrado",
  rvdd_gerado: "RVDD gerado",
  publicado: "Publicado",
};

export default function EmissaoHistoricoPage() {
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState("");
  const [resultados, setResultados] = useState<DiplomaResultado[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [gerandoId, setGerandoId] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Estado da prévia inline
  const [previaAberta, setPreviaAberta] = useState(false);
  const [previaUrl, setPreviaUrl] = useState<string | null>(null);
  const [previaCarregandoId, setPreviaCarregandoId] = useState<string | null>(null);
  const [previaNome, setPreviaNome] = useState("");

  const buscar = useCallback(async (q: string) => {
    if (!q.trim()) { setResultados([]); return; }
    setCarregando(true);
    setErro("");
    try {
      const params = new URLSearchParams({ search: q });
      const res = await fetch(`/api/diplomas?${params}`);
      const data = await res.json();
      const lista: DiplomaResultado[] = Array.isArray(data) ? data : (data.diplomas ?? []);
      setResultados(lista);
    } catch {
      setErro("Erro ao buscar. Tente novamente.");
      setResultados([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscaAtiva(busca);
      buscar(busca);
    }, 400);
    return () => clearTimeout(timer);
  }, [busca, buscar]);

  // Abre prévia em modal — gera o PDF real com timbrado e exibe inline
  const abrirPrevia = async (diplomaId: string, nomeAluno: string) => {
    setPreviaCarregandoId(diplomaId);
    setPreviaNome(nomeAluno);
    setErro("");
    try {
      const res = await fetchSeguro(`/api/secretaria/emissao/historico/${diplomaId}`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Erro ao gerar prévia");
      }
      const blob = await res.blob();
      // Limpar URL anterior se existir
      if (previaUrl) URL.revokeObjectURL(previaUrl);
      const url = URL.createObjectURL(blob);
      setPreviaUrl(url);
      setPreviaAberta(true);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar prévia");
    } finally {
      setPreviaCarregandoId(null);
    }
  };

  const fecharPrevia = () => {
    setPreviaAberta(false);
    if (previaUrl) {
      URL.revokeObjectURL(previaUrl);
      setPreviaUrl(null);
    }
  };

  const baixarDaPrevia = () => {
    if (!previaUrl) return;
    const a = document.createElement("a");
    a.href = previaUrl;
    a.download = `historico_${previaNome.replace(/\s+/g, "_").toLowerCase()}.pdf`;
    a.click();
  };

  const gerarHistorico = async (diplomaId: string, nomeAluno: string) => {
    setGerandoId(diplomaId);
    setSucesso(null);
    setErro("");
    try {
      const res = await fetchSeguro(`/api/secretaria/emissao/historico/${diplomaId}`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Erro ao gerar histórico");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `historico_${nomeAluno.replace(/\s+/g, "_").toLowerCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setSucesso(`Histórico de ${nomeAluno} gerado com sucesso.`);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar histórico");
    } finally {
      setGerandoId(null);
    }
  };

  return (
    <>
      {/* ── Modal de Prévia ── */}
      {previaAberta && previaUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm">
          {/* Barra superior */}
          <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm shrink-0">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-amber-500" />
              <span className="text-sm font-semibold text-gray-800">
                Prévia — Histórico Escolar
              </span>
              <span className="text-sm text-gray-400">· {previaNome}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={baixarDaPrevia}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors"
              >
                <Download size={13} /> Baixar PDF
              </button>
              <button
                onClick={fecharPrevia}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <X size={13} /> Fechar
              </button>
            </div>
          </div>

          {/* PDF inline */}
          <iframe
            src={previaUrl}
            className="flex-1 w-full border-0 bg-gray-100"
            title={`Prévia Histórico — ${previaNome}`}
          />
        </div>
      )}

      {/* ── Conteúdo da página ── */}
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap size={22} className="text-amber-500" />
            <h1 className="text-xl font-bold text-gray-900">Histórico Escolar Digital</h1>
          </div>
          <p className="text-sm text-gray-500">
            Busque o aluno pelo nome, CPF ou RA para emitir o histórico escolar.
          </p>
        </div>

        {/* Campo de busca */}
        <div className="relative mb-6">
          <Search size={17} className="absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, CPF ou RA..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            autoFocus
          />
          {carregando && (
            <Loader2 size={15} className="absolute right-3.5 top-3 text-amber-400 animate-spin" />
          )}
        </div>

        {/* Feedback */}
        {sucesso && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4 text-sm text-emerald-700">
            <FileText size={15} /> {sucesso}
          </div>
        )}
        {erro && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-700">
            <AlertCircle size={15} /> {erro}
            <button onClick={() => setErro("")} className="ml-auto text-red-400 hover:text-red-600">
              <RefreshCw size={13} />
            </button>
          </div>
        )}

        {/* Estado vazio inicial */}
        {!buscaAtiva && !carregando && (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <User size={24} className="text-amber-400" />
            </div>
            <p className="text-sm font-medium text-gray-600">Digite o nome ou CPF do aluno</p>
            <p className="text-xs text-gray-400 mt-1">O sistema buscará diplomas cadastrados</p>
          </div>
        )}

        {/* Sem resultados */}
        {buscaAtiva && !carregando && resultados.length === 0 && !erro && (
          <div className="text-center py-16">
            <p className="text-sm font-medium text-gray-600">Nenhum resultado encontrado</p>
            <p className="text-xs text-gray-400 mt-1">Tente buscar por nome completo ou CPF exato</p>
          </div>
        )}

        {/* Lista de resultados */}
        {resultados.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
            {resultados.map((diploma) => (
              <div key={diploma.id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <GraduationCap size={16} className="text-amber-500" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{diploma.diplomado_nome}</p>
                  <p className="text-xs text-gray-400">
                    {formatCPF(diploma.diplomado_cpf)} · {diploma.curso_nome} · {diploma.curso_grau}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Conclusão: {formatDate(diploma.data_conclusao)} ·{" "}
                    <span className="text-amber-600">
                      {STATUS_LABEL[diploma.status] ?? diploma.status}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Prévia: abre modal inline com PDF real + timbrado */}
                  <button
                    onClick={() => abrirPrevia(diploma.id, diploma.diplomado_nome)}
                    disabled={previaCarregandoId === diploma.id || gerandoId === diploma.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {previaCarregandoId === diploma.id ? (
                      <><Loader2 size={13} className="animate-spin" /> Carregando...</>
                    ) : (
                      <><Eye size={13} /> Prévia</>
                    )}
                  </button>

                  {/* Gerar e baixar direto */}
                  <button
                    onClick={() => gerarHistorico(diploma.id, diploma.diplomado_nome)}
                    disabled={gerandoId === diploma.id || previaCarregandoId === diploma.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {gerandoId === diploma.id ? (
                      <><Loader2 size={12} className="animate-spin" /> Gerando...</>
                    ) : (
                      <><Download size={12} /> Gerar PDF</>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-6">
          O PDF gerado utiliza o timbrado configurado em{" "}
          <a href="/secretaria/configuracoes/documentos" className="text-amber-600 hover:underline">
            Configurações → Modelos de Documentos
          </a>
        </p>
      </div>
    </>
  );
}
