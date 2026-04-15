---
name: Nexvy DS Voice — Biblioteca de Conteúdo + Funis + Gatilhos (CORREÇÃO)
description: Nexvy DS Voice — Biblioteca de Conteúdo + Funis + Gatilhos (CORREÇÃO)
type: reference
project: erp
tags: ["nexvy", "atendimento", "ds-voice", "automacao", "schema"]
success_score: 0.95
supabase_id: 36160289-c8ed-403e-93ab-794dc7c6f6ef
created_at: 2026-04-13 02:29:10.337731+00
updated_at: 2026-04-13 06:04:15.725888+00
---

DS Voice NÃO é apenas VoIP Twilio. É um módulo completo de biblioteca de conteúdo pré-salvo + automações.

7 sub-módulos:
1. Mensagens: templates de texto com variáveis {Nome Completo} {Primeiro Nome} {Saudação}, toggles "Visível para todos" e "Editar ao enviar", organização por pastas
2. Áudios: upload .mp3/.ogg ≤16MB, toggle "Enviar como gravado na hora" (aparece como mensagem de voz nativa WhatsApp)
3. Mídias: imagens ≤5MB / vídeos ≤100MB + caption opcional, por pastas
4. Documentos: ≤100MB, ⚠️ PDFs/DOCS/Planilhas NÃO suportados no Instagram
5. Funis: sequências multi-step com delay em segundos por etapa + "Duração total do funil", toggle "Visível para todos"
6. Gatilhos: disparam Funis quando mensagem chega. Campos: Nome, Tags, Funil, delay, condição da mensagem, toggles (ignorar salvos, ignorar grupos, case insensitive, WhatsApp, Instagram)
7. Configurações: export/import backup como .json

Tabelas necessárias: ds_voice_folders, ds_voice_messages, ds_voice_audios, ds_voice_media, ds_voice_documents, ds_voice_funnels, ds_voice_funnel_steps, ds_voice_triggers

Escopo ERP: Sprint 9+. VoIP Twilio fora do escopo inicial.
