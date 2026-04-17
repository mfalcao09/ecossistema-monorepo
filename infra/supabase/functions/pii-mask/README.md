# pii-mask (SC-19)

Mascara PII preservando o formato original e retorna um hash determinístico por ocorrência (útil para análise de padrões sem expor dados).

## Endpoint

`POST /pii-mask`

Modo singular:
```json
{ "text": "João Silva, CPF 123.456.789-00, contato joao@email.com ou (11) 99999-8888" }
```

Modo batch:
```json
{ "texts": ["linha 1 ...", "linha 2 ..."] }
```

## Resposta

```json
{
  "masked": "João Silva, CPF ***.***.***-**, contato j***@email.com ou (**) *****-****",
  "found": [
    { "type": "cpf",   "position": [16, 30], "value_hash": "sha256..." },
    { "type": "email", "position": [42, 56], "value_hash": "sha256..." },
    { "type": "phone", "position": [60, 75], "value_hash": "sha256..." }
  ],
  "counts": { "cpf": 1, "email": 1, "phone": 1 }
}
```

## Detecções
- `cpf` — `000.000.000-00` / `00000000000`
- `cnpj` — `00.000.000/0000-00`
- `email`
- `phone` — padrão BR com/sem DDD/DDI
- `cep` — `00000-000`
- `rg` — `00.000.000-X`

## Hashing
`sha256(PII_HASH_SALT || ":" || type || ":" || valor_original)`. Consistente para o mesmo valor — permite correlação sem expor dados.

Configure `PII_HASH_SALT` via env (default: `ecosystem-v9`).
