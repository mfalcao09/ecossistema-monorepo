---
name: STATUS_CONFIG incompleto causa fallback "Rascunho" em todos os status não mapeados
description: STATUS_CONFIG incompleto causa fallback "Rascunho" em todos os status não mapeados
type: feedback
project: erp
tags: ["status-config", "bug", "labels", "pipeline", "padrão"]
success_score: 0.9
supabase_id: bea4814d-32a0-4255-b741-bc78637672a3
created_at: 2026-04-15 00:44:24.911009+00
updated_at: 2026-04-15 00:44:24.911009+00
---

Bug confirmado: STATUS_CONFIG em diploma/page.tsx tinha apenas 11 entradas. O fallback STATUS_CONFIG[d.status] ?? STATUS_CONFIG.rascunho causava que qualquer status não mapeado (ex: aguardando_envio_registradora) aparecia como "Rascunho". Fix: expandir para 30+ entradas cobrindo todas as etapas + mudar fallback para { label: d.status, cor: "gray", icone: Clock }. Padrão a seguir: sempre que adicionar novo status ao banco, adicionar simultaneamente nos 4 arquivos: diploma/page.tsx (STATUS_CONFIG), diplomas/[id]/page.tsx (STATUS_LABEL+STATUS_COR), types/diplomas.ts (STATUS_DIPLOMA_LABELS), BannerSessaoAtiva.tsx (LABEL_STATUS se relevante).
