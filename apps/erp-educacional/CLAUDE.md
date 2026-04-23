# Projeto Diploma Digital — FIC

## Projeto

**Nome:** Ferramenta de Diploma Digital da FIC
**IES:** Faculdades Integradas de Cassilândia (FIC)
**Dono:** Marcelo Silva (mrcelooo@gmail.com)
**Abordagem:** Caminho Híbrido (core interno + APIs de terceiros para assinatura)
**Status:** Em desenvolvimento - Fase de Planejamento
**Visão Macro:** Este projeto é a BASE de um ERP Educacional completo. O Diploma Digital é o primeiro módulo, mas toda a estrutura de dados (IES, departamentos, cursos, etc.) está sendo construída para suportar o ERP inteiro. Módulos futuros serão implementados em paralelo.

## ⚠️ IDs Supabase canônicos (2026-04-21)

Projetos da organização Supabase — use o correto para cada operação:

| Projeto                   | ID                     | Região    | Conteúdo                                                                                                                     |
| ------------------------- | ---------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **diploma-digital** (ERP) | `ifdnjieklngcfodmtied` | sa-east-1 | **Este repo.** Tabelas `atendimento_*`, `ds_voice_*`, `alunos`, `diplomas`, `role_permissions`, Storage bucket `atendimento` |
| **ECOSYSTEM**             | `gqckbunsfjgerbuiyzvn` | us-east-2 | Memória cross-projeto (`ecosystem_memory`), credenciais compartilhadas, EFs dual-write                                       |
| **Intentus**              | `bvryaopfjiyxjgsuhjsb` | us-west-2 | Negócio separado (imobiliário) — **não mexer daqui**                                                                         |
| **jarvis-pessoal**        | `nasabljhngsxwdcprwme` | us-east-2 | Jarvis app do Marcelo                                                                                                        |

**Regra de ouro:** migrations do módulo Atendimento vão em `ifdnjieklngcfodmtied`. Memória de sessão vai em `gqckbunsfjgerbuiyzvn`.

## Termos Rápidos

| Termo          | Significado                                              |
| -------------- | -------------------------------------------------------- |
| **FIC**        | Faculdades Integradas de Cassilândia                     |
| **RVDD**       | Representação Visual do Diploma Digital (PDF visual)     |
| **XAdES**      | XML Advanced Electronic Signature (padrão de assinatura) |
| **ICP-Brasil** | Infraestrutura de Chaves Públicas Brasileira             |
| **XSD**        | XML Schema Definition (estrutura obrigatória dos XMLs)   |
| **AD-RA**      | Assinatura Digital com Referência de Arquivamento        |
| **A3**         | Tipo de certificado digital (obrigatório, não aceita A1) |
| **Buchecha**   | MiniMax M2.7 — Líder de codificação / Senior Developer   |
| **DeepSeek**   | DeepSeek V3.2 — Especialista em lógica e debugging       |
| **Qwen**       | Qwen3-Coder 480B — Especialista frontend/React           |
| **Kimi**       | Kimi K2.5 — Especialista em bugs/fixes                   |
| **Codestral**  | Codestral (Mistral) — Especialista multi-linguagem       |

## Arquitetura do Diploma Digital

3 XMLs obrigatórios:

1. **DocumentacaoAcademicaRegistro** — dados privados + rito de emissão
2. **HistoricoEscolarDigital** — histórico escolar completo
3. **DiplomaDigital** — dados públicos (o que o diplomado recebe)

## Módulos Planejados

| Módulo                       | Status                   |
| ---------------------------- | ------------------------ |
| Painel Administrativo (Web)  | Pendente                 |
| Motor de Geração XML         | Pendente                 |
| Módulo de Assinatura Digital | Pendente (API terceiros) |
| Gerador de RVDD (PDF)        | Pendente                 |
| Repositório Público (HTTPS)  | Pendente                 |
| Portal do Diplomado          | Pendente                 |

## Stack Técnica

