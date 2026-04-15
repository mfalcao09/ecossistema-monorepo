---
name: Sessão 043 — Gate FIC 3 estados + dialog confirmação comprobatórios
description: Gate FIC redesenhado com 3 estados visuais (pendente/detectado/confirmado), dialog de preview com signed URL, mapeamento Gemini→XSD, botão Criar Processo bloqueado até 4/4 confirmados
type: project
---

Sessão 043 (10/04/2026): Gate FIC de comprobatórios redesenhado com 3 estados visuais e confirmação humana obrigatória.

**Commit:** `5c29bdd` (main)
**Arquivos criados/modificados:**
- `src/lib/diploma/mapa-comprobatorios.ts` — mapeamento Gemini texto livre → XSD v1.05 (30+ variações), tipos `ConfirmacaoComprobatorio`, `StatusConfirmacao`, função `construirConfirmacoes()`
- `src/components/diploma/revisao/GateFicComprobatorios.tsx` — reescrito com 3 estados: cinza (pendente), amarelo (detectado pela IA), verde (confirmado pelo operador). Botões "Visualizar" e "Enviar" por regra.
- `src/components/diploma/revisao/DialogVisualizarDocumento.tsx` — dialog modal com preview (imagem/PDF via signed URL Supabase 10min), checkbox "Confirmo que este é o documento correto", reclassificação de tipo XSD
- `src/app/(erp)/diploma/processos/novo/revisao/[sessaoId]/page.tsx` — estado `confirmacoes` (Map<TipoXsd, Confirmacao>), hidratação de comprobatorios_detectados, auto-save com confirmacoes_comprobatorios, gate bloqueia "Criar Processo" até 4/4 confirmados

**Fluxo UX:**
1. Upload arquivos (Tela 1) → extração IA (Railway/Gemini)
2. Tela 2 sidebar mostra "3/4 detectados" com badges amarelos
3. Operador clica "Visualizar" → dialog abre com preview do documento
4. Operador marca checkbox + clica "Confirmar" → badge fica verde
5. Se IA errou o tipo → "Reclassificar tipo" permite trocar
6. Botão "Criar Processo" só libera com 4/4 verdes

**Review:** Buchecha (MiniMax M2.7) revisou — pattern de Map imutável correto, sugeriu botão desabilitado com contador (implementado).

**Why:** Marcelo pediu melhoria de UX porque sidebar "0/4 atendidos" dava impressão errada de docs faltantes, quando na verdade já estavam enviados.

**How to apply:** Toda vez que mexer no fluxo de comprobatórios, considerar os 3 estados. O `comprobatorios_detectados` vem do agregarDados() no Railway (server.js) e usa nomes livres do Gemini que são mapeados por `mapa-comprobatorios.ts`.
