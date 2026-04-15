---
name: Regras Críticas de Desenvolvimento ERP (anti-bugs)
description: Regras Críticas de Desenvolvimento ERP (anti-bugs)
type: feedback
project: erp
tags: ["regras", "anti-bugs", "critico", "desenvolvimento"]
success_score: 0.95
supabase_id: 06912d38-b233-47bb-9f03-8b1d531dc683
created_at: 2026-04-13 01:55:12.070453+00
updated_at: 2026-04-13 06:04:12.131908+00
---

FETCHSEGURO OBRIGATÓRIO: Toda mutação frontend usa fetchSeguro (não fetch nativo) — CSRF bloqueia silenciosamente sem ele

CARIMBO DO TEMPO: SEMPRE usa arquivo_url (XML assinado), NUNCA conteudo_xml (XML original não assinado)

BUCKET: Arquivos de processo ficam no bucket processo-arquivos (NÃO documentos) — converter-service.ts confirmado

GIT AUTHOR: DEVE ser mfalcao09 / contato@marcelofalcao.imb.br, senão deploy Vercel falha

DEFINITION OF DONE: DoD = deploy Vercel READY. Commit+push não é "pronto". Loop autônomo: push → monitorar → se ERROR, ler logs → corrigir → push → repetir, até READY.

DADOS SEMPRE DO XML: Dados exibidos devem vir SEMPRE do XML, nunca de informações presumidas no banco

GEMINI MODEL: Modelo correto em abr/2026 = gemini-2.5-flash. gemini-3.1-pro-preview (inexistente) e gemini-2.0-flash (descontinuado) causam resposta vazia silenciosa

REACT STALE CLOSURE: Sempre usar (prev) => no setState de objetos. Dois setState sequenciais com spread do objeto antigo: o 2º sobrescreve o 1º

NEXTJS DYNAMIC SEGMENT: NUNCA misturar nomes de segmentos dinâmicos no mesmo nível ([id] vs [sessaoId]) — build passa mas runtime crasha silenciosamente

SUPABASE PROMISELIKE: Supabase retorna PromiseLike (sem .catch()). Usar .then(res => { if (res.error)... })

VERIFICAR BUILD ANTES PUSH: Rodar next build completo (não só tsc) antes de push quando origin/main tem commits de sessão paralela

DIPLOMADO SÓ APÓS UFMS: /diploma/diplomados filtra por status ≥ registrado
