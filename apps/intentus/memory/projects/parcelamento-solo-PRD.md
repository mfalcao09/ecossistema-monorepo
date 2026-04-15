# PRD — Módulo Parcelamento de Solo (Projetos Horizontais)

> **Versão:** 0.1 (rascunho inicial — a evoluir conforme Marcelo for trazendo requisitos)
> **Owner:** Marcelo Silva (CEO Intentus)
> **Engenharia:** Claudinho + Buchecha (pair programming)
> **Skill aplicada:** `product-management:write-spec`, `saas-product`, `real-estate`
> **Data:** 07/04/2026
> **Status:** 🟡 Em construção iterativa

---

## 1. Problema

Empresas e empreendedores que querem **parcelar terras** (loteamentos urbanos, condomínios horizontais de lotes, chácaras de recreio) hoje precisam:

1. Contratar consultores caros para fazer **estudo de viabilidade preliminar**
2. Ou usar **planilhas frágeis** sem inteligência geoespacial
3. Ou usar ferramentas internacionais que **não conhecem a regulação brasileira** (Lei 6.766/79, Código Florestal, SICAR, zoneamento municipal)

O processo típico hoje leva **2-6 semanas** entre receber a proposta de um terreno e ter uma decisão qualificada de "vai/não vai".

## 2. Visão do Produto

Um módulo **dentro do Intentus** que permite, a partir do upload de um **arquivo georreferenciado** (KMZ/KML), gerar em **menos de 10 minutos** um **estudo de viabilidade completo** com:

- Análise urbanística (área líquida, lotes, taxa de aproveitamento)
- Análise legal (Lei 6.766/79, APP, Reserva Legal, zoneamento)
- Análise financeira (custos, cronograma, VPL, TIR, payback)
- Visualização 3D do terreno e do loteamento simulado
- Parecer técnico em linguagem natural gerado por IA
- Relatório PDF profissional pronto para apresentar a investidores

## 3. Personas

### 3.1 Marcelo (founder do Intentus + incorporador)
- Avalia ~10-30 terrenos por mês
- Hoje gasta horas analisando KMZ no Google Earth + Excel
- Quer decisão rápida e fundamentada
- Precisa apresentar para sócios/investidores

### 3.2 Incorporador parceiro
- Pequeno/médio incorporador que quer profissionalizar análises
- Não tem time de geoprocessamento próprio
- Disposto a pagar por ferramenta que substitua consultor

### 3.3 Corretor especializado em terrenos
- Capta terrenos para incorporadores
- Quer "vender" o terreno com estudo pronto

### 3.4 Investidor / fundo
- Compara múltiplas oportunidades
- Precisa de relatório padronizado para comitê

## 4. Casos de Uso (User Stories)

### 4.1 Núcleo (do Lovable)

| ID | Como... | Eu quero... | Para... |
|---|---|---|---|
| US-01 | Usuário | Fazer login no Intentus e ver módulo Parcelamento na sidebar | Acessar a ferramenta junto com o resto da plataforma |
| US-02 | Usuário | Criar novo projeto preenchendo nome, UF e cidade | Começar análise rápida |
| US-03 | Usuário | Subir um arquivo KMZ/KML por drag-drop | Importar limites do terreno |
| US-04 | Sistema | Calcular área do terreno automaticamente em hectares | Eliminar trabalho manual |
| US-05 | Sistema | Detectar se a localização do KMZ bate com a UF/cidade informada | Evitar erros de cadastro |
| US-06 | Sistema | Consultar SICAR/SIGEF/IBAMA em background | Obter dados oficiais sem usuário precisar buscar |
| US-07 | Sistema | Calcular APP/Reserva Legal por interseção real (não estimativa) | Precisão jurídica |
| US-08 | Usuário | Ajustar % de área pública, verde, viário, APP e área mínima do lote | Personalizar a análise |
| US-09 | Sistema | Calcular área líquida vendável, total de lotes e taxa de aproveitamento | Decisão rápida de viabilidade |
| US-10 | Usuário | Visualizar o terreno em mapa 2D com camadas SICAR/SIGEF/IBAMA sobrepostas | Validar visualmente |
| US-11 | Usuário | Visualizar o terreno em 3D com elevação real | Entender topografia |
| US-12 | Usuário | Simular um loteamento em 3D sobre o terreno | Ver como ficará na prática |
| US-13 | Usuário | Importar layout CAD (DXF/DWG) com traçado pronto | Reaproveitar projetos existentes |
| US-14 | Usuário | Editar parâmetros e re-simular sem recomeçar | Iterar rapidamente |
| US-15 | Usuário | Salvar projeto com status (em análise / viável / rejeitado / monitorando) | Gestão de pipeline |
| US-16 | Usuário | Mover projeto para lixeira | Limpar dashboard |
| US-17 | Super admin | Restaurar projeto da lixeira ou apagar permanentemente | Recuperação de erros |
| US-18 | Usuário | Convidar colaboradores com role específico | Trabalho em equipe multi-tenant |

