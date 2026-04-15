# Módulo Pedagógico — Análise Unimestre

**Módulo:** Pedagógico (Provas, Avaliações, Desempenho)
**Rotas Base:** `/gestao/publica/academico/prova`, `/projetos/portal_online/`
**Prioridade:** Média-Alta

---

## 1. Visão Geral

O módulo pedagógico gerencia todo o processo avaliativo: cadastro de provas, lançamento de notas, cálculo de médias, controle de frequência e análise de desempenho dos estudantes. É acessado principalmente por professores e coordenadores.

---

## 2. Submódulos Identificados

### 2.1 Provas/Avaliações
**Rota:** `/gestao/publica/academico/prova`

**Listagem — Filtros:**
- Ano/Semestre
- Turma
- Professor
- Disciplina

**Colunas da listagem:**
- Nº. Prova
- Ano/Sem
- Turma
- Professor
- Disciplina
- Etapa
- Data
- Assunto
- Bloco (booleano)

**Formulário de Configuração da Prova:**
- Data (date picker — ex: 11/12/2025)
- Assunto (texto — ex: "Metodologia de Pesquisa")
- Chave (booleano)
- Peso (numérico — ex: 0)
- Nota mínima (numérico)
- Nota máxima (numérico)
- Responsável (seletor de professor)
- Dias bloq (numérico)
- Bloquear a prova (checkbox)

**Botões:** VOLTAR, CONCLUIR

---

### 2.2 Desempenho dos Estudantes
**Rota:** Portal do Professor

**Tabs de navegação:**
1. **Desempenho Dos Estudantes** (ativo)
2. **Turmas**
3. **Aulas**
4. **Inscrições**

**Ações disponíveis:**
- [+] Inserir Avaliação
- Histórico De Alteração De Notas
- Atribuir Todas Notas
- Calcular Médias
- Atribuir Ajuste De Média
- Complemento De Médias

**Tabela de Notas:**
- Nº, Data, Assunto, Editar prova, Ações (aprovar/negar/visualizar/editar/deletar)

**Prazo de Avaliações:** ex: 01/12/2025 00:00 até 12/12/2025 00:00

---

### 2.3 Notas e Frequências (Visão do Aluno)

**Estrutura de Dados:**
- Disciplina (nome)
- Notas: MP, SB, MD, F, MF, MD, F
- 1º Bimestre, 2º Bimestre, Média Final, MEF, MF, MEF, MF, GF, F%, Situação

**Notação:**
- MP = Média Parcial
- SB = Segunda Oportunidade
- MD = Média
- F = Frequência
- MF = Média Final
- MEF = Média Exame Final
- GF = Grau Final
- F% = Percentual de Frequência

**Resultado final:** Mensagem de situação por disciplina

---

### 2.4 Histórico de Disciplinas
**Rota:** `/gestao/publica/academico/historico-disciplinas`

**Tabela:**
- Ano.Sem, Turma, Código, Nome, Disciplina, Sigla, Méd_1, F_1, Méd_2, F_2, Média, F_S

**Cores de status:**
- Verde claro: Aprovado
- Rosa/Magenta: Reprovado ou em risco
- Branco: Sem informação

**Opções:** Agrupar por semestre, Expandir/Recolher, Exportar PDF

---

### 2.5 Prazos do Diário de Classe
**Rota:** `/gestao/publica/academico/praza-diario-classe`

**Campos:**
- Ano/Semestre (ex: 2025/2)
- Nome prazo (ex: Etapa 1)
- Tipo prazo (dropdown)

**Filtros:** Departamento, Curso, Turma, Disciplina

---

### 2.6 Prova Online
**Menu:** Acessível via sidebar (Portal do Aluno e Admin)

**Funcionalidades:**
- Sistema de provas eletrônicas
- Disponível para alunos

---

### 2.7 Próximas Avaliações (Portal do Aluno)

**Mensagem:** "Você não possui avaliações nos próximos 7 dias"
**Link:** "Ver mais avaliações"

---

## 3. Fluxo de Gestão de Provas

```
1. Professor acessa módulo "Provas"
   ↓
2. Cria nova prova (data, assunto, peso)
   ↓
3. Vincula prova a turmas/disciplinas
   ↓
4. Configura prazos e responsáveis
   ↓
5. Sistema bloqueia/libera entrada de notas
   ↓
6. Professor lança notas
   ↓
7. Calcula médias automaticamente
   ↓
8. Atribui ajuste de média (se necessário)
   ↓
9. Complemento de médias
   ↓
10. Aluno visualiza resultado no portal
```

---

## 4. Rotas Consolidadas

| Rota | Descrição |
|------|-----------|
| `/gestao/publica/academico/prova` | Cadastro de provas |
| `/gestao/publica/academico/historico-disciplinas` | Histórico |
| `/gestao/publica/academico/praza-diario-classe` | Prazos do diário |

---

## 5. Relevância para o ERP FIC

**Alta relevância para Diploma Digital:** As notas, frequências e situação final do aluno são dados obrigatórios no XML HistoricoEscolarDigital. O cálculo de médias e a situação final (aprovado/reprovado) alimentam diretamente o histórico escolar digital.

---

**Gerado em:** 21/03/2026 | **Fonte:** Vídeos 5, 6
