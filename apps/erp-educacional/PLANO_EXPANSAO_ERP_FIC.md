# Plano de Expansão — ERP Educacional FIC
## "O ERP IA Native que o Brasil Precisa"

**Versão:** 1.0
**Data:** 21 de março de 2026
**Autor:** Claude (Opus 4) — Arquiteto-Chefe
**Revisores:** Buchecha (MiniMax M2.7), Product Manager Agent, Software Architect Agent
**Validação técnica:** Ordem de módulos validada por Buchecha

---

## Sumário Executivo

Este documento apresenta o plano de expansão do ERP Educacional da FIC — um sistema **100% IA Native** que será construído do zero para se tornar o **#1 em qualidade no Brasil**. Partindo do módulo de Diploma Digital (já em desenvolvimento), o plano cobre 12 módulos em 4 fases ao longo de 18 meses, com visão clara de produto, tecnologia, go-to-market e métricas de sucesso.

**O que nos diferencia de todo o mercado:** Nenhum ERP educacional brasileiro possui IA nativa verdadeira. Todos adicionam chatbots como feature opcional. Nós nascemos com IA no DNA — cada tela, cada formulário, cada decisão tem inteligência embarcada.

---

## 1. Análise de Mercado

### 1.1 Cenário Competitivo Atual

| Posição | Sistema | Base de Clientes | Ponto Forte | Fraqueza Principal |
|---------|---------|-----------------|-------------|-------------------|
| #1 | **TOTVS RM Educacional** | 700+ IES | Maior market share, robusto | Alto custo, implementação complexa, UI datada |
| #2 | **Gennera Academic One** | 750+ IES, 2,5M usuários | 100% cloud, integração SAP | Menos escalável para grandes IES |
| #3 | **Lyceum** | Diversos segmentos | Multi-modelo (escolas, EdTechs) | Interface menos intuitiva |
| #4 | **Sophia (Prima)** | 3.500+ clientes | 30+ anos de mercado | Sistema legado, pouca inovação |
| #5 | **JACAD** | Nicho | Foco em tendências | Menor base instalada |
| #6 | **Perseus ERP** | Regional | 100% web | Cobertura regional limitada |
| #7 | **Unimestre** | Regional | Sistema completo | PHP legado, sem IA |

### 1.2 Dores do Mercado (O Que as IES Mais Reclamam)

**Das IES (gestores):**
1. **Falta de integração** entre sistemas legados e novos — dados fragmentados
2. **Altos custos de customização** e implementação demorada (meses)
3. **Inflexibilidade** para múltiplos polos e modalidades (EAD/presencial)
4. **Conformidade MEC complexa** — preparar documentação para visitas in loco é pesadelo
5. **Zero capacidade preditiva** — sem BI, sem análise de evasão, sem cenários

**Dos alunos (para o MEC):**
1. **Dificuldade operacional** nas plataformas digitais (UX ruim)
2. **Atraso na emissão de diplomas** e certificados
3. **Negativação indevida** por erros financeiros do sistema

### 1.3 A Oportunidade

**Fato crítico:** Nenhum ERP educacional brasileiro possui IA nativa real. O que existe são chatbots bolt-on, não inteligência embarcada.

**Mercado endereçável:**
- ~2.600 IES privadas no Brasil
- ~300 IES públicas (federais + estaduais)
- TAM estimado: R$ 25-75M/ano (SaaS)

**Timing perfeito:**
- Portaria MEC 70/2025 → prazo de Diploma Digital cria urgência
- Portaria MEC 360/2022 → Acervo Acadêmico Digital é obrigatório
- IA deixou de ser diferencial para se tornar expectativa em 2026

---

## 2. Visão do Produto

### 2.1 Posicionamento

> **"ERP Educacional IA Native — Da matrícula ao diploma, com inteligência em cada passo."**

Não somos um ERP que "tem IA". Somos um ERP que **é IA**. Cada módulo, cada interface, cada processo tem inteligência artificial como parte fundamental da experiência.

### 2.2 Princípios de Design

| Princípio | O Que Significa na Prática |
|-----------|---------------------------|
| **IA Native** | Assistente contextual em cada módulo, auto-preenchimento inteligente, validação em linguagem natural, sugestões proativas |
| **MEC Compliance First** | Conformidade regulatória não é afterthought — é feature core |
| **Student-Centric** | Tudo existe para melhorar a experiência e o sucesso do aluno |
| **Data-Driven** | Cada decisão institucional apoiada por dados e previsões |
| **Open Architecture** | APIs documentadas, dados exportáveis, zero lock-in |
| **Mobile-First** | 60%+ dos acessos será mobile — projetar para isso desde dia 1 |
| **Acessível** | WCAG 2.1 AA — inclusão não é opcional |

