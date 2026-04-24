# ADR-018: Integração com Office 365 via Microsoft Graph API (app-only)

- **Status:** aceito
- **Data:** 2026-04-20 (atualizado 2026-04-20T15:30 — visão CRM-embedded)
- **Decisores:** Marcelo Silva (CEO), Claudinho (VP)
- **Relacionado:** MASTERPLAN-V9 § Parte VI (integrações externas), ADR-001 (Managed Agents runtime), ADR-017 (Baileys WhatsApp — padrão de integração externa direta), `packages/credentials`, `MEMORY.md` → `project_fase1`, `project_office365_fic`

## Contexto e problema

### Caso de uso primário: CRM-embedded M365

O motivador real desta integração é **embutir operações de e-mail, calendário e arquivos dentro dos módulos CRM** dos produtos do ecossistema — padrão semelhante ao que HubSpot e Salesforce oferecem quando integrados a M365. O usuário (comercial, secretaria, coordenação) opera o CRM como painel único e o CRM despacha/sincroniza com M365 nos bastidores.

Produtos alvo (todos recebem o módulo):

| Produto | Estado do CRM | Prioridade |
|---|---|---|
| **ERP-Educacional** (FIC) | CRM a construir — módulo novo + integração M365; aderente ao piloto de autonomia D6 (CLAUDE.md) | **F1 (primeiro)** |
| **Intentus** (SaaS imobiliário) | CRM já implementado — adicionar camada M365 ao CRM existente | F2 |
| **Nexvy** (SaaS comunicação) | CRM a construir | F3 |
| White-label externo | Baixa prioridade, pós-validação nos 3 internos | F4+ |

> **Por que FIC primeiro e não Intentus** (decisão Marcelo 2026-04-20): a FIC já é o tenant M365 onde a app Entra vive; começar ali significa usuários, mailboxes e SharePoint já sob o mesmo tenant — zero atrito de multi-tenant. O CRM do Intentus envolve clientes externos (corretoras), cujos e-mails não estão no tenant da FIC — seria preciso abrir antes o ADR-020 (multi-tenant). Piloto no ERP-FIC prova a stack sem esse overhead e alinha com D6 (ERP-Educacional = piloto de autonomia).

Operações que o CRM precisa fazer por trás:

- **E-mail como usuário (Opção A):** comercial clica "enviar e-mail" no CRM → mensagem sai com `From: joao@fic.edu.br`, o cliente vê vindo do João, não de uma caixa genérica `crm@`
- **Sincronização de threads:** inbox/sent do usuário espelhado no CRM, agrupado por contato/deal
- **Anexos e arquivos:** arrastar arquivo no CRM → salva em SharePoint site do deal; lead envia anexo → aparece no CRM
- **Calendário:** reunião marcada no CRM aparece no Outlook do participante; disponibilidade do usuário consultada pelo CRM
- **Auditoria:** cada ação registrada no Unified Audit Log (app como ator) + log próprio do CRM (usuário como ator lógico)

### Caso de uso secundário: agentes autônomos

Paralelamente, agentes autônomos (**CFO-FIC**, **CAO-FIC**, **Secretaria-FIC**) operam 24/7 no Railway sobre caixas institucionais (`secretaria@fic.edu.br`, `cfo@fic.edu.br`). Compartilham a mesma app registration e o mesmo package (`@ecossistema/office365`), mas o uso agentic é secundário em volume frente ao CRM.

### Stack subjacente (Microsoft 365 da FIC)

- E-mail institucional (`@fic.edu.br`) em Exchange Online
- Calendário acadêmico e reuniões administrativas
- SharePoint para documentos (atas, contratos, apostilas)
- OneDrive para arquivos individuais dos coordenadores
- Teams para comunicação interna

Requisito comum aos dois casos de uso:

- Operar **24/7 no Railway** sem depender de login interativo do Marcelo ou de qualquer humano

Restrições de contorno:

- Microsoft está **deprecando Basic Auth** em Exchange Online — IMAP/SMTP direto com usuário/senha não é mais viável para novas integrações
- O MCP oficial de Microsoft 365 é **por-usuário/interativo** (OAuth delegated flow) — serve para o Claudinho no terminal do Marcelo, não para um agente headless no Railway
- Power Automate / Logic Apps é caixa-preta, com licenciamento confuso para múltiplos tenants e sem versionamento sã via git
- Qualquer credencial precisa seguir o padrão canônico: armazenada em `@ecossistema/credentials` + `ecosystem_credentials` no Supabase ECOSYSTEM, nunca em `.env` ou hardcoded

## Opções consideradas

