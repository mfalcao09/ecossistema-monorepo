---
name: Meta dispatcher usa phone_number_id fake "123456123" — sempre usar fallback inbox
description: Meta dispatcher usa phone_number_id fake "123456123" — sempre usar fallback inbox
type: feedback
project: erp
tags: ["whatsapp", "meta", "dispatcher", "phone_number_id", "fallback"]
success_score: 0.95
supabase_id: 45dbd912-4b84-46ae-86ea-20eea1093bca
created_at: 2026-04-13 07:05:26.386901+00
updated_at: 2026-04-13 09:04:43.88647+00
---

O botão "Testar" do Meta for Developers (dispatcher) envia payload sintético com phone_number_id: "123456123" (placeholder). Em produção real, a Meta usa o ID real (ex: 938274582707248). Webhook deve ter fallback: se não achar inbox pelo phone_number_id exato, usar o primeiro inbox WhatsApp ativo do banco. Sem esse fallback, o dispatcher de teste sempre falha silenciosamente.
