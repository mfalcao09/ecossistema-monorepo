# Escopo — Package `@ecossistema/office365`

> **Sessão sugerida:** F1-S02 · **Fase:** 1 (após F1-S01 jarvis-app)
> **Relacionado:** ADR-018 (Office 365 via Graph app-only), `@ecossistema/credentials`, `@ecossistema/agentes`
> **Tenant piloto:** FIC (`fic.edu.br`)

---

## Objetivo

Encapsular toda a integração com **Microsoft 365 / Microsoft Graph API** em um único package TypeScript, consumível por:

1. **Módulos CRM dos produtos** (caso de uso primário — ADR-018): **ERP-FIC (F1)**, Intentus (F2, requer ADR-020), Nexvy (F3). O CRM chama o package para enviar e-mail como usuário, sincronizar threads, anexar arquivos em SharePoint, consultar agenda.
2. **Agentes autônomos** (caso de uso secundário): CFO-FIC, CAO-FIC, Secretaria-FIC operando headless no Railway.

Segue o padrão dos demais packages do monorepo (pnpm workspace, TypeScript estrito, `zod` para validação).

## Localização

- **Path:** `packages/office365/`
- **Nome npm:** `@ecossistema/office365`
- **Padrão:** pnpm workspace (igual `@ecossistema/credentials`, `@ecossistema/memory`, etc.)

## Stack

| Camada | Lib | Razão |
|---|---|---|
| Auth | `@azure/msal-node` | Oficial Microsoft; suporta client credentials flow; token cache nativo |
| HTTP | `@microsoft/microsoft-graph-client` | SDK oficial; retry exponencial; paginação; `select`/`expand` helpers |
| Types | `@microsoft/microsoft-graph-types` | Types oficiais (Message, Event, DriveItem, etc.) |
| Validação | `zod` | Padrão do monorepo em todos os packages |
| Test | `vitest` | Padrão do monorepo |
| Runtime | Node 20+ (padrão Railway) |

## API pública mínima (Fase 1)

```ts
// packages/office365/src/index.ts
export { createOffice365Client } from './client'
export { MailService } from './services/mail'
export { CalendarService } from './services/calendar'
export { FilesService } from './services/files'
export { Office365Error, Office365ThrottledError, Office365AuthError } from './errors'
export type * from './types'
```

Uso esperado por um agente:

```ts
import { createOffice365Client } from '@ecossistema/office365'
import { getCredential } from '@ecossistema/credentials'

const creds = await getCredential('office365_fic', { actor: 'cfo-fic' })
const o365 = createOffice365Client({
  clientId: creds.client_id,
  tenantId: creds.tenant_id,
  clientSecret: creds.client_secret,
})

const inbox = await o365.mail.listMessages({
  mailbox: 'secretaria@fic.edu.br',
  folder: 'inbox',
  top: 20,
})
```

## Estrutura de arquivos

```
packages/office365/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md
└── src/
    ├── index.ts                  # barrel + re-exports
    ├── auth.ts                   # MSAL client credentials, token cache em memória
    ├── client.ts                 # factory createOffice365Client(creds)
    ├── types.ts                  # types derivados de @microsoft/microsoft-graph-types
    ├── errors.ts                 # Office365Error + subclasses por código Graph
    └── services/
        ├── mail.ts
        ├── calendar.ts
        └── files.ts
```

### `src/auth.ts`

- MSAL `ConfidentialClientApplication` com client credentials flow
- Token cache **em memória** (escopo do processo); não persistir token em disco nem em Supabase
- Auto-refresh quando `expires_on - now < 5min`
- Log via `@ecossistema/observability` (futuro) / `console.info` estruturado por enquanto

### `src/client.ts`

- Factory `createOffice365Client(creds)` → retorna `{ mail, calendar, files, _graph }`
- Injeta um `GraphClient` autenticado nos services
- Recebe credenciais já resolvidas (não chama `@ecossistema/credentials` diretamente — inversão de controle; agente decide como buscar)

### `src/services/mail.ts`

Métodos Fase 1 — agentic (uso por agente autônomo):

| Método | HITL? | Graph endpoint (verificar docs) |
|---|---|---|
| `listMessages({ mailbox, folder, top, filter })` | não | `GET /users/{mailbox}/mailFolders/{folder}/messages` |
| `getMessage({ mailbox, messageId })` | não | `GET /users/{mailbox}/messages/{id}` |
| `sendMail({ mailbox, to, subject, body, cc?, bcc? })` | **sim** | `POST /users/{mailbox}/sendMail` |
| `replyToMessage({ mailbox, messageId, body })` | **sim** | `POST /users/{mailbox}/messages/{id}/reply` |
| `moveToFolder({ mailbox, messageId, folderId })` | não | `POST /users/{mailbox}/messages/{id}/move` |

Métodos Fase 2 — CRM-embedded (uso pelo backend CRM, sem HITL porque quem aprova é o usuário humano no UI):

