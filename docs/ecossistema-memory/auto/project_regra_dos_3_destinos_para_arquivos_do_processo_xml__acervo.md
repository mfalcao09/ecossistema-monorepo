---
name: Regra dos 3 destinos para arquivos do processo: XML + Acervo + só Processo
description: Regra dos 3 destinos para arquivos do processo: XML + Acervo + só Processo
type: project
project: erp
tags: ["arquivos", "processo", "acervo", "comprobatorios", "destinos"]
success_score: 0.9
supabase_id: 357ab1c2-3725-4001-93d2-f3d0ba1a9082
created_at: 2026-04-13 09:18:51.793075+00
updated_at: 2026-04-13 15:05:39.709819+00
---

Todo arquivo importado PERMANECE NO PROCESSO PARA SEMPRE. 3 categorias: 1) Comprobatórios obrigatórios → XML do Diploma + Acervo + Processo (RG, Histórico EM, etc.), 2) Complementares pessoais → Acervo + Processo (documentos sem tipo XSD válido), 3) Auxiliares de extração → só Processo (planilhas internas, listas para IA). UI: cada arquivo tem checkboxes independentes (destino_xml, destino_acervo, destino_processo — o último sempre marcado/desabilitado). Acervo é organizado por CPF do aluno.