### 2.3 Funcionalidades IA Native Transversais

Estas funcionalidades estão presentes em **TODOS** os módulos:

| Funcionalidade | Descrição |
|---------------|-----------|
| **Assistente Contextual** | Chat IA flutuante que entende em qual módulo/tela o usuário está e oferece ajuda específica |
| **Auto-Fill Inteligente** | Preenchimento automático buscando dados por CPF, CNPJ, CEP + dados do próprio sistema |
| **Validação em Linguagem Natural** | Em vez de "Campo inválido", mostra "Este CPF parece ter um dígito a mais — verifique o penúltimo número" |
| **Sugestões Proativas** | "Baseado nos últimos 3 semestres, sugerimos abrir 2 turmas de Direito Noturno" |
| **Copiloto de Documentos** | Geração assistida de XMLs, relatórios MEC, atas, declarações |
| **Busca Semântica** | Encontrar qualquer informação em linguagem natural: "Quais alunos estão devendo mais de 3 meses?" |
| **Insights Automáticos** | Cada dashboard vem com explicação em texto do que os números significam |

---

## 3. Arquitetura Técnica

### 3.1 Stack Tecnológico

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| **Frontend** | Next.js 14 (App Router) + React 18 + Tailwind CSS + shadcn/ui | Performance SSR/SSG, DX moderna, componentes acessíveis |
| **Backend** | Node.js + TypeScript (API Routes Next.js + Supabase Edge Functions) | Tipagem forte, ecossistema maduro, Supabase nativo |
| **Database** | PostgreSQL (Supabase) | RLS nativo, realtime, extensões (pgvector, pg_cron) |
| **IA/LLM** | Claude Sonnet via OpenRouter | Controlável, custo otimizado, português excelente |
| **Busca Vetorial** | Supabase pgvector | RAG para documentação MEC e busca semântica |
| **Armazenamento** | Cloudflare R2 | S3-compatible, sem egress fee, multi-região |
| **Hospedagem** | Vercel (Frontend) + Supabase (Backend/DB) | Deploy instantâneo, edge functions, escalabilidade |
| **Assinatura Digital** | API terceiros (BRy/Certisign/Soluti) | ICP-Brasil, certificado A3 |
| **PDF** | Puppeteer + Chrome Headless | RVDD de alta qualidade |
| **XML** | fast-xml-parser + validação XSD | Performance + conformidade |
| **Cache** | Supabase + Vercel Edge | Sessões, resultados IA |
| **Filas** | Supabase pg_net + Edge Functions | Processamento assíncrono |
| **Mobile** | React Native (Fase 4) | Code sharing com web |
| **Observabilidade** | Vercel Analytics + Supabase Logs | Monitoramento integrado |

### 3.2 Arquitetura de Camadas (Validada por Buchecha)

```
┌──────────────────────────────────────────────────────────────────┐
│                     CAMADA DE APRESENTAÇÃO                       │
│  Portal Aluno │ Portal Professor │ Portal Admin │ App Mobile     │
│  (Next.js 14 + React 18 + Tailwind + shadcn/ui)                │
├──────────────────────────────────────────────────────────────────┤
│                     CAMADA IA NATIVE                             │
│  Assistente Contextual │ Auto-Fill │ Copiloto │ Insights         │
│  (Claude Sonnet via OpenRouter + pgvector RAG)                  │
├──────────────────────────────────────────────────────────────────┤
│                     CAMADA DE NEGÓCIO                            │
│  Acadêmico │ Financeiro │ Matrículas │ Captação │ Pedagógico    │
│  Pessoas │ Diploma │ Acervo │ Admin │ Config │ Relatórios       │
│  (API Routes + Supabase Edge Functions + TypeScript)            │
├──────────────────────────────────────────────────────────────────┤
│                     CAMADA DE DADOS                              │
│  PostgreSQL (Supabase) │ Cloudflare R2 │ pgvector │ Cache       │
│  Row Level Security │ Realtime │ Audit Log                      │
└──────────────────────────────────────────────────────────────────┘
```

### 3.3 Ordem de Implementação dos Módulos (Validada por Buchecha)

