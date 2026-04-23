# Sessão F0.6 / Fase 2 — 2026-04-22 (tarde/noite)

**Branch:** `claude/vigorous-mccarthy-8ca1e4`
**Produção final:** `diploma-digital-ihudd6c9e` Ready
**Backlinks:** F0.6 Fase 1 → F0.6 Fase 2 (XMLs lendo snapshot) → F0.6 Fase 3 (PDFs lendo snapshot)

## 🎯 Objetivo

Fazer os 3 XMLs MEC (DocumentacaoAcademicaRegistro, HistoricoEscolarDigital, DiplomaDigital) lerem os dados consolidados do snapshot imutável criado na Fase 1, em vez das tabelas normalizadas.

## Estratégia

**Mínima invasiva**: criar helper que aplica o snapshot POR CIMA do `DadosDiploma` montado pelas tabelas. Preserva 100% dos 10+ builders XML e mantém compatibilidade com diplomas legados.

## ✅ Entregas

- `src/lib/diploma/snapshot-to-dados-diploma.ts` (~350 linhas)
  - `aplicarSnapshotSobreDadosDiploma(dados, snapshot): DadosDiploma`
  - Helpers de normalização: `normalizarTitulacao()`, `mapearFormaAcesso()`, `snapshotDisciplinaParaDadosDiploma()`
  - Conversões defensivas: nota string→number, enums do XSD v1.05
- `src/lib/xml/montador.ts`
  - SELECT inclui `dados_snapshot_extracao` + `dados_snapshot_travado`
  - Aplica helper antes das regras de negócio, `dadosDiplomaFinal` é retornado

## 🐛 Bugs fixados (5 rodadas)

1. Supabase `GenericStringError` → cast via interface (Fase 1)
2. `titulacao` como string livre → `normalizarTitulacao()` para enum TTitulacao
3. `nota` string → `parseFloat` com fallback NaN→undefined
4. `forma_integralizacao` enum XSD correto: `Cursado | Validado | Aproveitado`

## 🔒 Preservado

- Diplomas legados → helper é no-op quando snapshot é null
- Builders XML → zero mudanças
- APIs BRy Cloud/XAdES → inalteradas
- XSD v1.05 → inalterado

## 🔗 Commits

- `66c7bba` feat(diploma): Snapshot Fase 2 XMLs lendo snapshot
- `ed77b01` fix: normaliza titulação TTitulacao
- `94ceddb` fix: nota string→number
- `b34c323` fix: forma_integralizacao enum XSD correto

## 🔜 Próxima sessão — Fase 3 (~4h)

- `src/lib/diploma/render-pdf.ts` reutilizável (Puppeteer)
- Templates React: `HistoricoTemplate`, `TermoExpedicaoTemplate`, `TermoResponsabilidadeTemplate`
- Rotas: `/print/termo-expedicao/[id]`, `/print/termo-responsabilidade/[id]`
- Patch em `POST /api/diplomas/[id]/documentos`: se tem snapshot → Puppeteer, senão pdf-lib legado
