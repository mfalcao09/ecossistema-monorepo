# Supabase Migrations — `jarvis-pessoal` (`nasabljhngsxwdcprwme`)

DB alvo: projeto Supabase **`jarvis-pessoal`** (criado em 2026-04-19).
URL: `https://nasabljhngsxwdcprwme.supabase.co`

Separado do `infra/supabase/migrations/` que é exclusivo do ECOSYSTEM.

## Referências

- ADR-017 — WhatsApp pairing via Baileys direto (Nível 2)
- User memory `project_jarvis_whatsapp_pairing.md`
- Spike validado: `scripts/spikes/whatsapp-baileys/`

## Ordem cronológica

| Versão | Nome | Intenção |
|---|---|---|
| 20260419000000 | `whatsapp_schema` | Fase C1 — schema completo do WhatsApp gateway (instances, auth_state, contacts, chats, messages) + RLS + Realtime publication |

## Como aplicar

### Opção A — via SQL Editor (recomendada enquanto não há supabase-cli linkado)

1. Abrir [SQL Editor do jarvis-pessoal](https://supabase.com/dashboard/project/nasabljhngsxwdcprwme/sql/new)
2. Colar o conteúdo da migration a aplicar
3. Run

### Opção B — via supabase-cli (futuro, quando linkado)

```bash
cd infra/supabase/jarvis-pessoal
supabase link --project-ref nasabljhngsxwdcprwme
supabase db push
```

## Rollback

Scripts em `rollback/` espelham cada migration. A tabela `whatsapp_auth_state` contém secrets criptografados por Signal Protocol — **nunca dropar sem antes revogar o linked device no celular** (WhatsApp → Dispositivos conectados → Desconectar). Senão o número continua pareado a um "fantasma" até expirar.
