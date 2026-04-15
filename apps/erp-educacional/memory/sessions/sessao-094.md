# Sessão 094 — Sprint 6: Acervo Digital

**Data:** 15/04/2026  
**Duração:** ~3h (sessão + continuação pós-context-compaction)  
**Sprint:** Sprint 6 — Acervo Digital  
**Commit:** `d76b639` (main)  
**Deploy:** `dpl_89vEbauDXmayo2s9GnegqbzZ287Q` → **READY** ✅  

---

## Backlinks

- **Masterplan:** [diploma-digital-v4.md](../masterplans/diploma-digital-v4.md)
- **Sprint:** [SPRINT-6-PLANO.md](../sprints/SPRINT-6-PLANO.md)
- **Epics:** G1 (RPC comprobatórios), G2 (PDF/A converter endpoint), G3 (fix pipeline status), G11 (UI Etapa 2)

---

## Objetivo da Sessão

Ativar a Etapa 2 do pipeline de emissão de diplomas (Documentação e Acervo):
- Inserir comprobatórios automaticamente na tabela `diploma_documentos_comprobatorios` ao criar processo
- Wiring do endpoint de conversão PDF/A (Ghostscript via Railway)
- Corrigir o fluxo de status (`aguardando_documentos` não era uma etapa intermediária)
- UI de acervo mostrando status real de conversão com botão "Confirmar acervo"

---

## Diagnóstico Inicial (antes da sessão)

| Componente | Situação encontrada |
|-----------|---------------------|
| Tabela `diploma_documentos_comprobatorios` | ✅ Existe, enum com 9 tipos XSD v1.05 |
| `converter-service.ts` (`obterPdfABase64`) | ✅ Completo: cache, fail-fast 15MB |
| RPC `converter_sessao_em_processo` | ❌ Step 12.5 ausente — não inseria em DDC |
| `verificarEAvancarPacote` | ❌ Avançava direto para `aguardando_envio_registradora` |
| Endpoint `/api/diplomas/[id]/acervo/converter` | ❌ Não existia |
| UI de comprobatórios MEC | ❌ Não existia (`AbaAcervoDigital` usava `documentos_digitais`) |

---

## Entregas

### 6.1 — Migration SQL: RPC v3 com Step 12.5
**Arquivo:** `supabase/migrations/20260415_sprint6_acervo_rpc_comprobatorios.sql`

- DROP da versão 3-args legada (fix erro 42725 "function name not unique")
- Nova `converter_sessao_em_processo(p_sessao_id uuid, p_user_id uuid)` — 2-args
- Step 12.5 adicionado: após migrar `processo_arquivos`, insere em `diploma_documentos_comprobatorios` todos os arquivos com `destino_acervo = true`
- CASE WHEN mapping: `tipo_xsd TEXT` → enum `tipo_documento_comprobatorio` (9 valores, fallback 'Outros')
- `diploma_id = NULL` (FK é para `documentos_digitais`, não `diplomas` — ligação é por `processo_id`)
- `ON CONFLICT (processo_id, arquivo_origem_id) DO NOTHING` — idempotente
- JSONB de retorno inclui `comprobatorios_inseridos`
- **Aplicada com sucesso** via `apply_migration` no projeto `ifdnjieklngcfodmtied`

### 6.2 — POST /api/diplomas/[id]/acervo/converter
**Arquivo:** `src/app/api/diplomas/[id]/acervo/converter/route.ts`

- Usa `createAdminClient()` (service_role) — bucket `documentos-pdfa` exige write via service_role
- Lista todos `diploma_documentos_comprobatorios` do `processo_id` do diploma
- Loop sequencial (Ghostscript é CPU-bound): `obterPdfABase64(ddc.id, admin)`
- Documentos já convertidos: conta em `ja_convertidos`, não reconverte
- Erros por documento: acumula em `erros[]`, continua o loop
- Retorna: `{ total, convertidos, ja_convertidos, erros, mensagem }`
- `skipCSRF: true` conforme padrão obrigatório

### 6.3 — Fix `verificarEAvancarPacote`
**Arquivo:** `src/lib/bry/carimbo-pipeline.ts`

- **Antes:** avançava diretamente para `aguardando_envio_registradora`
- **Depois:** avança para `aguardando_documentos` (Etapa 2 — Acervo)
- A transição `aguardando_documentos` → `aguardando_envio_registradora` acontece via endpoint PATCH comprobatorios (item 6.4)

