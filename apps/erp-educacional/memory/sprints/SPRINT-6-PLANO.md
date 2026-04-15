# Sprint 6 — Acervo Digital (PLANO)

**Criado em:** 15/04/2026  
**Sessão início:** 094  
**Baseado em:** PLANO-PIPELINE-END-TO-END.md (sessão 093) + diagnóstico s094  
**Status:** ✅ CONCLUÍDO (sessão 094, deploy READY `d76b639`)  

---

## Objetivo

Ativar a Etapa 2 do pipeline (Documentação e Acervo):
- Transferir arquivos marcados como `destino_acervo=true` para a tabela de comprobatórios ao criar o processo
- Converter automaticamente os arquivos para PDF/A (padrão MEC)
- Corrigir o fluxo de status para não pular a Etapa 2
- UI de acervo mostrando status real de conversão e botão de confirmação

---

## Diagnóstico (sessão 094)

### Estado real encontrado

| Componente | Situação |
|-----------|----------|
| Tabela `diploma_documentos_comprobatorios` | ✅ Existe, enum corrigido (9 tipos XSD v1.05) |
| `converter-service.ts` (`obterPdfABase64`) | ✅ Completo: cache, fail-fast 15MB, blob cleanup |
| `/api/diplomas/[id]/acervo/route.ts` | ✅ Existe (GET/POST/PATCH) — mas usa `documentos_digitais`, não `diploma_documentos_comprobatorios` |
| `AbaAcervoDigital` no `[id]/page.tsx` | ✅ Existe — mas lê de `documentos_digitais` |
| RPC `converter_sessao_em_processo` | ❌ Step 12: migra `processo_arquivos` mas não insere em `diploma_documentos_comprobatorios` |
| `verificarEAvancarPacote` | ❌ Avança para `aguardando_envio_registradora`, pulando Etapa 2 |
| Endpoint para disparar conversão PDF/A | ❌ Não existe (`/api/diplomas/[id]/acervo/converter`) |

### Decisões arquiteturais

1. **`diploma_documentos_comprobatorios.diploma_id`** — FK aponta para `documentos_digitais` (tabela diferente, não é `diplomas`). Inserir com `diploma_id = NULL`. A ligação ao diploma é pelo `processo_id` — que é o que `converter-service.ts` usa.

2. **`tipo_xsd` mapping** — `processo_arquivos.tipo_xsd` é TEXT. Ao inserir em `diploma_documentos_comprobatorios`, fazer CASE WHEN para mapear valores válidos → cast para enum, fallback = `'Outros'`.

3. **Admin client para PDF/A** — bucket `documentos-pdfa` tem policy WRITE apenas para `service_role`. O endpoint converter deve criar `createAdminClient()` (não o client autenticado padrão).

4. **Conversão: lazy vs eager** — Lazy (sob demanda) é a arquitetura existente. Para Sprint 6, adicionamos "eager on demand": o operador vê os documentos pendentes na UI e clica "Converter tudo" (ou individual). Não há background job neste sprint.

5. **UI de acervo** — A `AbaAcervoDigital` continua existindo para uploads manuais (`documentos_digitais`). Criamos uma nova seção/aba separada para os **comprobatórios automáticos** (`diploma_documentos_comprobatorios`). Ambas coexistem.

---

## Items do Sprint

