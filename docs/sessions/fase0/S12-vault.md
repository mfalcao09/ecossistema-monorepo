# S12 — Magic Link Vault (Phantom pattern)

**Sessão:** S12 · **Dia:** 2 · **Worktree:** `eco-vault` · **Branch:** `feature/magic-link-vault`
**Duração estimada:** 1 dia (6-8h) · **Dependências:** nenhuma (standalone; integra com SC-29 quando pronta — pode usar stub)
**Bloqueia:** nenhum crítico; enriquece SC-29 e workflows de onboarding

---

## Leituras obrigatórias

1. `docs/masterplans/MASTERPLAN-V9.md` — **§ 26** (Padrão 3 — AES-256-GCM Vault + Magic Link)
2. `docs/research/ANALISE-JARVIS-REFERENCE.md` — phantom `src/secrets/crypto.ts`
3. `research-repos/phantom/src/secrets/crypto.ts` — implementação canônica
4. Web Crypto API docs (MDN): SubtleCrypto.encrypt com AES-GCM
5. Next.js App Router docs para páginas dinâmicas `/vault/collect/[token]`

---

## Objetivo

Implementar o **Phantom Magic Link Vault** — credenciais **nunca** fluem via chat. Agente gera URL com token one-time → Marcelo (ou usuário externo) abre no browser → preenche form → secret é **cifrado no client** com AES-256-GCM antes de enviar → servidor armazena cifrado → SC-29 decifra on-demand (Modo B).

**Regra absoluta:** em nenhum momento o secret cru fica em log, chat, stdout ou memória do agente.

---

## Escopo exato

```
packages/@ecossistema/magic-link-vault/
├── package.json
├── README.md
├── src/
│   ├── index.ts                     # API principal
│   ├── crypto/
│   │   ├── client-encrypt.ts        # browser-side AES-GCM
│   │   ├── server-decrypt.ts        # servidor-side (dentro da EF)
│   │   └── keys.ts                  # key derivation / KEK management
│   ├── tokens/
│   │   ├── generate.ts              # one-time token TTL 15min
│   │   └── validate.ts
│   ├── tool/
│   │   └── collect-secret-tool.ts   # MCP tool "collect_secret"
│   ├── types.ts
│   └── errors.ts
├── server/                          # Edge Function + Next.js page
│   ├── edge-function/
│   │   ├── collect-secret/          # Supabase EF
│   │   │   ├── index.ts
│   │   │   └── README.md
│   │   └── retrieve-secret/         # usado pela SC-29 Modo B
│   │       └── index.ts
│   └── webapp/                      # Next.js standalone app OU route em app existente
│       └── app/vault/collect/[token]/
│           ├── page.tsx             # formulário
│           └── submit.ts            # server action
└── tests/
    ├── crypto.test.ts               # encrypt/decrypt round-trip
    ├── tokens.test.ts
    └── e2e.test.ts                  # cria link → preenche → valida
```

---

## Decisões-chave

1. **AES-256-GCM** (não AES-CBC — GCM provê autenticação built-in)
2. **Chave principal (KEK)** em Supabase Vault; Data Encryption Keys (DEK) derivadas por solicitação
3. **Tokens one-time** TTL 15min, invalidados ao primeiro uso
4. **Cliente-side encryption** via Web Crypto API (browser nativo) — secret nunca sai plaintext pela rede
5. **TLS obrigatório** em todos endpoints
6. **No log do secret** — logs só registram token_id, timestamps, hash do ciphertext (nunca plaintext)

---

## Fluxo E2E

