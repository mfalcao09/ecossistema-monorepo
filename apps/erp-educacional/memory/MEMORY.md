# MEMORY.md — Roteador de Memória (ERP-Educacional)

> ⚠️ **FASE B ATIVA** — Este arquivo é **backup de emergência**.
> Fonte primária: Supabase ECOSYSTEM (`gqckbunsfjgerbuiyzvn`).
> Use `select bootstrap_session('tarefa', 'erp', 15)` no início da sessão.
> Última sync automática: 2026-04-26

> Regra: máximo 40 linhas. Detalhe vai nos arquivos linkados.
> Última atualização: 2026-04-26 (sync auto — F0.6 reflete últimas decisões) | Retroactive pass: ✅

## Ponto de Entrada

→ **[TRACKER.md](TRACKER.md)** — estado atual, progresso por sprint, próxima sessão

## Rastreabilidade (Masterplan → Sprint → Sessão)

| Recurso          | Arquivo                                                                |
| ---------------- | ---------------------------------------------------------------------- |
| Masterplan ativo | [masterplans/diploma-digital-v4.md](masterplans/diploma-digital-v4.md) |
| Sprints (6)      | [sprints/](sprints/) — 1 arquivo por sprint com plano de sessões       |
| Pendências       | [PENDENCIAS.md](PENDENCIAS.md) — gerado automaticamente (plan-audit)   |
| Sessões (55+)    | [sessions/SINTESE.md](sessions/SINTESE.md) — histórico cronológico     |

## Arquivos Temáticos (Camada 2 — ler sob demanda)

| Arquivo                                                                                                                    | Consultar quando...               |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| [preferences.md](preferences.md)                                                                                           | Início de projeto (não de sessão) |
| [architecture.md](architecture.md)                                                                                         | Decisão técnica de alto nível     |
| [patterns.md](patterns.md)                                                                                                 | Antes de implementar feature      |
| [debugging.md](debugging.md)                                                                                               | Bug encontrado                    |
| [xml-estrutura-xsd-v105.md](xml-estrutura-xsd-v105.md)                                                                     | Codar/revisar XML                 |
| [bugs-motor-xml-status-final.md](bugs-motor-xml-status-final.md)                                                           | Status do motor XML               |
| [projects/design-consolidado-sessao-024.md](projects/design-consolidado-sessao-024.md)                                     | Fluxo novo processo               |
| [projects/plano-tecnico-fluxo-novo-processo-sessao-028-v2.md](projects/plano-tecnico-fluxo-novo-processo-sessao-028-v2.md) | Plano técnico v2                  |

## Pastas

| Pasta        | Conteúdo                                     |
| ------------ | -------------------------------------------- |
| masterplans/ | Visão end-to-end de cada projeto grande      |
| sprints/     | Plano + progresso de cada sprint             |
| sessions/    | Registro individual de cada sessão           |
| projects/    | Designs, planos técnicos                     |
| workflows/   | Runbooks operacionais (commit-push-autonomo) |

## Decisões Ativas (últimas 5 — rotacionar)

| Data  | Decisão                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 22/04 | F0.6/F3: **🎉 F0.6 ENCERRADA — PDFs via Puppeteer + templates React** — render-pdf.ts (helper Puppeteer reutilizável) + TermoExpedicaoTemplate.tsx + TermoResponsabilidadeTemplate.tsx + 2 rotas /print/\* + patch POST /api/diplomas/[id]/documentos (snapshot→Puppeteer, legado→pdf-lib). Compatibilidade BRy HUB Signer + Secretaria + XAdES preservada. Produção `diploma-digital-i8arc5f78` Ready. Commit `d117506`. |
| 22/04 | F0.6/F2: **Snapshot Imutável Fase 2 — XMLs lendo snapshot** — src/lib/diploma/snapshot-to-dados-diploma.ts (350 linhas, normalizações TTitulacao/TFormaAcesso/forma_integralizacao). Patch montador.ts para SELECT incluir snapshot. Produção `diploma-digital-ihudd6c9e`.                                                                                                                                                |
| 22/04 | F0.6/F1: **Snapshot Imutável Fase 1** — 2 migrations (`diplomas.dados_snapshot_extracao` jsonb + `diploma_snapshot_edicoes` audit) + src/lib/diploma/snapshot.ts (builder/patches/diff/travar) + POST /api/processos populando snapshot + 3 endpoints REST + UI AbaSnapshot. Produção `diploma-digital-qsd0n5815`.                                                                                                        |
| 22/04 | F0.5: **PDF Texto Selecionável via Puppeteer + Plano Snapshot APROVADO** — rota `/print/historico/[id]` + endpoint POST `/pdf` (Puppeteer+Chromium headless) + LivePreview com props + botão "Salvar PDF" + toggle "Papel timbrado" + @sparticuz/chromium@147 + puppeteer-core@24. Plano arquitetural Snapshot Imutável aprovado (14h em 3 fases). Produção `diploma-digital-4r3nca9e0`.                                  |
| 17/04 | F0.4: **Fase 0.4 PDFs COMPLETA — Módulo Secretaria** — Secretaria (layout+emissão+configurações) + secretaria/emissao/historico (busca+download PDF) + API POST /api/secretaria/emissao/historico/[diplomaId] + timbrado e margens no pdf-generator.ts. PR #19 aberta. Branch: claude/vigorous-mccarthy-8ca1e4.                                                                                                           |

## Módulo Financeiro (sessão 093+)

- **Sessão de referência:** [sessions/sessao-092-2026-04-14.md](sessions/sessao-092-2026-04-14.md)
- **Regras chave:** boleto NAOTEMMULTA+ISENTO; encargos (multa 10%+juros 2%/mês) só no PIX sob demanda; 1 PIX/dia/cobrança; régua e-mail dias 1/3/7/12/17/22; bloquear portal dia 23
- **Bloqueador:** credenciais Inter sandbox (6 env vars) para emissão real
- **Próximo:** importar alunos 2026/1, configurar desconto_pontualidade, testar crons, implementar payment-webhook.py

## Tensões Ativas

- **Prazo MEC graduação:** 01/07/2025 já venceu — URGENTE
- **BRy credenciais homologação:** Sem acesso — bloqueia testes reais do pipeline BRy (Sprint 8)
- **Inter credenciais:** Sem sandbox credentials — bloqueia emissão real bolepix
- **Sprint 8 próximo (096):** Fluxo UFMS manual + teste ZIP Kauana (id: 5e197846) + configurar vars BRy Vercel
