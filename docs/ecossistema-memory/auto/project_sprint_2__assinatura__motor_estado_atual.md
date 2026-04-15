---
name: Sprint 2 — Assinatura + Motor (estado atual)
description: Sprint 2 — Assinatura + Motor (estado atual)
type: project
project: erp
tags: ["sprint2", "bry", "motor-xml", "assinatura", "diploma"]
success_score: 0.85
supabase_id: 85ddf352-0bb3-4f27-a92f-29c6e16683d3
created_at: 2026-04-13 01:55:12.070453+00
updated_at: 2026-04-13 06:04:14.839319+00
---

Sprint 2 — Assinatura + Motor XML
Progresso: ~50% (E2.1 ✅, E2.2 ~80%, E2.3-2.4 pendentes)

Epic 2.1 — Fluxo Completo de Emissão: ✅ 100% COMPLETO
- Motor XML v2 implementado (xmlbuilder2, 15+ arquivos, compilação limpa)
- Motor XML 17/17 unit tests passando
- Pipeline auditar requisitos XSD: 6 validators + API + hook + UI
- Processo nasce no Upload (em_extracao), nome nullable, sessao_id FK
- FormularioRevisao 12 seções XSD v1.05 + PDF export

Epic 2.2 — Integração BRy (assinatura digital): ~80%
- API Diploma Digital (Initialize/Finalize) implementada
- BRy Signer Desktop para Token A3 USB (decisão final — não Easy Signer, não KMS)
- Página /diploma/assinaturas com sidebar + seleção em lote
- Carimbo do tempo automático pós-assinatura
- Pipeline registradora: timestamp-service + ZIP (XMLs+.p7s+PDFs/A+manifest)
- BLOQUEADO: BRy credenciais de homologação pendentes

Epic 2.3 — PDF/A (Ghostscript Railway): 0%
Epic 2.4 — Portal do Diplomado: 0%

Última sessão (085, 12/04): Módulo Atendimento Sprint 1 — 9 tabelas Supabase + TopBar
Próxima sessão (086): Teste e2e completo pipeline BRy (bloqueado por credenciais)