### 6.1 — RPC: inserir comprobatórios ao criar processo
**Arquivo:** `supabase/migrations/20260415_sprint6_acervo_rpc_comprobatorios.sql`  
**O que faz:** Adiciona step 12.5 à RPC `converter_sessao_em_processo`  
**Lógica:**
```sql
-- Após step 12 (migrar processo_arquivos), antes do step 13 (override):
-- Para cada processo_arquivo com destino_acervo = true:
INSERT INTO diploma_documentos_comprobatorios (
  processo_id, arquivo_origem_id, diploma_id, tipo_xsd,
  selecionado_por, selecionado_em
)
SELECT
  v_processo_id,
  pa.id,
  NULL,  -- diploma_id: FK para documentos_digitais (diferente), deixamos NULL
  CASE pa.tipo_xsd
    WHEN 'DocumentoIdentidadeDoAluno' THEN 'DocumentoIdentidadeDoAluno'
    WHEN 'ProvaConclusaoEnsinoMedio'  THEN 'ProvaConclusaoEnsinoMedio'
    WHEN 'ProvaColacao'               THEN 'ProvaColacao'
    WHEN 'ComprovacaoEstagioCurricular' THEN 'ComprovacaoEstagioCurricular'
    WHEN 'CertidaoNascimento'         THEN 'CertidaoNascimento'
    WHEN 'CertidaoCasamento'          THEN 'CertidaoCasamento'
    WHEN 'TituloEleitor'              THEN 'TituloEleitor'
    WHEN 'AtoNaturalizacao'           THEN 'AtoNaturalizacao'
    ELSE 'Outros'
  END::tipo_documento_comprobatorio,
  v_sessao.usuario_id,
  now()
FROM processo_arquivos pa
WHERE pa.sessao_id = p_sessao_id
  AND pa.destino_acervo = true
ON CONFLICT (processo_id, arquivo_origem_id) DO NOTHING;
```
**Retorno:** adicionar `comprobatorios_inseridos INT` ao JSONB de retorno.

### 6.2 — Endpoint de conversão PDF/A
**Arquivo:** `src/app/api/diplomas/[id]/acervo/converter/route.ts`  
**POST /api/diplomas/[id]/acervo/converter**  
**O que faz:**
1. Busca `diploma.processo_id`
2. Lista todos `diploma_documentos_comprobatorios` onde `processo_id = X AND pdfa_storage_path IS NULL AND deleted_at IS NULL`
3. Para cada: chama `obterPdfABase64(ddc.id, adminClient)`
4. Retorna `{ convertidos, erros, total }`

**Edge case 15MB:** O `converter-service.ts` já lança `PdfAConversionError` — capturar e registrar em `pdfa_validation_errors`.

### 6.3 — Fix verificarEAvancarPacote
**Arquivo:** `src/lib/bry/carimbo-pipeline.ts`  
**Mudança:** linha ~148
```typescript
// ANTES:
status: "aguardando_envio_registradora",

// DEPOIS:
status: "aguardando_documentos",
```
**Condição para avançar para `aguardando_envio_registradora`:** será implementada no Sprint 7 (quando acervo confirmado + docs assinados).

### 6.4 — UI: seção de comprobatórios em diplomas/[id]/page.tsx
**Onde:** Aba "acervo" na página do diploma — adicionar seção "Comprobatórios (Acervo MEC)"  
**O que mostra:**
- Lista de `diploma_documentos_comprobatorios` (via GET /api/diplomas/[id]/comprobatorios — novo endpoint simples)
- Por documento: nome do arquivo, tipo XSD, status (Pendente / Convertido ✅ / Erro ❌)
- Botão "Converter documentos" (chama POST /api/diplomas/[id]/acervo/converter)
- Indicador "X de Y convertidos"
- Botão "Confirmar acervo" — chama PATCH /api/diplomas/[id]/acervo `{ acao: "confirmar_comprobatorios" }` — avança status

---

## Ordem de execução

1. ✅ 6.3 primeiro (1 linha — menor risco, sem deploy crítico ainda)
2. ✅ 6.1 em seguida (migration + alterar RPC)
3. ✅ 6.2 (novo endpoint converter)
4. ✅ 6.4 (UI)
5. ✅ Aplicar migration no Supabase
6. ✅ Build + push + deploy Vercel READY

---

## Arquivos modificados/criados

| Arquivo | Tipo | Item |
|---------|------|------|
| `supabase/migrations/20260415_sprint6_acervo_rpc_comprobatorios.sql` | Novo | 6.1 |
| `src/lib/bry/carimbo-pipeline.ts` | Modificado | 6.3 |
| `src/app/api/diplomas/[id]/acervo/converter/route.ts` | Novo | 6.2 |
| `src/app/api/diplomas/[id]/comprobatorios/route.ts` | Novo | 6.4 (API) |
| `src/app/(erp)/diploma/diplomas/[id]/page.tsx` | Modificado | 6.4 (UI) |
