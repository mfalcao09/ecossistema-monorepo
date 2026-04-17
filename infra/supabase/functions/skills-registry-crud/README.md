# skills-registry-crud (SC-04)

CRUD + descoberta por full-text da `skills_registry` (V9 Parte XII).

## Endpoints

| Método | Path | Scope | Descrição |
|---|---|---|---|
| GET  | `/skills-registry-crud?business_id=fic&tags=marketing,cro&active=true` | reader | list com filtros |
| GET  | `/skills-registry-crud/:id` | reader | get single |
| POST | `/skills-registry-crud` | operator | create |
| PATCH| `/skills-registry-crud/:id` | operator | update (campos brancos) |
| DELETE | `/skills-registry-crud/:id` | admin | soft-delete (`is_active=false`) |
| GET/POST | `/skills-registry-crud/match` | reader | FTS matching |

### Match
```bash
GET /skills-registry-crud/match?q=gerar+boleto+pix&business_id=fic&limit=5
# ou
POST /skills-registry-crud/match  { "query": "gerar boleto pix", "business_id": "fic", "limit": 5 }
```

Retorna skills do `business_id` + do escopo `ecosystem`, ordenadas por `ts_rank_cd`.

## Auth
JWT agent-bound OU owner bearer. Scopes verificados:
- list/get/match → qualquer principal autenticado
- create/update → `operator` ou `admin`
- delete → `admin`
