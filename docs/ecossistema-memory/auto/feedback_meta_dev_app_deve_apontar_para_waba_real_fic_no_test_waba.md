---
name: Meta Dev App deve apontar para WABA real FIC (não Test WABA)
description: Meta Dev App deve apontar para WABA real FIC (não Test WABA)
type: feedback
project: erp
tags: ["atendimento", "whatsapp", "meta-api", "waba", "webhook", "configuracao"]
success_score: 0.85
supabase_id: c5919c14-63b5-4833-b25e-30d793ce4235
created_at: 2026-04-13 23:44:28.967119+00
updated_at: 2026-04-14 01:06:51.747493+00
---

O Meta Developer App do ERP estava vinculado apenas ao "Test WhatsApp Business Account". O número real da FIC (+55 67 93618-0058, WABA 1833772130611929) não enviava eventos para nosso webhook porque o App não estava conectado ao WABA real.
Why: Meta roteia eventos de webhook por App. Se o App não tem o WABA real vinculado, recebe apenas eventos do Test WABA.
How to apply: Ao configurar qualquer WABA no Meta Developer Console, sempre verificar em WhatsApp → Getting Started qual WABA está selecionado. Deve ser o WABA real, não o Test. Confirmar também via Business Manager → Parceiros.
