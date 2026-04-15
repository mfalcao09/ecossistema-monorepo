# Módulo Financeiro — Análise Unimestre

**Módulo:** Financeiro
**Rotas Base:** `/portal/publico/academico/financeiro/*`, `/financeiro/*`
**Prioridade:** Alta

---

## 1. Visão Geral

O módulo financeiro gerencia toda a parte de receitas, despesas, planos de pagamento, bolsas, negociação de débitos e fluxo de caixa da instituição. É um dos módulos mais complexos do sistema, com 15+ submódulos.

---

## 2. Submódulos Identificados

### 2.1 Dados Básicos
**Rota:** `/portal/publico/academico/financeiro/dados-basicos`

**Campos:**
- Valor padrão (numérico)
- Grupo do boleto
- Data para gerar falda
- Forma de entrada (dropdown)

---

### 2.2 Contas
**Rota:** `/portal/publico/financeiro/conta`

**Seções:**
1. **USUÁRIOS DA CONTA**
   - Checkbox: "Aceitar transferência de qualquer usuário"

2. **VINCULAR USUÁRIOS A CONTA**
   - Tabela: Código, Nome, Conta pública
   - Paginação: 25 por página
   - Edição de vínculos

---

### 2.3 Planos de Pagamento (Parcelamento de Cursos)
**Rota:** `/portal/publico/academico/financeiro/plano-pagamento-cadastro`, `/financeiro/plano-pagamento/`

**Filtros:**
- Busca por Curso (ex: "Bacharelado em Enfermagem")
- Filtro de Turma
- Checkbox "Mostrar somente registros ativos"

**Formulário — Seção RELAÇÃO AO VALOR:**
- Valor fixo (radio) — ex: 1.250,00
- Por crédito (radio)
- Utilizar parcelas iniciais com valor fixado (checkbox)
  - Número de parcelas com valor fixo
  - Valor para as parcelas de valor fixo
- Adicionar valor adicional (checkbox)
- Conceder descontos nas parcelas (checkbox)
- Desconto em percentual (checkbox) — ex: 25,00%
- Ação de movimento: "Aplicação padrão de Desconto Fixo"

**Formulário — Seção RELAÇÃO AO VENCIMENTO:**
- Vencimento da primeira parcela
- Ano da parcela
- Mês (Janeiro, Julho)
- Limitar vencimento ao mês que a turma finaliza

**Formulário — Seção GERAÇÃO DE PARCELAS:**
- Adicionar parcela (+)
- Vencimento somente em dias úteis
- Vencimento dinâmico

**Funcionalidade Especial — Copiar Plano:**
- Modal para copiar plano existente
- Descrição do novo plano
- Seleção de destino

---

### 2.4 Plano de Bolsas
**Rota:** `/portal/publico/academico/financeiro/plano-bolsa`

**Campos:**
- Descrição do benefício
- Desconto (% ou valor)
- Desconto condicional
- Aplicação de juros dinamicamente
- Aplicação de multa
- Desconto em percentual
- Aplicação de índice de correção

---

### 2.5 Planos de Negociação
**Rota:** `/portal/publico/academico/financeiro/plano-negociacao`

**Seções:**

1. **PLANO DE NEGOCIAÇÃO**
   - Descrição
   - Situações permitidas: Todas em aberto / Vencidas
   - Número de dias / diárias / parcelas

2. **ACRÉSCIMOS**
   - Tipo: Simples / Composto
   - Número de garantias

3. **EM RELAÇÃO AO VALOR**
   - Valor fixo / Por crédito
   - Valor total a pagar de período
   - Utilizar parcelas iniciais com valor fixado
   - Aplicar valor adicional
   - Conceder descontos nas parcelas
   - Desconto em percentual
   - Ação de incremento

4. **EM RELAÇÃO AO VENCIMENTO**
   - Parcela cadastrada anteriormente
   - Parcela de curso
   - Período (ex: 30 dias)
   - Mensalidade
   - Limitar vencimento ao mês da turma

---

### 2.6 Programação de Descontos
**Rota:** `/portal/publico/academico/financeiro/programacao-descontos`