### 4.2 Gaps a completar (placeholders do Lovable)

| ID | Como... | Eu quero... | Para... |
|---|---|---|---|
| US-20 | Usuário | Cadastrar custos do terreno e infraestrutura | Análise financeira |
| US-21 | Usuário | Definir cronograma físico-financeiro (24-48 meses) | Projetar fluxo de caixa |
| US-22 | Usuário | Definir velocidade de venda esperada | Projetar receita |
| US-23 | Sistema | Calcular VPL, TIR, Payback, Margem Líquida, ROI | Indicadores financeiros |
| US-24 | Sistema | Mostrar 3 cenários (conservador/realista/otimista) | Análise de sensibilidade |
| US-25 | Usuário | Marcar itens de checklist Lei 6.766/79 como atendidos | Conformidade legal |
| US-26 | Sistema | Calcular score de compliance 0-100 | Visão rápida de risco regulatório |
| US-27 | Sistema | Alertar sobre itens críticos (declividade >47%, APP invadida) | Evitar problemas de aprovação |
| US-28 | Usuário | Gerar relatório executivo PDF (1-2 páginas) | Apresentar a decision-maker |
| US-29 | Usuário | Gerar relatório técnico PDF (10-20 páginas) | Documentação completa |
| US-30 | Usuário | Exportar memorial descritivo | Agilizar protocolo na prefeitura |
| US-31 | Usuário | Compartilhar relatório por link expirável | Enviar a investidor |
| US-32 | Usuário | Exportar para Excel | Análise externa |

### 4.3 IA-native (incrementos de visão)

| ID | Como... | Eu quero... | Para... |
|---|---|---|---|
| US-40 | Usuário | Receber parecer técnico em linguagem natural gerado por IA | Entender o estudo sem ser engenheiro |
| US-41 | Usuário | Ativar modo "autopilot" e a IA escolher melhor configuração | Decisão automatizada |
| US-42 | Usuário | Comparar 5 terrenos lado a lado | Priorizar investimentos |
| US-43 | Sistema | Sugerir parâmetros baseado em zoneamento municipal | Conformidade automática |
| US-44 | Sistema | Detectar declividade real por pixel (a partir do grid de elevação) | Análise de movimentação de terra |
| US-45 | Sistema | Otimizar traçado por algoritmo genético | Maximizar nº de lotes mantendo legalidade |
| US-46 | Sistema | Integrar com MapBiomas (Google Earth Engine) | Histórico de uso/cobertura do solo |
| US-47 | Sistema | Alimentar CRM com lotes calculados (twin digital) | Fechar ciclo Intentus completo |

### 4.4 A definir (Marcelo avisou: "muita coisa")

> Marcelo vai trazer mais histórias progressivamente. Esta seção vai crescer.

- [ ] ?

## 5. Métricas de Sucesso

### 5.1 Métricas de produto
- **Tempo médio "do KMZ ao parecer"** — meta: <10 minutos
- **# de projetos analisados/mês** — baseline: 0
- **# de projetos por status** (em_analise, viavel, rejeitado, monitorando)
- **Taxa de conversão "viável → contrato"** (integração futura com CLM)
- **NPS do módulo** — meta: >50

### 5.2 Métricas técnicas
- **Tempo de upload + parse de KMZ** — meta: <5s
- **Tempo de cálculo APP/RL** (com cache) — meta: <3s
- **Tempo de carregamento 3D** — meta: <8s
- **Erro rate das EFs externas** — meta: <2%
- **Taxa de cache hit do SICAR** — meta: >60%

### 5.3 Métricas de negócio
- **# de incorporadores parceiros usando** — meta para Q3/2026: 10
- **MRR atribuível ao módulo** — a definir após pricing

## 6. Restrições e Premissas

### 6.1 Restrições técnicas
- **Stack:** React + Vite + TS + shadcn + Supabase (igual ao resto do Intentus)
- **Banco:** PostgreSQL (Supabase) — projeto `bvryaopfjiyxjgsuhjsb`
- **Multi-tenant:** RLS com `getAuthTenantId()` (padrão Intentus)
- **RBAC:** 7 roles do Intentus
- **Pair programming:** Obrigatório com Buchecha (CLAUDE.md)
- **Naming:** Prefixo `parcelamento_*` em TODAS as tabelas/EFs/rotas