```
1. Agent (CFO-IA): "preciso da chave Inter para emitir boleto"
    ↓
2. Agent chama tool collect_secret(description="Inter Client Secret", scope="cfo-fic:fic")
    ↓
3. Tool cria token one-time (15min TTL) + gera URL:
    https://vault.ecossistema.internal/vault/collect/abc123xyz
    ↓
4. Agent envia URL para Marcelo via WhatsApp/Jarvis:
    "Marcelo, preciso da chave Inter. Por favor, preencha: <URL>"
    ↓
5. Marcelo abre URL no navegador → vê formulário "Inter Client Secret"
    ↓
6. Marcelo cola o secret e clica "Enviar"
    ↓
7. BROWSER (client-side JavaScript):
    - Fetch nonce/IV from server
    - encryptedValue = AES-GCM-encrypt(secret, DEK, IV)  — no browser
    - POST { encryptedValue, iv, tag } para servidor
    ↓
8. Server (Edge Function collect-secret):
    - Valida token
    - Armazena ciphertext em ecosystem_credentials.vault_key
    - Invalida token
    - Retorna 200
    ↓
9. Marcelo vê: "✅ Credencial armazenada com segurança"
    ↓
10. Agent CFO-IA agora pode usar via SC-29 Modo B:
    POST /credential-gateway-v2/proxy → EF busca ciphertext, decifra, faz call ao Inter
    (secret nunca volta para o agente)
```

---

## Spec — `crypto/client-encrypt.ts`

```typescript
export async function encryptClientSide(
  plaintext: string,
  dek: CryptoKey,  // já importada via subtle.importKey
): Promise<EncryptedPayload> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));  // 96 bits AES-GCM
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    dek,
    encoder.encode(plaintext),
  );
  
  return {
    ciphertext: arrayBufferToBase64(ciphertext),   // inclui tag no final (GCM)
    iv: arrayBufferToBase64(iv.buffer),
    algorithm: 'AES-256-GCM',
    version: '1',
  };
}

export async function importDEK(rawKey: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', rawKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
  );
}
```

### `server/edge-function/collect-secret/index.ts`

```typescript
Deno.serve(async (req) => {
  const { token, encrypted_payload } = await req.json();
  
  // 1. Valida token
  const { data: tokenRow, error } = await supabase
    .from('vault_tokens')
    .select('*')
    .eq('token', token)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .single();
  if (!tokenRow) return error(400, 'invalid_or_expired_token');
  
  // 2. Armazena ciphertext em ecosystem_credentials
  //    IMPORTANTE: a DEK já foi usada pelo browser; servidor recebe só ciphertext
  //    Para decryption futura, servidor usa KEK para derivar mesma DEK
  await supabase.from('ecosystem_credentials')
    .update({
      vault_key: encrypted_payload.ciphertext,
      vault_iv: encrypted_payload.iv,
      vault_algorithm: encrypted_payload.algorithm,
      updated_at: 'now()',
    })
    .eq('name', tokenRow.credential_name)
    .eq('project', tokenRow.project);
  
  // 3. Invalida token
  await supabase.from('vault_tokens').update({ used: true, used_at: 'now()' }).eq('token', token);
  
  // 4. Audit (sem valor — só hash do ciphertext)
  await supabase.from('audit_log').insert({
    agent_id: 'magic-link-vault',
    action: 'secret_collected',
    tool_input_hash: await sha256(encrypted_payload.ciphertext),
    metadata: { credential: tokenRow.credential_name, project: tokenRow.project },
  });
  
  return ok({ status: 'stored' });
});
```

### `server/webapp/app/vault/collect/[token]/page.tsx`