- **Opção 1:** **Microsoft Graph API com OAuth 2.0 client credentials (app-only)** — app registrado no Entra ID (Azure AD) do tenant da FIC, com permissões `application` e admin consent
- **Opção 2:** **MCP Microsoft 365 oficial** (delegated flow, por usuário interativo)
- **Opção 3:** **Power Automate / Logic Apps** como middleware com webhooks
- **Opção 4:** **IMAP/SMTP direto** com conta de serviço e senha

## Critérios de decisão

- Operação 24/7 em Railway sem humano no loop de autenticação
- Auditabilidade (quem/quando/o quê — via Microsoft 365 Unified Audit Log)
- Escopo de permissão restringível por mailbox/site (princípio do menor privilégio)
- Longevidade (não depender de features em deprecação)
- Reuso: o mesmo padrão serve para Klésis e qualquer outro negócio que adote Microsoft 365

## Decisão

**Escolhemos Opção 1 — Microsoft Graph API com OAuth 2.0 client credentials (app-only).**

Cria-se **uma app registration por tenant** (começando pela FIC) no Entra ID, com permissões `application` de escopo mínimo, admin consent uma vez, e as credenciais (`client_id`, `tenant_id`, `client_secret`) armazenadas em `ecosystem_credentials` via `@ecossistema/credentials`.

A implementação fica encapsulada no novo package **`@ecossistema/office365`** (ver `docs/sessions/ESCOPO-PACKAGE-OFFICE365.md`), que expõe tools para os agentes via `@ecossistema/agentes`.

### Por que não as outras

- **Opção 2 (MCP Microsoft 365):** exige login interativo. Bom para Claudinho rodando no terminal do Marcelo; inviável para o CFO-FIC às 3h da manhã processando boletos no Railway.
- **Opção 3 (Power Automate):** opaco, difícil de versionar em git, difícil de reproduzir entre tenants, licenciamento adicional. Fere o princípio "infra como código" do V9.
- **Opção 4 (IMAP/SMTP):** Microsoft está retirando Basic Auth; conta de serviço com senha é antipattern de segurança moderno e não cobre SharePoint/OneDrive/Teams.

### Escopos de permissão (Graph application permissions)

**Decisão:** dado o caso de uso CRM-embedded (cada usuário da FIC potencialmente tem seu e-mail gerenciado via CRM), o app foi concedido com **permissões amplas tenant-wide**, não least-privilege por mailbox. Essa é uma decisão consciente: a granularidade vem dos controles compensatórios (abaixo), não da permissão Graph.

Permissões concedidas no app `ecossistema-agentes-fic` (tenant FIC, admin consent em 2026-04-20) — 23 no total, resumidas por domínio:

| Domínio | Permissões | Justificativa |
|---|---|---|
| Mail | `Mail.ReadWrite`, `Mail.ReadBasic.All`, `Mail.Send` | CRM lê/envia de qualquer caixa do tenant (sales, secretaria, coordenação) |
| Calendar | `Calendars.ReadBasic`, `Calendars.ReadWrite` | Sync de calendário por contato no CRM |
| Files / Sites | `Files.ReadWrite.All`, `Files.ReadWrite.AppFolder`, `Files.SelectedOperations.Selected`, `Sites.Selected`, `Sites.ReadWrite.All`, `Sites.Manage.All`, `Sites.Create.All`, `Sites.Archive.All`, `Sites.FullControl.All` | Criar site SharePoint por deal, arquivar deal concluído, organizar estrutura de pastas por conta/oportunidade |
| User | `User.Read.All`, `User.ReadWrite.All` | Resolver endereço → nome, popular contatos, sincronizar metadados de usuário |

> **Trade-off consciente:** essa superfície é grande. Mitigação não está em encolher Graph permissions (incompatível com o caso de uso CRM-for-all-users), mas em **controles compensatórios em múltiplas camadas** — ver seção abaixo.

### Controles compensatórios (substituem least-privilege)

1. **Application Access Policy (Exchange Online):** restringir **quais mailboxes** a app pode tocar. Fase 1: grupo inicial de usuários piloto; expande conforme onboarding no CRM. Mesmo com `Mail.ReadWrite` tenant-wide, policy bloqueia caixas fora do grupo (ex: reitoria, diretoria pessoal).
2. **Conditional Access + IP allowlist Railway:** app só autentica a partir de IPs conhecidos do backend CRM. Secret vazado fora do perímetro não funciona.
3. **Rotação de client secret a cada 90 dias** (não 24 meses do padrão Entra). Janela de exposição em caso de leak é curta.
4. **Unified Audit Log + alerta Langfuse:** toda ação da app registrada com `AppId`; alerta em padrões anômalos (ex: invocação de `Sites.FullControl.All`, leitura em massa de mailboxes fora do perfil CRM).
5. **HITL nos tools do agente** (para uso agentic, não CRM interativo): `mail.send`, `calendar.create_event`, `files.write` param e pedem aprovação.
6. **Secret em Supabase Vault:** nunca em `.env`, nunca em log, nunca em git.
7. **Camada de autorização do CRM:** o backend do CRM valida quem pode mandar e-mail "como" qual usuário — não é porque o app pode que qualquer dev pode. Permissão efetiva é `(CRM ACL) ∩ (Application Access Policy)`.

