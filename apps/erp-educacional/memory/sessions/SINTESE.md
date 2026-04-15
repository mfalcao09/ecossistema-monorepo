# SÍNTESE — ERP-Educacional / Diploma Digital FIC

> Consolidação das sessões por blocos temáticos.
> Última atualização: 2026-04-15 (95 sessões — sync automático 15/04/2026).
> Masterplan ativo: v4.0 (6 Sprints, ~204h). Sprint 1 ✅ COMPLETO, Sprint 2 E2.1 ✅ COMPLETO (s058-081 polish).
> s085-090: Módulo Atendimento — S1 schema+UI (085), análise Nexvy (086-088), Webhook WABA validado E2E (089-089b), Tela de Conversas 3 painéis (090).
> s091: Hotfixes ERP — cadastro usuários (CSRF+Roles+Senha), título do site.
> s092: S-03 Régua de Cobrança Completa (migration 3 tabelas + 6 endpoints Python; commit 1f27208).
> s093: Pipeline end-to-end diagnóstico — 11 gaps, plano S6–S9 aprovado, 4 decisões confirmadas.
> s094: 🎉 Sprint 6 — Acervo Digital COMPLETO (RPC DDC automático + PDF/A + AbaComprobatoriosMec; commit d76b639).
> s095: 🎉 Sprint 7 — Pacote Registradora COMPLETO (HUB Signer BRy + ZIP binário + webhook bry-assinatura-pdf; commit 817c47e).

## Bloco 1: Fundação (Sessões 001–004) — 19/03/2026

**O que foi construído:**
- Pesquisa completa sobre diploma digital (regulamentação, padrões, XSD)
- Briefing completo do projeto (`BRIEFING-DIPLOMA-DIGITAL-FIC.md`)
- Decisão: abordagem híbrida (core interno + APIs de terceiros)
- Análise detalhada do sistema Aluno Digital (139 frames, 3 templates DOCX, 1 template email)
- Stack definida: Next.js 14 + TypeScript + Tailwind + Supabase
- 15 tabelas modeladas (Claude + MiniMax em parceria)
- Supabase project criado (`ifdnjieklngcfodmtied`, sa-east-1)
- Vercel configurado com auto-deploy
- 3 migrations executadas, banco operacional
- Next.js 14 project gerado e deployado

**Decisões importantes:**
- Abordagem híbrida (não full SaaS, não manual)
- 3 XMLs obrigatórios: DocumentacaoAcademicaRegistro, HistoricoEscolarDigital, DiplomaDigital
- PDF/A (arquivamento) e não PDF/X-1a (impressão)
- ICP-Brasil A3 obrigatório (não aceita A1)
- Aluno Digital como REFERÊNCIA, nunca como cópia

## Bloco 2: IA Native (Sessões 005–006) — 19/03/2026

**O que foi construído:**
- Diretriz "100% IA Native" aprovada pelo Marcelo
- `AIAssistant.tsx` — componente de chat contextual flutuante
- `SmartCNPJInput.tsx` — auto-busca CNPJ via BrasilAPI
- `SmartEMECInput.tsx` — busca E-MEC com fallback IA
- Módulo de Configuração completo (4 arquivos)
- Módulo de Cursos CRUD completo
- Sistema de feedback visual (verde/roxo/amarelo)

**Decisões importantes:**
- IA em TODAS as telas (não opcional)
- SmartInputs como padrão para qualquer campo que possa ser auto-preenchido
- Cores de feedback: verde = real, roxo = sugestão IA, amarelo = manual

## Bloco 3: Expansão ERP (Sessão 007) — 20/03/2026

**O que foi construído:**
- Transformação de app de diploma → ERP multi-módulo
- Home com grid de 6 módulos (launcher)
- Sidebar navigation redesenhada por módulo
- Layout groups: `(erp)`, `(auth)`, `(portal)`
- Módulo Diplomados adicionado

**Decisões importantes:**
- ERP completo desde o início (não apenas diploma)
- 6 módulos planejados: Cadastro, Diploma, Acadêmico, Financeiro, Comercial, Biblioteca
- Cores por módulo na sidebar

## Bloco 4: UI/UX (Sessão 008) — 21/03/2026

**O que foi construído:**
- Login redesenhado com dark card + banner/logo do Supabase Storage
- Sistema de cores dinâmico via CSS custom properties + ThemeProvider
- Dark mode completo (`darkMode: 'class'`)
- TopBar aumentada (72px)
- Bug circular CSS resolvido (ver debugging.md)

