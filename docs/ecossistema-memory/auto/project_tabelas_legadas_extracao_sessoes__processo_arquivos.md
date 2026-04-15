---
name: Tabelas legadas extracao_sessoes + processo_arquivos
description: Tabelas legadas extracao_sessoes + processo_arquivos
type: project
project: erp
tags: ["schema", "migration", "legado", "tech-debt"]
success_score: 0.85
supabase_id: 95d770e0-963c-4f2d-803a-a17a5c46bd0f
created_at: 2026-04-13 09:22:03.410397+00
updated_at: 2026-04-13 16:05:51.607645+00
---

Ambas as tabelas já existiam ANTES do plano v2 com schema diferente. extracao_sessoes: migration 20260321101335 (sessões 005-006, módulo emissão IA). processo_arquivos: migration 20260406003445 (sessão 013, Skills+RAG). Schema extracao_sessoes falta: usuario_id, version, arquivos. Schema processo_arquivos falta: sessao_id, destino_processo, destino_xml, destino_acervo, tipo_xsd, ddc_id. Sobreposições: tipo_documento(text livre) vs tipo_xsd(enum), promovido_acervo vs destino_acervo, sha256 vs hash_sha256. Decisão Sprint 1: Opção A aditiva — ADD COLUMN das faltantes, legado intacto. Consolidação é tech-debt para sprint futura. How to apply: antes de qualquer ALTER nessas tabelas, conferir esta memória + listar colunas via information_schema.columns.
