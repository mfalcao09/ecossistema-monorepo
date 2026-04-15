---
name: Plano de Expansão do Formulário v2
description: Plano v2 aprovado em princípio — 11 seções visíveis, ~120 campos, 7 premissas do Marcelo aplicadas. Aguardando confirmação final.
type: project
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

**Estrutura:** 11 seções visíveis (Processo, Pessoais, Curso, Emissora, Acadêmicos, Disciplinas, Atividades Complementares, Estágio, Assinantes, Decisão Judicial, Habilitações) + 2 ocultas (Registradora, Livro de Registro) + Arquivos

**Quantitativo:** ~30-40 editáveis, ~50+ auto-preenchidos readonly, ~25-30 preenchidos por IA, ~30 ocultos, ~10-15 manuais puros

**Fases de implementação:**
1. Expandir interface DadosExtraidos + criar 11 seções colapsáveis
2. Auto-preenchimento de Curso e Emissora a partir do banco
3. Tabela de Disciplinas com CRUD + CSV
4. Seções opcionais (Atividades, Estágio, Habilitações, Decisão Judicial)
5. Integração IA máxima — preencher todos os campos possíveis dos docs
