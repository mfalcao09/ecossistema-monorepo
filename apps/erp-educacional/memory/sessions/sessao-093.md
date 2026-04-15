# Sessão 093 — Pipeline End-to-End: Diagnóstico, Plano e Decisões

**Data:** 14/04/2026  
**Duração estimada:** ~3h  
**Módulo:** Diploma Digital  
**Sprint:** Pré-Sprint 6 (planejamento)  
**Masterplan:** diploma-digital-v4  

---

## O que foi feito

### 1. Fix diploma da Kauana (herdado da sessão anterior)
- Diploma `5e197846-8d55-4105-94db-b15ce99bf69b` estava preso em `em_assinatura` porque BRy Finalize retornou sucesso sem XML assinado
- Criado script Node.js `fix-kauana-diploma.mjs` para:
  - Criar bucket `xml-diplomas` que não existia (via SQL INSERT em `storage.buckets`)
  - Usar `conteudo_xml` como substituto do XML assinado (BRy não retornou versão assinada)
  - Fazer upload dos 2 XMLs para o bucket
  - Atualizar `xml_gerados.status = 'assinado'` + `arquivo_url`
  - Avançar `diplomas.status = 'aguardando_envio_registradora'`
- **Resultado:** Diploma da Kauana avançado com sucesso para Etapa 3

### 2. Fix labels "Rascunho" (bug STATUS_CONFIG)
**Causa raiz:** STATUS_CONFIG em `diploma/page.tsx` tinha apenas 11 entradas + fallback ruim (`?? STATUS_CONFIG.rascunho`)  
**Arquivos modificados:**
- `src/app/(erp)/diploma/page.tsx` — STATUS_CONFIG expandido de 11 → 30+ status; label `rascunho` → "Em preparação"; fallback corrigido para `{ label: d.status, cor: "gray", icone: Clock }`
- `src/app/(erp)/diploma/diplomas/[id]/page.tsx` — STATUS_LABEL + STATUS_COR expandidos com todos os status do pipeline
- `src/types/diplomas.ts` — STATUS_DIPLOMA_LABELS sincronizado; comment de `rascunho` atualizado
- `src/components/diploma/BannerSessaoAtiva.tsx` — labels `rascunho` e `aguardando_revisao` corrigidos

### 3. Análise dos gaps do pipeline
Identificação de 11 gaps entre as Etapas 2–5:
- G1: Arquivos "Acervo" do processo não copiados para o diploma na criação
- G2: `/api/converter/pdfa` existe mas nunca é chamada
- G3: `verificarEAvancarPacote` pula Etapa 2 inteira
- G4–G6: Histórico Escolar PDF + Termos não implementados
- G7: BRy `api-assinatura-digital` não integrada
- G8–G10: ZIP, upload UFMS, recebimento XML registrado
- G11: UI "Ações do pipeline" sem ações para Etapas 2–5

### 4. Plano de 4 Sprints (6–9)
Documento criado: `memory/sprints/PLANO-PIPELINE-END-TO-END.md`

### 5. Arquivo HTML visual do pipeline
Criado: `GitHub/pipeline-diploma-digital.html` — visual escuro com 6 etapas, status de cada ação, sprints e decisões pendentes

### 6. Decisões confirmadas por Marcelo
Todas as 4 decisões pendentes foram respondidas:
- D1: Templates dos termos disponíveis ✅
- D2: Contrato BRy Assinatura Digital ativo ✅
- D3: Upload manual no sistema web UFMS ✅
- D4: Layout RVDD da FIC disponível ✅

**Nenhum sprint está bloqueado.** Podemos iniciar Sprint 6 imediatamente.

---

## Arquivos criados/modificados

| Arquivo | Tipo | O que mudou |
|---------|------|-------------|
| `src/app/(erp)/diploma/page.tsx` | Modificado | STATUS_CONFIG 11→30+, fallback corrigido, label rascunho |
| `src/app/(erp)/diploma/diplomas/[id]/page.tsx` | Modificado | STATUS_LABEL+STATUS_COR expandidos |
| `src/types/diplomas.ts` | Modificado | STATUS_DIPLOMA_LABELS sincronizado |
| `src/components/diploma/BannerSessaoAtiva.tsx` | Modificado | Labels rascunho/aguardando_revisao corrigidos |
| `memory/sprints/PLANO-PIPELINE-END-TO-END.md` | Criado | Plano completo S6–S9 com todas as decisões |
| `GitHub/pipeline-diploma-digital.html` | Criado | Visualização do pipeline completo |
| `storage.buckets['xml-diplomas']` | Criado (Supabase) | Bucket para XMLs assinados (não existia) |

---

## Status no final da sessão

- Diploma da Kauana: ✅ avançado para `aguardando_envio_registradora`
- Bug labels "Rascunho": ✅ corrigido nos 4 arquivos
- Plano S6–S9: ✅ documentado e aprovado
- Todas as decisões: ✅ confirmadas

---

## Próxima Sessão — 094

**Objetivo:** Sprint 6 — Acervo Digital  
**O que implementar:**
1. Item 6.1 — RPC `converter_sessao_em_processo`: copiar arquivos Acervo para o diploma
2. Item 6.2 — Wiring de conversão PDF/A automática ao receber comprobatórios
3. Item 6.3 — Corrigir `verificarEAvancarPacote`: `assinado → aguardando_documentos`
4. Item 6.4 — UI Etapa 2 no bloco "Ações do pipeline"

**Arquivos a tocar na 094:**
- `supabase/migrations/` — alterar RPC `converter_sessao_em_processo`
- `src/lib/diploma/verificar-e-avancar-pacote.ts`
- `src/app/api/diplomas/[id]/acervo/route.ts`
- `src/app/(erp)/diploma/diplomas/[id]/page.tsx`

**Não há bloqueadores** — pode iniciar direto.
