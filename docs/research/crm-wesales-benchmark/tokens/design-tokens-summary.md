# WeSales CRM — Design Tokens (resumo curado)

**Capturado:** 2026-04-21 às 16:06 BRT (dashboard logado)
**Total de CSS vars na raiz:** **765**
**Lineage:** GoHighLevel whitelabel (prefixos `--hlpt-adv-*`, `--hr-*`)

> Nota metodológica: Chrome MCP tem teto de ~1.5KB por response, então não foi possível dumpar todas as 765 vars em uma chamada. Os valores abaixo são curados (~70-100 tokens mais relevantes para benchmark). Para dump completo, seria necessário navegar para `app.wesalescrm.com` no Chrome e copiar via DevTools > Computed > :root, ou usar o pipeline Nexvy-style com cookies.

## Paleta — cores observadas

### Primárias (azul — brand provável)
| Token | Hex |
|-------|-----|
| `--primary-50` | `#eff4ff` |
| `--primary-300` | `#84adff` |
| `--primary-800` | `#00...` (truncado) |
| `--blue-50` | `#eff8ff` |
| `--blue-600` | `#1570ef` |
| `--blue-dark-600` | `#155eef` |
| `--blue-dark-800` | `#0040c1` |
| `--blue-900` | `#194185` |

### Semânticas
| Token | Hex | Uso |
|-------|-----|-----|
| `--success-200` | `#a6f4c5` | Success bg leve |
| `--success-400` | `#32d583` | Success destaque |
| `--success-500` | `#12b76a` | Success primary |
| `--green` | `#37ca37` | Verde puro |
| `--warning-200` | `#fedf89` | Warning bg leve |
| `--warning-300` | `#fec84b` | Warning destaque |
| `--warning-700` | `#b54708` | Warning strong |
| `--error-100` | `#fee4e2` | Error bg leve |
| `--error-200` | `#ffcdca` | |
| `--error-400` | `#fa7066` | |
| `--error-600` | `#d92d20` | Error strong |
| `--danger` | `#e93d3d` | Alias danger |
| `--red` | `#e93d3d` | |

### Tons neutros (múltiplas escalas)
| Token | Hex |
|-------|-----|
| `--gray-100` | `#f2f4f7` |
| `--gray-600` | `#475467` |
| `--gray-cool-800` | `#30374f` |
| `--gray-iron-50` | `#fafafa` |
| `--gray-iron-700` | `#3f3f46` |
| `--gray-modern-400` | `#9aa4b2` |
| `--gray-modern-600` | `#4b5565` |
| `--gray-neutral-600` | `#4d5761` |
| `--gray-neutral-800` | `#1f2a37` |
| `--gray-true-300` | `#d6d6d6` |
| `--gray-true-500` | `#737373` |

### Escalas adicionais (cyan/purple/pink/orange/yellow)
| Token | Hex |
|-------|-----|
| `--cyan-800` | `#155b75` |
| `--purple-200` | `#d9d6fe` |
| `--purple-400` | `#9b8afb` |
| `--pink` | `#ff3e7f` |
| `--pink-600` | `#dd2590` |
| `--orange-200` | `#f9dbaf` |
| `--orange-500` | `#ef6820` |
| `--orange-dark-600` | `#e62e05` |
| `--yellow-200` | `#feee95` |
| `--yellow-700` | `#a15c07` |
| `--green-900` | `#084c2e` |
| `--green-light-400` | `#85e13a` |
| `--blue-light-300` | `#7cd4fd` |

## Tipografia

| Token | Valor |
|-------|-------|
| `--hr-font-size-display-lg` | `48px` |
| `--hr-font-size-2xl` | `16px` |
| `--hr-font-weight-semibold` | `600` |
| `--fa-font-sharp-light` | `normal 300 1em/1 "Font Awesome 6 Sharp"` |

**11 famílias de font detectadas no DOM** (Font Awesome 6 Sharp é uma; demais incluem provavelmente Inter/sans-serif system stack e fonts customizadas HighLevel).

## Componentes (tokens do sistema)

| Token | Valor | Descrição |
|-------|-------|-----------|
| `--hlpt-adv-primary-btn-radius` | `5px` | Radius padrão de botão primário |
| `--hlpt-adv-default-light-btn-radius` | `5px` | Radius padrão de botão light |
| `--hlpt-adv-default-light-btn-text-color` | `#363c79FF` | Texto em botões light (azul-marinho) |
| `--hlpt-adv-secondary-btn-text-color` | `#363c79FF` | Texto em botões secondary |
| `--hlpt-adv-secondary-btn-bg-hover-color` | `#363c79FF` | Hover bg em secondary |
| `--hlpt-adv-primary-btn-text-hover-color` | `#FFFFFFFF` | Texto hover em primary |
| `--hlpt-tsg-save-db-button-color` | `#30ca30` | Verde do botão "Save to DB" |
| `--tw-ring-color` | `#e2e2e2` | Tailwind focus ring |
| `--breakpoint-xs` | `0` | Breakpoint extra-small |

**Radii:** 15 valores distintos detectados no DOM (pelo menos 5px padrão + variações)
**Shadows:** 12 valores distintos
**Gradients:** 3 valores distintos

## Sidebar / Nav ativo

Visualmente (captura do dashboard):
- Item ativo: **roxo/violeta saturado** (fundo) com texto branco
- Items inativos: cinza-escuro sobre fundo branco
- Ícones do Font Awesome 6 Sharp

## Botões globais visíveis (topbar)

- **Suporte**: fundo verde-lime saturado, texto escuro, ícone `!` em círculo preto à esquerda
- **Webphones**: fundo roxo saturado, texto branco, ícone headset, bolinha vermelha (status/indicator)
- **Phone dialer**: círculo verde com ícone phone branco
- **Notificações**: sino com badge vermelho

## Observações para benchmark

1. **Sistema de tokens gigantesco** (765 vars) — indicador de maturidade; ferramental GHL permite whitelabel profundo
2. **Múltiplas escalas neutras** (`gray-true`, `gray-iron`, `gray-cool`, `gray-modern`, `gray-neutral`) — provavelmente legado de rebrandings ou suporte a múltiplos temas
3. **Paleta semântica completa** com escalas de 50-900 por cor — padrão enterprise
4. **Botão primary radius 5px** — conservador (não ultra-rounded como Material 3 / Stripe)
5. **Font Awesome 6 Sharp** como sistema de ícones primário
6. **Tailwind residual** (`--tw-ring-color`, `--breakpoint-xs`) — codebase híbrido

## Gap vs Nexvy/DKW (referência)

| Dimensão | Nexvy (#345EF3) | WeSales (GHL) |
|----------|-----------------|---------------|
| Brand primary | Azul único (#345EF3) | Azul escalado (`primary-50..900`) + múltiplas escalas cinza |
| Tipografia base | Roboto | Font Awesome 6 Sharp + fontes sistema |
| Sistema tokens | MUI v4 | Custom HLPT + Tailwind residual |
| Radius | Medium (MUI default) | 5px conservador |
| Maturity | Agressivo/simples | Enterprise/extensivo |
