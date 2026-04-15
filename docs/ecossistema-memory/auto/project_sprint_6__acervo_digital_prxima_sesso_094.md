---
name: Sprint 6 — Acervo Digital (próxima sessão 094)
description: Sprint 6 — Acervo Digital (próxima sessão 094)
type: project
project: erp
tags: ["sprint-6", "acervo", "pdf-a", "rpc", "verificar-e-avancar-pacote", "próxima-sessão", "094"]
success_score: 0.93
supabase_id: fe89d148-6824-4d70-acf2-1c2a4e00184c
created_at: 2026-04-15 00:44:24.911009+00
updated_at: 2026-04-15 00:44:24.911009+00
---

Sprint 6 é o próximo passo imediato (sem bloqueadores). 4 itens: 6.1 Alterar RPC converter_sessao_em_processo para copiar arquivos com destino_acervo=true para diploma_documentos_comprobatorios com status=pendente_conversao. 6.2 Wiring da rota /api/converter/pdfa: disparar conversão automática após insert em diploma_documentos_comprobatorios (edge case: PDF > 15MB deve falhar com mensagem clara). 6.3 Corrigir verificarEAvancarPacote: assinado → aguardando_documentos (não aguardando_envio_registradora). Avançar para aguardando_envio_registradora apenas quando acervo confirmado + documentos assinados. 6.4 UI Etapa 2 em diplomas/[id]/page.tsx: lista comprobatórios com status PDF/A, botão confirmar acervo.