Buchecha analisou as dependências de banco de dados e definiu a ordem técnica correta:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CAMADA BASE (Fundação)                        │
│  1. Pessoas          ← FK de pessoas em TODO lugar              │
│  2. Configurações    ← Parâmetros globais do sistema            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  CAMADA OPERACIONAL CORE                         │
│  3. Financeiro       ← Quase tudo tem componente financeiro     │
│  4. Pedagógico       ← Professores, componentes, competências   │
│  5. Acadêmico        ← Cursos, turmas, grades (depende de 4)   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    CAMADA DE NEGÓCIO                             │
│  6. Matrículas       ← Requer Financeiro + Acadêmico           │
│  7. Captação         ← Lead → Pessoa → Matrícula               │
│  8. Diploma Digital  ← Dados acadêmicos finalizados            │
│  9. Acervo Digital   ← Depende de Acadêmico                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   CAMADA DE CONSUMO                              │
│  10. Administrativo  ← Consome módulos operacionais             │
│  11. Relatórios      ← Agrega dados de TUDO                    │
│  12. Portais         ← Interface que lê todos os módulos        │
└─────────────────────────────────────────────────────────────────┘
```

**Nota de Buchecha:** O Diploma Digital pode rodar em PARALELO com Financeiro, Pedagógico e Acadêmico, desde que as tabelas base de Pessoas e Configurações existam primeiro. A FK pode ser adicionada progressivamente.

---

## 4. Roadmap em 4 Fases (18 Meses)

### FASE 1: FUNDAÇÃO + DIPLOMA DIGITAL (Meses 0-4)

**Objetivo:** Validar no mercado, entregar Diploma Digital em produção, estabelecer base técnica para todo o ERP.

#### Módulos desta fase:

**1. Pessoas (Base)**
- Cadastro unificado: alunos, professores, colaboradores, candidatos
- Perfis com foto, documentos, contatos
- Grupos e categorias
- **[IA]** Auto-preenchimento por CPF (dados públicos), validação inteligente de documentos

**2. Configurações (Base)**
- Dados da IES (CNPJ, endereço, credenciamento MEC)
- Parâmetros globais do sistema
- Permissões RBAC (Acessar/Inserir/Alterar/Remover/Especial)
- Anos letivos, períodos, calendários
- **[IA]** Diagnóstico de saúde do sistema, sugestões de otimização

**3. Diploma Digital (Módulo Estrela)**
- Motor de geração dos 3 XMLs obrigatórios (XSD v1.06)
- Integração com API de assinatura digital (ICP-Brasil A3)
- Gerador de RVDD (PDF visual)
- Portal público de consulta (diploma.ficcassilandia.com.br)
- Portal do Diplomado (download, compartilhamento, QR Code)
- **[IA]** Copiloto de geração XML, validação automática, preenchimento assistido

**4. Acervo Acadêmico Digital**
- Repositório seguro de documentos acadêmicos
- Upload com metadados obrigatórios (Decreto 10.278/2020)
- Hash SHA-256 para integridade
- Log de auditoria completo
- Backup externo (Cloudflare R2 multi-região)
- **[IA]** OCR inteligente para digitalização, classificação automática de documentos

#### Métricas de Sucesso — Fase 1:
- [ ] Diploma Digital em produção na FIC
- [ ] 100% conformidade MEC (Portarias 70/2025 e 360/2022)
- [ ] Tempo de emissão: < 30 minutos (end-to-end)
- [ ] 1-2 IES piloto assinadas
- [ ] Base de dados Pessoas + Config operacional

#### Investimento Estimado:
- Infraestrutura: ~R$ 2.500-4.000/mês
- Time: Claude (arquiteto) + Buchecha (senior dev) + DeepSeek (lógica) + Qwen (frontend) + Kimi (bugs) + Codestral (code)

---

### FASE 2: CORE ACADÊMICO + IA NATIVE (Meses 4-10)

**Objetivo:** Expandir para 3 módulos acadêmicos core, ativar IA Native em todas as funcionalidades, conquistar primeiros clientes pagantes.

#### Módulos desta fase:

**5. Financeiro**
- Planos de pagamento e mensalidades
- Geração de boletos (integração bancária)
- Gestão de bolsas e descontos
- Negociação de dívidas
- Recebimentos e baixas
- Dashboard financeiro
- **[IA]** Scoring preditivo de inadimplência, sugestão de planos de parcelamento, detecção de fraude, previsão de fluxo de caixa

**6. Pedagógico**
- Matrizes curriculares e componentes
- Planos de ensino
- Gestão de competências e habilidades
- Diário de classe digital
- Provas e avaliações (online e presencial)
- Cálculo de médias configurável
- **[IA]** Assistente de design curricular (alinhamento MEC/ENADE), sugestão de metodologias ativas, análise de carga horária vs. performance

**7. Acadêmico**
- Gestão de cursos (graduação, pós, extensão)
- Turmas e períodos letivos
- Grades curriculares
- Horários e alocação de salas
- Documentação acadêmica (7 tipos: diploma, histórico, XMLs)
- Coordenadores e NDEs
- **[IA]** Otimização de grade horária, sugestão de abertura/fechamento de turmas baseada em demanda, análise de pré-requisitos

**8. Portal do Professor (View)**
- Lançamento de notas e frequência
- Gestão de provas e avaliações
- Material de apoio (upload/download)
- Dashboard de desempenho das turmas
- **[IA]** Copiloto de avaliação (sugestões de feedback, detecção de plágio, análise de curva de notas)

#### Funcionalidades IA Diferenciais — Fase 2:

| Feature IA | Descrição | Impacto |
|-----------|-----------|---------|
| **Preditor de Evasão** | ML model que identifica risco de evasão na semana 1 (não na semana 15) | Retenção +8-15% |
| **Auto-Fill Acadêmico** | Preenche dados de curso automaticamente consultando e-MEC | Redução de erros 90% |
| **Copiloto Financeiro** | "Mostre alunos com mais de 3 parcelas em atraso que cursam Direito" | Produtividade +40% |
| **Análise de Desempenho** | "A turma 2024.2 de Administração está 12% abaixo da média histórica em Estatística" | Intervenção precoce |

#### Métricas de Sucesso — Fase 2:
- [ ] 3 módulos acadêmicos operacionais
- [ ] 3-5 IES clientes pagantes
- [ ] MRR: R$ 15-20k
- [ ] Taxa de adoção IA: > 50% dos usuários ativos
- [ ] Redução de tempo administrativo: 40%

---

### FASE 3: GESTÃO COMPLETA + INTELIGÊNCIA INSTITUCIONAL (Meses 10-15)

**Objetivo:** Completar cobertura funcional (70%+), lançar funcionalidades de IA que nenhum concorrente tem, consolidar posição de mercado.

#### Módulos desta fase:

**9. Matrículas**
- Wizard de nova matrícula (multi-step)
- Planilha de matrículas por disciplina
- Rematrícula automatizada
- Escolha de disciplinas pelo aluno (self-service)
- Integração financeira (cálculo automático de mensalidade)
- Aceite digital de contrato
- **[IA]** Recomendação de disciplinas baseada em histórico, previsão de demanda por turma, detecção de conflitos de horário

**10. Captação (CRM Educacional)**
- Pré-cadastro de candidatos (landing page)
- Jornada de inscrição configurável
- Processo seletivo (vestibular, ENEM, transferência)
- Contrato digital (assinatura eletrônica)
- Funil de conversão (lead → inscrito → matriculado)
- Campanhas de captação
- **[IA]** Lead scoring educacional, personalização de comunicação por perfil, chatbot de atendimento ao candidato, previsão de taxa de conversão

**11. Relatórios e BI**
- Dashboard executivo (retenção, evasão, financeiro, acadêmico)
- Relatórios MEC automáticos (Censo, ENADE, CPC, IGC)
- Análises preditivas e cenários
- Exportação PDF, Excel, CSV
- Filtros avançados e segmentação
- **[IA]** Gerador de insights ("Evasão em Engenharia está 15% acima da média"), simulador "e se" ("Se reduzir mensalidade em 10%, qual impacto na retenção?"), narrativa automática para relatórios

**12. Portal do Aluno (View Completa)**
- Dashboard personalizado
- Notas e frequências em tempo real
- Financeiro (boletos, pagamentos, negociação)
- Upload de documentos
- Calendário acadêmico
- Requerimentos online
- Escolha de disciplinas
- **[IA]** Assistente pessoal do aluno ("Quando é minha próxima prova?", "Como está minha situação financeira?"), recomendador de carreira, alertas proativos

#### Inovação Diferenciadora — "Institutional Intelligence"

**Painel IA da Reitoria** (exclusivo, nenhum concorrente tem):
- Previsão de inadimplência 90 dias antes
- Alertas de risco ENADE por disciplina/docente
- Oportunidades de expansão (análise de demanda regional)
- Simulador de cenários ("E se abrir novo polo em cidade X?")
- Benchmark anônimo com outras IES da rede

**MEC Compliance Autopilot:**
- Geração automática de relatórios para visita in loco
- Auditoria contínua de conformidade curricular
- Checklist inteligente de documentação pendente
- Alertas de prazos regulatórios

#### Métricas de Sucesso — Fase 3:
- [ ] 8 módulos operacionais (cobertura 70% operações IES)
- [ ] 10-15 IES clientes ativos
- [ ] MRR: R$ 45-60k / ARR: R$ 540-720k
- [ ] Net Revenue Retention: > 110%
- [ ] 3+ case studies publicados
- [ ] Índice de adoção IA: > 60%

---

### FASE 4: EXPANSÃO, MOBILE E DOMÍNIO DE MERCADO (Meses 15-18)

**Objetivo:** Completar 100% dos módulos, lançar app mobile, consolidar posição #1 no Brasil.

#### Módulos desta fase:

**13. Administrativo**
- Gestão de patrimônio e infraestrutura
- Controle de contratos e fornecedores
- Ocorrências e protocolos
- Notícias e comunicados institucionais
- Gestão de espaços e reservas
- **[IA]** Análise de contratos (cláusulas de risco), otimização de alocação de espaços, previsão de manutenção

**14. App Mobile (iOS + Android)**
- React Native com code sharing do web
- Push notifications inteligentes
- Acesso offline a documentos
- Biometria para autenticação
- Diploma Digital no celular (visualização + QR Code)
- **[IA]** Notificações personalizadas por perfil e comportamento

#### Inovações Finais:

**"Student Success AI"** — Sistema de sucesso do aluno:
- Detecção precoce de risco de evasão (semana 1, não semana 15)
- Intervenção multi-canal automática (email, SMS, WhatsApp, notificação)
- Análise de causalidade ("Não é evasão geral — é a disciplina de Cálculo com o Prof. X")
- Tracking de resultado das intervenções (o que funciona para cada perfil?)

**"IES Benchmark Network"** — Rede de benchmarking:
- Dados anonimizados de todas as IES clientes
- "Seu custo/aluno é R$ X vs. média R$ Y de IES comparáveis"
- "Sua evasão em Engenharia é 12% vs. média nacional 18%"
- Ranking de melhores práticas por métrica

**"Pedagogical Playbook AI"** — Playbook pedagógico:
- IA analisa padrões de docentes com melhor retenção
- Sugere práticas pedagógicas comprovadas por dados
- Gera planos de capacitação personalizados

#### Métricas de Sucesso — Fase 4:
- [ ] 100% módulos operacionais (cobertura > 95% operações IES)
- [ ] 25-35 IES clientes ativos
- [ ] MRR: R$ 100-150k / ARR: R$ 1.2-1.8M
- [ ] Net Revenue Retention: > 120%
- [ ] NPS: > 50
- [ ] Posição reconhecida: #1 ERP IA Native para Educação no Brasil

---

## 5. Integrações com APIs Governamentais e de Mercado

### 5.1 APIs Governamentais (Obrigatórias)

| API/Sistema | Uso | Módulo |
|-------------|-----|--------|
| **e-MEC** | Consulta de dados de IES, cursos credenciados | Acadêmico, Config |
| **INEP/Censo** | Submissão de dados do Censo da Educação Superior | Relatórios |
| **ENADE** | Dados de desempenho de estudantes | Relatórios, BI |
| **Receita Federal (CPF/CNPJ)** | Validação de documentos, auto-fill | Pessoas, Captação |
| **ViaCEP** | Auto-preenchimento de endereço | Pessoas, Captação |
| **ICP-Brasil** | Assinatura digital de diplomas e documentos | Diploma, Acervo |
| **SISTEC** | Integração com sistema de cursos técnicos | Acadêmico |

### 5.2 APIs de Mercado (Estratégicas)

| API/Serviço | Uso | Módulo |
|-------------|-----|--------|
| **BRy / Certisign / Soluti** | Assinatura digital A3 | Diploma, Acervo |
| **Clicksign / Autentique** | Assinatura eletrônica de contratos | Captação, Matrículas |
| **Asaas / PagSeguro / Stripe** | Gateway de pagamento, boletos, PIX | Financeiro |
| **OpenRouter (Claude Sonnet)** | Motor IA para assistente e análises | Todos (IA Layer) |
| **Google Workspace** | Meet (videoconferência), Classroom, Calendar | Pedagógico |
| **SendGrid / Resend** | Emails transacionais e notificações | Todos |
| **Twilio / Evolution API** | SMS e WhatsApp para comunicação | Captação, Student Success |
| **Cloudflare Turnstile** | CAPTCHA para portais públicos | Portais |

### 5.3 APIs Futuras (Fase 3-4)

| API/Serviço | Uso | Módulo |
|-------------|-----|--------|
| **Moodle / Canvas LMS** | Integração com AVA existentes | Pedagógico |
| **CAPES Sucupira** | Pós-graduação stricto sensu | Acadêmico |
| **SISU / PROUNI / FIES** | Processos seletivos federais | Captação, Matrículas |
| **LinkedIn Learning** | Capacitação docente e discente | Pessoas, Pedagógico |
| **Amplitude / Mixpanel** | Analytics de produto | BI |

---

## 6. O Que Nos Torna #1 no Brasil

### 6.1 Sete Diferenciais Estruturais

**1. IA NATIVE = Vantagem Genética, Não Feature**

Enquanto concorrentes adicionam IA como módulo opcional, nosso ERP nasceu com IA no DNA:
- Cada interface tem assistente contextual (não separado)
- Cada formulário tem auto-fill inteligente
- Cada decisão oferece recomendação com nível de confiança
- Cada relatório vem com insights "e porquê" (não só números)
- **Resultado:** Usuários 30-40% mais produtivos sem mudar workflow

**2. MEC Compliance Autopilot = Diferencial Regulatório**

Nenhum ERP brasileiro automatiza conformidade MEC de verdade:
- Geração automática de relatórios MEC (Censo, ENADE, CPC)
- Auditoria contínua de currículo vs. Portarias
- Simulação de resultados de avaliação institucional
- **Resultado:** IES preparada para visita in loco a qualquer momento

**3. Student Success AI = Motor de Retenção**

Não oferecemos "alertas de evasão" — oferecemos intervenção inteligente:
- Detecção na semana 1 (antes do aluno desistir)
- Análise causal (qual disciplina? qual docente? qual fator?)
- Intervenção multi-canal automática
- **Resultado:** Redução de evasão 8-15% = R$ 500k-1.5M/ano retidos para IES média

**4. Portabilidade de Dados = Confiança Total**

Dados abertos, sem lock-in:
- Export em formato aberto (CSV, JSON, XML)
- Migração zero-loss de outros ERPs
- APIs documentadas e abertas
- **Resultado:** IES escolhe ficar porque quer, não porque precisa

**5. Design que Pessoas Amam = Adoção 2x Mais Rápida**

ERPs educacionais brasileiros têm UI dos anos 2000:
- Design system próprio com tokens, componentes reutilizáveis
- Mobile-first (60%+ de acesso será mobile)
- Acessibilidade WCAG 2.1 AA nativa
- **Resultado:** Onboarding de 2 semanas vs. 2 meses dos concorrentes

**6. Pricing Justo = Go-to-Market Vencedor**

Modelo de pricing transparente e escalável:
- **Diploma Free:** Diploma Digital gratuito (entrada no funil)
- **Academic Starter:** R$ 2.500/mês (até 500 alunos, 3 módulos)
- **Academic Pro:** R$ 7.500/mês (até 2.000 alunos, 7 módulos)
- **Enterprise:** R$ 25.000+/mês (ilimitado, todos os módulos + BI)
- Sem custos ocultos, sem surpresas

**7. Ecosystem Play = Efeito de Rede**

Plataforma, não monolito:
- Marketplace de integrações (tutoria IA, proctoring, gateways)
- API-first (terceiros constroem em cima)
- Comunidade docente (compartilhamento de práticas)
- **Resultado:** Valor exponencial — cada nova integração beneficia todos os clientes

---

## 7. Funcionalidades IA Exclusivas por Módulo

### Mapa Completo de IA Native

| Módulo | Feature IA | Tipo | Nível de Inovação |
|--------|-----------|------|-------------------|
| **Pessoas** | Auto-fill por CPF/CNPJ, validação de documentos por OCR | Produtividade | Diferencial |
| **Configurações** | Diagnóstico de saúde, sugestão de otimização | Operacional | Diferencial |
| **Diploma Digital** | Copiloto XML, validação semântica, preenchimento assistido | Core | Revolucionário |
| **Acervo Digital** | OCR + classificação automática de documentos | Produtividade | Diferencial |
| **Financeiro** | Preditor de inadimplência, scoring de crédito, previsão de caixa | Preditivo | Revolucionário |
| **Pedagógico** | Design curricular assistido, análise de carga vs. ENADE | Estratégico | Único no Brasil |
| **Acadêmico** | Otimização de grade, previsão de demanda, consulta e-MEC | Operacional | Diferencial |
| **Matrículas** | Recomendação de disciplinas, detecção de conflitos | Experiência | Diferencial |
| **Captação** | Lead scoring, chatbot candidato, previsão de conversão | Growth | Diferencial |
| **Relatórios** | Insights narrativos, simulador "e se", MEC Autopilot | Estratégico | Único no Brasil |
| **Portal Aluno** | Assistente pessoal, recomendador de carreira, alertas | Experiência | Revolucionário |
| **Portal Professor** | Copiloto de avaliação, análise de curva, anti-plágio | Produtividade | Diferencial |
| **Student Success** | Detecção precoce evasão, intervenção automática, causal | Retenção | Único no Brasil |
| **Institutional Intel** | Painel Reitoria, benchmark, cenários, previsão acreditação | Estratégico | Único no Brasil |

**Legenda de Inovação:**
- **Diferencial:** Melhor que concorrentes, mas conceito existente
- **Revolucionário:** Abordagem fundamentalmente nova no mercado educacional BR
- **Único no Brasil:** Nenhum ERP educacional brasileiro oferece nada similar

---

## 8. Go-to-Market Strategy

### 8.1 Estratégia de Aquisição por Fase

**Fase 1-2: Land & Expand (Bottom-Up)**
- Diploma Digital como porta de entrada (problema agudo, mandato MEC)
- Mensagem: "Cumpra a Portaria 70/2025 em 2 semanas, não em 6 meses"
- Proof: Case study FIC como primeiro cliente
- Prospecção direta a Reitores e Pró-Reitores de Registro

**Fase 2-3: Inbound + Comunidade**
- Grupo "Registradores Acadêmicos do Brasil" (LinkedIn/WhatsApp)
- Conteúdo técnico gratuito (templates, best practices, webinars)
- Whitepaper: "Estado do Diploma Digital no Brasil — 2026"
- Eventos: ABREMI, ABMES, Fóruns de Educação Superior

**Fase 3-4: Domínio de Mercado**
- Brand positioning: "O ERP que IES escolhem quando querem ser data-driven"
- Parcerias estratégicas com MEC e associações
- Benchmark público anonimizado: "Estado da Educação Superior BR"
- Channel partners (consultores educacionais, integradores)

### 8.2 Funil de Conversão

```
Awareness (Blog, Eventos, LinkedIn)
    ↓
