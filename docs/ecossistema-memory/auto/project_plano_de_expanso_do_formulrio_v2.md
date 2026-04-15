---
name: Plano de Expansão do Formulário v2
description: Plano de Expansão do Formulário v2
type: project
project: erp
tags: ["formulário", "expansão", "plano", "diploma-digital"]
success_score: 0.8
supabase_id: c9b92a0f-e2cf-4977-b09f-00478859b42f
created_at: 2026-04-14 09:14:15.633563+00
updated_at: 2026-04-14 10:07:27.140645+00
---

Plano v2 de expansão do formulário de diploma digital, com 7 premissas do Marcelo aplicadas (28/03/2026).

**Premissas:**
1. Nome do Processo = `{CPF} - {NOME}`, auto-gerado, readonly
2. Dados do Curso = auto-preenchidos do cadastro, readonly
3. Dados da Emissora = auto-preenchidos do cadastro, readonly
4. Registradora = OCULTA no formulário, populada só no retorno do XML registrado
5. Disciplinas = vêm da importação prévia, campos faltantes destacados em amarelo
6. Assinantes = Nome, CPF, Cargo + e-CNPJ da emissora
7. IA = preenche o máximo possível de campos dos documentos uploadados

**Estrutura:** 11 seções visíveis + 2 ocultas + Arquivos

**Quantitativo:** ~30-40 editáveis, ~50+ auto-preenchidos readonly, ~25-30 preenchidos por IA, ~30 ocultos, ~10-15 manuais puros
