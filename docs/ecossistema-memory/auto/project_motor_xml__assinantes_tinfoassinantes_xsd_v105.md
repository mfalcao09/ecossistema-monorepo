---
name: Motor XML — Assinantes TInfoAssinantes XSD v1.05
description: Motor XML — Assinantes TInfoAssinantes XSD v1.05
type: project
project: erp
tags: ["xml", "xsd", "assinantes", "motor-xml"]
success_score: 0.92
supabase_id: 1e3beb5f-646f-4f80-8e73-c0e9201d9492
created_at: 2026-04-13 09:25:59.657012+00
updated_at: 2026-04-13 19:06:18.982564+00
---

Implementado em assinantes.builder.ts (sessão 021, commit 0c25a58). Posicionamento: dentro de DadosDiploma APÓS IesEmissora ANTES de ds:Signature. IMPORTANTE: TInfoAssinantes NÃO tem Nome — só CPF + (Cargo OU OutroCargo). Enum TCargosAssinantes 8 cargos válidos: Reitor, Reitor em Exercício, Responsável pelo registro, Coordenador de Curso, Subcoordenador, Coord em exercício, Chefe área registro, Chefe em exercício. Qualquer cargo fora do enum vai como OutroCargo (case-sensitive). Cardinalidade: Assinantes opcional, mas Assinante minOccurs=1 dentro — se sem assinantes válidos, omitir bloco inteiro (não emitir vazio). Ordenação: por ordem_assinatura asc (eCNPJ assina por último). How to apply: Assinantes ≠ AutoridadesIesEmissora (nome legado) e NÃO leva Nome.
