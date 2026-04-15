---
name: Estado atual do desenvolvimento - Diploma Digital
description: Deploy OK (a4b0a81), Sessão 014 — Dupla Checagem removida; upload docs mantido; próximo = Motor XML
type: project
---

## Deploy atual (05/04/2026)
- **Último commit (main):** `a4b0a81` — Remove dupla-checagem (botão, dialog, route); mantém upload docs
- **Commit anterior:** 1e27957 — FIC visual no relatório de extração
- **Commits da sessão 011:** d1637b4, cce7c20, de3fe43
- **Status Vercel:** READY (production)
- **URL:** gestao.ficcassilandia.com.br
- **Domínios:** gestao.* = ERP autenticado, diploma.* = portal público

## Sessão 011 — Migração Caminho 2 (05/04/2026)

### O que mudou
- **page.tsx** reescrita: 2354→270 linhas (lista-only com métricas, busca, filtros)
- **[id]/page.tsx** é agora a página unificada (upload, IA, form, save, confirm)
- Prop `readOnly` cascadeada em 11 seções de componentes
- Migração em lote deprecada (410 Gone)

### APIs novas
- `POST /api/processos/rascunho` — cria rascunho vazio
- `PUT /api/processos/rascunho` — atualiza dados_rascunho JSONB
- `GET /api/processos/rascunho/[id]` — retorna processo + rascunho

### Features novas
- Feedback visual ao salvar rascunho (toast verde sucesso / vermelho erro, auto-hide 5s)
- Botão "Exportar PDF" — gera HTML completo com 9 seções via window.print()

## Sprints 1-5 (anteriores — 30/03/2026)

### Sprint 1 — Correções base
- Fix navegação, salvamento filiações, enum StatusDiploma expandido (25 valores)

### Sprint 2 — Pipeline e transição de status
- API status com checklist, pipeline visual 6 fases

### Sprint 3 — Geração de PDFs (pdf-lib)
- PDFBuilder, 3 templates, upload Supabase Storage

### Sprint 4 — Editor de imagem + Acervo digital
- ImageEditor (Canvas API), API acervo, conformidade Decreto 10.278/2020

### Sprint 5 — Abas interativas + Pacote registradora
- 5 abas, documentos complementares, acervo digital, ZIP archiver

## DB — StatusDiploma enum (25 valores, 6 fases)
rascunho, validando_dados, preenchido, gerando_xml, xml_gerado, validando_xsd,
aguardando_assinatura_emissora, em_assinatura, aplicando_carimbo_tempo, assinado,
aguardando_documentos, gerando_documentos, documentos_assinados,
aguardando_digitalizacao, acervo_completo,
aguardando_envio_registradora, pronto_para_registro, enviado_registradora,
rejeitado_registradora, aguardando_registro, registrado,
gerando_rvdd, rvdd_gerado, publicado

## Git workaround (FUSE filesystem)
- Clone fresh para /tmp, resolver conflitos lá, push direto
- Git config: user=mfalcao09, email=contato@marcelofalcao.imb.br

## Sessão 013-continuação (05/04/2026) — Dupla Checagem com IA
- `processo_arquivos` table: ✅ criada no Supabase (commit anterior desta sessão)
- `ia_configuracoes` entry (dupla_checagem): ✅ inserida (gemini-3.1-pro-preview)
- `POST /api/processos/[id]/arquivos`: upload Supabase Storage + SHA-256 + auto-detect tipo via Gemini Flash
- `GET /api/processos/[id]/arquivos`: lista com URLs assinadas
- `DELETE /api/processos/[id]/arquivos?arquivo_id=...`: remove storage + banco
- `POST /api/processos/[id]/dupla-checagem`: baixa docs do storage → Gemini analisa → APROVADO/REPROVADO
- `DuplaChecagemDialog.tsx`: modal completo com veredicto visual, score de confiança, tabela de inconsistências
- `page.tsx`: handleFilesSelected agora faz upload real, lista docs na UI, botão "Dupla Checagem" na toolbar

## Sessão 013b — Skills RAG + Import MD (05/04/2026)

### RAG Pipeline
- `ia_skills` → `dividirSkillEmChunks()` → `gerarEmbedding()` (text-embedding-3-small) → `ia_skill_chunks`
- Busca híbrida: 70% semântica (pgvector cosine) + 30% keyword
- **Problema:** 10 skills inseridas via SQL → sem embeddings → RAG não funciona ainda
- **Solução:** Revisar conteúdo de cada skill com Marcelo → importar via painel → auto-indexa

### Feature "Importar .md" entregue (commit `6b37a531` — READY)
- Botão "Importar .md" no painel Skills (toolbar, ícone Upload, branco/borda)
- `parseMdFile()`: extrai nome (H1), slug (auto), descricao (1º parágrafo), conteudo (tudo)
- Ao salvar → POST /api/ia/skills → indexarSkill() → embeddings automáticos
- FUSE workaround: clone /tmp/diploma-digital-upload-md, push direto

### 10 skills aguardando revisão com Marcelo
Tom e Identidade FIC, Validação de Documentos, Processo de Matrícula, Admissão CLT,
Regulamentação MEC, Legislação Trabalhista, Guia LGPD, Cursos e Grades,
Organograma FIC, Processo de Contratação Docente

## Sessão 014 — Dupla Checagem: debug e remoção (05/04/2026)

- Feature "Dupla Checagem com IA" REMOVIDA após falhas de modelo Gemini
- Commits: `ab2b856` (fix modelo) → `a4b0a81` (remove feature)
- Upload de documentos de origem MANTIDO e funcionando
- Modelo Gemini correto em abr/2026: `gemini-2.5-flash`
- `ia_configuracoes` (dupla_checagem) ainda existe no banco — pode ser reaproveitada

## Pendências
- **P1 (URGENTE):** Motor XML + validação XSD v1.06 (prazo MEC 01/07/2025 vencido!)
- **P2:** Revisão das 10 skills com Marcelo + reimportar via painel
- **P3:** Integração BRy (assinatura digital OAuth2)
- **P4:** RVDD (PDF visual do diploma)
- **P5:** Portal do diplomado (consulta pública)
- **P6:** Fluxo registradora

**Why:** Registro completo do estado para retomar sem perder contexto.
**How to apply:** Consultar antes de qualquer trabalho no diploma-digital.
