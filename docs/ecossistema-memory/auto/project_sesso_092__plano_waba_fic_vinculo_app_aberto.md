---
name: Sessão 092 — PLANO-WABA-FIC-VINCULO-APP (aberto)
description: Sessão 092 — PLANO-WABA-FIC-VINCULO-APP (aberto)
type: project
project: erp
tags: ["atendimento", "whatsapp", "waba", "webhook", "sessao-092", "plano-aberto"]
success_score: 0.7
supabase_id: e2e3ba23-1299-46dd-b6ef-8106bcaef8ea
created_at: 2026-04-13 23:44:28.967119+00
updated_at: 2026-04-14 00:06:50.15998+00
---

Sessão 092 (13/04/2026). Fix: avatar_url removida de atendimento_contacts nos 2 routes de conversas (commit 080de25, deploy READY). 
Investigação WABA: WABA 1833772130611929 é propriedade da FIC - Cassilândia MS. Número +55 67 93618-0058 (phone_number_id 938274582707248) está Conectado no WhatsApp Manager. Todas 4 vars WHATSAPP_* configuradas no Vercel. 
Causa raiz mensagens não chegando: Meta Developer App do ERP está vinculado ao Test WhatsApp Business Account, não ao WABA real da FIC.
Plano PLANO-WABA-FIC-VINCULO-APP: ir em developers.facebook.com → App ERP → WhatsApp → Getting Started → trocar WABA para FIC real. Ou via Business Manager → Parceiros → Add App. Status: não resolvido, retomar na sessão 093.
