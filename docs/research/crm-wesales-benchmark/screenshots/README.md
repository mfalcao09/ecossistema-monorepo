# Screenshots — instruções de preenchimento manual

## Contexto

Chrome MCP não persiste screenshots em disco automaticamente (mantém só in-memory na conversa).
Esta pasta é para **upload manual** das capturas que Marcelo vai fazer com Cmd+Shift+4 (macOS) ou similar.

## Estrutura sugerida

```
screenshots/
├── desktop/                 # capturas 1440+ wide, uma por seção
│   ├── 02-dashboard.png
│   ├── 03-conversations.png
│   ├── 04-calendars.png
│   ├── 05-contacts.png
│   ├── 06-opportunities.png
│   ├── 07-payments.png
│   ├── 08-ai-agents.png
│   ├── 09-marketing.png
│   ├── 10-automation.png
│   ├── 11-sites.png
│   ├── 12-memberships.png
│   ├── 13-media-storage.png
│   ├── 14-reputation.png
│   ├── 15-reporting.png
│   ├── 16-app-marketplace.png
│   └── 17-settings.png
├── mobile/                  # capturas 375px (iPhone) — DevTools responsive
│   ├── dashboard-mobile.png
│   ├── conversations-mobile.png
│   └── contacts-mobile.png
├── modals/                  # dialogs/drawers específicos
│   ├── add-contact-drawer.png
│   ├── add-opportunity-drawer.png
│   ├── workflow-new-trigger.png
│   └── bulk-action-menu.png
├── flows/                   # sequências (criar lead, mover card, etc)
│   ├── create-lead-01-click.png
│   ├── create-lead-02-form.png
│   ├── create-lead-03-submit.png
│   ├── create-lead-04-success.png
│   ├── pipeline-drag-01-before.png
│   ├── pipeline-drag-02-after.png
│   └── send-message-01-compose.png
├── settings-drill/          # cada sub-item do Settings
│   ├── business-profile.png
│   ├── my-staff.png
│   ├── phone-system.png
│   ├── whatsapp.png
│   ├── custom-fields.png
│   ├── custom-values.png
│   ├── lead-scoring.png
│   ├── pipelines-settings.png
│   └── integrations.png
├── ai-agents-drill/         # cada sub-tab do AI Agents
│   ├── voice-ai-config.png
│   ├── conversation-ai-config.png
│   ├── agent-studio-builder.png
│   ├── knowledge-base.png
│   ├── agent-templates-gallery.png
│   ├── content-ai-editor.png
│   └── agent-logs-list.png
└── automation-drill/        # workflow builder interno
    ├── workflows-list.png
    ├── new-workflow-trigger-picker.png
    ├── new-workflow-action-picker.png
    ├── workflow-canvas-empty.png
    └── workflow-canvas-populated.png
```

## Convenção de nomes

- **Lowercase** com hífens (kebab-case)
- **Prefixar com número** se houver ordem (fluxos sequenciais)
- **Sufixar com estado** se capturar variações (`-mobile`, `-empty`, `-filled`, `-hover`, `-error`)
- **Incluir seção** quando não óbvio pelo path

## Formato

- **PNG** (preferido pra UI screenshots — sem compressão lossy)
- **JPG** OK para flows longos/animations ou se tamanho importar
- **Full-page** (use Cmd+Shift+4+Space no macOS ou Full Page Screenshot do Chrome DevTools Ctrl+Shift+P > "Capture full size screenshot")

## Passo-a-passo macOS para capturas

### Full page (scroll inteiro)
1. Abrir DevTools (Cmd+Option+I)
2. Cmd+Shift+P (command palette)
3. Digitar "Capture full size screenshot"
4. PNG cai em ~/Downloads
5. Move/renomeia para a subpasta correta

### Viewport (tela visível)
- Cmd+Shift+4 → espaço → clicar na janela = captura só da janela
- Cmd+Shift+4 → arrastar = selecionar região

### Mobile responsive
1. Abrir DevTools (Cmd+Option+I)
2. Toggle device toolbar (Cmd+Shift+M)
3. Escolher iPhone 15 Pro (393×852) ou iPhone SE (375×667)
4. Capturar com "Capture full size screenshot"

## Priorização (o que capturar primeiro)

**Tier 1 (imprescindível pro benchmark)** — 8 capturas
- `desktop/03-conversations.png` (3 painéis, right-rail 9-slots)
- `desktop/10-automation.png` (lista de workflows)
- `automation-drill/workflow-canvas-populated.png` (builder visual)
- `desktop/08-ai-agents.png` (landing)
- `ai-agents-drill/voice-ai-config.png`
- `ai-agents-drill/agent-studio-builder.png`
- `settings-drill/whatsapp.png` (settings de WhatsApp)
- `modals/add-contact-drawer.png` (já capturado inline — re-capturar permanente)

**Tier 2 (complementar)**
- Restante dos 17 desktops top-level
- Settings: Custom Fields, Custom Values, Lead Scoring, Pipelines, My Staff
- Flows: criar lead + mover card kanban + enviar mensagem

**Tier 3 (nice-to-have)**
- Mobile responsive das 3 telas mais críticas
- Hover states, dropdowns expandidos, loading states

## Cross-reference com os .md

Cada seção `sections/XX-nome.md` pode ser atualizada depois com `![alt](../screenshots/desktop/XX-nome.png)` para embedar a imagem no próprio doc.
