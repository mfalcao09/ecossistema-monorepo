"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { RespostaAuditoria } from "@/lib/auditoria/tipos";

interface UseAuditoriaOptions {
  diplomaId: string;
  /** ISO timestamp do updated_at do diploma — usado como cache key */
  diplomaUpdatedAt: string;
}

interface UseAuditoriaReturn {
  auditoria: RespostaAuditoria | null;
  carregando: boolean;
  erro: string | null;
  /** Executa (ou re-executa) a auditoria, respeitando o cache em sessionStorage */
  auditar: (forcar?: boolean) => Promise<void>;
  /** Limpa cache e resultado atual */
  limpar: () => void;
}

/**
 * Hook que busca a auditoria de requisitos XSD v1.05 para um diploma.
 *
 * Sessão 2026-04-26 (Onda 2 — auditoria persistente):
 *   1) sessionStorage continua como cache de UX (resposta instantânea)
 *   2) Se cache vazio, hidrata de `/api/diplomas/[id]/auditorias?ultima=1`
 *      — busca a última auditoria salva no banco. Se ela tem o mesmo
 *      `diploma_updated_at` que o diploma atual, hidrata sem re-executar.
 *   3) Só re-executa GET /auditoria quando: (a) usuário clica Re-auditar
 *      (forcar=true), ou (b) diploma mudou (updated_at diferente da última
 *      salva).
 *
 * Como usar:
 *   const { auditoria, carregando, auditar } = useAuditoria({ diplomaId, diplomaUpdatedAt })
 *   useEffect(() => { auditar() }, [diplomaId])
 */
export function useAuditoria({
  diplomaId,
  diplomaUpdatedAt,
}: UseAuditoriaOptions): UseAuditoriaReturn {
  const [auditoria, setAuditoria] = useState<RespostaAuditoria | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Evita duas chamadas simultâneas (ex: StrictMode React)
  const fetchingRef = useRef(false);
  // Garante que a hidratação inicial só roda 1x por (diplomaId, updated_at)
  const hidratacaoRef = useRef<string | null>(null);

  const cacheKey = `auditoria:${diplomaId}:${diplomaUpdatedAt}`;

  // ── Hidratação inicial: busca a última auditoria salva no banco ──────────
  // Se ela cobre o estado atual do diploma, evita o re-cálculo no servidor.
  useEffect(() => {
    if (!diplomaId || !diplomaUpdatedAt) return;
    const chaveHidrat = `${diplomaId}:${diplomaUpdatedAt}`;
    if (hidratacaoRef.current === chaveHidrat) return;
    hidratacaoRef.current = chaveHidrat;

    // Cache local primeiro
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setAuditoria(JSON.parse(cached) as RespostaAuditoria);
        return;
      }
    } catch {
      // ignora
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/diplomas/${diplomaId}/auditorias?ultima=1`,
        );
        if (!res.ok) return;
        const body = await res.json();
        const ultima = (body?.auditorias ?? [])[0] as
          | {
              id: string;
              auditado_em: string;
              diploma_updated_at: string;
              pode_gerar_xml: boolean;
              totais: RespostaAuditoria["totais"];
              grupos: RespostaAuditoria["grupos"];
            }
          | undefined;
        if (!ultima || cancelled) return;
        // Só hidrata se a última auditoria foi pra o estado atual do diploma
        if (ultima.diploma_updated_at !== diplomaUpdatedAt) return;

        const hidratada: RespostaAuditoria = {
          pode_gerar_xml: ultima.pode_gerar_xml,
          auditado_em: ultima.auditado_em,
          grupos: ultima.grupos,
          totais: ultima.totais,
        };
        if (cancelled) return;
        setAuditoria(hidratada);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(hidratada));
        } catch {
          // ignora
        }
      } catch {
        // hidratação é opcional — falha silenciosa, deixa o usuário Auditar
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [diplomaId, diplomaUpdatedAt, cacheKey]);

  const auditar = useCallback(
    async (forcar = false) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      try {
        // ── Cache hit ──────────────────────────────────────────────────────
        if (!forcar) {
          try {
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
              setAuditoria(JSON.parse(cached) as RespostaAuditoria);
              return;
            }
          } catch {
            // sessionStorage indisponível (SSR, iframe sandboxado) — ignora
          }
        }

        // ── Fetch ──────────────────────────────────────────────────────────
        setCarregando(true);
        setErro(null);

        // Sessão 2026-04-26: backend persiste cada execução em
        // diploma_auditorias. forcar=true → ?forcar=1 garante novo INSERT
        // mesmo que o estado do diploma não tenha mudado.
        const url = forcar
          ? `/api/diplomas/${diplomaId}/auditoria?forcar=1`
          : `/api/diplomas/${diplomaId}/auditoria`;
        const res = await fetch(url);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body?.error ?? `Erro ${res.status} ao auditar diploma`,
          );
        }

        const data: RespostaAuditoria = await res.json();
        setAuditoria(data);

        // ── Salvar no cache ────────────────────────────────────────────────
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(data));
        } catch {
          // quota excedida ou indisponível — continua sem cache
        }
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "Erro desconhecido na auditoria";
        setErro(msg);
      } finally {
        setCarregando(false);
        fetchingRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [diplomaId, cacheKey],
  );

  const limpar = useCallback(() => {
    setAuditoria(null);
    setErro(null);
    try {
      sessionStorage.removeItem(cacheKey);
    } catch {
      // ignora
    }
  }, [cacheKey]);

  return { auditoria, carregando, erro, auditar, limpar };
}
