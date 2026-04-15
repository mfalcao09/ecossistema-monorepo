---
name: Nexvy Design Tokens + UX Patterns confirmados (referência visual ERP Atendimento)
description: Nexvy Design Tokens + UX Patterns confirmados (referência visual ERP Atendimento)
type: reference
project: erp
tags: ["nexvy", "atendimento", "design-tokens", "ux-patterns", "ui"]
success_score: 0.9
supabase_id: 4d803db1-6a1b-4de8-bf80-211217d8e867
created_at: 2026-04-13 02:29:50.418629+00
updated_at: 2026-04-13 07:04:19.797063+00
---

DESIGN TOKENS:
- Primary: #345EF3
- Font: Instrument Sans
- Kanban col: 300px fixo, height calc(100vh - 90px)
- Modal border-radius: 24px com glass (blur 20px + saturate 180%)
- Bubble in: left-align, bg cinza, border-radius 8px 18px 18px 8px
- Bubble out: right-align, bg #dcf8c6 (WhatsApp green), border-radius 18px 8px 18px 18px
- Left/right panels: 320px cada
- Pipeline drawer: 480px
- Scrollbar: 3px, cor #345EF3

UX PATTERNS CONFIRMADOS:
1. Janela fechada WhatsApp: banner + input disabled + CTA template modal
2. Breadcrumb pipeline no header do chat (bidirecional kanban↔chat)
3. Toolbar 5 tipos: Templates(funil) | Texto(T) | Áudio(mic) | Imagem | Documento
4. Abas customizadas (saved_views) com filtros combinados por agente
5. Protocolos: ticket (imutável #) ≠ protocolo (instância de atendimento #)
6. Lead detail modal: 2 colunas (33%/67%) + 4 tabs + 7 ações rápidas
7. Stage progress bar: steps horizontais, atual em azul #345EF3
8. Custom fields inline: "+ Adicionar campo" → par Nome/Valor com confirm ✓/✗
9. Column ⋮ menu: editar | transferir | CSV | log automações
10. DS Voice backup: export/import .json para portabilidade staging↔prod
