---
name: Arquitetura Técnica do ERP
description: Arquitetura Técnica do ERP
type: context
project: erp
tags: ["arquitetura", "stack", "supabase", "nextjs", "railway"]
success_score: 0.9
supabase_id: 96c0d940-876e-45bf-9f5f-1ef93839512b
created_at: 2026-04-13 01:55:12.070453+00
updated_at: 2026-04-13 06:04:09.450527+00
---

Stack principal:
- Frontend: Next.js + React + TypeScript + shadcn/ui + Tailwind CSS
- Backend: Next.js API Routes (Vercel Serverless)
- Banco: PostgreSQL 15 via Supabase (bvryaopfjiyxjgsuhjsb)
- Deploy: Vercel
- Runtime externo: Railway (serviços Python: extração Gemini, converter PDF/A)

Serviços Railway:
- Extração de documentos: Gemini 2.5 Flash (fire-and-forget)
- Converter PDF/A: Ghostscript

Domínios:
- gestao.* = ERP autenticado (painel admin)
- diploma.* = portal público (diplomados)

CRÍTICO — Segurança:
- DOMPurify SEMPRE sanitizar HTML gerado por IA antes de dangerouslySetInnerHTML
- profiles.id ≠ auth.users.id — usar session.user.id com cuidado
- SEMPRE .maybeSingle() em vez de .single() (evita crash PGRST116)
- NUNCA misturar dynamic/static imports (TDZ error Vite/Rollup)
- Toda tabela nova: RLS ON + policy authenticated auth.uid() IS NOT NULL
- Funções trigger com search_path fixo
- NUNCA misturar nomes de segmentos dinâmicos no mesmo nível ([id] vs [sessaoId])
