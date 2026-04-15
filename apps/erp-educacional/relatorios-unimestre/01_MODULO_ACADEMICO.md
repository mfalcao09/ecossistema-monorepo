# Módulo Acadêmico — Análise Unimestre

**Módulo:** Acadêmico
**Rotas Base:** `/portal/academico/*`, `/gestao/publica/academico/*`
**Prioridade:** Alta (módulo core do ERP)

---

## 1. Visão Geral

O módulo acadêmico é o coração do sistema, gerenciando toda a estrutura de cursos, turmas, disciplinas, grades curriculares, horários e documentação acadêmica. É acessado tanto pelo painel administrativo quanto pelo portal de gestão (professores/coordenadores).

---

## 2. Submódulos Identificados

### 2.1 Cursos
**Rota:** `/portal/academico/cursos`

**Campos:**
- Código do curso
- Nome do curso
- Ativo (checkbox)
- Descrição oficial do curso
- Descrição oficial de habilitação
- Titulação
- Período de divisão de turma (Ano ou Semestre)
- Grau (dropdown)
- Referência (checkbox)
- Área de atuação
- Desabilitar verificação de disciplinas aprovadas na Rematrícula

**Abas de controle:**
- TURMAS
- UNIDADE CURRICULAR
- GRADES CURRICULARES

---

### 2.2 Turmas
**Rota:** `/portal/academico/turmas`, `/gestao/publica/academico/turmas`

**Listagem — Campos:**
- Ano/Semestre (ex: 2025/1, 2025/2)
- Unidade/Campus
- Departamento
- Curso
- Código da turma (ex: 74164-ENF)
- Descrição
- Situação (EM ANDAMENTO, ENCERRADA)

**Filtros:**
- Departamento (dropdown)
- Ano/semestre
- Campo de busca por turma

**Formulário de Criação/Edição:**
- Dados principais (ano/semestre, código, descrição)
- Dados complementares
- Datas da turma
- Financeiro (utilizar plano de pagamento específico, conta de boletos, PIX)
- Rematrícula
- Próxima turma
- Disciplinas optativas
- Observações
- Conceitos
- Campos extras/adicionais

**Funcionalidade Especial — Copiar Turmas:**
- Modal para copiar turmas existentes
- Departamento/Curso de origem
- Opção: "Copiar as turmas para todas as unidades do curso"

**Ações:** Visualizar, Editar, Deletar, Filtrar, Ordenar

---

### 2.3 Unidades Curriculares (Disciplinas)
**Rota:** `/portal/academico/unidade-curricular`

**Campos:**
- Código (ex: ADM25)
- Descrição
- Ordem
- Código IFC (PPC)
- Ativo (checkbox)
- Histórico anterior — indicação de unidade curricular anterior
- Vincular como unidade curricular mestre
- Usar ementa da unidade curricular mestre

**Seção EMENTAS:**
- Utilizar ementa da unidade curricular mestre (checkbox)
- Editor de ementa

---

### 2.4 Categoria de Unidade Curricular
**Rota:** `/portal/academico/disciplina-categoria`

**Funcionalidades:**
- Gerenciamento de categorias de disciplinas
- Mensagem de alerta sobre restrições de uso

---

### 2.5 Grade Curricular
**Rota:** `/portal/academico/grade-curricular`

**Seções:**
1. **GERENCIAR GRADES** — Seleção de grades por curso
2. **UNIDADES CURRICULARES DA GRADE** — Visualização e edição

**Campos:**
- Seleção de grade (dropdown)
- Código PPC (IFC)
- Seleção de unidade curricular mestre
- Ordem
- CH. Prévios
- CH. semestral
- Status: INATIVA/ATIVA/TODAS

**Totalizadores:**
- CH. de unidades curriculares
- Total de créditos financeiros
- Total carga horária semanal
- Total carga horária férias
- Total carga horária religião

---

### 2.6 Unidades de Ensino (Campus/Instituição)
**Rota:** `/portal/academico/unidade-ensino`

**Campos:**
- Nome
- CNPJ
- Código MEC
- Número Regional Estadual
- Nome da secretária
- Ato oficial da secretária
- Ato oficial do estabelecimento
- Direções (setor)
- Datas

---

### 2.7 Turma-Disciplina-Professor
**Rota:** `/gestao/publica/academico/turma-disciplina-professor`

**Funcionalidades:**
- Vinculação de disciplinas a turmas
- Atribuição de professores responsáveis
- Visualização de associações

**Dados exibidos:**
- Ano/Semestre, Turma, Código, Nome do Professor
- Sigla da disciplina (ex: TCC2)
- Descrição completa
- Categoria (Titular)

**Filtros:** Instituição, Departamento, Pessoa (busca)

---

### 2.8 Horários de Turma
**Rota:** `/portal/publico/academico/horario-turma`, `/gestao/publica/academico/horario-turma`

