# @ecossistema/magic-link-vault

**Phantom Magic Link Vault** — credenciais nunca fluem via chat.

Implementa o **Padrão 3 — AES-256-GCM Vault + Magic Link** do MASTERPLAN-V9 § 26.

---

## Princípio central

```
REGRA DE OURO: Secret nunca trafega via chat (WhatsApp, Slack, Jarvis, voz).
```

Agent gera URL → Marcelo abre no browser → secret é **cifrado no browser** com AES-256-GCM antes de enviar → servidor armazena **apenas o ciphertext** → SC-29 decifra on-demand para proxy call (secret nunca volta ao agente).

---

## Fluxo E2E

```
1. Agent (ex: CFO-FIC): chama tool collect_secret(credential_name, project, scope)
        ↓
2. Tool gera token one-time (TTL 15min) + DEK 256 bits + wrap DEK com KEK
   Persiste vault_tokens com dek_wrapped
        ↓
3. Tool retorna URL: https://vault.ecossistema.internal/vault/collect/<token>
   Agent envia URL ao Marcelo via WhatsApp/Jarvis (apenas a URL, nunca o secret)
        ↓
4. Marcelo abre URL no browser
        ↓
5. Browser: GET /api/vault/dek?token=... → servidor unwrap DEK → retorna DEK ao browser (TLS)
        ↓
6. Browser cifra: AES-256-GCM(plaintext, DEK, IV_aleatório) — 100% no browser
        ↓
7. Browser: POST /api/vault/submit → proxy → EF collect-secret:
   - Valida token (unused + não-expirado)
   - Armazena { vault_key: ciphertext, vault_iv, vault_algorithm } em ecosystem_credentials
   - Invalida token (one-time)
   - Audit log: apenas hash SHA-256 do ciphertext (nunca o valor)
        ↓
8. Marcelo vê: "✅ Credencial armazenada com segurança"
        ↓
9. Agent CFO-FIC usa SC-29 Modo B (EF retrieve-secret):
   - Unwrap DEK com KEK (KEK em Supabase Vault, nunca env var)
   - Decifra vault_key → plaintext
   - Inject plaintext no header Authorization da chamada ao Inter
   - Retorna apenas o resultado da chamada (sem plaintext)
   - Plaintext descartado da memória imediatamente
```

---

## Modelo de segurança

| Ameaça                | Mitigação                                                           |
| --------------------- | ------------------------------------------------------------------- |
| Secret via chat       | Tool só retorna URL — nunca o valor                                 |
| Intercepção HTTPS     | AES-256-GCM cifra o plaintext ANTES de sair do browser              |
| Replay de token       | Token one-time: invalidado no primeiro uso                          |
| Token expirado        | TTL 15min; índice `vault_tokens_exp_idx` para purge eficiente       |
| KEK comprometida      | KEK em Supabase Vault (`vault.decrypted_secrets`), nunca em env var |
| Log do secret         | Audit log registra apenas `sha256(ciphertext)`, nunca o plaintext   |
| Ciphertext adulterado | GCM auth tag (128 bits) detecta qualquer alteração                  |
| Brute force de tokens | Rate limit no Supabase Dashboard (a configurar)                     |
| Agente não autorizado | ACL em `ecosystem_credentials` verificada pela EF `retrieve-secret` |

---

## Estrutura

```
packages/magic-link-vault/
├── src/
│   ├── crypto/
│   │   ├── client-encrypt.ts    # AES-GCM encrypt (browser + Node)
│   │   ├── server-decrypt.ts    # AES-GCM decrypt (servidor)
│   │   └── keys.ts              # DEK generation + KEK wrap/unwrap (AES-KW)
│   ├── tokens/
│   │   ├── generate.ts          # Token one-time, buildNewToken
│   │   └── validate.ts          # assertTokenValid, isTokenValid
│   ├── tool/
│   │   └── collect-secret-tool.ts  # MCP tool schema + handler
│   ├── types.ts
│   ├── errors.ts
│   └── index.ts
├── server/
│   ├── edge-function/
│   │   ├── collect-secret/      # Supabase EF: valida token + armazena ciphertext
│   │   └── retrieve-secret/     # Supabase EF: SC-29 Modo B proxy decrypt
│   └── webapp/app/
│       ├── vault/collect/[token]/page.tsx    # Formulário AES-GCM client-side
│       └── api/vault/
│           ├── metadata/route.ts  # GET token metadata
│           ├── dek/route.ts       # GET DEK unwrapped (TLS only)
│           └── submit/route.ts    # POST proxy → EF collect-secret
└── tests/
    ├── crypto.test.ts   # 9 testes: round-trip, tamper, KEK wrap/unwrap
    ├── tokens.test.ts   # 18 testes: generate, validate, TTL, one-time
    └── e2e.test.ts      # 4 testes: fluxo completo simulado
```

---

## Setup

### 1. Variáveis de ambiente

```bash
# Next.js webapp
NEXT_PUBLIC_SUPABASE_URL=https://gqckbunsfjgerbuiyzvn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
VAULT_KEK_HEX=<64-char hex — 256 bits — gerado uma vez com crypto.getRandomValues>

# Edge Functions (injetadas automaticamente pelo Supabase):
# SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
# VAULT_KEK_HEX deve ser adicionada manualmente no Supabase Dashboard > Edge Functions > Secrets
```

### 2. Gerar KEK (uma vez, em ambiente seguro)

```typescript
const kek = crypto.getRandomValues(new Uint8Array(32));
const kekHex = Array.from(kek)
  .map((b) => b.toString(16).padStart(2, "0"))
  .join("");
console.log(kekHex); // salvar no Supabase Vault imediatamente
```

### 3. Deploy das Edge Functions

```bash
supabase functions deploy collect-secret --project-ref gqckbunsfjgerbuiyzvn
supabase functions deploy retrieve-secret --project-ref gqckbunsfjgerbuiyzvn
```

### 4. Aplicar migration

```bash
supabase db push --project-ref gqckbunsfjgerbuiyzvn
```

---

## Security review checklist (pré-merge)

- [x] TLS obrigatório em todos endpoints (Railway/Supabase: padrão)
- [ ] CSP no Next.js bloqueando scripts externos em `/vault/*`
- [x] Token one-time: zero replays (tested em tokens.test.ts + e2e.test.ts)
- [x] KEK nunca loggada, nunca em env var em texto (Supabase Vault)
- [x] Auth tag GCM verificada: tampered ciphertext → CryptoError (tested)
- [ ] Rate limit em `/api/vault/submit` no Supabase Dashboard
- [x] Logs limpos: audit_log só tem `sha256(ciphertext)`, nunca plaintext (EF collect-secret)
- [ ] VAULT_KEK_HEX definida como secret no Supabase Dashboard (manual)

---

## Integração SC-29 Modo B

A EF `retrieve-secret` recebe:

```json
{
  "credential_name": "INTER_CLIENT_SECRET",
  "project": "fic",
  "agent_id": "cfo-fic",
  "proxy_target": {
    "url": "https://cdpj.partners.bancointer.com.br/oauth/v2/token",
    "method": "POST",
    "body": { "grant_type": "client_credentials" }
  }
}
```

Retorna apenas o resultado da chamada ao Inter — o plaintext é descartado imediatamente após uso.

---

## Dependências de sessão

- **S8 (EFs)** — SC-29 Modo B usa `retrieve-secret` (este package)
- **S13 (Clients)** — `@ecossistema/credentials` pode adicionar `requestSecretViaMagicLink()`
- **S16 (CFO-FIC Piloto)** — primeiro uso real (credenciais Banco Inter)