```tsx
'use client';
import { useState, useEffect } from 'react';
import { encryptClientSide, importDEK } from '@ecossistema/magic-link-vault';

export default function CollectSecretPage({ params }: { params: { token: string }}) {
  const [metadata, setMetadata] = useState(null);
  const [secret, setSecret] = useState('');
  const [status, setStatus] = useState<'idle'|'submitting'|'done'|'error'>('idle');
  
  useEffect(() => {
    fetch(`/api/vault/metadata?token=${params.token}`)
      .then(r => r.json()).then(setMetadata);
  }, [params.token]);
  
  if (!metadata) return <p>Validando token…</p>;
  if (metadata.error) return <p>Token inválido ou expirado.</p>;
  
  const handleSubmit = async () => {
    setStatus('submitting');
    try {
      // Fetch DEK (base64) — servidor gerou ao criar token
      const { dek } = await fetch(`/api/vault/dek?token=${params.token}`).then(r => r.json());
      const key = await importDEK(base64ToArrayBuffer(dek));
      const encrypted = await encryptClientSide(secret, key);
      const resp = await fetch('/api/vault/submit', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ token: params.token, encrypted_payload: encrypted }),
      });
      if (resp.ok) setStatus('done');
      else setStatus('error');
    } catch {
      setStatus('error');
    }
  };
  
  if (status === 'done') return <p>✅ Credencial armazenada com segurança.</p>;
  
  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-bold">Credencial: {metadata.credential_name}</h1>
      <p className="text-sm text-gray-600">Escopo: {metadata.scope}</p>
      <p className="text-sm text-gray-600">Expira em: {metadata.expires_in_minutes} minutos</p>
      <textarea
        className="w-full border rounded p-3 mt-4 font-mono"
        rows={6}
        placeholder="Cole o secret aqui"
        value={secret}
        onChange={e => setSecret(e.target.value)}
      />
      <p className="text-xs text-gray-500 mt-2">
        🔒 O valor será cifrado no seu navegador com AES-256-GCM antes de ser enviado.
        O servidor armazenará apenas o texto cifrado. Este link é válido apenas uma vez.
      </p>
      <button
        onClick={handleSubmit}
        disabled={!secret || status === 'submitting'}
        className="mt-4 bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {status === 'submitting' ? 'Enviando…' : 'Enviar'}
      </button>
    </div>
  );
}
```

---

## Schema `vault_tokens`

Migration (em slot separado, coordenado com S4 se couber):

```sql
create table vault_tokens (
    token             text primary key,          -- 32+ chars random url-safe
    credential_name   text not null,
    project           text not null,
    scope             text,                      -- descrição humana ("Inter Client Secret FIC")
    dek_wrapped       bytea,                     -- DEK cifrada pela KEK (para futura decryption pela SC-29)
    requested_by      text not null,             -- agent_id que pediu
    created_at        timestamptz default now(),
    expires_at        timestamptz not null,
    used              boolean default false,
    used_at           timestamptz,
    used_from_ip      inet,
    used_from_ua      text
);

create index vault_tokens_exp_idx on vault_tokens (expires_at) where used = false;

-- Purge automático de tokens expirados (pg_cron)
-- (criar cron separado: delete tokens used=true ou expired há 7+ dias)
```

---

## Tool MCP `collect_secret`

Exposto via MCP server do ecossistema para agents chamarem:

