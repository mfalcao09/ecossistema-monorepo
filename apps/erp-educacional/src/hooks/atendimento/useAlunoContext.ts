"use client";

/**
 * useAlunoContext — resolve o aluno vinculado ao contato de uma conversa
 * e expõe cobranças pendentes. Sprint S4.5 · Etapa 2-B.
 *
 * Retorna:
 *   - aluno: {id, nome, cpf, ra, curso, telefone} ou null se contact_sem_aluno
 *   - cobrancasPendentes: [] se aluno null
 *   - loading, error, refresh()
 *
 * Nota: componente cliente. Chama `/api/atendimento/pagamentos?conversation_id`
 * que já valida permissão e resolve o join.
 */

import { useCallback, useEffect, useState } from "react";

export interface CobrancaPendente {
  id: string;
  valor: number;
  mes_referencia: string;
  data_vencimento: string;
  status: "gerado" | "enviado" | "vencido";
  bolepix_linha_digitavel: string | null;
  bolepix_pix_copia_cola: string | null;
  bolepix_pdf_url: string | null;
  your_number: string | null;
  created_at: string;
}

export interface AlunoBrief {
  id: string;
  nome: string;
  cpf: string;
  ra: string | null;
  curso: string | null;
  telefone: string | null;
}

interface State {
  aluno: AlunoBrief | null;
  cobrancasPendentes: CobrancaPendente[];
  loading: boolean;
  error: string | null;
  /** false = contact_sem_aluno (response 409). Botão fica desabilitado. */
  vinculado: boolean;
}

export function useAlunoContext(conversationId: string | null): State & {
  refresh: () => void;
} {
  const [state, setState] = useState<State>({
    aluno: null,
    cobrancasPendentes: [],
    loading: false,
    error: null,
    vinculado: false,
  });

  const fetchData = useCallback(async () => {
    if (!conversationId) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const res = await fetch(
        `/api/atendimento/pagamentos?conversation_id=${encodeURIComponent(conversationId)}`,
      );
      const data = (await res.json()) as
        | { aluno: AlunoBrief; cobrancas: CobrancaPendente[] }
        | { erro: string; message?: string };

      if (res.status === 409 && "erro" in data && data.erro === "contact_sem_aluno") {
        setState({
          aluno: null,
          cobrancasPendentes: [],
          loading: false,
          error: null,
          vinculado: false,
        });
        return;
      }
      if (!res.ok || "erro" in data) {
        setState({
          aluno: null,
          cobrancasPendentes: [],
          loading: false,
          error: "erro" in data ? data.erro : `HTTP ${res.status}`,
          vinculado: false,
        });
        return;
      }

      setState({
        aluno: data.aluno,
        cobrancasPendentes: data.cobrancas,
        loading: false,
        error: null,
        vinculado: true,
      });
    } catch (err) {
      setState({
        aluno: null,
        cobrancasPendentes: [],
        loading: false,
        error: err instanceof Error ? err.message : String(err),
        vinculado: false,
      });
    }
  }, [conversationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...state, refresh: fetchData };
}
