# Sessão F0.5 — 2026-04-22

**Branch:** `claude/vigorous-mccarthy-8ca1e4`
**PR:** [#19](https://github.com/mfalcao09/ecossistema-monorepo/pull/19) (não mergeado — deployado em produção via promote direto)
**Produção final:** `diploma-digital-4r3nca9e0` (Ready)
**Backlinks:** masterplan diploma-digital-v4 → Fase 0.5 (PDF + Módulo Secretaria)

## 🎯 Objetivo

Construir o módulo Secretaria no ERP, emissão do Histórico Escolar com visual fiel ao config preview, e alinhar a arquitetura de PDF+texto-selecionável no pipeline do diploma.

## ✅ Entregas (deploy em produção)

### Módulo Secretaria

- Layout próprio com sidebar amber
- Dashboard + hubs de Emissão e Configurações
- Transplante da `AbaVisualHistorico` de Diploma → Secretaria/Configurações
- Adicionado no TopBar como módulo principal

### Emissão do Histórico — arquitetura 3 camadas

1. **Camada de dados:** `GET /api/secretaria/emissao/historico/[id]/dados` — devolve JSON pronto com config+dadosAluno+dadosCurso+disciplinas+assinantes
2. **Camada de renderização:** rota `/print/historico/[id]` com layout minimalista — `LivePreview` recebe snapshot via fetch e renderiza A4
3. **Camada de export:** `POST /api/secretaria/emissao/historico/[id]/pdf` — Puppeteer+Chromium navega para a rota de render com cookies de auth → `page.pdf({ format:'A4', printBackground:true })` → retorna bytes

### LivePreview estendido

Novas props opcionais (backward compatible):

- `dadosAluno`, `dadosCurso`, `dadosAssinantes`, `codigoVerificacao`
- Quando passadas (modo real), renderiza valores ao lado dos labels
- Quando omitidas (modo template config), comportamento inalterado

### UX do dialog de prévia

- Botão **"Salvar PDF"** (amber, primário): chama endpoint Puppeteer → download direto sem diálogo, sem nova aba. Texto selecionável.
- Botão **"Imprimir"** (outline): iframe escondido + `contentWindow.print()` → diálogo Chrome aparece sem criar aba.
- Toggle **"Papel já timbrado"**: oculta timbrado digital em todos os caminhos (preview, salvar, imprimir).

### Infra

- `@sparticuz/chromium@147` + `puppeteer-core@24` instalados no `apps/erp-educacional`
- `next.config.mjs`: `serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core']`
- CSP `frame-src` inclui `blob:`
- `vercel.json`: `installCommand: "npm install"` (evita pnpm engine mismatch quando turbo.json é detectado)
- `api/diplomas/[id]/documentos` passa timbrado+margens aos 3 PDFs pdf-lib atuais

## 🐛 Bugs corrigidos no caminho

1. `Buffer.from(pdfBytes)` em `NextResponse` (Uint8Array não é BodyInit)
2. CSP blocking `blob:` em iframe
3. `diploma_config` tem 2 rows (homologacao/producao) — endpoint preferia a de produção que estava com PDF legado; fix: prefere row com timbrado PNG/JPG válido
4. Impressão A4 não encaixada — `outerHTML` copiava `transform: scale(0.85)` do dialog; fix: `innerHTML` + `page-break-after:always` + `-webkit-print-color-adjust:exact`
5. `chromium.defaultViewport` não existe mais em `@sparticuz/chromium@147` — só `page.setViewport()`
6. `fetchSeguro` import perdido na refatoração

## 📐 Plano arquitetural aprovado (NÃO executado — próxima sessão F0.6)

### Snapshot Imutável do Diploma — Estratégia B + auditoria

**Princípio:** artefatos oficiais (PDFs + XMLs + RVDD) são gerados a partir de SNAPSHOT IMUTÁVEL dos dados extraídos+confirmados na Fase 1. Tabelas normalizadas (`diplomados`, `cursos`, `diploma_disciplinas`) servem só para busca/relacionamento.

**Fluxo:**

```
Extração IA → Snapshot (consolida) → 2 fluxos paralelos:
  ├─► PDFs via Puppeteer → BRy HUB Signer (API 2)
  └─► XMLs via builders → BRy Cloud/XAdES (API 1)
```

**Pipeline visual reorganizado (6 etapas):**

1. Extração
2. **Consolidação (Snapshot)** ← NOVA
3. **Assinaturas** (XML + PDF paralelos) ← reorganizada
4. Registro
5. RVDD
6. Publicado

**Regra de trava:**

- Snapshot editável enquanto `rascunho` (ações auditadas em `diploma_snapshot_edicoes` com justificativa ≥20 chars)
- Trava manual explícita: user clica "Confirmar e liberar assinaturas"
- Após travado: imutável permanente
- Se descobrir erro depois: cancelar diploma + novo processo (fluxo jurídico fora do escopo técnico)

**Escopo:**

- ✅ DENTRO: novos diplomas (snapshot automático), 3 templates React, Puppeteer para 3 PDFs, builders XML adaptados, aba Snapshot dedicada, auditoria
- ❌ FORA: diplomas legados (imutáveis, sem backfill), Secretaria emissão avulsa (organizamos depois)

**2 APIs BRy — NÃO MISTURAR:**

- BRy Cloud/KMS (XAdES) — 3 XMLs MEC — Fase atual "XML e Assinatura"
- BRy HUB Signer — 3 PDFs complementares — Fase atual "Documentação e Acervo"

**Garantias de não-regressão:**

- Credenciais BRy, endpoints de assinatura, webhooks, extração IA, portal público, RVDD, registro UFMS, Secretaria atual — TUDO INTOCADO
- Feature flag + rollback fácil + 3 deploys separados

**Estimativa:** ~14h em 3 fases (snapshot+UI → XMLs → PDFs)

## 🔧 Commits da sessão

Principais (10+ commits no branch):

- `feat(erp): módulo Secretaria + timbrado nos PDFs do Diploma Digital`
- `fix(secretaria): Buffer.from(pdfBytes) para BodyInit no NextResponse`
- `fix(vercel): força npm install para evitar pnpm engine mismatch`
- `fix(csp): adiciona blob: ao frame-src para prévia PDF inline`
- `fix(secretaria): prévia do histórico abre modal inline com PDF real`
- `feat(secretaria): prévia do histórico reusa LivePreview com dados reais`
- `fix(secretaria): timbrado não aparecia na prévia — 2 rows em diploma_config`
- `fix(secretaria): impressão do histórico agora encaixa em A4 100%`
- `feat(secretaria): botões Salvar PDF (direto) e Imprimir (sem nova aba)`
- `feat(secretaria): PDF com texto selecionável via Puppeteer headless`
- `fix(build): remove chromium.defaultViewport (v147)`
- `feat(secretaria): toggle "papel já timbrado" — oculta timbrado digital`

## 📋 Pendências

| ID    | Descrição                                                                    | Prioridade          |
| ----- | ---------------------------------------------------------------------------- | ------------------- |
| P-030 | Mergear PR #19 (vigorous-mccarthy) + PR #20 (vercel-npm-install) em main     | Alta                |
| P-031 | Executar plano Snapshot Imutável (F0.6 — ~14h em 3 fases)                    | Alta                |
| P-032 | Migration 2 rows `diploma_config`: substituir PDF legado de produção por PNG | Média               |
| P-033 | E-mails dos 4 assinantes FIC para BRy (LUCIMAR, ALECIANA, MARCELO, eCNPJ)    | Alta (bloqueia BRy) |
| P-034 | Piloto Kauana end-to-end (Fase 0.5 original)                                 | Média               |

## 🔗 Backlinks

- Supabase ECOSYSTEM: 4 memórias inseridas (type=project|decision|context|reference)
- Masterplan: `memory/masterplans/diploma-digital-v4.md`
- Próxima sessão: F0.6 — executar Fase 1 do Snapshot (~4h45)
