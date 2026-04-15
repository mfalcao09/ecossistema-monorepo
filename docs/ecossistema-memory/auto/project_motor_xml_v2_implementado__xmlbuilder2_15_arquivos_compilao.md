---
name: Motor XML v2 implementado — xmlbuilder2, 15+ arquivos, compilação limpa
description: Motor XML v2 implementado — xmlbuilder2, 15+ arquivos, compilação limpa
type: project
project: erp
tags: ["motor-xml", "xmlbuilder2", "xsd", "geracao"]
success_score: 0.9
supabase_id: 8f91da21-836c-4065-b6c6-a4e7af894412
created_at: 2026-04-13 09:17:12.70224+00
updated_at: 2026-04-13 14:05:25.994776+00
---

Motor de geração XML v2 implementado. Arquitetura: src/lib/xml/builders/ — 8 builders modulares; src/lib/xml/generators/ — 2 generators; src/lib/xml/validation/ — xsd-validator + business-rules; src/lib/xml/legacy/ — gerador-v1 referência. Decisões: xmlbuilder2 v3.1.1, fast-xml-parser para validação estrutural (serverless-compatible), validação 1 camada apenas, XSD v1.05, crypto.randomBytes() para códigos de validação. Ao trabalhar com geração XML, usar builders v2 em src/lib/xml/builders/, nunca o legado.