**Campos:**
- Período de desconto
- Valor desconto
- Tipo de desconto
- Geração de parcelas com desconto automático

---

### 2.7 Fornecedores
**Rota:** `/portal/publico/academico/financeiro/fornecedor`

**Campos:**
- Nome da empresa/pessoa
- Tipo: FÍSICA / JURÍDICA
- CNPJ/CPF
- Inscrição estadual
- Nome fantasia
- Nome do contato
- Responsável legal (busca)
- Informações de acesso

---

### 2.8 Recebimentos / Planilha de Recebimentos
**Rota:** `/financeiro/planilha-recebimentos/`

**Filtros:**
- Busca por aluno
- Turma: "Todos os anos" / "Todas as turmas"
- Situação

**Formulário de Edição:**
- Parcela final
- Ano/semestre
- Vencimento inicial
- Alterar somente o dia (checkbox)
- Vencimento somente em dias úteis (checkbox)
- Alterar data de competência (checkbox)

**Seção MENSALIDADE:**
- Valor inicial (ex: 1.150,00)
- Valor extra
- Valor base
- Desconto Fixo

**Tabela de Recebimentos:**
- Cód. Título, Aluno, Parcela, Vencimento, Valor Inicial, Desc. Cond., Desc. Flav., Multa + Juros

**Atalhos:** MATRÍCULAS, COBRANÇAS

---

### 2.9 Compromissos
- Registro de compromissos financeiros a cumprir
- Rastreamento de pagamentos

### 2.10 Parceiros Comissionados
- Gestão de parceiros com comissão

### 2.11 Tesouraria
- Gestão de caixa

### 2.12 Negociações
- Renegociação de débitos

### 2.13 Remessa/Retorno Bancário
- Envio de remessas para banco
- Processamento de retornos

### 2.14 Trocar Plano de Pagamento / Trocar Contas
- Migração entre planos

---

## 3. Dashboard Financeiro

**Componentes:**
- Cards de valor: Receitas vencidas, Contas a pagar, Recebido (em R$)
- Gráfico "RECEBIMENTOS X PAGAMENTOS" (timeline)
- Sidebar expandido com submódulos financeiros

---

## 4. Menu Lateral Financeiro (Estrutura)

```
[ Financeiro ]
├── Buscar
├── Dados básicos
├── Contas
├── Parceiros comissionados
├── Planos de pagamento
├── Planos de negociação
├── Programação de descontos
├── Plano de bolsas
├── Fornecedores
├── Recebimentos
├── Planilha de recebimentos
├── Negociações
├── Desir títulos a receber
├── Baixar títulos a receber
├── Planilha de cobranças
├── Remessa bancária
├── Retorno bancário
├── Trocar plano de pagamento
├── Trocar contas de títulos
├── Compromissos
└── Tesouraria
```

---

## 5. Rotas Consolidadas

| Rota | Descrição |
|------|-----------|
| `/portal/publico/academico/financeiro/dados-basicos` | Dados básicos |
| `/portal/publico/financeiro/conta` | Contas |
| `/portal/publico/academico/financeiro/plano-pagamento-cadastro` | Planos de pagamento |
| `/financeiro/plano-pagamento/` | Planos (gestão) |
| `/portal/publico/academico/financeiro/plano-bolsa` | Plano de bolsas |
| `/portal/publico/academico/financeiro/plano-negociacao` | Planos de negociação |
| `/portal/publico/academico/financeiro/programacao-descontos` | Programação de descontos |
| `/portal/publico/academico/financeiro/fornecedor` | Fornecedores |
| `/financeiro/planilha-recebimentos/` | Planilha de recebimentos |

---

## 6. Relevância para o ERP FIC

O módulo financeiro é relevante para o ERP completo, mas **não é prioridade imediata para o Diploma Digital**. Porém, os dados financeiros do aluno podem ser necessários como pré-requisito para emissão do diploma (aluno em dia com pagamentos).

---

**Gerado em:** 21/03/2026 | **Fonte:** Vídeos 2, 3