### Envio "como usuário" (Opção A)

Para o CRM, e-mail enviado por João sai com `From: joao@fic.edu.br` — o destinatário vê vindo do João, não de uma caixa genérica. Implementação:

```http
POST /users/{joao-user-id}/sendMail
Authorization: Bearer {app-only token}
Content-Type: application/json

{
  "message": {
    "subject": "...",
    "body": { "contentType": "HTML", "content": "..." },
    "toRecipients": [...]
  },
  "saveToSentItems": true
}
```

Requisitos:
- App tem `Mail.Send` application ✅
- Application Access Policy permite `joao@fic.edu.br` ✅
- Unified Audit Log registra app como ator, com claim `on behalf of joao@fic.edu.br`
- `saveToSentItems: true` faz a mensagem aparecer na pasta "Enviados" do João (UX natural)

Offboarding: quando João sai da FIC e a mailbox dele é desativada, a chamada falha com `MailboxNotEnabledForRESTAPI` — CRM trata como "usuário inativo" e remove do pool de remetentes. Não é débito técnico, é o comportamento correto.

### Restrição por mailbox (Application Access Policy)

Mesmo com `Mail.ReadWrite` / `Mail.Send` application, o Exchange Online permite restringir **quais caixas** a app pode tocar via **Application Access Policy**. Isso é crítico: sem policy, a app pode ler qualquer caixa do tenant (ex: e-mails da diretoria), o que viola menor privilégio.

Passos (a executar pelo admin do tenant, via Exchange Online PowerShell — documentar em runbook):

```powershell
# 1. Criar mail-enabled security group contendo só as mailboxes que a app pode acessar
New-DistributionGroup -Name "AgentesEcossistemaFIC" -Type "Security" -PrimarySmtpAddress "agentes-ecossistema@fic.edu.br"
Add-DistributionGroupMember -Identity "AgentesEcossistemaFIC" -Member "secretaria@fic.edu.br"
Add-DistributionGroupMember -Identity "AgentesEcossistemaFIC" -Member "cfo@fic.edu.br"

# 2. Restringir a app àquelas caixas
New-ApplicationAccessPolicy `
  -AppId "<client_id_da_app>" `
  -PolicyScopeGroupId "agentes-ecossistema@fic.edu.br" `
  -AccessRight RestrictAccess `
  -Description "Agentes do ecossistema — acesso restrito às caixas operacionais"

# 3. Validar
Test-ApplicationAccessPolicy -AppId "<client_id>" -Identity "secretaria@fic.edu.br"  # → Granted
Test-ApplicationAccessPolicy -AppId "<client_id>" -Identity "reitoria@fic.edu.br"    # → Denied
```

> **Verificar docs Microsoft** antes de executar em prod — sintaxe PowerShell e nome de cmdlets podem mudar conforme versão do módulo `ExchangeOnlineManagement`.

## Consequências

### Positivas

- Agentes operam 24/7 headless, sem Marcelo no loop de auth
- Credenciais ficam no padrão canônico (`@ecossistema/credentials` + ECOSYSTEM) — rotação, ACL, auditoria já resolvidas
- Escopo restringível por mailbox (Exchange) e por site (SharePoint `Sites.Selected`)
- Mesmo padrão reaproveitável para Klésis (outro tenant) e qualquer futuro negócio Microsoft 365
- Auditoria nativa via Microsoft 365 Unified Audit Log (todo acesso da app é logado com AppId)

### Negativas

- Exige **admin consent** do tenant FIC — passo manual, bloqueante, não automatizável
- `client_secret` expira (padrão 24 meses no Entra ID) — precisa alarme de rotação; avaliar migrar para **certificate credential** em Fase 3 (verificar docs Microsoft para MSAL certificate flow)
- Application Access Policy é restrito a **Exchange** — para SharePoint/OneDrive a restrição é via `Sites.Selected` + grants explícitos, fluxo diferente
- `Files.ReadWrite.All` em Fase 1 é permissivo demais; migração para `Sites.Selected` é débito técnico a quitar antes de expor ao CFO-FIC em produção plena