**Funcionalidades:**
- Visualização em calendário (dia, semana, mês)
- Lista de disciplinas com cores distintas
- Navegação temporal

**Formulário de Horário:**
- Descrição (ex: "1ª Aula Noturno")
- Hora início / Hora fim (ex: 19:00 - 19:45)
- Tipo: NOTURNO (dropdown)
- Categoria (dropdown)
- Ativo (checkbox)
- Horário EAD (checkbox)

**Funcionalidade:** ADICIONAIS DISCIPLINAS (link expandível)

---

### 2.9 Cursos e Coordenadores
**Rota:** `/portal/publico/academico/cursos-coordenadores`, `/gestao/publica/academico/cursos-coordenadores`

**Funcionalidades:**
- Vincular coordenadores a cursos
- Tipo de função: COORDENADOR | AUXILIAR | DIREÇÃO
- Busca de pessoas para coordenação
- Permissões inline (ex: "Alterar mesmo fora do prazo")

**Tabela:**
- Código Pessoa, Nome, Curso, Departamento, Tipo, Permissão Alheia, Colégio

---

### 2.10 Documentação do Aluno
**Rota:** `/portal/academico/documentacao`

**Filtros:**
- Busca de aluno (por nome)
- Curso de matrícula (dropdown)

**Tabela de documentos:**
- Documento, Entregue, Data de entrega, Obrigatoriedade, Confirmado, Data necessária, Confirmado por, Observação, Download

---

### 2.11 Documentos Necessários
**Rota:** `/portal/academico/documentos-necessarios`

**Funcionalidades:**
- Definição de documentação obrigatória por curso

**Lista de documentos obrigatórios identificados:**
1. Comprovante Provisório Apontadoria
2. DIPLOMA DIGITAL
3. HISTÓRICO DIGITAL FINAL
4. PDF CURRÍCULO DIGITAL
5. RG
6. XML CURRÍCULO DIGITAL
7. XML DIPLOMA DIGITAL
8. XML DOCUMENTAÇÃO ACADÊMICA
9. XML HISTÓRICO DIGITAL FINAL

> **Nota para o ERP FIC:** Estes 7 tipos de documentos do Diploma Digital (itens 2-8) são fundamentais para o módulo de Diploma Digital que estamos construindo.

---

### 2.12 Histórico de Disciplinas
**Rota:** `/gestao/publica/academico/historico-disciplinas`

**Funcionalidades:**
- Visualização de histórico acadêmico do aluno por semestre
- Cálculo automático de médias
- Cores de status: Verde (aprovado), Rosa (reprovado), Branco (sem info)
- Exportação para PDF

**Tabela:**
- Ano.Sem, Turma, Código, Nome, Disciplina, Sigla, Méd_1, F_1, Méd_2, F_2, Média, F_S

---

### 2.13 Prazos do Diário de Classe
**Rota:** `/gestao/publica/academico/praza-diario-classe`

**Funcionalidades:**
- Definição de prazos para lançamento de notas
- Alocação de etapas letivas

**Campos:**
- Ano/Semestre
- Nome prazo (ex: Etapa 1)
- Tipo prazo (dropdown)
- Filtros: Departamento, Curso, Turma, Disciplina

---

## 3. Rotas Consolidadas

| Rota | Descrição |
|------|-----------|
| `/portal/academico` | Módulo acadêmico principal |
| `/portal/academico/cursos` | Gestão de cursos |
| `/portal/academico/turmas` | Gestão de turmas |
| `/portal/academico/unidade-curricular` | Disciplinas |
| `/portal/academico/disciplina-categoria` | Categorias de disciplinas |
| `/portal/academico/grade-curricular` | Grades curriculares |
| `/portal/academico/unidade-ensino` | Unidades de ensino |
| `/portal/academico/documentacao` | Documentação do aluno |
| `/portal/academico/documentos-necessarios` | Documentos obrigatórios |
| `/gestao/publica/academico/turmas` | Turmas (gestão) |
| `/gestao/publica/academico/turma-disciplina-professor` | Turma-Disciplina-Professor |
| `/gestao/publica/academico/horario-turma` | Horários |
| `/gestao/publica/academico/cursos-coordenadores` | Coordenadores |
| `/gestao/publica/academico/historico-disciplinas` | Histórico |
| `/gestao/publica/academico/praza-diario-classe` | Prazos do diário |

---

## 4. Relevância para o ERP FIC

**Alta prioridade para o Diploma Digital:**
- Documentos Necessários (tipos de XML/PDF obrigatórios)
- Histórico de Disciplinas (dados para gerar o XML HistoricoEscolarDigital)
- Grade Curricular (dados para DocumentacaoAcademicaRegistro)
- Unidade de Ensino (dados da IES para todos os XMLs)
- Cursos (dados de titulação, grau para DiplomaDigital)

---

**Gerado em:** 21/03/2026 | **Fonte:** Vídeos 1, 2, 3, 5
