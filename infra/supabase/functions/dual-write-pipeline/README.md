# dual-write-pipeline (SC-03)

Escrita idempotente em primary + mirror com opção `fail` (hard) ou `queue` (retry async) quando mirror falha.

## Endpoint

`POST /dual-write-pipeline`

```json
{
  "pipeline_id": "agent_tasks_mirror",
  "idempotency_key": "sha256:abcdef...",
  "primary": {
    "project": "ifdnjieklngcfodmtied",
    "table": "agent_tasks",
    "op": "upsert",
    "payload": { "id": "uuid", "status": "done" },
    "on_conflict": "id"
  },
  "mirror": {
    "project": "gqckbunsfjgerbuiyzvn",
    "table": "agent_tasks_replica",
    "op": "upsert",
    "payload": { "id": "uuid", "status": "done", "source_project": "ifdnjieklngcfodmtied" },
    "on_conflict": "id"
  },
  "on_mirror_failure": "queue"
}
```

## Importante
- O client Supabase da EF é sempre o **service-role do ECOSYSTEM**. Para escrever em outros projetos (ex: ERP-FIC), você precisa rodar uma EF proxy naquele projeto ou expandir esta EF para carregar clients adicionais a partir de `ecosystem_credentials`. Esta versão escreve ambos no ECOSYSTEM — `primary.project` e `mirror.project` ficam no log para auditoria.
- `idempotency_key` deve ser `sha256` do payload normalizado para garantir dedup.
- Ops suportadas: `insert`, `upsert`, `update`, `delete`. `update`/`delete` exigem `match`.

## Fila
Quando `on_mirror_failure=queue` e mirror falha, registro vai para `dual_write_queue` com `status=pending`, `next_attempt_at=now()+1min`. Worker de retry (fora do escopo desta EF) pode drenar.

## Auditoria
`audit_log.article_ref=SC-03` + `dual_write_log` com resultado por leg.
