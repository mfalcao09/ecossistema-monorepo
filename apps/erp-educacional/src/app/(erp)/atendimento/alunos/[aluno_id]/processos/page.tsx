"use client";

/**
 * /atendimento/alunos/[aluno_id]/processos
 *
 * Lista todos os protocolos (= processos acadêmicos) de um aluno, agregados
 * em um só lugar. Sprint S4.5 · Etapa 2-B.
 */

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, ExternalLink } from "lucide-react";

interface Aluno {
  id: string;
  nome: string;
  cpf: string;
  ra: string | null;
  curso: string | null;
  telefone: string | null;
  email: string | null;
  status: string;
}

interface ProcessoRow {
  id: string;
  protocol_number: number;
  subject: string;
  description: string | null;
  status: "open" | "resolved" | "canceled";
  created_at: string;
  resolved_at: string | null;
  conversation_id: string;
  process_type: { id: string; key: string; name: string } | null;
}

function statusPill(status: ProcessoRow["status"]) {
  switch (status) {
    case "open":
      return {
        label: "Aberto",
        className: "bg-blue-50 text-blue-700 border-blue-200",
      };
    case "resolved":
      return {
        label: "Resolvido",
        className: "bg-green-50 text-green-700 border-green-200",
      };
    case "canceled":
      return {
        label: "Cancelado",
        className: "bg-gray-50 text-gray-600 border-gray-200",
      };
  }
}

export default function AlunoProcessosPage({
  params,
}: {
  params: Promise<{ aluno_id: string }>;
}) {
  const { aluno_id } = use(params);
  const [aluno, setAluno] = useState<Aluno | null>(null);
  const [processos, setProcessos] = useState<ProcessoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/atendimento/alunos/${encodeURIComponent(aluno_id)}/processos`,
      );
      const data = (await res.json()) as
        | { aluno: Aluno; processos: ProcessoRow[] }
        | { erro: string };
      if (!res.ok || "erro" in data) {
        setError("erro" in data ? data.erro : `HTTP ${res.status}`);
        return;
      }
      setAluno(data.aluno);
      setProcessos(data.processos);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [aluno_id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Link
        href="/atendimento"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={14} /> voltar
      </Link>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
          <Loader2 size={16} className="animate-spin" /> Carregando…
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && aluno && (
        <>
          <header className="border-b border-gray-200 pb-4">
            <h1 className="text-2xl font-bold text-gray-900">{aluno.nome}</h1>
            <p className="mt-1 text-sm text-gray-500">
              CPF {aluno.cpf}
              {aluno.ra && <> · RA {aluno.ra}</>}
              {aluno.curso && <> · {aluno.curso}</>}
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                {aluno.status}
              </span>
            </p>
          </header>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Processos acadêmicos ({processos.length})
            </h2>

            {processos.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">
                Nenhum processo aberto até agora.
              </p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                    <th className="py-2 pr-3">Protocolo</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Assunto</th>
                    <th className="py-2 pr-3">Aberto em</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3 text-right">Conversa</th>
                  </tr>
                </thead>
                <tbody>
                  {processos.map((p) => {
                    const sp = statusPill(p.status);
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-2 pr-3 font-mono text-xs text-gray-700">
                          #{p.protocol_number}
                        </td>
                        <td className="py-2 pr-3 text-gray-600">
                          {p.process_type?.name ?? "—"}
                        </td>
                        <td className="py-2 pr-3 text-gray-900">
                          {p.subject}
                          {p.description && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-md">
                              {p.description}
                            </p>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-gray-500 text-xs">
                          {new Date(p.created_at).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded border ${sp.className}`}
                          >
                            {sp.label}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right">
                          <Link
                            href={`/atendimento?conversation=${p.conversation_id}`}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                          >
                            abrir <ExternalLink size={11} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