| Método | Observações |
|---|---|
| `sendAsUser({ userMailbox, to, subject, body, attachments?, cc?, bcc?, replyTo? })` | Envia via `POST /users/{userMailbox}/sendMail` com `saveToSentItems: true` — aparece na pasta Enviados do usuário. `From` resolvido automaticamente pelo Graph (não setar manual). |
| `listThread({ mailbox, conversationId })` | Retorna thread completo agrupado por `conversationId` — o CRM mostra histórico ordenado no deal/contato |
| `delta({ mailbox, folder, deltaToken? })` | Sincronização incremental (Graph delta query) — CRM guarda `deltaToken` e pede só o que mudou. Evita full-scan a cada refresh. |
| `downloadAttachment({ mailbox, messageId, attachmentId })` → `Buffer` | Anexo baixado para upload ao storage do CRM (ou passagem direta ao SharePoint) |
| `uploadLargeAttachment({ mailbox, draftId, filename, content })` | Upload session para anexos >3MB (Graph exige chunked upload) |
| `createDraft({ mailbox, to, subject, body })` → `draftId` | CRM permite salvar rascunho antes de enviar; útil pra compose UX |
| `addAttachmentToDraft({ mailbox, draftId, filename, contentType, content })` | Adiciona anexo ao draft. Combina com `sendDraft`. |
| `sendDraft({ mailbox, draftId })` | Dispara envio do draft criado anteriormente |

**Subscriptions (Fase 3):** `POST /subscriptions` registra webhook no orchestrator → cada novo e-mail na caixa dispara evento no CRM em ~segundos (vs. polling). Exige endpoint HTTPS público no Railway com validation token (ver docs Microsoft Graph Subscriptions).

**Tracking de abertura/clique (fora do Graph):** Graph não emite eventos de abertura/clique. Se o CRM precisar disso, implementa camada própria: imagem-pixel servida por EF + redirect tracker para links. Não é responsabilidade deste package — anotar em README.

### `src/services/calendar.ts`

| Método | HITL? |
|---|---|
| `listEvents({ mailbox, from, to })` | não |
| `getEvent({ mailbox, eventId })` | não |
| `createEvent({ mailbox, subject, start, end, attendees, body })` | **sim** |
| `findMeetingTimes({ mailbox, attendees, duration, window })` | não |

### `src/services/files.ts` (OneDrive + SharePoint)

Métodos agentic (Fase 1):

| Método | HITL? |
|---|---|
| `listDriveItems({ driveId, path })` | não |
| `downloadFile({ driveId, itemId })` → `Buffer` | não |
| `uploadFile({ driveId, path, content })` | **sim** (escrita) |
| `getSharePointSite({ hostname, path })` | não |

Métodos CRM-embedded (Fase 2) — operações por-deal/por-conta:

| Método | Observações |
|---|---|
| `createDealSite({ dealId, name, template? })` | Cria SharePoint site dedicado ao deal (quando deal é criado no CRM). `Sites.Create.All` cobre isso. Padrão de naming: `deal-{dealId}` |
| `linkFileToDeal({ dealId, filename, content, source: 'user-upload' \| 'email-attachment' })` | Upload para pasta `/deals/{dealId}/` dentro do site |
| `archiveDealSite({ dealId })` | Quando deal é marcado como perdido/concluído há >30 dias, move site para estado arquivado (`Sites.Archive.All`) |
| `listDealFiles({ dealId })` | Lista todos arquivos do deal, com metadata (quem enviou, quando, via e-mail ou upload) |
| `shareFileWithContact({ dealId, filename, contactEmail, permission: 'view' \| 'edit' })` | Gera link compartilhável com permissão temporária e auditada |

> **Nota:** fluxos SharePoint com `Sites.Selected` exigem passo prévio de grant — documentar em `README.md` do package.

> **ACL CRM vs. ACL SharePoint:** quem pode ver o deal no CRM ≠ quem tem permissão no site SharePoint. Backend do CRM resolve isso injetando identidade do usuário ao chamar o Graph; package não trata autorização de negócio, só a autenticação com o tenant.

### `src/errors.ts`

```ts
export class Office365Error extends Error {
  constructor(public code: string, public statusCode: number, message: string) { super(message) }
}
export class Office365ThrottledError extends Office365Error {}  // 429
export class Office365AuthError extends Office365Error {}        // 401/403
```

Mapear códigos Graph comuns (`ErrorItemNotFound`, `ErrorAccessDenied`, `MailboxNotEnabledForRESTAPI`, etc.) para subclasses ou propriedades — **verificar docs Microsoft** para lista canônica.

## Dependências

- `@ecossistema/credentials` — agente busca credenciais; o package recebe elas já resolvidas
- `@ecossistema/agentes` — este package registra tools que aparecem para os agentes (ver abaixo)
- **Não** depende de `@ecossistema/memory` nem de Supabase direto (separação de camadas)

## Tools expostas aos agentes (via `@ecossistema/agentes`)

Nomes dos tools seguem convenção `<dominio>.<servico>.<acao>`:

| Tool | HITL | Permissão Graph mínima |
|---|---|---|
| `office365.mail.search(query, mailbox)` | não | `Mail.ReadWrite` |
| `office365.mail.read(mailbox, message_id)` | não | `Mail.ReadWrite` |
| `office365.mail.send(to, subject, body, mailbox)` | **sim** — envio é irreversível | `Mail.Send` |
| `office365.mail.reply(mailbox, message_id, body)` | **sim** | `Mail.Send` |
| `office365.calendar.list(mailbox, from, to)` | não | `Calendars.ReadWrite` |
| `office365.calendar.create_event(mailbox, subject, start, end, attendees)` | **sim** | `Calendars.ReadWrite` |
| `office365.files.read(path)` | não | `Files.ReadWrite.All` (Fase 1) / `Sites.Selected` (Fase 2+) |
| `office365.files.write(path, content)` | **sim** | idem |

HITL integra-se com o padrão do V9 — ver CLAUDE.md raiz, regra 2 ("ações irreversíveis → parar e pedir aprovação").

## Testes

- **Unit (vitest):** mockar `GraphClient`, validar construção de request, parsing de resposta, mapeamento de erros
- **Smoke (contra tenant real):** script `packages/office365/scripts/smoke-test.ts`
  - Caixa: `secretaria@fic.edu.br` (ou criar `agentes-teste@fic.edu.br` se preferir isolar)
  - Checa: listar últimos 5 e-mails, baixar 1 anexo, listar próximos 3 eventos de calendário, listar conteúdo de pasta SharePoint conhecida
  - **Não envia e-mail** no smoke (evitar spam na caixa real); envio testado em mailbox dedicada
- **CI:** smoke fica atrás de env var `O365_SMOKE=1` para não rodar em todo PR (precisa creds reais)

## Roadmap

### Fase 1 — package + módulo CRM novo no ERP-FIC (F1-S02)
- Package criado, auth funcionando, token cache OK
- Mail: read (list/get/move/thread/delta) + `sendAsUser` + drafts + attachments (incluindo large upload session)
- Calendar: read + `createEvent`
- Files: `createDealSite`, `linkFileToDeal`, `archiveDealSite`, `listDealFiles`
- **Módulo CRM novo** no ERP-FIC (UI + entidades CRM + integração end-to-end com M365)
- Escopo funcional do CRM FIC a definir antes do briefing (P-015 — leads matrícula? atendimento pais? egressos?)
- Smoke test passando contra tenant FIC

### Fase 2 — Intentus (F2, pré-requisito ADR-020)
- Abrir ADR-020 (multi-tenant M365 OAuth por-usuário) antes de começar
- Adicionar camada M365 ao CRM existente do Intentus
- Reuso máximo do package; extensão para lidar com múltiplos tenants

### Fase 3 — Teams + subscriptions + Nexvy (F3)
- Teams: enviar mensagem em canal, ler menções
- Graph subscriptions (webhooks): e-mail novo dispara evento → CRM sincroniza em segundos (sem polling)
- Avaliar migração `client_secret` → certificate credential
- Replicar integração no **Nexvy**

### Fase 4 — extração / white-label (F4+, condicional)
- Avaliar extração de `@ecossistema/crm-core` se ≥2 produtos têm lógica duplicada >70%
- White-label externo quando tiver primeiro cliente

## Critério de aceite (F1-S02)

1. Agente CFO-FIC consegue listar as últimas 10 mensagens de `secretaria@fic.edu.br` via tool `office365.mail.search`
2. Agente Secretaria-FIC consegue listar eventos da semana via `office365.calendar.list`
3. Smoke test passa contra tenant real em CI local (não bloqueante em CI remoto por falta de secret)
4. Application Access Policy está ativa — tentativa de acessar `reitoria@fic.edu.br` retorna 403 controlado e `Office365AuthError`

## Pendências a registrar em `docs/sessions/PENDENCIAS.md`

A adicionar quando este escopo virar PR (próximos `P-NNN` livres começam em **P-009**):

| ID sugerido | Categoria | Severidade | Ação |
|---|---|---|---|
| P-009 | config | high | Criar app registration no Entra ID do tenant FIC (Marcelo faz manual no Azure Portal) e coletar `client_id` + `tenant_id` |
| P-010 | config | high | Admin consent das permissões Fase 1 (`Mail.ReadWrite`, `Calendars.ReadWrite`, `Files.ReadWrite.All`) no tenant FIC |
| P-011 | acl | high | Aplicar `New-ApplicationAccessPolicy` no Exchange Online restringindo a app a `secretaria@fic.edu.br` + `cfo@fic.edu.br` (ver ADR-018) |
| P-012 | config | high | Popular `ecosystem_credentials` com `office365_fic_client_id`, `office365_fic_tenant_id`, `office365_fic_client_secret` (ACL: `cfo-fic`, `cao-fic`, `secretaria-fic`) |

## Referências

- ADR-018 — decisão arquitetural e escopos de permissão
- `MEMORY.md` → `project_fase1` (F1-S01 é jarvis-app; este é F1-S02)
- **Verificar docs Microsoft** antes de implementar: `@azure/msal-node` (client credentials), `@microsoft/microsoft-graph-client` (uso e retry), `New-ApplicationAccessPolicy` (sintaxe PowerShell atual)