## Bloco 5: Bug Fixes + Estabilização (Sessão 009) — 22/03/2026

**O que foi corrigido:**
- Bug timezone -1 dia (timestamptz + UTC-3)
- Bug null fields (Next.js fetch cache)
- `cache: 'no-store'` aplicado em 3 clients Supabase
- `force-dynamic` em route handlers sensíveis
- Página de verificação reconstruída

## Bloco 6: Conformidade + Auditoria (Sessão 010) — 26/03/2026

**O que foi feito:**
- Revisão de evolução (40+ deploys entre sessões)
- Fix TypeScript Zod type inference
- Auditoria completa XSD v1.05 → 19 itens a corrigir
- 65 tabelas confirmadas no banco

**Status XSD:** 19 itens pendentes de conformidade (documentado em relatório)

## Squad Init (21/03/2026)

- 5 servidores MCP configurados (Qwen, Kimi, Codestral, DeepSeek, MiniMax)
- SDKs corrigidos e testados
- Tarefa agendada para inicialização diária

## Bloco 7: Migração Caminho 2 + UX (Sessão 011) — 05/04/2026

**O que foi construído:**
- page.tsx reescrita: 2354→270 linhas (lista-only com métricas, busca, filtros)
- [id]/page.tsx como página unificada (upload, IA, form, save, confirm)
- API rascunho (POST/PUT/GET) com dados_rascunho JSONB
- Feedback visual ao salvar (toast verde sucesso / vermelho erro)
- Botão "Exportar PDF" com todas as seções (window.print client-side)
- Migração em lote deprecada (410 Gone)
- Prop readOnly cascadeada em 11 seções

**Decisões importantes:**
- Caminho 2 escolhido: toda lógica no [id], lista é só lista
- Upload/IA reprocessing ficam como stubs para próxima sessão

**Deploys:** d1637b4, cce7c20, de3fe43 — todos READY

## Bloco 8: Agentes IA + Plano Skills/RAG (Sessão 012) — 05/04/2026

**O que foi construído:**
- 3 agentes dedicados de cadastro (aluno, professor, colaborador) em produção
- API /api/ia/chat agora roteia por categoria → funcionalidade do agente
- AssistenteChat.tsx com saudação dinâmica por tipo de vínculo
- Contexto dinâmico (campos, docs, instituição) injetado automaticamente

**O que foi planejado e aprovado:**
- Plano unificado Skills + RAG (Caminho 2 + Caminho 4) — `docs/PLANO-SKILLS-RAG-IA-NATIVE.md`
- 4 tabelas novas: ia_skills, ia_agente_skills, ia_skill_chunks, ia_skill_feedback
- pgvector para embeddings, busca híbrida 70% semântica + 30% keyword
- 10 skills iniciais mapeadas
- 4 fases: Fase 1 (concluída), Fase 2 (Skills Fixas), Fase 3 (RAG), Fase 4 (Feedback)

**Decisões importantes:**
- Claude Sonnet 4.5 via OpenRouter para agentes de cadastro (temp 0.4)
- Persona vem do banco (ia_configuracoes), não mais hardcoded
- Skills fixas (sempre injetadas) + Skills RAG (sob demanda via pgvector)
- text-embedding-3-small (1536 dims) para embeddings

**Deploy:** 5196547 — READY

## Bloco 9: Skills RAG — Entendimento + Import MD (Sessão 013b) — 05/04/2026

**O que foi feito:**
- Explicação completa do pipeline RAG: SQL bypass → sem embeddings → reindex-all necessário
- Decisão: trabalhar cada skill com Marcelo antes de importar
- Implementação do botão "Importar .md" no painel Skills (`SkillsManager.tsx`)
  - `parseMdFile()` extrai nome (H1), slug (auto), descricao (primeiro parágrafo), conteudo (tudo)
  - Abre `ModalSkill` pré-populado e editável
  - Ao salvar: `POST /api/ia/skills` → `indexarSkill()` → embeddings automáticos
- Commit `6b37a531` → Vercel READY

**Decisões importantes:**
- Opção B escolhida: import .md apenas, sem modificações adicionais
- "Não modifique mais nada para que possamos fazer juntos"
- 10 skills existentes ficam sem embeddings até que conteúdo seja revisado com Marcelo
- Cada skill será revisada individualmente, exportada como .md, importada via painel

**Deploy:** `6b37a531` — READY

## Bloco 10: Dupla Checagem — Debug e Remoção (Sessão 014) — 05/04/2026