| Componente     | Tecnologia                             |
| -------------- | -------------------------------------- |
| Backend        | A definir (Node.js/TS ou Python)       |
| Frontend       | A definir (Next.js/React)              |
| Banco de Dados | PostgreSQL (Supabase)                  |
| Geração XML    | Biblioteca XML nativa + validação XSD  |
| Geração PDF    | A definir (Puppeteer, PDFKit)          |
| Assinatura     | API terceiros (BRy, Certisign, Soluti) |
| Hospedagem     | Vercel + Supabase ou Cloudflare        |
| Armazenamento  | Cloudflare R2 ou Supabase Storage      |

## Time de IAs — Workflow de Desenvolvimento

### Hierarquia

- **Claude (Opus 4):** Arquiteto-chefe e orquestrador. Planeja, delega, revisa e integra o trabalho das demais IAs.

### Squad de Desenvolvimento

| IA                     | Modelo                        | Papel                                   | Escopo Principal                                                                                 |
| ---------------------- | ----------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Buchecha (MiniMax)** | MiniMax M2.7                  | Líder de codificação / Senior Developer | Gerência geral do código, code review, geração em massa, testes, implementação paralela          |
| **DeepSeek**           | DeepSeek V3.2 (deepseek-chat) | Especialista em lógica                  | Raciocínio complexo, debugging profundo, lógica de banco de dados, algoritmos                    |
| **Qwen**               | Qwen3-Coder (480B)            | Especialista frontend/React             | Código frontend, React/Next.js, agentic coding, tool use, raciocínio sobre repositórios inteiros |
| **Kimi**               | Kimi K2.5                     | Especialista em bugs/fixes              | Resolver bugs reais, entender codebases grandes, gerar fixes corretos                            |
| **Codestral**          | Codestral (Mistral)           | Especialista multi-linguagem            | Code completion, código idiomático, múltiplas linguagens                                         |

### Plugins Habilitados

- `minimax-ai-assistant` — Buchecha (líder)
- `deepseek-ai-assistant` — DeepSeek (lógica/debug)
- `qwen-ai-assistant` — Qwen (frontend/React)
- `kimi-ai-assistant` — Kimi (bugs/fixes)
- `codestral-ai-assistant` — Codestral (multi-lang)

### Como usar o time

- Claude orquestra e delega tarefas para cada IA conforme a especialidade
- Buchecha (MiniMax) é sempre consultada para code review e decisões técnicas gerais
- DeepSeek para problemas de lógica, queries SQL complexas, debugging
- Qwen para tudo que é React/Next.js/frontend
- Kimi quando há bugs difíceis de resolver
- Codestral para code completion e refatoração idiomática
- **Auto-save:** Cada sessão salva automaticamente em memory/sessions/

## Regulamentação

- Portaria MEC 554/2019 (marco original)
- Portaria MEC 70/2025 (ampliação + novos prazos)
- IN SESU/MEC 1/2020 e 2/2021 (requisitos técnicos)
- **Prazo graduação:** 1 jul 2025 (já vencido — urgente!)
- XSD vigente: v1.05

## Sistema de Rastreabilidade (Masterplan → Sprint → Sessão)

### FASE B — Supabase como memória primária (ativo desde 14/04/2026)

**Início de sessão (obrigatório):**
Chamar `bootstrap_session()` via Supabase MCP ANTES de qualquer trabalho:

```sql
select bootstrap_session(
  '[descrever a tarefa desta sessão em 1 frase]',
  'erp',
  15
);
```

A função retorna automaticamente as memórias mais relevantes (feedbacks, decisões, contexto, status de sprints). **Não é mais necessário ler TRACKER.md ou arquivos de sprint manualmente** — o Supabase filtra o que importa para aquela sessão específica.

**Fallback (Supabase indisponível):**

1. `memory/TRACKER.md` → estado atual, % por sprint (~500 tokens)
2. Sprint ativo em `memory/sprints/` → escopo desta sessão (~1.500 tokens)

**Encerramento (7 passos):**