### 6.2 Restrições legais
- **Lei 6.766/79** — base regulatória federal
- **Lei 12.651/12** (Código Florestal) — APP/RL
- **NBR 12.721** — cálculo de áreas
- **LGPD** — dados de localização são pessoais quando ligados a CPF

### 6.3 Premissas
- Marcelo é o **primeiro usuário** (dogfooding em terrenos reais)
- Pricing será definido após validação interna
- Integração com CRM/CLM virá em fase posterior

## 7. Não-Objetivos (out of scope para v1)

- ❌ **Não substitui** o projeto urbanístico oficial (assinado por arquiteto/urbanista)
- ❌ **Não substitui** o EIV (Estudo de Impacto de Vizinhança)
- ❌ **Não faz** licenciamento ambiental
- ❌ **Não emite** documentos com força legal (memorial é template, não substitui registro)
- ❌ **Não integra** com órgãos públicos (prefeituras, CRI) — futuro
- ❌ **Não suporta** verticalização / incorporação de prédios (apenas horizontal)
- ❌ **Não calcula** ITBI/laudêmio/registro (talvez futuro)

## 8. Roadmap em fases

### Fase 0 — Auditoria (1-2 dias) ← **EM EXECUÇÃO AGORA**
- Auditoria das 5 EFs externas (provedores, custos, dependências)
- Listagem de tabelas atuais do Intentus para evitar colisões
- Decisões finais de naming

### Fase 1 — Schema (2-3 dias)
- Migration `add_parcelamento_module.sql`
- Tabelas com prefixo `parcelamento_*`
- RLS + helper functions adaptadas
- Storage bucket `parcelamento-files`

### Fase 2 — Edge Functions (2-3 dias)
- 5 EFs com prefixo `parcelamento-*`
- Adaptação ao `_shared/middleware.ts`
- CORS whitelist
- Deploy + teste

### Fase 3 — Libs e tipos (1-2 dias)
- Migrar libs geoespaciais
- Eliminar `as unknown as`
- Regenerar tipos Supabase

### Fase 4 — Páginas e componentes (4-6 dias)
- Migrar fluxo de criação 4-step
- Migrar componentes 3D (refatorar em sub-componentes)
- Integrar ao layout/sidebar do Intentus

### Fase 5 — Reescrever placeholders (5-7 dias)
- ParcelamentoFinancial.tsx
- ParcelamentoCompliance.tsx
- ParcelamentoReports.tsx (com geração PDF)

### Fase 6 — Testes e qualidade (3-4 dias)
- Testes unitários cálculos
- Testes integração KMZ
- E2E fluxo completo
- Build limpo

### Fase 7 — Migração de dados (opcional, 1-2 dias)
- Se Marcelo quiser trazer projetos do Lovable

### Fase 8 — Documentação (1 dia)
- Atualizar CLAUDE.md
- Criar `/help/parcelamento`

### Fase 9+ — Iterações com "muita coisa" do Marcelo
- A definir progressivamente

## 9. Decisões abertas

| Decisão | Status | Prazo |
|---|---|---|
| Escopo do MVP — incluir os 3 placeholders ou ir ao ar sem eles? | ⏳ Aguardando | Final da Fase 0 |
| IA desde o início ou plain primeiro? | ⏳ Aguardando | Final da Fase 0 |
| Pricing do módulo | ⏳ Não urgente | Após validação interna |
| Integração com CRM (twin digital) | ⏳ Pós-MVP | — |
| Provedor da EF `elevation` (custo) | 🔍 Em auditoria | Fase 0 |
| Provedor da EF `dwg-to-dxf` | 🔍 Em auditoria | Fase 0 |

## 10. Próximos passos

1. ✅ Memória inicializada
2. ⏭️ Auditoria das 5 Edge Functions (Fase 0.1, 0.2, 0.3)
3. ⏭️ Listagem de tabelas atuais do Intentus (Fase 0.4)
4. ⏭️ Apresentar relatório de auditoria a Marcelo
5. ⏭️ Decisões abertas → fechadas
6. ⏭️ Iniciar Fase 1 (schema)

---

**Histórico de versões:**
- **v0.1 (07/04/2026)** — rascunho inicial com base na análise técnica do código Lovable. Marcelo confirmou Caminho A e pediu para tratar como construção iterativa.
