# Sessão F0.6 / Fase 3 — 2026-04-22 (noite)

**Branch:** `claude/vigorous-mccarthy-8ca1e4`
**Produção final:** `diploma-digital-i8arc5f78` Ready
**Backlinks:** F0.6 Fase 2 → F0.6 Fase 3 (PDFs lendo snapshot) — **F0.6 ENCERRADA**

## 🎯 Objetivo

Fazer os 3 PDFs complementares (Histórico, Termo Expedição, Termo Responsabilidade) serem gerados via Puppeteer + templates React lendo do snapshot, substituindo o pdf-lib legado apenas para diplomas novos (com snapshot).

## ✅ Entregas

### Backend
- **`src/lib/diploma/render-pdf.ts`** (~160 linhas)
  - `renderPdfFromPrintRoute()` — helper Puppeteer reutilizável
  - Cookies de sessão repassados para auth Supabase
  - `page.pdf({ format:A4, printBackground, preferCSSPageSize })`
  - `try/finally` para sempre fechar browser
  - Helpers: `parseCookieHeader()`, `derivePrintContext()`

### Templates React
- **`TermoExpedicaoTemplate.tsx`** — texto jurídico oficial (Port. MEC 70/2025) + dados do diplomado em destaque + tabela de registro + data por extenso
- **`TermoResponsabilidadeTemplate.tsx`** — 5 cláusulas declaratórias (I-V) referenciando o snapshot imutável

### Rotas
- **`/print/termo-expedicao/[diplomaId]/page.tsx`** — Client Component
- **`/print/termo-responsabilidade/[diplomaId]/page.tsx`** — Client Component
- Ambos fazem fetch do endpoint `/dados` (mesma fonte da Secretaria) e priorizam snapshot

### Endpoint modificado
- **`POST /api/diplomas/[id]/documentos`**:
  - `maxDuration: 120`, `runtime: 'nodejs'`
  - Bifurcação: `temSnapshot` → 3× `renderPdfFromPrintRoute` em paralelo; senão → pdf-lib legado
  - Upload Storage + upsert em `diploma_documentos_complementares` iguais nos 2 caminhos

## 🔒 Compatibilidade preservada

- Diplomas legados (sem snapshot) → pdf-lib intocado
- API BRy HUB Signer (POST `/documentos/assinar`) → recebe PDFs igual
- Bucket `documentos` + tabela `diploma_documentos_complementares` → inalterados
- API BRy Cloud/XAdES (Fase 2) → inalterada
- Secretaria → usa mesmo endpoint `/dados`

## 🔗 Commit

- `d117506` feat(diploma): Snapshot Fase 3 — PDFs via Puppeteer + templates React

## 📋 Próximos passos

1. **Merge PR #19** — solicitado pelo Marcelo nesta sessão
2. **Smoke end-to-end Kauana** — Marcelo executará; resolverá e-mails dos 4 assinantes BRy no teste
3. Iteração de correções conforme erros aparecerem

## 🎉 F0.6 Arquitetura Completa

```
[Extração IA]
     ↓
  extracao_sessoes.dados_confirmados
     ↓ POST /api/processos
  diplomas.dados_snapshot_extracao (JSONB IMUTÁVEL)
     ↓ AbaSnapshot: editar + travar manual
     ├─► montador XML + aplicarSnapshotSobreDadosDiploma()
     │   → 3 XMLs MEC → BRy Cloud / XAdES
     │
     └─► 3 rotas /print/* + Puppeteer + render-pdf.ts
         → 3 PDFs → BRy HUB Signer
```

Entregue em 1 sessão (14h estimadas).