1. Salvar sessão com backlinks (masterplan→sprint→epic) em `memory/sessions/`
2. Atualizar sprint (✅ itens, registrar sessão)
3. Atualizar TRACKER.md (%, última/próxima sessão) — manter sync manual
4. **INSERT no Supabase ECOSYSTEM (PRIORITÁRIO — fazer ANTES dos arquivos locais)** via `mcp__05dc4b38-c201-4b12-8638-a3497e112721__execute_sql` no projeto `gqckbunsfjgerbuiyzvn` com `project='erp'`
5. Atualizar MEMORY.md (rotacionar entradas, manter índice limpo)
6. Atualizar CENTRAL-MEMORY.md
7. Indicar próxima sessão se pré-planejada

**Automações:**

- `daily-cross-memory-sync` (diária 5h) — sync dados + TRACKER
- `plan-audit` (dom/seg/qua/sex 9h30) — cruzar plano×execução → PENDENCIAS.md
- `weekly-memory-review` (domingo 13h30) — limpeza e consolidação

## Supabase ECOSYSTEM — Memória Online (DUAL-WRITE)

**Projeto:** `gqckbunsfjgerbuiyzvn` (us-east-2) — NUNCA confundir com:

- **ERP / diploma-digital:** `ifdnjieklngcfodmtied` (sa-east-1) — tabelas `atendimento_*`, `ds_voice_*`, `alunos`, `diplomas` etc.
- **Intentus:** `bvryaopfjiyxjgsuhjsb` (us-west-2) — negócio separado (imobiliário), não mexer daqui
  **Regra:** Toda memória nova vai para AMBOS os lugares — arquivo local (.md) E Supabase.
  **Fonte da verdade:** Supabase é primário. Arquivos locais são cache/backup.

**Como inserir memória nova (usar no passo 7 do encerramento):**

```sql
insert into ecosystem_memory (type, title, content, project, tags, success_score) values
('feedback' | 'decision' | 'context' | 'project' | 'reference',
 'Título da memória',
 'Conteúdo detalhado...',
 'erp',
 ARRAY['tag1', 'tag2'],
 0.85
);
```

**Tipos de memória:**

- `feedback` — regras, anti-padrões, lições aprendidas
- `decision` — decisões arquiteturais tomadas
- `context` — estado atual do projeto, regulamentação, stack
- `project` — status de sprints, módulos, entregas
- `reference` — URLs, IDs, endpoints, caminhos

## Referências

- **TRACKER (ponto de entrada):** `memory/TRACKER.md`
- Masterplan: `memory/masterplans/diploma-digital-v4.md`
- Sprints: `memory/sprints/`
- Pendências: `memory/PENDENCIAS.md`
- Briefing completo: `BRIEFING-DIPLOMA-DIGITAL-FIC.md`
- Projeto detalhado: `memory/projects/diploma-digital.md`
- Contexto regulatório: `memory/context/regulamentacao.md`
- Sessões: `memory/sessions/`

## Preferências do Marcelo

- Iniciante em programação — passo a passo detalhado
- Quer ver todas as possibilidades antes de decidir
- Salvar sessões automaticamente (sem precisar pedir)
- Time de 5 IAs especializadas trabalhando em squad (ver seção "Time de IAs")

## Diretriz Fundamental

- O sistema Aluno Digital é APENAS REFERÊNCIA visual/funcional
- NÃO estamos copiando — estamos criando nosso próprio modelo
- Contrataremos nossas próprias APIs (assinatura, etc.)
- Toda a arquitetura, banco, e código são NOSSOS, do zero
- O time de IAs (Buchecha, DeepSeek, Qwen, Kimi, Codestral) DEVE ser usado ativamente conforme especialidade
- **SISTEMA 100% IA NATIVE** — IA integrada em toda experiência do usuário:
  - Assistente IA no painel admin (ajuda contextual, preenchimento inteligente)
  - Auto-preenchimento de campos via IA (ex: buscar dados por CNPJ, CEP)
  - Sugestões inteligentes durante cadastro
  - Validação com feedback em linguagem natural
  - Copiloto para geração de XML e revisão de dados
  - Chat assistente para tirar dúvidas sobre o processo
