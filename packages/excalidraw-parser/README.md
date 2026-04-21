# @ecossistema/excalidraw-parser

Lê arquivos `.excalidraw` (JSON) e produz grafo estruturado + Markdown para agentes consumirem.

Caso de uso canônico: **Marcelo rascunha workflow ou arquitetura no Excalidraw → Claudinho lê o `.excalidraw` exportado → gera ADR/runbook/doc a partir do rascunho.**

## Uso

```ts
import { parseExcalidraw, toMarkdown } from "@ecossistema/excalidraw-parser";
import { readFileSync } from "node:fs";

const raw = readFileSync("fluxo-cfo.excalidraw", "utf8");
const parsed = parseExcalidraw(raw);

console.log(parsed.nodes);  // [{ id, shape, label }]
console.log(parsed.edges);  // [{ id, fromId, toId, label }]
console.log(parsed.floatingTexts); // [{ id, text }]

const md = toMarkdown(parsed, "Fluxo de fechamento CFO-FIC");
// # Fluxo de fechamento CFO-FIC
// ## Formas (3) ...
// ## Conexões (2) ...
// ## Notas soltas (1) ...
```

## O que é extraído

| Elemento Excalidraw | Vira | Regra |
|---|---|---|
| `rectangle`, `ellipse`, `diamond` | **Nó** (`Node`) | Label = texto filho com `containerId` apontando para a forma |
| `arrow` | **Aresta** (`Edge`) | `fromId`/`toId` vêm de `startBinding`/`endBinding`; label = `text` no próprio arrow |
| `text` sem `containerId` | **Nota solta** (`FloatingText`) | Descontado o texto vazio e elementos com `isDeleted=true` |
| `line`, `freedraw`, `text` deletado | ignorado | — |

## O que NÃO faz (propositalmente)

- Não renderiza UI — é utilitário puro para agentes consumirem
- Não exporta Mermaid/DOT (adicionar se demanda aparecer)
- Não infere tipo semântico do nó (ator vs sistema vs decisão) — cabe ao agente consumidor

## Limitações conhecidas

- Label de nó só pega **o primeiro filho de texto** via `containerId`. Múltiplos textos empilhados em cima da mesma forma são ignorados além do primeiro
- Formato Excalidraw v2 (2024+). Versões antigas podem ter schemas diferentes

## Testes

```bash
pnpm --filter @ecossistema/excalidraw-parser test
```

Fixture: `tests/fixtures/cfo-close-flow.excalidraw.json` — diagrama de fechamento CFO-FIC com 3 nós, 2 arestas, 1 nota solta, 1 elemento deletado para validar filtro.
