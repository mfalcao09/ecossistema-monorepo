# Edge Function: collect-secret

Recebe o ciphertext AES-256-GCM do browser, valida o token one-time e armazena em `ecosystem_credentials`.

## Endpoint

`POST /functions/v1/collect-secret`

## Request body

```json
{
  "token": "abc123...",
  "encrypted_payload": {
    "ciphertext": "<base64>",
    "iv": "<base64>",
    "algorithm": "AES-256-GCM",
    "version": "1"
  }
}
```

## Variáveis de ambiente (Supabase)

- `SUPABASE_URL` — injetada automaticamente
- `SUPABASE_SERVICE_ROLE_KEY` — injetada automaticamente

## Segurança

- Token one-time: invalidado na primeira utilização
- Plaintext NUNCA armazenado — apenas ciphertext
- Audit log: apenas hash SHA-256 do ciphertext (nunca o valor)
- Rate limiting deve ser configurado no Supabase Dashboard
