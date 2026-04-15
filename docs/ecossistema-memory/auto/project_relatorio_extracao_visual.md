---
name: Relatório de Extração — Visual FIC Atualizado
description: Relatorio de extração de dados do processo de diploma atualizado com identidade visual FIC (azul/vermelho) e cabeçalho institucional padrão
type: project
---

## Relatório de Extração — Identidade Visual FIC

**Arquivo:** `src/app/(erp)/diploma/processos/[id]/page.tsx`

A função `exportarDados` (useCallback) gera um HTML inline aberto em `window.open("", "_blank")`.

**Sessão 05/04/2026 — mudanças aplicadas:**
- Cores: roxo `#7c3aed` → azul FIC `#1e40af` em toda a UI (section-titles, tabelas, links)
- Botão Imprimir: roxo → vermelho FIC `#dc2626` com sombra e ícone 🖨️
- Cabeçalho substituído pelo timbrado oficial FIC (commit `9d6c37b`):
  - Faixa decorativa tricolor (cinza `#4b5563` / vermelho `#dc2626` / azul `#1e3a8a`) no topo e embaixo
  - Nome da instituição em uppercase + bold à esquerda
  - Dados de Credenciamento e Recredenciamento abaixo do nome
  - Logo FIC à direita (`/logo-fic.png`)
  - Título "Dados do Processo de Emissão de Diploma Digital" centralizado abaixo do timbrado
- Rodapé: "FIC" em azul bold com classe `.footer-brand`

**Estrutura do timbrado (HTML/CSS atual):**
- `.timbrado-stripe` — faixa tricolor (gradient), `margin: 0 -20px` para sangrar nas bordas do body
- `.timbrado-content` — flex row: info à esquerda + logo à direita
- `.timbrado-name` — nome da IES uppercase, cor `#111827`
- `.timbrado-cred` — texto de credenciamento, 9.5px, cor `#374151`
- `.timbrado-logo` — 64px de altura

**Why:** Marcelo quer o timbrado EXATO (imagem real), não recriação em CSS. Quando ele diz "use o timbrado", significa a imagem PNG, nunca gradientes ou HTML.

**How to apply:** Ao editar esse relatório no futuro, manter `TimbradoSISTEMA.png` como fundo fixo. NÃO criar CSS para simular o timbrado. Verificar sempre os assets em `/public` antes de criar qualquer elemento visual.

**Cores FIC de referência:**
- Azul principal: `#1e40af` (hover/dark: `#1e3a8a`)
- Vermelho: `#dc2626` (hover: `#b91c1c`)
- Logo: `/public/logo-fic.png`
