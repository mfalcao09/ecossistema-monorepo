"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck, Plus, Copy, CheckCircle2, XCircle, Clock,
  AlertTriangle, Loader2, Eye, EyeOff, Activity, RefreshCw,
  Key,
} from "lucide-react";
import type { AcervoMecToken } from "@/types/acervo";

// ── Tipos locais ──────────────────────────────────────────
interface TokenComPreview extends Omit<AcervoMecToken, "token"> {
  token_preview: string;
  token_recente?: string; // token completo só exibido após criação
}

interface LogEntry {
  id: string;
  ip_origem: string | null;
  user_agent: string | null;
  filtros: Record<string, unknown> | null;
  total_retornado: number | null;
  created_at: string;
}

// ── Card de token ─────────────────────────────────────────
function CardToken({
  token,
  onRevogar,
}: {
  token: TokenComPreview;
  onRevogar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const [mostrarCompleto, setMostrarCompleto] = useState(!!token.token_recente);

  const handleCopiar = async () => {
    const texto = token.token_recente ?? token.token_preview;
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const expirado = token.expira_em && new Date(token.expira_em) < new Date();

  return (
    <div className={`bg-white border rounded-xl p-4 transition-all ${
      !token.ativo || expirado ? "opacity-60 border-gray-100" : "border-gray-200"
    }`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Key size={14} className={token.ativo && !expirado ? "text-teal-500" : "text-gray-300"} />
            <p className="text-sm font-semibold text-gray-900">{token.descricao}</p>
            {!token.ativo && (
              <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">Revogado</span>
            )}
            {expirado && token.ativo && (
              <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">Expirado</span>
            )}
            {token.ativo && !expirado && (
              <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Ativo</span>
            )}
          </div>
          <p className="text-xs text-gray-400">
            Criado em {new Date(token.created_at).toLocaleDateString("pt-BR")}
            {token.expira_em && ` · Expira em ${new Date(token.expira_em.includes("T") ? token.expira_em : token.expira_em + "T12:00:00").toLocaleDateString("pt-BR")}`}
          </p>
        </div>

        {token.ativo && !expirado && (
          <button
            onClick={onRevogar}
            className="text-xs text-red-500 hover:text-red-700 font-medium flex-shrink-0"
          >
            Revogar
          </button>
        )}
      </div>

      {/* Token (mascarado ou completo) */}
      <div className="bg-gray-50 rounded-lg px-3 py-2 flex items-center gap-2 mb-3">
        <code className="text-xs font-mono text-gray-700 flex-1 truncate">
          {mostrarCompleto && token.token_recente
            ? token.token_recente
            : token.token_preview}
        </code>
        <div className="flex items-center gap-1 flex-shrink-0">
          {token.token_recente && (
            <button
              onClick={() => setMostrarCompleto((v) => !v)}
              className="p-1 text-gray-400 hover:text-gray-700"
              title={mostrarCompleto ? "Ocultar" : "Mostrar token completo"}
            >
              {mostrarCompleto ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          )}
          <button
            onClick={handleCopiar}
            className="p-1 text-gray-400 hover:text-teal-600 transition-colors"
            title="Copiar token"
          >
            {copiado ? <CheckCircle2 size={13} className="text-green-500" /> : <Copy size={13} />}
          </button>
        </div>
      </div>

      {/* Último acesso */}
      {token.ultimo_uso_em && (
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <Activity size={11} />
          Último acesso: {new Date(token.ultimo_uso_em).toLocaleString("pt-BR")}
        </p>
      )}

      {/* Aviso se é token recém-criado */}
      {token.token_recente && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <p className="text-xs text-amber-800">
            <span className="font-semibold">⚠ Copie este token agora.</span>{" "}
            Ele não será exibido novamente após recarregar a página.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Modal criar token ─────────────────────────────────────
function ModalNovoToken({
  onClose,
  onCriado,
}: {
  onClose: () => void;
  onCriado: (token: TokenComPreview) => void;
}) {
  const [descricao, setDescricao] = useState("");
  const [expiraEm, setExpiraEm] = useState("");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao) { setErro("Descrição obrigatória."); return; }
    setCriando(true);
    setErro("");
    try {
      const res = await fetch("/api/acervo/mec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "criar",
          descricao,
          expira_em: expiraEm || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onCriado({
        ...data,
        token_preview: `${data.token.slice(0, 6)}...${data.token.slice(-4)}`,
        token_recente: data.token, // token completo apenas no momento da criação
      });
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setCriando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Novo token de acesso MEC</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {erro && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{erro}</div>}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Descrição <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="Ex: MEC — Fiscalização 2024, CEE/MS — Auditoria"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Data de expiração (opcional)
            </label>
            <input
              type="date"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              value={expiraEm}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setExpiraEm(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Se não definida, o token não expira automaticamente
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            <p className="text-xs text-blue-700">
              O token gerado será exibido <strong>uma única vez</strong>.
              Copie-o imediatamente após a criação.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={criando}
              className="px-5 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {criando ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
              {criando ? "Gerando..." : "Gerar token"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────
export default function AcessoMecPage() {
  const [tokens, setTokens] = useState<TokenComPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"tokens" | "logs">("tokens");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const carregarTokens = () => {
    setLoading(true);
    fetch("/api/acervo/mec/tokens")
      .then((r) => r.json())
      .then((d) => setTokens(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const carregarLogs = () => {
    setLoadingLogs(true);
    // Os logs estão na tabela acervo_mec_log — busca via supabase client
    import("@/lib/supabase/client")
      .then((m) => m.createClient())
      .then((supabase) =>
        supabase
          .from("acervo_mec_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50)
      )
      .then(({ data }) => setLogs(data ?? []))
      .catch(() => {})
      .finally(() => setLoadingLogs(false));
  };

  useEffect(() => { carregarTokens(); }, []);

  useEffect(() => {
    if (abaAtiva === "logs") carregarLogs();
  }, [abaAtiva]);

  const handleTokenCriado = (token: TokenComPreview) => {
    setModalAberto(false);
    setTokens((prev) => [token, ...prev]);
  };

  const handleRevogar = async (tokenId: string) => {
    if (!confirm("Tem certeza que deseja revogar este token? O acesso MEC será imediatamente bloqueado.")) return;
    try {
      await fetch("/api/acervo/mec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revogar", token_id: tokenId }),
      });
      setTokens((prev) =>
        prev.map((t) => t.id === tokenId ? { ...t, ativo: false } : t)
      );
    } catch {}
  };

  const endpointUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/acervo/mec`
    : "/api/acervo/mec";

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={20} className="text-teal-600" />
            <h1 className="text-xl font-bold text-gray-900">Acesso MEC / CEE</h1>
          </div>
          <p className="text-sm text-gray-500">
            Tokens de acesso para fiscalização do acervo pelo MEC e Conselhos Estaduais
          </p>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          className="flex items-center gap-2 bg-teal-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus size={16} /> Novo token
        </button>
      </div>

      {/* Aviso legal */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-4 flex items-start gap-3">
        <AlertTriangle size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 space-y-1">
          <p className="font-semibold">Portaria MEC 613/2022 — Obrigação de acesso</p>
          <p className="text-xs">
            A IES deve disponibilizar ao MEC e ao respectivo sistema de supervisão acesso ao
            acervo acadêmico digital para fins de fiscalização. O endpoint abaixo implementa
            essa obrigação com autenticação por token e registro de todos os acessos.
          </p>
          <div className="mt-2 bg-blue-100 rounded-lg px-3 py-2">
            <p className="text-xs font-mono text-blue-900 break-all">
              GET {endpointUrl}
              <br />
              Authorization: Bearer &lt;token&gt;
            </p>
          </div>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setAbaAtiva("tokens")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            abaAtiva === "tokens" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Tokens ({tokens.filter((t) => t.ativo).length} ativos)
        </button>
        <button
          onClick={() => setAbaAtiva("logs")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            abaAtiva === "logs" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Log de acessos
        </button>
      </div>

      {/* Aba tokens */}
      {abaAtiva === "tokens" && (
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
                  <div className="h-4 bg-gray-100 rounded w-48 mb-2" />
                  <div className="h-8 bg-gray-50 rounded" />
                </div>
              ))}
            </div>
          ) : tokens.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
              <Key size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Nenhum token gerado ainda</p>
              <p className="text-xs text-gray-400 mt-1 mb-4">
                Crie um token para fornecer ao MEC ou CEE
              </p>
              <button
                onClick={() => setModalAberto(true)}
                className="inline-flex items-center gap-2 bg-teal-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors"
              >
                <Plus size={15} /> Gerar primeiro token
              </button>
            </div>
          ) : (
            tokens.map((token) => (
              <CardToken
                key={token.id}
                token={token}
                onRevogar={() => handleRevogar(token.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Aba logs */}
      {abaAtiva === "logs" && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Últimos 50 acessos</p>
            <button
              onClick={carregarLogs}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {loadingLogs ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse flex gap-3">
                  <div className="h-3 bg-gray-100 rounded w-32" />
                  <div className="h-3 bg-gray-100 rounded w-24" />
                  <div className="h-3 bg-gray-100 rounded flex-1" />
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center">
              <Activity size={28} className="text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Nenhum acesso registrado ainda</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Data/Hora</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">IP</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Filtros</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Retornados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {new Date(log.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell font-mono">
                      {log.ip_origem ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 hidden lg:table-cell">
                      {log.filtros
                        ? Object.entries(log.filtros)
                            .filter(([, v]) => v)
                            .map(([k, v]) => `${k}=${v}`)
                            .join(", ") || "Nenhum"
                        : "Nenhum"}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-700">
                      {log.total_retornado ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modalAberto && (
        <ModalNovoToken
          onClose={() => setModalAberto(false)}
          onCriado={handleTokenCriado}
        />
      )}
    </div>
  );
}
