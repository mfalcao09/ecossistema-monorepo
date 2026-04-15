---
name: Cadência de Interlock 2+2 entre frentes paralelas · Sessão 014
description: Cadência de Interlock 2+2 entre frentes paralelas · Sessão 014
type: decision
project: ecosystem
tags: ["interlock", "cadencia", "2-frentes", "governanca", "heranca-v8.1", "sessao-014", "drift-prevention"]
success_score: 0.92
supabase_id: 0c2a7cee-ee84-4d7f-9ca0-6af4a00e2c33
created_at: 2026-04-14 09:01:32.551843+00
updated_at: 2026-04-14 09:07:19.361094+00
---

Decisão arquitetural: ao lançar duas frentes paralelas (Ecossistema V8.1 + FIC v2.1), estabelece-se cadência de reconciliação a cada 2 sessões FIC + 2 sessões Ecossistema. Objetivo: prevenir drift entre plano-fonte (V8.1) e plano-aplicação (MASTERPLAN FIC). Quando houver divergência detectada, V8.1 prevalece OU evolui para v8.2 se o aprendizado tático for relevante para outros negócios. Possível bump v2.1→v2.2 se MASTERPLAN FIC precisar capturar decisões operacionais que nao invalidam V8.1 mas o refinam. Heranca formal no cabecalho passa a ser obrigatoria para todo MASTERPLAN futuro (Intentus/Klesis/Splendori/Nexvy).
