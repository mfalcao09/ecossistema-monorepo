"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  FileSignature,
  Loader2,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";
import { fetchSeguro } from "@/lib/security/fetch-seguro";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface AssinanteRef {
  id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  cargo: string | null;
  outro_cargo: string | null;
  tipo_certificado: "eCPF" | "eCNPJ" | null;
}

interface FluxoRow {
  id: string;
  diploma_id: string;
  assinante_id: string;
  ordem: number;
  status: string;
  papel: "emissora" | "registradora" | null;
  tipo_certificado: string | null;
  assinantes: AssinanteRef | null;
}

interface Props {
  diplomaId: string;
  diplomaStatus: string;
  onChange?: () => void;
}

const STATUS_QUE_TRAVAM_EDICAO = new Set([
  "em_assinatura",
  "assinado",
  "aguardando_documentos",
  "aguardando_envio_registradora",
  "aguardando_registro",
  "registrado",
  "publicado",
  "cancelado",
]);

const CARGO_LABEL: Record<string, string> = {
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

function cargoText(a: AssinanteRef | null): string {
  if (!a) return "—";
  if (a.cargo === "outro" && a.outro_cargo) return a.outro_cargo;
  return CARGO_LABEL[a.cargo ?? ""] ?? a.cargo ?? "—";
}

// ── Componente principal ─────────────────────────────────────────────────────

export function EditorFluxoAssinaturas({ diplomaId, diplomaStatus, onChange }: Props) {
  const [fluxo, setFluxo] = useState<FluxoRow[]>([]);
  const [assinantesDisponiveis, setAssinantesDisponiveis] = useState<AssinanteRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [novoAssinanteId, setNovoAssinanteId] = useState("");
  const [novoPapel, setNovoPapel] = useState<"emissora" | "registradora">("emissora");

  const edicaoBloqueada = STATUS_QUE_TRAVAM_EDICAO.has(diplomaStatus);

  const carregarFluxo = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(`/api/diplomas/${diplomaId}/fluxo-assinaturas`);
      if (!res.ok) throw new Error(`Erro ao carregar fluxo (${res.status})`);
      const data = (await res.json()) as FluxoRow[];
      setFluxo(data.sort((a, b) => a.ordem - b.ordem));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [diplomaId]);

  const carregarAssinantes = useCallback(async () => {
    try {
      const res = await fetch(`/api/assinantes`);
      if (!res.ok) return;
      const data = (await res.json()) as AssinanteRef[];
      setAssinantesDisponiveis(data);
    } catch {
      // silencioso — o dropdown só fica vazio
    }
  }, []);

  useEffect(() => {
    carregarFluxo();
    carregarAssinantes();
  }, [carregarFluxo, carregarAssinantes]);

  const idsNoFluxo = useMemo(
    () => new Set(fluxo.map((f) => f.assinante_id)),
    [fluxo]
  );
  const candidatos = useMemo(
    () => assinantesDisponiveis.filter((a) => !idsNoFluxo.has(a.id)),
    [assinantesDisponiveis, idsNoFluxo]
  );

  async function adicionar() {
    if (!novoAssinanteId) return;
    setActioning("add");
    setErro(null);
    try {
      const res = await fetchSeguro(`/api/diplomas/${diplomaId}/fluxo-assinaturas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assinante_id: novoAssinanteId, papel: novoPapel }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Falha ao adicionar (${res.status})`);
      }
      setNovoAssinanteId("");
      setShowAdd(false);
      await carregarFluxo();
      onChange?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao adicionar");
    } finally {
      setActioning(null);
    }
  }

  async function remover(fluxoId: string) {
    if (!confirm("Remover este signatário do fluxo?")) return;
    setActioning(fluxoId);
    setErro(null);
    try {
      const res = await fetchSeguro(
        `/api/diplomas/${diplomaId}/fluxo-assinaturas/${fluxoId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Falha ao remover (${res.status})`);
      }
      await carregarFluxo();
      onChange?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao remover");
    } finally {
      setActioning(null);
    }
  }

  async function reordenar(fluxoId: string, direcao: "up" | "down") {
    const i = fluxo.findIndex((f) => f.id === fluxoId);
    const j = direcao === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= fluxo.length) return;

    const a = fluxo[i];
    const b = fluxo[j];
    setActioning(fluxoId);
    setErro(null);
    try {
      const [r1, r2] = await Promise.all([
        fetchSeguro(`/api/diplomas/${diplomaId}/fluxo-assinaturas/${a.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ordem: b.ordem }),
        }),
        fetchSeguro(`/api/diplomas/${diplomaId}/fluxo-assinaturas/${b.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ordem: a.ordem }),
        }),
      ]);
      if (!r1.ok || !r2.ok) throw new Error("Falha ao reordenar");
      await carregarFluxo();
      onChange?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao reordenar");
    } finally {
      setActioning(null);
    }
  }

  async function alterarPapel(
    fluxoId: string,
    papel: "emissora" | "registradora"
  ) {
    setActioning(fluxoId);
    setErro(null);
    try {
      const res = await fetchSeguro(
        `/api/diplomas/${diplomaId}/fluxo-assinaturas/${fluxoId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ papel }),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Falha ao alterar papel (${res.status})`);
      }
      await carregarFluxo();
      onChange?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao alterar papel");
    } finally {
      setActioning(null);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <FileSignature size={14} className="text-gray-400" />
          Fluxo de assinaturas
        </h3>
        {!edicaoBloqueada && (
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700"
          >
            <Plus size={14} />
            Adicionar signatário
          </button>
        )}
      </div>

      {edicaoBloqueada && (
        <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Fluxo bloqueado para edição no status atual ({diplomaStatus}).
        </div>
      )}

      {erro && (
        <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {erro}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Loader2 size={12} className="animate-spin" />
          Carregando fluxo…
        </div>
      ) : fluxo.length === 0 ? (
        <p className="text-xs text-gray-500">
          Nenhum signatário no fluxo.{" "}
          {!edicaoBloqueada && "Adicione um para iniciar."}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {fluxo.map((f, idx) => {
            const isBusy = actioning === f.id;
            return (
              <li
                key={f.id}
                className="flex items-center gap-2 text-xs bg-gray-50/70 rounded-lg px-3 py-2"
              >
                <span className="font-mono text-[10px] text-gray-400 w-5 text-center">
                  {f.ordem}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">
                    {f.assinantes?.nome ?? "—"}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate">
                    {cargoText(f.assinantes)}
                    {f.assinantes?.tipo_certificado
                      ? ` · ${f.assinantes.tipo_certificado}`
                      : ""}
                    {f.assinantes?.email ? ` · ${f.assinantes.email}` : ""}
                    {!f.assinantes?.email && (
                      <span className="text-red-500"> · e-mail pendente</span>
                    )}
                  </p>
                </div>

                <select
                  value={f.papel ?? "emissora"}
                  onChange={(e) =>
                    alterarPapel(f.id, e.target.value as "emissora" | "registradora")
                  }
                  disabled={edicaoBloqueada || isBusy}
                  className="text-[10px] px-2 py-1 border border-gray-200 rounded-md bg-white disabled:opacity-50"
                >
                  <option value="emissora">Emissora</option>
                  <option value="registradora">Registradora</option>
                </select>

                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    f.status === "assinado"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {f.status}
                </span>

                {!edicaoBloqueada && (
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => reordenar(f.id, "up")}
                      disabled={idx === 0 || isBusy}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      title="Mover para cima"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => reordenar(f.id, "down")}
                      disabled={idx === fluxo.length - 1 || isBusy}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      title="Mover para baixo"
                    >
                      <ArrowDown size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remover(f.id)}
                      disabled={isBusy}
                      className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-30"
                      title="Remover do fluxo"
                    >
                      {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {showAdd && !edicaoBloqueada && (
        <div className="border border-gray-200 rounded-xl p-3 space-y-2 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <select
              value={novoAssinanteId}
              onChange={(e) => setNovoAssinanteId(e.target.value)}
              className="flex-1 text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
            >
              <option value="">Selecione um signatário cadastrado…</option>
              {candidatos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome} {a.cpf ? `— ${a.cpf}` : ""}
                </option>
              ))}
            </select>
            <select
              value={novoPapel}
              onChange={(e) =>
                setNovoPapel(e.target.value as "emissora" | "registradora")
              }
              className="text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white"
            >
              <option value="emissora">Emissora</option>
              <option value="registradora">Registradora</option>
            </select>
            <button
              type="button"
              onClick={adicionar}
              disabled={!novoAssinanteId || actioning === "add"}
              className="flex items-center gap-1.5 text-xs font-medium bg-primary-600 text-white px-3 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {actioning === "add" ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Plus size={12} />
              )}
              Adicionar
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-gray-500">
            <span>
              {candidatos.length === 0
                ? "Todos os signatários cadastrados já estão no fluxo."
                : `${candidatos.length} disponível(is) para adicionar.`}
            </span>
            <Link
              href="/diploma/assinantes"
              target="_blank"
              className="flex items-center gap-1 text-primary-600 hover:text-primary-700"
            >
              <UserPlus size={11} />
              Cadastrar novo
              <ExternalLink size={10} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
