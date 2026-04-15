---
name: Sessão 049 — fix gate tipo_xsd desincronizado com confirmações
description: Bug onde sidebar mostrava 4/4 confirmados mas gate bloqueava criação porque tipo_xsd não era salvo no banco ao confirmar comprobatórios
type: project
---

Sessão 049 (11/04/2026): fix gate comprobatórios false positive.

**Bug:** Sidebar da Tela 3 mostrava "4/4 confirmados" (via Map `confirmacoes` in-memory), mas ao clicar "Criar processo" o modal mostrava todos 4 como faltantes. Causa: `handleConfirmarComprobatorio` atualizava apenas o Map `confirmacoes`, sem refletir o `tipo_xsd` nos `arquivosClassif`. O auto-save e flush pré-converter enviavam `arquivosClassif` com `tipo_xsd: null` ao banco. A rota `/converter` lia `processo_arquivos.tipo_xsd` do banco → gate filtrava `.filter(a => a.tipo_xsd)` → nenhum passava → todos faltantes.

**Fix:** Criado `useMemo` `arquivosComConfirmacoes` que mescla `arquivosClassif` com as confirmações (por `nome_original`), setando `tipo_xsd` e `destino_xml: true` para comprobatórios confirmados. Substituído `arquivosClassif` por `arquivosComConfirmacoes` nos dois pontos de serialização (auto-save debounced + flush pré-converter).

**Why:** O sidebar e o gate usavam fontes de dados diferentes — Map in-memory vs campo no banco. A ponte entre eles (serialização no auto-save) não incluía o tipo_xsd derivado das confirmações.

**How to apply:** Qualquer novo campo que seja editado em estado in-memory E precise ser persistido no banco deve ter sua serialização verificada no auto-save e no flush pré-converter.

Commit: eb5561b. Deploy Vercel automático.
