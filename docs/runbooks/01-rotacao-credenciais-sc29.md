# Runbook 01 — Rotação de credenciais (SC-29)

> **Quando:** credencial expirou, vazou, ou entrou no ciclo de rotação periódica.
> **Dono:** D-Infra (cross-business) + D-Governanca (compliance).
> **Fontes canônicas:** ADR-008 (SC-29), V9 § Parte VII, Art. II (HITL), Art. IV (Rastreabilidade).

## Pré-requisitos

- [ ] Acesso ao Supabase ECOSYSTEM (`gqckbunsfjgerbuiyzvn`)
- [ ] Acesso ao dashboard do provider (Inter, BRy, Anthropic, OpenRouter, Gemini, Stripe, etc)
- [ ] WhatsApp de Marcelo disponível (Art. II se credencial de **produção**)
- [ ] Nome da credencial em `ecosystem_credentials` (campo `name`)

## Passo-a-passo

### 1. Identificar credencial

```sql
select id, name, project, environment, provider, expires_at, is_active
from ecosystem_credentials
where name = '<nome_canonico>'
  and environment = 'prod';
```

Registrar `vault_key` e `acl` em nota local para verificação pós-rotação.

### 2. Solicitar aprovação Marcelo (Art. II — produção apenas)

Para `environment = 'prod'`:

```sql
insert into approval_requests (requester_agent_id, action, payload, severity, channel)
values ('runbook-01', 'rotate_credential',
        jsonb_build_object('credential', '<nome>', 'reason', '<por que rotacionar>'),
        'critical', 'whatsapp');
```

Aguardar webhook `status_idled` confirmar aprovação. **Não prosseguir sem aprovação.**

### 3. Gerar novo valor no provider

- Acessar dashboard do provider
- Criar nova chave/token (anote escopos/permissões idênticos ao antigo)
- **Não** revogar ainda a antiga (faremos no passo 7)

### 4. Atualizar Supabase Vault

Via Supabase Studio (Vault UI) ou API:

```bash
curl -X POST https://gqckbunsfjgerbuiyzvn.supabase.co/rest/v1/rpc/vault_update_secret \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "<vault_key>", "secret": "<novo_valor>"}'
```

### 5. Registrar em audit log (Art. IV)

```sql
insert into credential_access_log (credential_name, project, accessor, action, success, metadata)
values ('<nome>', '<project>', 'runbook-01', 'rotate', true,
        jsonb_build_object('approval_id', '<id_passo_2>', 'old_vault_ref', '<ref_antiga>'));
```

### 6. Validar Modo B proxy funciona com novo valor

Fazer chamada-teste via EF `credential-gateway`:

```bash
curl -X POST https://gqckbunsfjgerbuiyzvn.supabase.co/functions/v1/credential-gateway \
  -H "Authorization: Bearer <jwt_agente_autorizado>" \
  -H "Content-Type: application/json" \
  -d '{"mode":"proxy","credential":"<nome>","target":"<endpoint_provider_ping>"}'
```

- **Sucesso:** HTTP 200 com resposta esperada do provider
- **Falha:** revisar passo 4 (Vault) antes de prosseguir

### 7. Invalidar valor antigo no provider

Só depois do passo 6 passar verde:

- Revogar chave antiga no dashboard do provider
- Confirmar que chamadas com a antiga retornam `401/403`

### 8. Notificar briefing diário

Atualizar `docs/incidents/rotations/YYYY-MM-DD-<credencial>.md` com:
- Motivo da rotação
- Nova data de expiração
- Resultado dos smoke tests
- Mencionar D-Infra + D-Governanca no próximo briefing

## Rollback (se passo 7 der errado)

Se após revogar a antiga algo quebrar:
1. Reaver valor anterior do provider (se dashboard permitir recuperação dentro da janela) OU gerar outra nova
2. Atualizar Vault (passo 4) com valor funcional
3. Smoke test (passo 6)
4. Registrar incidente P1 (runbook 05)

## Critérios de sucesso

- [ ] `credential_access_log` tem entry `action=rotate, success=true`
- [ ] Chamada proxy Modo B responde 200 pós-rotação
- [ ] Chave antiga inválida no provider
- [ ] Nenhum agente loga erro de auth nas próximas 24h
