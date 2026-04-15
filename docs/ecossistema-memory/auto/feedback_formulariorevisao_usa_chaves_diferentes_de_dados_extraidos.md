---
name: FormularioRevisao usa chaves diferentes de dados_extraidos — COALESCE obrigatório
description: FormularioRevisao usa chaves diferentes de dados_extraidos — COALESCE obrigatório
type: feedback
project: erp
tags: ["formulario", "revisao", "dados", "bug", "coalesce"]
success_score: 0.9
supabase_id: 5c387ea2-a857-45aa-bf1a-27be3f78cd13
created_at: 2026-04-13 09:16:29.500429+00
updated_at: 2026-04-13 13:05:18.707063+00
---

FormularioRevisao salva dados revisados sob chaves DIFERENTES do dados_extraidos original: dados_confirmados.diplomado.nome_completo vs dados_extraidos.aluno.nome; dados_confirmados.diplomado.rg_numero vs dados_extraidos.aluno.rg. O FormularioRevisao foi escrito com tipos XSD v1.05 (DadosDiplomado). O extrator Gemini usa nomes genéricos. A divergência causou gate bloqueando 100% das sessões com 9 falsos positivos. TODO código que lê dados_confirmados/dados_extraidos DEVE usar COALESCE fallback chain: JS: dados.diplomado ?? dados.aluno; SQL: COALESCE(v_dados->diplomado, v_dados->aluno); campos: nome_completo ?? nome, rg_numero ?? rg.
