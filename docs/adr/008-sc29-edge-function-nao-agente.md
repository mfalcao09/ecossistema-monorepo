# ADR-008: SC-29 Credential Vault como Edge Function determinística

- **Status:** aceito
- **Data:** 2026-04-16
- **Decisores:** Marcelo Silva (CEO), Claudinho (VP)
- **Relacionado:** MASTERPLAN-V9 § Parte VII §19 §20 §21 §22 §23, MASTERPLAN-ECOSSISTEMA-v8.2 SC-29, Art. IV, Art. II

## Contexto e problema

O conceito original do SC-29 (V8.2) era um **agente LLM** especializado em credenciais, com dupla verificação + proxy seguro + audit log. O conceito **permanece correto**: verificar ACL, rate-limit, auditar, permitir proxy (agente não vê secret) ou entrega direta.

Problema com LLM-agent:
- **Verificação de credencial é determinística** (ACL é lookup em tabela, não raciocínio)
- LLM custa ~500ms + tokens por chamada simples
- LLM pode **alucinar** e liberar credencial por razão errada
- Observability é ruim: por que o LLM decidiu liberar/negar?
- Custo: 30-35 agentes × N chamadas = LLM call chain problemático

Uma Edge Function determinística:
- Resolve em <50ms
- Custo marginal zero (Supabase free-tier para EFs não é caro)
- ACL em código aberto auditável
- `service_role` key injetado pelo Supabase → não precisa "Secret para gerenciar secrets"

## Opções consideradas

- **Opção 1:** Agente LLM (proposta original V8.2)
- **Opção 2:** Edge Function determinística em Supabase
- **Opção 3:** Service externo no Railway com HSM

## Critérios de decisão

- Determinismo e auditabilidade
- Latência
- Custo operacional
- Superficie de ataque (quanto menor, melhor)

## Decisão

**Escolhemos Opção 2** — Edge Function determinística `/credential-gateway` em Supabase.

**Modos de operação:**

| Modo | Comportamento | Uso |
|---|---|---|
| **A — Entrega direta** | EF retorna secret ao agente | Dev/staging; agentes super-confiáveis |
| **B — Proxy de chamada** 🏆 | Agente pede "chame API X com cred Y"; EF faz a chamada e retorna apenas o resultado. Agente NUNCA vê a key. | **Produção (default)** |

Modo B é a concretização da proposta original de Marcelo: *"proteger o secret de quem requisita, fornecendo direto à fonte confiável"*.

## Consequências

### Positivas
- Secret **nunca entra em memória, prompt, log do agente, WhatsApp, chat, voz**
- Determinismo total — auditoria é leitura direta do código da EF
- Latência p95 < 100ms (EF + Supabase Vault call)
- Custo marginal zero
- `service_role` key do Supabase é injetado pelo runtime — não precisa bootstrap externo
- Append-only audit (`credential_access_log`) via trigger (MP-08 + Art. IV)

### Negativas
- Toda nova integração precisa entender o padrão "pede proxy, não pede secret"
- Modo B exige que SDK do agente tenha cliente que converse com EF
- Se Modo B proxy cai, agente não consegue contornar (bom para segurança, ruim para resiliência)

### Neutras / riscos
- **Risco:** atacante que comprometa `service_role` pode ler secrets. **Mitigação:** `service_role` só roda em EF (nunca exposto ao cliente); rotação via runbook 01.
- **Risco:** falsa sensação de segurança se agente logar o retorno do proxy inadvertidamente. **Mitigação:** hook Art. IV redacta respostas da EF no `audit_log`.

## Evidência / pesquisa

- V9 § Parte VII §19–§23 (arquitetura, schema, regras de ouro)
- `phantom/src/secrets/crypto.ts` — AES-256-GCM + magic link vault pattern
- `docs/analises/ANALISE-VERTICAIS-BRASIL-PROFUNDA.md` — rotação de secrets bancários
- SC-29 V8.2 preserved as concept

## Ação de implementação

- Schema `ecosystem_credentials` + `credential_access_log` + triggers (sessão S04)
- Edge Function `credential-gateway` com Modo A + Modo B (sessão S08)
- `@ecossistema/credentials` client que chama EF (sessão S12)
- Runbook 01 — rotação de credenciais SC-29 (este ADR pack)

## Revisão

Revisar em 2026-10-16 ou quando houver auditoria externa (compliance LGPD bancário).