```typescript
export const collectSecretTool = {
  name: 'collect_secret',
  description: 'Solicita uma credencial ao usuário via magic link seguro (não expõe secret em chat)',
  input_schema: {
    type: 'object',
    required: ['credential_name', 'project', 'scope_description'],
    properties: {
      credential_name: { type: 'string', description: 'ex: INTER_CLIENT_SECRET' },
      project: { type: 'string', enum: ['ecosystem','fic','klesis','intentus','splendori','nexvy'] },
      scope_description: { type: 'string', description: 'Descrição humana do que é a credencial' },
      ttl_minutes: { type: 'number', default: 15, maximum: 60 },
    },
  },
  handler: async (args, ctx) => {
    const token = generateToken(32);
    const dek = generateDEK();
    const wrappedDEK = await wrapDEKWithKEK(dek);
    
    await supabase.from('vault_tokens').insert({
      token,
      credential_name: args.credential_name,
      project: args.project,
      scope: args.scope_description,
      dek_wrapped: wrappedDEK,
      requested_by: ctx.agent_id,
      expires_at: new Date(Date.now() + args.ttl_minutes * 60 * 1000).toISOString(),
    });
    
    const url = `https://vault.ecossistema.internal/vault/collect/${token}`;
    return {
      url,
      expires_at: ...,
      message: `⚠️ NÃO compartilhe credencial em chat. Peça ao usuário para abrir este link: ${url}`,
    };
  },
};
```

---

## Integração com SC-29 Modo B

Quando SC-29 Modo B precisa decifrar:
1. SC-29 consulta `ecosystem_credentials.vault_key` (ciphertext) + `vault_iv`
2. Busca DEK wrapped em `vault_tokens` (última entrada para essa credencial) OU armazena DEK direto em `ecosystem_credentials.dek_wrapped` após token usado
3. Unwrap DEK com KEK (KEK vem de Supabase Vault)
4. Decipher ciphertext → plaintext
5. Usa plaintext para chamada proxy → **descarta plaintext da memória imediatamente**
6. Retorna resultado

**Importante:** KEK fica em Supabase Vault. NUNCA em env var do Railway. SC-29 acessa via `vault.decrypted_secrets` (Supabase Vault API).

---

## Testes obrigatórios

### `tests/crypto.test.ts`
```typescript
test('encrypt + decrypt round-trip', async () => {
  const dek = generateDEK();
  const plaintext = 'super-secret-api-key-123';
  const encrypted = await encryptClientSide(plaintext, await importDEK(dek));
  const decrypted = await decryptServerSide(encrypted, dek);
  expect(decrypted).toBe(plaintext);
});

test('tampered ciphertext fails auth', async () => {
  const { ciphertext, iv } = await encryptClientSide('secret', key);
  const tampered = { ...ciphertext, ciphertext: tamper(ciphertext) };
  await expect(decryptServerSide(tampered, dek)).rejects.toThrow(/auth tag/i);
});
```

### `tests/tokens.test.ts`
- Token usado 2x → 2º uso rejeitado
- Token expirado → rejeitado
- Token não existente → rejeitado

### `tests/e2e.test.ts`
Fluxo completo (com Supabase branch):
1. Agent chama `collect_secret` → recebe URL
2. Simula POST do browser com payload cifrado
3. Verifica que `ecosystem_credentials` tem ciphertext
4. Simula SC-29 Modo B decifrando e chamando API mock
5. Verifica que API mock recebeu o secret correto

---

## Critério de sucesso

- [ ] Crypto round-trip passa (encrypt cliente, decrypt servidor)
- [ ] Token one-time validado + invalidado
- [ ] Next.js page renderiza, form funcional, client-side encryption OK
- [ ] Edge Function `/collect-secret` grava ciphertext
- [ ] Tool MCP `collect_secret` disponível (exposto via `@ecossistema/mcp-servers/credential-mcp` — ou stub)
- [ ] E2E teste verde contra Supabase branch
- [ ] README documentando fluxo + security model
- [ ] **Zero plaintext** em logs (audit log só tem hashes)
- [ ] Commit: `feat(vault): magic-link AES-256-GCM + Next.js form + tool MCP`

---

## ⚠️ Security review obrigatório

Antes de merge, validar:

- [ ] TLS enforce em todos endpoints (Railway default: sim; Supabase: sim)
- [ ] CSP no Next.js bloqueando scripts externos
- [ ] Token one-time: zero replays possíveis
- [ ] KEK nunca loggada, nunca em env raw
- [ ] Auth tag GCM verificada (tampered ciphertext → falha)
- [ ] Rate limit em `/api/vault/submit` (prevenir brute force de tokens)
- [ ] Logs limpos (spot-check: grep "secret\|key\|token" nos logs → só metadata, nunca valor)

---

## Handoff

- **S13 (Clients)** — `@ecossistema/credentials` pode adicionar método `requestSecretViaMagicLink()`
- **S8 (EFs)** — SC-29 Modo B integra com esta vault (usa KEK + DEK para decrypt antes do proxy)
- **S16 (Piloto CFO-FIC)** — primeiro uso real (credenciais Inter)

---

**Boa sessão. Segurança de credenciais é linha vermelha. Capricho absoluto.**
