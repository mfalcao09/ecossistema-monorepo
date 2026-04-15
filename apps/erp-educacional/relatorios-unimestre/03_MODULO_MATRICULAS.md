# Módulo de Matrículas — Análise Unimestre

**Módulo:** Matrículas
**Rotas Base:** `/matricular/*`, `/planilha-matriculas/`
**Prioridade:** Alta

---

## 1. Visão Geral

O módulo de matrículas gerencia todo o processo de inscrição, matrícula e rematrícula de alunos, desde a busca do candidato até a confirmação da matrícula com seleção de turma, curso e turno.

---

## 2. Submódulos Identificados

### 2.1 Processo de Nova Matrícula (Wizard 5 Passos)
**Rota:** `/matricular/nova-matricula/matricular/`

**Modal de Busca:**
- Campo para buscar por NOME
- Campo para buscar por CPF
- Lista de resultados com seleção
- Atalho: ALUNO (botão verde)

**Passo 1 de 5 — Matrícula no Curso:**
- Curso (dropdown)
- Turno (dropdown — ex: NOTURNO)
- Turma (dropdown)
- Formato de inscrição (dropdown — ex: Matrícula)
- Encerramento de inscrição (data — ex: 2025/2)
- Data de inscrição (data — ex: 04/12/2025)
- Seleções de opção (dropdown)

**Botão:** AVANÇAR

> **Nota:** Passos 2-5 não foram totalmente capturados nos vídeos.

---

### 2.2 Planilha de Matrículas
**Rota:** `/planilha-matriculas/`

**Componentes:**
- Tutorial em vídeo modal com play button
- Abas: Matrículas | Planilha de matrículas

**Tabela DISCIPLINAS MATRICULADAS:**
- Código
- Disciplina
- Sigla
- Situação
- Turma
- Horariada
- Crédito %
- Carga h.
- Data Inic.
- Disc. Genótipo
- Componente
- Adaptação
- Dependente

**Menu lateral de opções do aluno:**
- Ingresso no curso
- Processo Seletivo
- Matrícula e conclusão
- Certificado/Diploma
- Decisão Judicial

**Seções adicionais:**
- CAMPOS EXTRAS DA MATRÍCULA CURSO
- OBSERVAÇÕES DO ALUNO (com campo "Registrar observação")
- HISTÓRICO (área de histórico de alterações)

---

### 2.3 Visualização de Matrícula do Aluno

**Tabela Matrículas do Aluno:**
- Ano/semestre
- Turma
- Data de inscrição
- Situação (ex: RESERVADO)
- Forma de inscrição

**Botões:**
- REMATICULAR (verde)

**Atalhos:** ALUNO, MATRÍCULAS, FINANCEIRO

---

### 2.4 Rematrícula
**Rota:** `/processos/rematricula` ou similar

**Status:** Em homologação (aviso laranja)

**Seção DADOS DO PROCESSO:**
- Descrição do processo
- Jornada (dropdown)
- Data de abertura e fechamento (DD/MM/YYYY HH:MM:SS)

**Seção TURMAS QUE RECEBERÃO REMATRÍCULAS:**
- Tabela com: Checkbox, Colégios, Descrição, Ano/Semestre, Curso, Turma, Jornada
- Botões: MARCAR TODOS, DESMARCAR TODOS

---

### 2.5 Escolha de Disciplinas (Portal do Aluno)

**Componentes:**
- Progress bar com múltiplos passos
- Disciplinas com checkboxes ("Quero me matricular")
- Total de disciplinas selecionadas

**Seção Financeiro integrado:**
- Card de mensalidade com parcelamento
- Cálculo de total geral (ex: R$ 7.380)
- Descontos condicionais

- Aceite de documento com checkbox
- Botões: Voltar, Avançar

---

## 3. Fluxos de Negócio

### Fluxo: Nova Matrícula
```
1. Cadastro aluno → Buscar aluno por nome/CPF
2. Selecionar aluno na lista
3. Clicar em "MATRICULAR"
4. Wizard 5 passos:
   - Passo 1: Curso, turma, turno
   - Passo 2-5: (dados complementares)
5. Confirmar matrícula
```

### Fluxo: Rematrícula
```
1. Admin acessa Rematrícula
2. Configura processo (datas, jornada)
3. Seleciona turmas
4. Aluno acessa Portal → Escolhe disciplinas
5. Financeiro calculado automaticamente
6. Aceite de documento/contrato
7. Confirmação
```

---

## 4. Rotas Consolidadas

| Rota | Descrição |
|------|-----------|
| `/matricular/nova-matricula/matricular/` | Wizard nova matrícula |
| `/planilha-matriculas/` | Planilha de disciplinas |
| `/processos/rematricula` | Processo de rematrícula |

---

## 5. Relevância para o ERP FIC

**Alta relevância para Diploma Digital:** Os dados de matrícula e conclusão são essenciais para o XML DiplomaDigital (dados do diplomado, curso, data de conclusão) e para o XML DocumentacaoAcademicaRegistro (rito de emissão).

---

**Gerado em:** 21/03/2026 | **Fonte:** Vídeos 3, 5, 6
