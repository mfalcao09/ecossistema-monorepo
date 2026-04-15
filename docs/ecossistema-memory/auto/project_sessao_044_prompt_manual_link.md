---
name: Sessão 044 — Prompt Gemini revisado + inserção manual de comprobatórios
description: Prompt extração reescrito com tabela fixa de tipos + confiança obrigatória; DialogSelecionarArquivo para vinculação manual; fixes confiança 0% no server.js
type: project
---

Sessão 044 (10/04/2026): Prompt Gemini revisado + inserção manual de comprobatórios quando IA falha.

**Commit:** `30e2d51` (main)

**Problema:** Extração anterior mostrava confiança 0% e só 1/4 comprobatórios detectados (screenshot de Marcelo). Causas: prompt vago, `|| 0` zerando confiança legítima, filtro `!== 'outro'` descartando documentos.

**Arquivos criados/modificados:**
- `services/document-converter/src/extractor.js` — PROMPT_EXTRACAO reescrito: tabela fixa de 14 tipos válidos para tipo_documento_detectado (case-sensitive), confiança 0.05-1.0 obrigatória (nunca null/0), passo-a-passo (classificar → extrair → confiar), dicas visuais por tipo de documento brasileiro
- `services/document-converter/src/server.js` — confianca_geral agora usa `typeof === 'number'` em vez de `|| 0`; tipo_documento_detectado fallback `?? 'outro'` em vez de `|| null`; agregarDados() não filtra mais "outro" (frontend lida)
- `src/lib/diploma/mapa-comprobatorios.ts` — expandido com 20+ variações: CIN, CNH, e-Título, diploma, comprovante matrícula, estágio curricular etc.
- `src/components/diploma/revisao/DialogSelecionarArquivo.tsx` — NOVO: picker de arquivo para vinculação manual. Lista todos os arquivos da sessão com ícones MIME, mostra se já vinculado a outro tipo, seleção + botão "Vincular arquivo"
- `src/app/(erp)/diploma/processos/novo/revisao/[sessaoId]/page.tsx` — novo estado `tipoSelecaoManual`, useMemo `arquivosSessaoParaPicker`, handler `handleSelecionarArquivoManual` (cria confirmação "detectado"), `onSubstituirArquivo` passado ao GateFicComprobatorios

**Fluxo manual (NOVO):**
1. Comprobatório pendente (cinza) → operador clica "Enviar"
2. DialogSelecionarArquivo abre → lista todos os arquivos da sessão
3. Operador seleciona arquivo → estado vira "detectado" (amarelo)
4. Operador clica "Visualizar" → dialog de preview abre
5. Confirma com checkbox → badge fica verde

**Review:** Buchecha (MiniMax M2.7) revisou — aprovou fluxo 2-step, sugeriu origin tracking (AI vs manual) como melhoria futura, apontou que `confianca: undefined` é OK pois serialização omite.

**Why:** Marcelo reportou dados "bagunçados" com 0% confiança e 1/4 detectados. Root cause: prompt vago + `|| 0` + filtro excessivo.

**How to apply:** O prompt novo no Railway precisa de redeploy manual (Railway não faz auto-deploy pelo GitHub do Next.js). O mapa de comprobatórios em `mapa-comprobatorios.ts` é a fonte de verdade para matching Gemini → XSD.