Interest (Diploma Digital Gratuito, Webinars)
    ↓
Consideration (Demo personalizada, Case study FIC)
    ↓
Decision (Piloto 30 dias, ROI calculator)
    ↓
Adoption (Onboarding 2 semanas, Success Manager)
    ↓
Expansion (Módulos adicionais, upsell BI/IA)
    ↓
Advocacy (NPS > 50, referral program)
```

---

## 9. Métricas SaaS Projetadas

| Métrica | Fase 1 (M4) | Fase 2 (M10) | Fase 3 (M15) | Fase 4 (M18) |
|---------|-------------|-------------|-------------|-------------|
| **Clientes Ativos** | 1-2 | 3-5 | 10-15 | 25-35 |
| **MRR** | R$ 0 (piloto) | R$ 15-20k | R$ 45-60k | R$ 100-150k |
| **ARR** | — | R$ 180-240k | R$ 540-720k | R$ 1.2-1.8M |
| **Churn Mensal** | 0% | < 2% | < 2% | < 1% |
| **Net Retention** | — | 80% | 110% | 125% |
| **NPS** | — | 35+ | 45+ | 50+ |
| **Adoção IA** | — | 50%+ | 60%+ | 75%+ |

---

## 10. Time e Squad de Desenvolvimento

### 10.1 Squad Atual (IAs)

| IA | Papel no Plano de Expansão |
|----|---------------------------|
| **Claude (Opus 4)** | Arquiteto-chefe, orquestrador, decisões estratégicas |
| **Buchecha (MiniMax M2.7)** | Senior Developer, code review, implementação paralela, definição de ordem técnica |
| **DeepSeek (V3.2)** | Lógica de banco de dados, queries complexas, debugging profundo |
| **Qwen (Qwen3-Coder)** | Frontend React/Next.js, design system, componentes |
| **Kimi (K2.5)** | Resolução de bugs, fixes em codebases grandes |
| **Codestral (Mistral)** | Code completion, refatoração idiomática |

### 10.2 Expansão Futura (Humanos)

| Fase | Contratações Sugeridas |
|------|----------------------|
| **Fase 2** | 1 DevOps/Infra (part-time), 1 Designer UX/UI |
| **Fase 3** | 1 Product Manager, 1 Data Scientist (IA/ML) |
| **Fase 4** | 1 Especialista Compliance MEC, 2-3 Customer Success |

---

## 11. Cronograma Visual

```
MESES:    0    2    4    6    8   10   12   14   16   18
          │    │    │    │    │    │    │    │    │    │
