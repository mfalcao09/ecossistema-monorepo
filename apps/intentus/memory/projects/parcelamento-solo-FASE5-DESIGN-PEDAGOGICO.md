# Parcelamento de Solo — Fase 5 Bloco A: Princípio de Design Pedagógico

**Data:** 2026-04-08
**Sessão:** 123
**Origem:** Esclarecimento de Marcelo ao iniciar Sprint 1

---

## Princípio Central

A pedagogia do Bloco A Financeiro **NÃO é para a conversa entre Marcelo e Claudinho** — é **para o usuário final da plataforma**, embutida diretamente na UI.

> "O que compõe o ROI, o quanto este ou aquele prazo impacta TIR. Isso que quero dizer quando falo que os conceitos precisam estar claros." — Marcelo, sessão 123

## Requisitos Funcionais Derivados

1. **Cada KPI deve ser explicável in-loco**
   - Tooltip curto ao lado do número (o quê)
   - Painel expansível "Como este número é calculado?" (passo a passo)
   - Breakdown visual dos componentes (ex: ROI = Lucro Líquido / Investimento → mostrar os dois números)

2. **Cada slider de sensibilidade deve mostrar causa-efeito em tempo real**
   - Ao mover "prazo de obra", o usuário vê instantaneamente o delta em VPL, TIR e Payback
   - Micro-copy: "Estender o prazo em 6 meses reduz sua TIR em X pontos porque..."

3. **Breakdowns clicáveis (drill-down)**
   - Clicar em "Custo Total" abre lista de itens (terreno, infraestrutura, projeto, comercialização)
   - Clicar em "Receita Total" abre cronograma de recebimentos
   - Clicar em "Lucro Líquido" mostra a conta: Receita − Custos − Impostos

4. **Glossário embutido**
   - Ícone `(?)` ao lado de cada termo técnico
   - Abre mini-modal com definição simples + exemplo numérico + vídeo opcional (futuro)

5. **Modo "Explicar esta aba"**
   - Botão no topo de cada uma das 8 abas: "O que esta aba me mostra?"
   - Abre overlay com tour guiado: o que é o gráfico, como ler, que decisões o usuário pode tomar a partir dele

6. **Impacto de variáveis em cascata**
   - Tabela "Quem impacta quem": mostra visualmente que aumentar o preço de venda impacta Margem → ROI → TIR
   - Grafo de dependências entre variáveis

## Implicações no Schema

As tabelas precisam guardar **metadados de explicação**, não só números:

- `parcelamento_financial_scenarios` deve armazenar os componentes do cálculo (não só o resultado final), para permitir drill-down sem recalcular.
- `parcelamento_cash_flow` precisa ter campo `categoria` para agrupar por tipo de entrada/saída.
- Uma nova tabela `parcelamento_financial_glossary` (ou seed JSON) para textos explicativos versionados.

## Implicações na Edge Function

A EF `parcelamento-financial-calc` deve retornar, junto com cada KPI:

```json
{
  "tir": {
    "valor": 0.187,
    "formato": "percentual",
    "componentes": {
      "fluxos": [...],
      "investimento_inicial": 1200000
    },
    "explicacao_curta": "Taxa que iguala o VPL a zero.",
    "explicacao_longa": "A TIR representa o retorno anualizado...",
    "sensibilidade_principal": "prazo_obra"
  }
}
```

Isso permite a UI renderizar o número, o tooltip, o painel "como é calculado?" e a sensibilidade sem chamadas extras.

## Próximo Passo

Desenhar schema do banco com esses requisitos em mente e apresentar a Marcelo para aprovação.
