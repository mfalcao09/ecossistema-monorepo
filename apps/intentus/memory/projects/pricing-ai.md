# pricing-ai — Histórico e Status

**Status:** ⏸️ Standby (v42 com erros, aguardando alternativa Urbit)
**Versão atual:** v24r8 (deploy version 42 — re-deploy com código correto)
**Edge Function ID:** 0cfa68cf-dcae-4020-a58d-a1a73c931d89
**Arquivo:** `supabase/functions/pricing-ai/index.ts` (~1302 linhas)

## Resumo da Evolução (24 sessões)
- **Sessões 1-5:** Shape mismatch, top comparables, bug fixes, timeout, parse contract
- **Sessões 6-9:** Rental fix, auditoria completa, pricing history tab, XSS security
- **Sessões 10-14:** Multi-plataforma (v26-v31), city filtering, single actor simplification
- **Sessões 15-20:** Rollback v24, reconstrução, Apify endpoint fix, contract_type, field normalization, TX boundary
- **Sessões 21-23:** URL VivaReal fix (/bairros/), ZapImóveis re-adicionado, property type filter
- **Sessão 24:** Re-deploy (v41 tinha código errado → v42 com código correto do repo). Ainda com erros.

## Status Atual (Sessão 72, 15/03/2026)
v42 retorna "Edge Function returned a non-2xx status code" — Marcelo pivotou para explorar Urbit API como alternativa estratégica. Projeto em standby aguardando negociação comercial com Urbit. Código local v24r8 está correto e testado (sessões 1-24), problema é de deploy/runtime não diagnosticado.

## Arquitetura v24r8
- 2 actors Apify (VivaReal + ZapImóveis) em paralelo
- Property type filter (URL + post-processing)
- TX boundary absoluto (nunca mistura venda/locação)
- Two-pass scraping (bairro → cidade)
- Safe fallback (geo relaxa, TX nunca)
- OpenAI GPT-4o-mini para análise
- Auto-persist em pricing_analyses
