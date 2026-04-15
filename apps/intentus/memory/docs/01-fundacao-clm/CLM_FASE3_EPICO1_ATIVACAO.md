# CLM Fase 3 — Épico 1: Alertas e Notificações Inteligentes

## Resumo

Centro de notificações in-app com sino na topbar, dropdown interativo, filtro por categoria, e painel de preferências de notificação.

---

## Arquivos Modificados/Criados

| Arquivo | Ação | Função |
|---------|------|--------|
| `src/hooks/useNotifications.ts` | **Expandido** | Adicionado: preferências, delete, helpers de link/tempo, constantes de categorias |
| `src/components/notifications/NotificationCenter.tsx` | **Novo** | Sino na topbar com dropdown, badge de contagem, filtro por categoria, ações |
| `src/components/notifications/NotificationPreferences.tsx` | **Novo** | Painel de configuração (app/email/frequência por categoria) |

---

## Passo a Passo para Ativação

### 1. Adicionar o sino na Topbar/Header

Localize o componente de Header/Topbar do app (geralmente em `src/components/layout/` ou `src/components/Header.tsx`).

Adicione o import e o componente:

```tsx
import NotificationCenter from "@/components/notifications/NotificationCenter";

// No JSX do header, ao lado do avatar/menu do usuário:
<NotificationCenter />
```

### 2. Adicionar preferências na página de Configurações

Abra `src/pages/ClmSettings.tsx` e adicione:

```tsx
import NotificationPreferences from "@/components/notifications/NotificationPreferences";
```

Adicione uma nova tab:

```tsx
<TabsTrigger value="notificacoes">Notificações</TabsTrigger>

<TabsContent value="notificacoes">
  <NotificationPreferences />
</TabsContent>
```

---

## Tabelas Utilizadas

| Tabela | Uso |
|--------|-----|
| `notifications` | Notificações do usuário (10 colunas) |
| `notification_preferences` | Preferências por categoria (9 colunas) |
| `contract_alert_log` | Log de alertas enviados (9 colunas) — usado pelas Edge Functions |
| `legal_notifications` | Notificações jurídicas formais (18 colunas) — módulo separado |

---

## Funcionalidades

### NotificationCenter (Sino)
- Badge vermelho com contagem de não lidas (atualiza a cada 15s)
- Realtime via Supabase (novas notificações aparecem instantaneamente)
- Dropdown com lista scrollável (até 100 notificações)
- Filtro por categoria (pills coloridas)
- Marcar como lida (individual e todas)
- Excluir notificação
- Clique navega para o recurso relacionado (contrato, cobrança, etc.)
- Tempo relativo ("há 2 min", "há 3h", "há 1 dia")
- Ícone contextual por categoria

### NotificationPreferences
- Toggle App (in-app on/off por categoria)
- Toggle Email (email on/off por categoria)
- Seletor de frequência (imediato, diário, semanal)
- Categorias: Sistema, Contratos, Cobrança, Aprovações, Vencimentos, Alertas, IA

---

## Edge Functions Relacionadas (Backend)

Essas Edge Functions já existem e geram as notificações:

- `unified-alerts` — Sistema centralizado de alertas
- `clm-alert-scheduler` — Agendador de alertas do CLM
- `clm-lifecycle-processor` — Processador de ciclo de vida de contratos

---

## Commit Sugerido

```
feat(clm): add notification center and preferences (Phase 3 Epic 1)

- Expand useNotifications hook with preferences, delete, category helpers
- Create NotificationCenter component (bell icon + dropdown)
- Create NotificationPreferences component (app/email/frequency toggles)
- Add realtime subscription for instant notification updates
- Support category filtering and relative time display
```