### Neutras / riscos

- **Risco:** throttling do Graph API (limite padrão ~10k requests / 10min por app por tenant). **Mitigação:** usar `@microsoft/microsoft-graph-client` com retry exponencial nativo; não fazer polling agressivo (preferir webhooks/subscriptions em Fase 3).
- **Risco:** exfiltração se `client_secret` vazar. **Mitigação:** secret em `ecosystem_credentials` com ACL; rotação trimestral; alarme Langfuse em uso anômalo; Application Access Policy limita blast radius a mailboxes autorizadas.
- **Risco:** divergência entre tenants (FIC vs. Klésis) se cada um tiver seu próprio app. **Mitigação:** uma app por tenant é o correto; o package `@ecossistema/office365` recebe credenciais por instância, não é singleton global.

## Evidência / pesquisa

- Microsoft Graph overview e client credentials flow — **verificar docs Microsoft** (https://learn.microsoft.com/en-us/graph/) antes de implementar; APIs evoluem
- `@azure/msal-node` — biblioteca oficial Microsoft para Node.js (client credentials flow suportado)
- `@microsoft/microsoft-graph-client` — SDK oficial para chamadas Graph
- Application Access Policy — cmdlet `New-ApplicationAccessPolicy` do módulo `ExchangeOnlineManagement`
- ADR-017 (Baileys direto) como precedente de "integração externa como serviço próprio vs. intermediário genérico"

## Ação de implementação

**Estado em 2026-04-20:**

- ✅ App registration criada no Entra ID tenant FIC: `ecossistema-agentes-fic` (client_id `f8a3027c-87fa-4c0d-8812-bb2297b6628d`)
- ✅ 23 permissões application concedidas com admin consent
- ✅ Client secret gerado (label `ecossistema-railway-2026-04`, expira 2026-07-19)
- ✅ 3 credenciais gravadas em `ecosystem_credentials` + Supabase Vault (commit [10f8633](../../docs/sessions/PENDENCIAS.md))

**Faseamento CRM-embedded:**

| Fase | Sessão | Entrega |
|---|---|---|
| 1 | F1-S02 | Package `@ecossistema/office365` (ver escopo) + **módulo CRM novo no ERP-FIC** (UI + entidades CRM + integração M365 ponta-a-ponta). Escopo funcional do CRM a definir (P-015). |
| 2 | F2-Sxx | Adicionar camada M365 ao **CRM existente do Intentus** (precisa ADR-020 antes — Intentus tem clientes externos, tenants M365 diferentes) |
| 3 | F3-Sxx | Módulo CRM no Nexvy |
| 4 | F4+ | Avaliar extração de `@ecossistema/crm-core` se ≥2 produtos têm duplicação >70% |
| ADR-020 | antes da F2 | Multi-tenant M365 para cenário Intentus/white-label (OAuth por-usuário, não app-only) |

**Pendências abertas (P-009..P-014):**
- P-009: Application Access Policy no Exchange Online (restringir mailboxes fase 1)
- P-010: implementação do package
- P-011: rotação do secret antes de 2026-07-19
- P-012: Conditional Access + IP allowlist Railway
- P-013: *(fechada neste update)*
- P-014: arquitetura CRM cross-produto (decidir quando extrair package compartilhado vs. manter por-produto)

## Revisão

Revisar após:
- (a) integração funcionar no CRM do Intentus (F1-S02 concluído);
- (b) primeiro incidente simulado (ex: leak de secret → medir blast radius real com policy ativa);
- (c) segundo produto adotar o padrão (ERP-FIC) — aí avaliar extração de `@ecossistema/crm-core`;
- (d) primeiro cliente white-label aparecer no horizonte — aí abrir ADR-020 (multi-tenant OAuth).

### Histórico de revisões

- **2026-04-20 criação** — ADR baseado em use case "agentes autônomos sobre caixas institucionais"
- **2026-04-20T15:30** — expandido para refletir visão CRM-embedded M365 como caso de uso primário (Marcelo confirmou em sessão); tabela de permissões atualizada para 23 permissões tenant-wide (decisão consciente); adicionada seção de controles compensatórios; adicionada seção "Envio como usuário (Opção A)"; faseamento multi-produto explicitado. Fecha P-013.
- **2026-04-20T15:45** — faseamento invertido por decisão de Marcelo: **ERP-FIC** (módulo CRM novo) vira F1, Intentus cai para F2 (depende de ADR-020 multi-tenant). Rationale: FIC já é o tenant M365 da app, zero atrito multi-tenant, alinha com D6 (ERP-Educacional = piloto de autonomia).