**O que foi feito:**
- Debug profundo da feature "Dupla Checagem com IA" que retornava REPROVADO 30% genérico
- Identificada causa raiz: modelo `gemini-3.1-pro-preview` (inválido) no banco → resposta vazia/safety block → parsing falhava em todas as 3 estratégias
- Feature removida por completo após múltiplas tentativas de fix
- Upload de documentos mantido (independente da Dupla Checagem)

**Decisões importantes:**
- Modelo Gemini correto em abr/2026: `gemini-2.5-flash` (suporta `responseMimeType: application/json`)
- `responseMimeType` só deve ser usado com modelos compatíveis
- Quando feature crítica falha repetidamente, remover é melhor que insistir

**Commit:** `a4b0a81` (remoção)

## Bloco 11: Timbrado Real no Relatório (Sessão 015) — 05/04/2026

**O que foi feito:**
- Tentativa 1 (descartada): faixas CSS tricolores com gradientes
- Solução final: `TimbradoSISTEMA.png` (já em `/public`) como fundo fixo da página
- `position:fixed; z-index:-1; width:100%; height:100%; object-fit:fill`
- Padding calibrado: tela `170px 50px 130px`, print A4 `53mm 20mm 38mm` com `@page { margin: 0; size: A4; }`
- CSS antigo das classes `.timbrado-*` totalmente removido

**Workaround:** Clone em `/tmp` para contornar `index.lock` do FUSE

**Commit:** `b7f6cb0` READY

## Bloco 12: Bug ENADE (Sessão 016) — 05/04/2026 (noite)

**O que foi corrigido (2 bugs sobrepostos):**
- **Bug 1 (backend):** POST `/api/processos` não inseria dados ENADE em `diploma_enade` → Seção 8.5 adicionada + rollback
- **Bug 2 (frontend):** Stale closure em 2 `setState` sequenciais → segunda chamada sobrescrevia a primeira
- **Fix:** `setRevisao((prev) => ({ ...prev, [field]: value }))` — functional setState
- Todas as funções de área atualizadas para padrão `prev =>`

**Commits:** `23ba614` (backend ENADE) + `780d906` (stale closure)

## Bloco 13: Fix Criação de Processo + Timezone (Sessão 017) — 05/04/2026

**O que foi corrigido (4 bugs em cascata na criação de processo):**
- **Bug 1:** Zod rejeitava `null` em campos opcionais → adicionado `.nullable()` em 4 campos (turno, periodo_letivo, data_colacao, obs)
- **Bug 2:** Frontend `throw new Error("Erro ao criar processo")` ocultava causa real → parse do `res.json()` e exibição do erro real
- **Bug 3:** `DuplaChecagemDialog` removido mas re-importado no build → re-push do componente
- **Bug 4:** `diploma_disciplinas.codigo` NOT NULL → fallback `DISC-{idx}` para codigo, `'aprovado'` para situacao
- **Fix timezone datas:** `T12:00:00` noon UTC em `formatDate()` de 3 arquivos (diplomas/[id], acervo/digitalizar/[id], acervo/mec)

**Padrão confirmado:** Toda data pura (YYYY-MM-DD) DEVE usar `T12:00:00` antes de `new Date()`. Timestamps completos podem usar `new Date()` direto.

**Commits:** `cbf012c` + `b6da7d9`

## Bloco 14: Exclusão Diploma Duplicado (Sessão 018) — 05/04/2026

**O que foi feito:**
- Exclusão do diploma `19f02bb9-8afc-48f9-9d3d-e645be201ac1` (duplicado do diplomado `b0d7b7ef`)
- Hard-delete justificado (rascunho vazio, 0 disciplinas/logs/estágios/ENADE, sem audit trail relevante)
- Verificação de 7 tabelas dependentes antes do DELETE

**Decisão:** Hard-delete permitido APENAS para rascunhos vazios sem dados dependentes. Regra geral (soft-delete com `deleted_at`) mantida.

## Bloco 15: Fix Timezone (Sessão 019) — 05/04/2026

Sessão duplicada de refinamento do fix de timezone do bloco 13. Mesmos arquivos e mesmo padrão `T12:00:00` noon UTC. Reforça o padrão como regra permanente do projeto.

## Bloco 16: Sessão Cross-Project — 05/04/2026

**O que foi feito:**
- Diagnóstico das skills no Cowork (12 instaladas no Finder, invisíveis no Cowork)
- Cópia de 10 skills customizadas para `.claude/skills/` dos projetos (ERP: 10, Intentus: 7)
- Diretriz obrigatória: Claude DEVE indicar e usar skills antes de cada tarefa
- Mapa de skills por contexto em `preferences.md` (ERP: 26 contextos, Intentus: 30 contextos)
- Criação dos arquivos centrais em `/Users/marcelosilva/Projects/GitHub/`:
  - `ONBOARDING-KIT.md` (~11KB)
  - `CENTRAL-MEMORY.md` (~8KB)
  - `PROTOCOLO-MEMORIA.md` (~6KB)
