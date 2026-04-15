---
name: carimbo_tempo deve usar arquivo_url, nunca conteudo_xml
description: carimbo_tempo deve usar arquivo_url, nunca conteudo_xml
type: feedback
project: erp
tags: ["xml", "assinatura", "carimbo"]
success_score: 0.9
supabase_id: 74b65618-0f2b-4381-807e-43fedc433739
created_at: 2026-04-13 09:13:28.773921+00
updated_at: 2026-04-13 10:04:46.199385+00
---

Em xml_gerados: conteudo_xml é o XML ORIGINAL não assinado. arquivo_url aponta para o XML ASSINADO no storage (atualizado após finalize). O carimbo do tempo DEVE ser aplicado sobre o XML assinado → SEMPRE priorizar arquivo_url. Bug crítico descoberto na sessão 082 — carimbo aplicado sobre XML sem assinatura resultaria em pacote inválido para a registradora. Em qualquer rota que calcule hash ou aplique carimbo sobre XML: buscar conteúdo via fetch(xml.arquivo_url), com fallback para conteudo_xml apenas quando arquivo_url ainda não existir (pré-finalize). Ver carimbo/route.ts e carimbo-pipeline.ts.
