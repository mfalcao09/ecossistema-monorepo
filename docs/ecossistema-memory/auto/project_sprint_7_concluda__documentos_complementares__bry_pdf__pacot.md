---
name: Sprint 7 concluída — Documentos Complementares + BRy PDF + Pacote Registradora
description: Sprint 7 concluída — Documentos Complementares + BRy PDF + Pacote Registradora
type: project
project: erp
tags: ["sprint7", "documentos-complementares", "bry", "assinatura-pdf", "webhook", "pacote-registradora", "hub-signer"]
success_score: 0.92
supabase_id: c583fd4f-bd16-42d0-a673-19c9df93b688
created_at: 2026-04-15 02:12:37.510882+00
updated_at: 2026-04-15 02:12:37.510882+00
---

Sprint 7 entregue (s095, commit 817c47e, deploy dpl_FYTdVrwZgJjeCP7FoNKj1zGLq1EP READY). Tabela diploma_documentos_complementares criada (Sprint 6/sessão 094). POST /documentos corrigido (bug: usava documentos_digitais sem diploma_id → novo: diploma_documentos_complementares com upsert diploma_id+tipo). src/lib/bry/assinatura-pdf.ts criado — cliente HUB Signer BRy com submitDocumentoBry / consultarStatusDocumentoBry / cancelarDocumentoBry. POST /api/diplomas/[id]/documentos/assinar dispara assinatura BRy por documento. POST /api/webhooks/bry-assinatura-pdf recebe callback BRy (correlação por externalId "{diploma_id}:{tipo}" ou bry_document_id). UI Etapa 3 expandida: botão Enviar p/ Assinatura BRy + DocStatusBadge + Baixar ZIP + Upload XML registrado. pacote-registradora corrigido: usa diploma_documentos_complementares (não documentos_digitais), prefere arquivo_assinado_url, retorna ZIP binário (não JSON). Novas env vars: BRY_ASSINATURA_PDF_BASE_URL + BRY_ASSINATURA_PDF_WEBHOOK_URL.