- Regra "vou encerrar" = salvamento completo em 5 arquivos

**Decisões importantes:**
- `.claude/skills/` global é read-only no Cowork → skills de projeto vão em `{projeto}/.claude/skills/`
- Arquivos centrais ficam APENAS em `/GitHub/` (cópia única, sem duplicação nos projetos)

## Bloco Motor XML — Ondas de Hardening (Sessões 020–022) — 06–07/04/2026

**O que foi construído:**
- **Sessão 020 (#7/#2/#12):** hardening `.trim()` em prefixo SHA256 + RPC `persistir_timestamp_historico` write-once-then-frozen com SELECT FOR UPDATE. Commit `1802e3e`.
- **Sessão 021 (#1/#11):** `codigo_validacao` removido (é da registradora) + `Assinantes` builder novo (TInfoAssinantes, whitelist 8 cargos do enum, fallback `<OutroCargo>`). Commit `0c25a58` que também subiu o motor v2 inteiro (15+ arquivos que estavam untracked).
- **Sessão 022 (#G/#H + Override Humano):**
  - **#G** — Tabela `atos_curso` espelhando `credenciamentos` + backfill idempotente + `buscarAtosCurso()` + padrão `tabela ?? fallback_planos` no montador.
  - **#H** — Centralização de regras em `validation/regras-negocio.ts` (`REGRAS_NEGOCIO` enum + `ValidacaoNegocioError`) + API 422 estruturado + Modal React com justificativa ≥10 chars por violação + auditoria universal `validacao_overrides`.
  - Commit `2518ed3`, deploy `dpl_7mgBX54PMUEczE3JsPxUzP3fJQzJ` READY.
- Onda 1 paralela (#A/#B/#C/#D), Bug #E (DataExpedicaoDiploma via helper) também finalizados nesta janela.

**Decisões importantes:**
- **Princípio do Override Humano Universal:** A confirmação humana pode sobrescrever qualquer regra de negócio do ERP, com justificativa ≥10 chars auditada. Tabela `validacao_overrides` é genérica e reutilizável por qualquer módulo (financeiro, acadêmico, regulatório) — não é exclusiva do motor XML.
- **Justificativa ≥10 chars como CHECK constraint** — frontend não pode desabilitar.
- **Padrão `tabela_dedicada ?? fallback_planos`** — migração gradual sem big-bang; cursos legados continuam funcionando.
- **Dynamic `await import()`** dentro de função — padrão para módulos de validação que dependem do mesmo arquivo que os instancia (evita ciclo circular).
- **Status final do motor XML:** 11 de 12 bugs resolvidos (~92%). Único pendente: **#F (Documento PDF/A em base64)** — sub-projeto de 2-4 dias, sessão dedicada.

## Bloco Bug #F + Comprobatórios (Sessões 023–024) — 07/04/2026

**O que foi construído:**
- **Sessão 023:** Infra Bug #F — tabela `diploma_documentos_comprobatorios` + bucket `documentos-pdfa` + enums. Ghostscript no Railway escolhido para conversão PDF/A. Commit `139b5d5`.
- **Sessão 024:** Bug #F Caminho B (5 commits incrementais) — `converter-service.ts` producer-only, `gerarXMLs` overload, consumer em `gerar-xml`, tela React `SelecaoComprobatorios.tsx` (808 linhas), migrações DDL sincronizadas. Motor XML 12/12 (100%). Commits `ee6ec62` +4.

**Decisões importantes:**
- Ghostscript Railway para conversão PDF/A (não Docker local)
- Padrão "Caminho B" (commits incrementais) para features grandes
- Tela `SelecaoComprobatorios` com seleção manual de docs para XML/Acervo

## Bloco Git Ops + Design + RLS (Sessões 025–028) — 07–08/04/2026

**O que foi feito:**
- **Sessão 025:** Planejamento fluxo novo processo (design v2 com drag-and-drop → extração → revisão → criar processo)
- **Sessão 026:** Implementação do design consolidado (sessão com push travado por FUSE)
- **Sessão 027:** Push destravado via clone em `/tmp` + PAT v3 bind mount. Commit `fb8d07c` em produção (deploy READY).
- **Sessão 028:** Hardening RLS — 5 achados fechados: `processo_arquivos` com RLS ON, policies `USING(true)` eliminadas, `search_path` fixo. Commit `b0a38d7`.

**Decisões importantes:**
- Fluxo aprovado: drag-and-drop → extração → revisão pós-extração com gate de comprobatórios → criar processo
- Clone em `/tmp` é workaround canônico para FUSE/bindfs
- RLS canônico: `auth.uid() IS NOT NULL` (nunca `USING(true)`)

## Bloco Backend Extração Railway (Sessões 029–030) — 08/04/2026

**O que foi construído:**
- **Sessão 029:** Backend completo — rota POST `/extrair-documentos` live no Railway com Gemini 2.5 Flash fire-and-forget + SSRF guards + timeouts. API Next.js: POST `/api/extracao/iniciar` + PUT `/callback` com nonce 1-uso. Commits `5c6bf66`, `f9739e46`.
- **Sessão 030:** UI loop completo — Tela 1 react-dropzone + Tela 2 polling + bucket `processo-arquivos`. Deploy READY ~80s. Commit `5e5e2e9`.

**Decisões importantes:**
- Railway como microserviço de extração (não Edge Function — precisa de > 10s)
- Nonce 1-uso no callback para prevenir replay attacks
- Polling com Supabase Realtime + setTimeout encadeado como fallback

## Bloco Resiliência Tela 2 (Sessões 031–039) — 08–09/04/2026

**O que foi corrigido (7 sessões de hardening):**
- **Sessão 031:** Paralelização Railway 4x inline + TIMEOUT_MS 5→7min. Commit `e0acf69`.
- **Sessão 032:** Bug callback 307 — middleware do portal bloqueava PUT. Bypass explícito. Commit `6735f4b`.
- **Sessão 033:** DB Write Direto — Railway grava em `extracao_sessoes` via service_role, callback HTTP eliminado. Commit `3bccb3c`.
- **Sessão 034:** Tela 2 polling resiliente — Realtime + visibilitychange + setTimeout encadeado + Gemini retry backoff 503. Commit `db9e00d`.
- **Sessão 035:** Causa raiz "Failed to fetch" era 504 no GET sessão — split lite/heavy. Commit `1869807`.
- **Sessão 036:** Bug residual — fetch pendente infinito no cold start. AbortController 12s. Commit `6ed2db6`.
- **Sessão 037:** AbortController 12s abortava heavy fetch antes do maxDuration 30s. Fix: 12→35s + backoff. Commit `13fb0ea`.
- **Sessão 038:** Fix definitivo 504s — 6 queries sequenciais→2 passos paralelos no GET sessões. Commit `2bcfb8c`.
- **Sessão 039:** 🔑 CAUSA RAIZ REAL — conflito `[id]` vs `[sessaoId]` no App Router crashava 100% das invocações. Commit `935935d`.

**Decisões importantes:**
- DB Write Direto (Railway→Supabase) substituiu callback HTTP
- NUNCA misturar nomes de segmentos dinâmicos no mesmo nível
- AbortController com timeout > maxDuration da API

## Bloco Formulário Revisão + Extração IA (Sessões 041–048) — 09–10/04/2026

**O que foi construído:**
- **Sessão 041:** FormularioRevisao reescrito — enums XSD v1.05 corretos + UI Tela 3 + filiação dinâmica + ENADE. Commit `8d322b4`.
- **Sessão 042:** Prompt Gemini expandido (+RG, sexo, disciplinas, ENADE, genitores) + agregação com dedup. Commit `9117ded`.
- **Sessão 043:** Gate comprobatórios 3 estados (pendente/detectado/confirmado) + dialog preview + mapeamento Gemini→XSD. Commit `5c29bdd`.
- **Sessão 044:** Prompt Gemini revisado (tabela fixa 14 tipos + confiança obrigatória) + DialogSelecionarArquivo vinculação manual. Commit `30e2d51`.
- **Sessão 045:** Fix build TS (null→undefined em href) + preview blob URL + prompt disciplinas 65k tokens. Commits `c631432`, `9d80e02`.
- **Sessão 046:** RPC `converter_sessao_em_processo` — fecha loop Tela 2→Criar Processo. Commit `71d619c`.
- **Sessão 047:** Fix gate false positives (3 causas: diplomado→aluno, nome_completo→nome, destino_xml filter) + iframe PDF preview. Commits `044bf49`, `5474b5d`.
- **Sessão 048:** Prompt v3 gavetas tipadas + consolidarDados() Reducer relacional + UI conceito/integralização. Commit `5d7ea69`.

**Decisões importantes:**
- Prompt v3 com gavetas tipadas (1 gaveta por tipo de doc)
- Reducer relacional para correlação cross-doc (docente↔disciplina↔titulação)
- Gate FIC: 4 comprobatórios mínimos (RG, Histórico EM, Cert Nasc/Casamento, Título Eleitor)

## Bloco Fixes + PII Crypto (Sessões 049–055) — 11/04/2026

**O que foi feito:**
- **Sessão 049:** Fix "Processando 0 arquivos" — API lite retornava `arquivos:[]` em vez do JSONB real. Commit `5d7b4ef`.
- **Sessão 049b:** Fix gate `tipo_xsd` desincronizado — confirmações não gravavam `tipo_xsd` no banco. Commit `eb5561b`.
- **Sessão 051:** Auditoria MASTERPLAN v3→v4 (17 erros corrigidos). MASTERPLAN v4 aprovado como versão canônica.
- **Sessão 052:** Epic 1.1 PII Crypto — Migration HMAC-SHA256 + AES-256 + 4 rotas migradas + rota admin `/migrar-pii`. Commit `48006a4`. Também: fix preview PDF/imagem nos dialogs — proxy server-side. Commit `6c06897`.
- **Sessão 053:** Fix naturalidade campo único→3 campos XSD (Município, Código IBGE 7 dígitos, UF) + auto-preenchimento IBGE. Commit `0a1cacf`.
- **Sessão 054:** Fix gate `tipo_xsd` confirmações não gravavam no banco. Commit registrado.
- **Sessão 055:** Epic 1.1 PII Crypto COMPLETO — deploy + fix middleware/RLS/rg + migração 158/158 diplomados em produção. Commits `a4b263e`, `50b9029`, `072a78a`.

**Decisões importantes:**
- MASTERPLAN v4 é versão canônica (v3 descartado)
- Proxy server-side para Supabase Storage (nunca fetch cross-origin do browser)
- PII Crypto: HMAC-SHA256 para busca + AES-256 para reversibilidade

## Bloco Sprint 1 Segurança + E2.1 Fechamento (Sessões 056–058) — 11/04/2026

**O que foi feito:**
- **Sessão 056:** Epic 1.2 Vault (PII key migrada para Supabase Vault) + Epic 1.3 Railway Security (audit trail + rate limiter).
- **Sessão 057:** Epic 1.4 Hard Lock Jurídico — trigger imutabilidade `fn_hard_lock_diploma` + unlock windows temporárias. **Sprint 1 Segurança 100% COMPLETO.**
- **Sessão 058:** Teste e2e `converter_sessao_em_processo` — 4 bugs encontrados e corrigidos (normalizar_uf, rg_orgao, ENADE derivação, check constraint). RPC v2. Commit `8275d16`. **Epic 2.1 100% COMPLETO.**
- **Sessões 059-063:** BRy integration (E2.2) + polish E2.1 — página assinaturas, normalização enums, fix gate, FormularioRevisao 12 seções + PDF export. Commit `2fd21c3`. Deploy READY.

**Decisões importantes:**
- `normalizar_uf()` centralizado no banco (27 estados BR com variantes de acento)
- ENADE: derivação automática de `situacao` a partir de `habilitado`/`condicao`
- Check constraint de sessão expandido para 10 status (todo o ciclo de vida)
- **FormularioRevisao** é o formulário canônico pós-extração; formulário antigo (`/diploma/processos/[id]`) a ser removido
- RPC `converter_sessao_em_processo`: COALESCE em chave docente para retrocompatibilidade

## Bloco Polish E2.1 (Sessões 064–069) — 11/04/2026

**O que foi feito:**
- **Sessão 064:** 6 ajustes UI — Dados Processo simplificado, disciplinas agrupadas+editáveis, campos extras, assinantes read-only, checkboxes XML/acervo no Dialog. Commit `ea74208`.
- **Sessão 065:** Fix "Diplomando não identificado" → exibir CPF+NOME no card de extração. Commit `805d6b1`.
- **Sessão 066:** Botão "Substituir Arquivo" no dialog + Excluir importação/extração com `window.confirm` → `POST /api/extracao/sessoes/[id]/descartar`. Commit `444207c`.
- **Sessão 067:** Normalização de períodos com `normalizarPeriodo()` (1º→1, "Primeiro"→1) + labels semestre editáveis + botão "Padronizar todos".
- **Sessão 068:** Fix assinantes auto-load via `/api/assinantes` + fix confiança 0%→97% via RPC retrofix no Supabase.
- **Sessão 069:** Fix banner recovery persiste após descartar — causa: servidor retorna `null` mas código caía em localStorage fallback. Fix: null do servidor → limpa localStorage; localStorage só é fallback quando fetch falha. Commit `6d07657`. Auditoria banco: 22 sessões, todas `status=descartado` com `finalizado_em`.

**Decisões importantes:**
- localStorage de recovery é fallback de ÚLTIMO RECURSO (só quando fetch falha), não alternativa ao null do servidor
- Descartar → limpar localStorage antes de redirect (evita flash do banner)
- Formulário antigo (`/diploma/processos/[id]`) marcado para remoção na sessão 070

## Classificação de Sessões por Sprint (Masterplan v4)

| Sprint | Sessões | Status |
|--------|---------|--------|
| Pré-Masterplan (Fundação) | 001-019 + cross + squad-init | ✅ Base construída |
| Sprint 1 — Segurança | 028, 051-052, 055-057 | ✅ COMPLETO (4/4 Epics) |
| Sprint 2 — Motor + Assinatura | 020-027, 029-039, 041-054, 058-076 | 🔄 E2.1 ✅, E2.2 bloqueado (BRy), E2.3-2.4 pendentes |
| Sprint 3 — RVDD + Portal | — | 🔲 Não iniciado |
| Sprint 4 — Compliance MEC | — | 🔲 Não iniciado |
| Sprint 5 — Backup + Expedição | — | 🔲 Não iniciado |
| Sprint 6 — Observabilidade | — | 🔲 Não iniciado |

## Números Consolidados

| Métrica | Valor |
|---------|-------|
| Sessões | 76 + cross + squad-init |
| Tabelas no banco | 67+ (+ development_zoneamento? pendente) |
| Enums | 9+ |
| Diplomas (dados) | 157+ |
| Diplomados (dados) | 158 (100% com PII criptografado) |
| Permissões RBAC | 175 |
| Registros audit_log | 4.282+ |
| API Routes | 45+ |
| SmartInputs IA | 4 |
| Deploys Vercel | 90+ |
| Bugs motor XML | 12/12 resolvidos |
| Commits Sprint 2 E2.1 | 50+ |
| SQL migrations aplicadas | 65+ |

## Bloco Auditoria XSD + Refatoração Arquitetural (Sessões 070–075) — 11-12/04/2026

**O que foi feito:**

**Sessão 070 — Pipeline Auditar Requisitos XSD (12 arquivos, +1764 linhas, commit `17efbc4`):**
- 6 validators: diplomado, filiacao, curso, ies, historico, comprobatorios — validam todos os campos obrigatórios XSD v1.05
- API GET `/api/diplomas/[id]/auditoria` com Promise.all de 5 queries paralelas
- Hook `useAuditoria.ts` com cache sessionStorage (invalida ao editar diploma)
- `PainelAuditoria.tsx`: BadgeGrupo + BotaoCorrecao + gate suave com modal amber (override humano — Gerar XMLs sempre habilitado)

**Sessões 071–073 — Bug fix série (botões de correção da auditoria):**
- s071: PainelAuditoria refatorado para usar `processoId` (não `diplomaId`) como âncora de navegação
- s072: BotaoCorrecao com dual-path: `sessaoId` presente → `/revisao/{sessaoId}` | ausente → formulário legado
- s073: Causa raiz real — API GET `/api/diplomas/[id]` retornava `extracao: null` hardcoded. Fix: query real em `extracao_sessoes`. Commit `8b10b4a`.

**Sessão 074 — Processo nasce no Upload (commit `e31ebfb` | READY):**
- Motivação: processo sumia se extração ficasse bloqueada (criado só ao confirmar)
- DB: `processos_emissao.nome` nullable + `sessao_id` FK com UNIQUE INDEX (exceto cancelados)
- `POST /api/extracao/iniciar` agora cria processo em `em_extracao` imediatamente após criar sessão
- RPC `converter_sessao_em_processo`: UPDATE se já existe processo; INSERT só para sessões legadas
- Lista de processos: `em_extracao` + `sessao_id` → navega direto à revisão

**Sessão 075 — Fix 6 bugs pós-074 (commit `b82d6fd` | READY):**
- Bug #1: Lista de processos → sempre revisão quando `sessao_id` presente (independente de status)
- Bug #2: 3 links no pipeline apontavam para formulário legado → fix para `/revisao/{extracao.id}`
- Bug #3: Redirect pós-confirmar → pipeline (`/diploma/diplomas/${diplomaId}`) em vez da lista
- Bug #4a: Auditoria genitores falhou → query `filiacoes` adicionada no Promise.all da rota
- Bug #4b: Histórico com 4 erros falsos → `codigo_curriculo`/`data_expedicao` rebaixados a avisos; CH lida do campo correto; COALESCE `docente`/`nome_docente` (key mismatch extrator v3)
- Bug #4c: 0 comprobatórios → RPC não fazia INSERT em `diploma_documentos_comprobatorios`; fix com cast `::tipo_documento_comprobatorio`
- SQL em produção: `fix_rpc_comprobatorios_cast_s075` + `fix_data_kauana_s075` (55 docentes, CH=4560, 4 comprobatórios)

**Decisões importantes (070-075):**
- Processo nasce no upload em `em_extracao` — rastreabilidade garantida desde o início
- JSONB key mismatch: extrator v3 salva `docente`, RPC lia `nome_docente` → COALESCE obrigatório em todas as RPCs que leem disciplinas
- PL/pgSQL late compilation: funções com erro de tipo são aceitas no CREATE mas falham no runtime → testar sempre com dados reais
- `codigo_curriculo` e `data_expedicao` são avisos (não críticos) — disponíveis só na assinatura

---

## Bloco UX Polish E2.1 (Sessão 076) — 12/04/2026

**O que foi entregue:**
- **Sessão 076:** Auto-save timestamp persistente ("Salvo automaticamente, às HH:MM de DD/MM/AA") no header do formulário de revisão. `AutoSaveIndicator` reescrito em 2 linhas (status + timestamp permanente após 1º save). Commit `563cb88`, deploy `dpl_FoZ5sxf23KajUMgrGYFxdRPhUxhQ` READY.
- **Bloqueio formulário pós-publicação:** Backend PUT `/api/extracao/sessoes/[id]` retorna 403 `DIPLOMA_PUBLICADO` se diploma vinculado está em `['assinado', 'registrado', 'rvdd_gerado', 'publicado']`. Frontend: banner âmbar + lock-check useEffect na carga + form desabilitado (onChange silenciado, botão disabled).

**Decisões importantes:**
- `STATUS_DIPLOMA_BLOQUEADO` = `['assinado', 'registrado', 'rvdd_gerado', 'publicado']` (via `processo_id` FK traversal)
- Dois caminhos de detecção de lock: na carga (via `contagem_status`) + reativo (via 403 no auto-save)
- Timestamp formatado em hora local: `às HH:MM de DD/MM/AA` — sem timezone explícito

## Módulo Atendimento — Sprint 1 (Sessão 085) — 12/04/2026

**O que foi entregue:**
- **9 tabelas Supabase** (`inboxes`, `contacts`, `conversations`, `messages`, `labels`, `conversation_labels`, `agents`, `automation_rules`, `whatsapp_templates`) com RLS Fase 1 + seed FIC
- **8 arquivos frontend**: `layout.tsx` (sidebar verde 6 itens) + `page.tsx` (dashboard) + `conversas/`, `contatos/`, `canais/`, `automacoes/`, `relatorios/` (todos placeholders bem estruturados)
- **TopBar.tsx** atualizado: "Atendimento" adicionado ao MODULOS (ativo: true, cor: green)
- **Fix crítico `vercel.json`**: bloco `functions` removido — scripts Python rodam no Railway, não no Vercel; 5 deploys ERROR em cadeia desde sessão 083 → READY em commit `3082329`

**Decisões importantes:**
- Estratégia NEXVY: tabelas com `account_id` nullable → Fase 2 extrai para SaaS multi-tenant
- Python scripts Vercel: sem `functions` block, Vercel detecta e sobe automaticamente com runtime default (`lambdaRuntimeStats: {"nodejs":9,"python":2}`)
- Deploy READY: `dpl_EX3BD7ZiJRUqvH1Uqt6tpsCTzjaG` commit `3082329`

---

## Próximas Prioridades

1. 🔴 **Atendimento Sprint 2** — Webhook WhatsApp (Meta Cloud API) + Bull Queue Railway + validação HMAC-SHA256
2. 🔴 **Sprint 2 — E2.2 BRy** — Outbox + OAuth2 + worker (bloqueado: credenciais)
3. 🔴 **Sprint 3 — RVDD + Portal** — alternativa se BRy permanecer bloqueado
4. 🟡 **Sprint 2 — E2.3/E2.4** — Reconciler + Compressão PDF/A
5. 🟢 **Prazo MEC** — 01/07/2025 já venceu, resolver com urgência