FASE 1: FUNDAÇÃO + DIPLOMA DIGITAL
├─ Pessoas + Config    ████
├─ Diploma Digital     ████████
├─ Acervo Digital      ████████
├─ Portal Público           ████
└─ Go-live FIC                  ✓

FASE 2: CORE ACADÊMICO + IA
├─ Financeiro               ████████████
├─ Pedagógico               ████████████
├─ Acadêmico                     ████████████
├─ Portal Professor              ████████████
├─ IA Layer Transversal     ████████████████████
└─ 3-5 Clientes                            ✓

FASE 3: GESTÃO + INTELIGÊNCIA
├─ Matrículas                         ████████████
├─ Captação (CRM)                     ████████████
├─ Relatórios/BI                           ████████████
├─ Portal Aluno                            ████████████
├─ Institutional Intel                     ████████████
└─ 10-15 Clientes                                    ✓

FASE 4: EXPANSÃO + DOMÍNIO
├─ Administrativo                               ████████
├─ Mobile App                                   ████████████
├─ Student Success AI                           ████████████
├─ IES Benchmark Network                             ████████
├─ MEC Compliance Autopilot                          ████████
└─ #1 ERP IA Native do Brasil                              ✓
```

---

## 12. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Atraso na API de assinatura digital | Média | Alto | Testar 3 provedores (BRy, Certisign, Soluti) em paralelo |
| Mudança na regulamentação MEC | Baixa | Alto | Arquitetura flexível; camada de regras separada |
| Custo de IA (tokens) acima do previsto | Média | Médio | Cache agressivo, modelos menores para tarefas simples |
| Dificuldade de venda para IES tradicionais | Alta | Médio | Diploma Digital gratuito como porta de entrada |
| Concorrente lançar IA antes | Baixa | Médio | Velocidade de execução; vantagem de first mover |
| Escalabilidade do Supabase | Baixa | Alto | Arquitetura preparada para migração se necessário |

---

## 13. Próximos Passos Imediatos

1. **Finalizar Diploma Digital** (Fase 1 — em andamento)
2. **Implementar tabelas base** de Pessoas e Configurações
3. **Definir design system** (tokens, componentes, padrões)
4. **Configurar IA Layer** (OpenRouter + pgvector + RAG com docs MEC)
5. **Prospectar 2-3 IES** para piloto do Diploma Digital
6. **Documentar APIs** para futura integração de módulos

---

## Conclusão

> **O Diploma Digital não é um módulo. É a fundação de um ERP que vai redefinir a gestão educacional no Brasil.**

Nossa vantagem não está em lista de features. Está em:

1. **IA Native por design** — não bolt-on, mas genético
2. **Obsessão em compliance MEC** — automação que viabiliza escala
3. **Obsessão em sucesso do aluno** — retenção que cria valor real
4. **Plataforma aberta** — ecossistema, não monolito
5. **Design que pessoas amam** — adoção 2x mais rápida

Com execução disciplinada, em 18 meses teremos: 25-35 clientes ativos, ARR de R$ 1.2-1.8M, e a posição incontestável de **#1 ERP IA Native para Educação no Brasil**.

O mercado existe. A tecnologia existe. O timing é agora.

---

**Elaborado por:** Claude (Opus 4) — Arquiteto-Chefe
**Inputs técnicos:** Buchecha (MiniMax M2.7) — Ordem de módulos e arquitetura
**Pesquisa de mercado:** Agent de pesquisa — 10 concorrentes analisados
**Estratégia de produto:** Product Manager Agent + Software Architect Agent
**Data:** 21 de março de 2026
