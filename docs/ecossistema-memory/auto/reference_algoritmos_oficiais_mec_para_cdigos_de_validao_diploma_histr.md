---
name: Algoritmos oficiais MEC para códigos de validação (Diploma, Histórico, Currículo)
description: Algoritmos oficiais MEC para códigos de validação (Diploma, Histórico, Currículo)
type: reference
project: erp
tags: ["mec", "sha256", "código-validação", "xsd", "algoritmos", "diploma", "histórico"]
success_score: 0.92
supabase_id: 06c012cb-6a4e-48d5-981a-c0a45ccb9f80
created_at: 2026-04-14 09:14:55.330253+00
updated_at: 2026-04-14 11:07:31.220112+00
---

Fonte: Anexo III da IN SESu 05/2020 (páginas 89-92). Confirmado também na Nota Técnica 13/2019/DIFES/SESU section 7.6.1.8.

Regra geral: SHA256, primeiros 12 caracteres mínimo (a-f, 0-9), concatenação SEM espaços.

## 1. Código de Validação do DIPLOMA (TCodigoValidacao — 3 partes)
Estrutura: `CodIesEmissora . CodIesRegistradora . CodLocalizacaoDiploma`
Pattern XSD: `\d{1,}\.\d{1,}\.[a-f0-9]{12,}`
Responsável: **IES Registradora**

Fórmula padrão (com NumeroFolha + NumeroSequencia):
`SHA256(CPF || CodigoCursoEMEC || IesEmissora_CNPJ || IesRegistradora_CNPJ || LivroRegistro || NumeroFolhaDoDiploma || NumeroSequenciaDoDiploma)`

## 2. Código de Validação do HISTÓRICO (TCodigoValidacaoHistorico — 2 partes)
Estrutura: `CodIesEmissora . CodLocalizacaoHistorico`
Fórmula: `SHA256(CPF || CodigoCursoEMEC || IesEmissora_CNPJ || LivroRegistro)`
