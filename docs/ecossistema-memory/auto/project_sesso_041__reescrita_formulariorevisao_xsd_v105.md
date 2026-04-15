---
name: Sessão 041 — Reescrita FormularioRevisao XSD v1.05
description: Sessão 041 — Reescrita FormularioRevisao XSD v1.05
type: project
project: erp
tags: ["xsd", "formulario", "enums", "sessao-041"]
success_score: 0.9
supabase_id: 72df34de-327d-41f0-baff-375e65fcafe4
created_at: 2026-04-13 09:24:10.156184+00
updated_at: 2026-04-13 18:06:07.14349+00
---

Commit 8d322b4, deploy READY 80s (09/04/2026). Correções XSD: Sexo F/M (não Feminino/Masculino); Modalidade EAD (não EaD/Semipresencial); GrauConferido +Curso sequencial; FormaAcesso 3→10 valores; ENADE 3 campos; TituloConferido 4 opções; Filiação campos fixos→array dinâmico Genitores; Naturalidade campo único→campo "Cidade - UF" com backward compat; documento estrangeiros; CodigoCursoEMEC. UI: seções colapsáveis + BadgeCount + indicadores origem IA/Cadastro por campo. Why: enums errados gerariam XMLs inválidos. How to apply: FormularioRevisao é self-contained (componentes internos), não depende de ui-helpers da Tela 3.