### 6.4 — GET+PATCH /api/diplomas/[id]/comprobatorios + AbaComprobatoriosMec
**API:** `src/app/api/diplomas/[id]/comprobatorios/route.ts`

- **GET:** lista todos DDC de um diploma (via `processo_id`), com join em `processo_arquivos` para nome do arquivo
  - `status_pdfa` implícito: `pdfa_storage_path IS NULL` = pendente; `IS NOT NULL` = convertido; `pdfa_validation_ok = false` = convertido_com_aviso
- **PATCH `{ acao: "confirmar_comprobatorios" }`:** valida que há ≥1 PDF/A convertido, avança status `aguardando_documentos` → `aguardando_envio_registradora`
- Ambos com `skipCSRF: true`

**UI:** `AbaComprobatoriosMec` em `src/app/(erp)/diploma/diplomas/[id]/page.tsx`

- Busca do GET comprobatorios com polling manual (botão "Recarregar")
- Badge "X/Y convertidos" no header da seção
- Botão "Converter documentos" → POST acervo/converter (via `fetchSeguro`)
- Botão "Confirmar acervo" (só exibido quando `status === 'aguardando_documentos'` e `totalConvertidos > 0`) → PATCH comprobatorios
- Rows por documento: ícone de status (✅ CheckCircle2 verde / ⚠ AlertTriangle âmbar / 🕐 Clock cinza)
- Info box informando que todos estão convertidos mas acervo não confirmado
- Inserida ANTES da `AbaAcervoDigital` existente no bloco `abaAtiva === "acervo"`

---

## Problemas Encontrados e Soluções

### 1. Erro 42725 no Supabase — função ambígua
**Causa:** Duas sobrecargas de `converter_sessao_em_processo` coexistiam: `(uuid, uuid, uuid)` e `(uuid, uuid)`.  
**Solução:** DROP explícito da versão 3-args no início da migration.

### 2. Remote git URL incorreta
**Causa:** URL no clone era `mfalcao09/ERP-Educacional` (404).  
**Solução:** Descobriu-se via GitHub API que o repo correto é `mfalcao09/diploma-digital`. URL corrigida.

### 3. `git index.lock` bloqueado pelo bindfs
**Causa:** Filesystem FUSE impede remoção de `.git/index.lock`.  
**Solução:** Clone limpo em `/tmp/diploma-digital`, cópia dos arquivos Sprint 6, commit e push de lá.

### 4. `npm run build` timeout (exit 143)
**Causa:** Build completo trava após 2min no sandbox.  
**Solução:** Validação via `npx tsc --noEmit` — saiu sem erros (0 linhas output = TypeScript limpo).

---

## Arquivos Criados/Modificados

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/20260415_sprint6_acervo_rpc_comprobatorios.sql` | CRIADO |
| `src/app/api/diplomas/[id]/acervo/converter/route.ts` | CRIADO |
| `src/app/api/diplomas/[id]/comprobatorios/route.ts` | CRIADO |
| `src/app/(erp)/diploma/diplomas/[id]/page.tsx` | MODIFICADO (AbaComprobatoriosMec + render acervo) |
| `src/lib/bry/carimbo-pipeline.ts` | MODIFICADO (verificarEAvancarPacote → aguardando_documentos) |

---

## Estado Final

| Item | Status |
|------|--------|
| 6.1 — RPC step 12.5 | ✅ Aplicado no Supabase ERP |
| 6.2 — POST acervo/converter | ✅ Live em produção |
| 6.3 — Fix verificarEAvancarPacote | ✅ Live em produção |
| 6.4 — GET+PATCH comprobatorios + UI | ✅ Live em produção |
| TypeScript check | ✅ `tsc --noEmit` limpo |
| Vercel deploy | ✅ READY (`dpl_89vEbauDXmayo2s9GnegqbzZ287Q`) |

---

## Próxima Sessão

**Sprint 7** — Pacote Registradora (G4–G7 do plano end-to-end):
- G4: Endpoint de montagem do pacote ZIP (XMLs + .p7s + PDFs/A + manifest)
- G5: Upload do pacote para UFMS
- G6: Recebimento do retorno da registradora (XML registrado)
- G7: Atualização do status final `registrado` + portal diplomado

Ver `PLANO-PIPELINE-END-TO-END.md` para detalhes.
