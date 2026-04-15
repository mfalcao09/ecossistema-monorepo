---
name: Sessão 050 — Naturalidade 3 campos XSD (Município+IBGE+UF)
description: Sessão 050 — Naturalidade 3 campos XSD (Município+IBGE+UF)
type: project
project: erp
tags: ["xsd", "naturalidade", "ibge", "sessao-050"]
success_score: 0.9
supabase_id: 38fc3b41-838e-41b9-9ead-2081e953b936
created_at: 2026-04-13 09:24:44.925893+00
updated_at: 2026-04-13 18:06:12.666681+00
---

Commit 0a1cacf (11/04/2026). FormularioRevisao.tsx tratava naturalidade como campo único "Cidade - UF" mas XSD v1.05 TNaturalidade→GMunicipio exige 3: NomeMunicipio (max 255), CodigoMunicipio (TCodMunIBGE exatamente 7 dígitos), UF (enum 27 siglas). Fix: 3 campos separados + auto-preenchimento via GET /api/ibge-municipios debounce 600ms + fallback parse regex legado "Cidade - UF" ou "Cidade/UF". Naturalidade_codigo_municipio adicionado na interface Diplomado. Badge contador 7→9. Ref: Chapadão do Sul/MS = 5002951. Why: sem CodigoMunicipio, XML inválido contra XSD. How to apply: qualquer formulário com naturalidade DEVE ter os 3 campos separados (nunca campo único).
