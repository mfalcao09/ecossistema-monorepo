# F1-S02 — Escopo funcional: CRM ERP-FIC, piloto "Leads de Matrícula"

> **Fecha P-015.** Define o recorte do módulo CRM que a sessão F1-S02 entrega.
> Os demais processos (atendimento a pais, egressos, comercial extensão, etc.) ficam em sessões posteriores (F1.5+) usando o **mesmo** modelo.
>
> **Relacionado:** ADR-018 · `ESCOPO-PACKAGE-OFFICE365.md` · `project_office365_fic` (memória) · ADR-017 (WhatsApp — canal futuro de captação)

---

## Processo piloto

**Leads de matrícula / vestibular da FIC** — pipeline de captação do prospecto até o aluno pagante.

### Pipeline (estágios default)

```
Prospecto → Lead qualificado → Inscrito no vestibular → Aprovado → Matrícula efetivada → Pagante
```

Estágios são configuráveis (secretaria acadêmica pode renomear/reordenar no futuro). Pagante é estado terminal vinculado ao ERP (aluno ativo).

---

## Entidades (modelo de dados)

| Entidade | Campos essenciais | Vínculo com ERP existente |
|---|---|---|
| **Contato** | nome, cpf, e-mail, telefone, origem, tags | pode virar `Aluno` na conversão |
| **Oportunidade** | contato_id, curso_id, processo_seletivo, estágio_atual, valor_previsto, owner_id, origem | vira `Matricula` na conversão |
| **Atividade** | oportunidade_id, tipo (email/call/meeting/whatsapp/nota), direção (in/out), conteúdo_ref (message_id Graph, etc.), autor_id, timestamp | — |
| **Fonte** | nome (site, Instagram, vestibular agendado, indicação, parceiro) | — |
| **Estágio** | nome, ordem, pipeline_id, probabilidade_default | — |

**Não entram no piloto:** scoring automático, campos customizados, forecasting, relatórios avançados.

---

## Papéis e autorização (RLS)

| Papel | Visão | Edição |
|---|---|---|
| **Secretaria acadêmica** | todos os leads | tudo |
| **Coordenação de curso** | leads dos próprios cursos | estágio, atividades, notas |
| **Diretoria** | todos (read-only + relatórios) | nenhuma |
| **Comercial** (se houver) | leads atribuídos ao próprio `owner_id` | tudo nos próprios |
| **Professores** | não entra no piloto | — |

RLS no Supabase (tabelas do ERP-FIC) com `auth.uid()` + mapeamento papel→regra. Padrão já usado em outras tabelas do ERP.

---

## UI — dentro do ERP-FIC

Módulo novo `CRM` na navegação do ERP-Educacional (mesma sessão, mesmo menu, mesmo design system).

Telas do piloto:
1. **Kanban do pipeline** — colunas por estágio, cards arrastáveis; filtros por curso, origem, owner
2. **Detalhe da oportunidade** — dados do contato, histórico de atividades (tabs: E-mail, Calendário, Notas, Arquivos), botão "Nova atividade"
3. **Lista/Tabela de contatos** — busca, filtros, import CSV manual (automações ficam p/ depois)
4. **Compose de e-mail** — abre modal, envia `sendAsUser`, aparece na pasta Enviados do próprio usuário, anexa automaticamente à oportunidade

**Fora do piloto:** dashboard analítico, formulário web de captação, fluxos/drips, integração WhatsApp, IA de qualificação.

---

## Integração Microsoft Graph (`@ecossistema/office365`)

| Recurso | Uso no piloto |
|---|---|
| `mail.sendAsUser` | Secretaria/coordenação clica "enviar" no CRM → sai com `From: usuario@fic.edu.br` |
| `mail.listThread` + `mail.delta` | Histórico de e-mails trocados com o contato aparece na oportunidade (polling inicial; subscriptions em F3) |
| `mail.downloadAttachment` | Anexo recebido aparece clicável no CRM |
| `files.createDealSite` | **Adiado para F1.5** — piloto usa apenas OneDrive do usuário ou anexo embutido |
| `calendar.createEvent` | Agendamento de entrevista/visita a partir da oportunidade (opcional no piloto) |

---

## Critérios de aceite F1-S02

1. Secretaria cria lead manualmente no CRM → aparece no kanban
2. Secretaria clica "enviar e-mail" → Graph envia `sendAsUser` com `From: secretaria@fic.edu.br`, `saveToSentItems: true`
3. Resposta do lead chega na caixa → CRM mostra a mensagem na oportunidade ao dar refresh (ou em até 5min via polling)
4. Mudança de estágio no kanban persiste, registra atividade automática ("moveu de X para Y")
5. RLS funciona: coordenador vê só os cursos dele; tenta abrir lead de outro curso → 403
6. Conversão "Matrícula efetivada" cria registro em `matriculas` do ERP-FIC com `origem_crm_oportunidade_id` preenchido
7. Smoke test ponta-a-ponta passa em ambiente de staging

---

## Fora do escopo (sessões posteriores)

| Sessão | Entrega |
|---|---|
| F1.5 | Formulário web de captação (site FIC → cria lead automaticamente); SharePoint por oportunidade |
| F1.6 | Subscriptions Graph (push, não polling); WhatsApp via Baileys integrado ao CRM |
| F1.7 | Automações (drip, follow-up, SLA de resposta) |
| F1.8 | Processo (b) atendimento a pais |
| F1.9 | Processos (c) egressos e (d) comercial extensão |
| F2 | Intentus (precisa ADR-020 antes — multi-tenant M365) |

---

## Pré-requisitos antes do briefing

- [ ] Package `@ecossistema/office365` implementado (parte da própria F1-S02)
- [ ] Application Access Policy no Exchange (P-009) definindo mailboxes iniciais — mínimo: `secretaria@fic.edu.br` + 1 usuário por papel pra teste
- [ ] Confirmar com secretaria da FIC nomenclatura exata dos estágios (pode diferir do default aqui)
- [ ] Levantar lista real de fontes (site, Insta, indicação, parceiros específicos)

---

## Mailboxes pra P-009 (Access Policy)

Pra desbloquear o piloto, preciso que você defina quem entra no grupo inicial. Sugestão mínima:

- `secretaria@fic.edu.br` (caixa institucional)
- 1 e-mail pessoal da secretaria pra testes (`fulana@fic.edu.br`)
- 1 coordenador de curso pra validar RLS (`coord.direito@fic.edu.br` ou similar)
- Marcelo (dev/QA)

Me confirma a lista real antes do briefing.
