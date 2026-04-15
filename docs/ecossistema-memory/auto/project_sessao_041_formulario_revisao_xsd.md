---
name: Sessão 041 — Reescrita FormularioRevisao XSD v1.05
description: Sessão 041 (09/04): FormularioRevisao reescrito com enums XSD v1.05 corretos + UI consistente com Tela 3
type: project
---

Sessão 041 (09/04/2026): reescrita completa do FormularioRevisao (Tela 2) — commit 8d322b4, deploy dpl_6kk1dmCidF2raD3jkJoDzuEZZk7e READY ~80s.

**Correções XSD v1.05:**
- Sexo: "Feminino"/"Masculino" → "F"/"M"
- Modalidade: "EaD"/"Semipresencial" → "EAD" (só "Presencial" e "EAD" no XSD)
- GrauConferido: adicionado "Curso sequencial" (era só "Sequencial")
- FormaAcesso: de 3 → 10 valores (Vestibular, ENEM, PROUNI, etc.)
- ENADE: 3 campos (habilitado Sim/Não, condicao 5 valores, ano)
- TituloConferido: 4 opções (Bacharel, Licenciado, Tecnólogo, Médico)
- Filiação: de campos fixos mãe/pai → array dinâmico Genitores (Nome + NomeSocial + Sexo)
- Naturalidade: campo único formato XSD "Cidade - UF" (com backward compat)
- Documento alternativo para estrangeiros (outro_doc_tipo + outro_doc_id)
- CodigoCursoEMEC adicionado

**UI:**
- Visual matching Tela 3 (seções colapsáveis, badges, separadores)
- BadgeCount por seção (preenchido/total)
- Indicadores de origem (IA, Cadastro) por campo
- 5 seções: Pessoais+Filiação, Curso/Acadêmicos, IES, ENADE, Disciplinas

**page.tsx atualizado:**
- aplicarCursoCadastro agora mapeia titulo_conferido + codigo_emec + codigo_mec

**Why:** Formulário antigo tinha enums errados que gerariam XMLs inválidos, e UI era inconsistente com Tela 3.
**How to apply:** FormularioRevisao é self-contained (componentes internos), não depende de ui-helpers da Tela 3.
