# RPC Portal Público — Quick Reference

## Migration File
```
supabase/migrations/20260326_rpc_portal_publico.sql
```

## Functions Available

### 1. CPF Search (Public Diploma Lookup)
```sql
SELECT * FROM consultar_documentos_por_cpf(
  p_cpf_hash TEXT,
  p_data_nascimento TEXT
)
```

**Returns:**
```
id, tipo, titulo, numero_documento, assinado_em,
publicado_em, ies_nome, codigo_verificacao, url_verificacao
```

**Example:**
```typescript
const cpfHash = crypto.createHash('sha256').update('12345678900').digest('hex');
const { data } = await admin.rpc('consultar_documentos_por_cpf', {
  p_cpf_hash: cpfHash,
  p_data_nascimento: '1990-01-01'
});
```

---

### 2. Document Verification (By Code)
```sql
SELECT * FROM verificar_documento_por_codigo(
  p_codigo TEXT
)
```

**Returns:**
```
valido, tipo, status, destinatario_nome, destinatario_cpf_mascarado,
codigo_validacao, numero_registro, titulo_conferido, titulo, grau,
modalidade, carga_horaria_total, codigo_emec_curso, reconhecimento,
ies_emissora_nome, ies_emissora_codigo_mec, ies_registradora_nome,
ies_registradora_codigo_mec, data_ingresso, data_conclusao,
data_colacao_grau, data_expedicao, data_registro, data_publicacao,
forma_acesso, assinado_em, publicado_em, rvdd_url, xml_url,
xml_historico_url, qrcode_url, ies_nome, numero_documento, erro_message
```

**Example:**
```typescript
const { data } = await admin.rpc('verificar_documento_por_codigo', {
  p_codigo: 'FIC-2025-ABC123'
});
```

---

## Security Checklist

- [x] SECURITY DEFINER — Functions run as database owner
- [x] search_path = 'public' — No schema injection possible
- [x] Field whitelisting — Only public fields returned
- [x] Two-factor verification — CPF hash + birth date
- [x] Status filtering — Only 'publicado' documents
- [x] No raw CPF — Masked for display (XXX.***.***.NN)
- [x] No internal IDs — diplomado_id not exposed
- [x] Granted to authenticated + anon — Public portal ready
- [x] 4 indexes — O(log n) performance

---

## Deployment Checklist

1. **Pre-deployment**
   - [ ] Review migration SQL
   - [ ] Verify tables exist: diplomados, diplomas, cursos
   - [ ] Backup database (Supabase handles this)

2. **Apply Migration**
   - [ ] Copy SQL to Supabase SQL Editor
   - [ ] Click Run
   - [ ] Verify no errors

3. **Post-deployment**
   - [ ] Verify functions exist:
     ```sql
     SELECT proname FROM pg_proc
     WHERE proname LIKE 'consultar_%' OR proname LIKE 'verificar_%';
     ```
   - [ ] Test RPC calls manually
   - [ ] Update API routes to use RPC
   - [ ] Monitor error logs

---

## API Integration Examples

### CPF Portal Search
**File:** `src/app/api/portal/consultar-cpf/route.ts`

```typescript
import crypto from 'crypto';

// Inside POST handler:
const cpfLimpo = cpf.replace(/\D/g, '');
const cpfHash = crypto.createHash('sha256').update(cpfLimpo).digest('hex');

const { data: documentos, error } = await admin.rpc(
  'consultar_documentos_por_cpf',
  {
    p_cpf_hash: cpfHash,
    p_data_nascimento: dataNascimentoISO
  }
);

if (error) throw error;

const diplomas = (documentos || []).map(d => ({
  id: d.id,
  tipo: d.tipo,
  titulo: d.titulo,
  numero_documento: d.numero_documento,
  assinado_em: d.assinado_em,
  publicado_em: d.publicado_em,
  ies_nome: d.ies_nome,
  codigo_verificacao: d.codigo_verificacao,
  url_verificacao: d.url_verificacao,
}));
```

### Document Verification
**File:** `src/app/api/documentos/verificar/[codigo]/route.ts`

```typescript
// Inside verificarDocumento function:
const admin = getAdminClientEngine();

const { data, error } = await admin.rpc(
  'verificar_documento_por_codigo',
  { p_codigo: codigoVerificacao }
);

if (error || !data || data.length === 0) {
  return { valido: false, erro: 'Documento não encontrado' };
}

const row = data[0];
if (!row.valido) {
  return { valido: false, erro: row.erro_message };
}

return {
  valido: row.valido,
  documento: {
    tipo: row.tipo,
    status: row.status,
    destinatario_nome: row.destinatario_nome,
    destinatario_cpf_mascarado: row.destinatario_cpf_mascarado,
    codigo_validacao: row.codigo_validacao,
    numero_registro: row.numero_registro,
    titulo_conferido: row.titulo_conferido,
    titulo: row.titulo,
    grau: row.grau,
    modalidade: row.modalidade,
    carga_horaria_total: row.carga_horaria_total,
    codigo_emec_curso: row.codigo_emec_curso,
    reconhecimento: row.reconhecimento,
    ies_emissora_nome: row.ies_emissora_nome,
    ies_emissora_codigo_mec: row.ies_emissora_codigo_mec,
    ies_registradora_nome: row.ies_registradora_nome,
    ies_registradora_codigo_mec: row.ies_registradora_codigo_mec,
    data_ingresso: row.data_ingresso,
    data_conclusao: row.data_conclusao,
    data_colacao_grau: row.data_colacao_grau,
    data_expedicao: row.data_expedicao,
    data_registro: row.data_registro,
    data_publicacao: row.data_publicacao,
    forma_acesso: row.forma_acesso,
    assinado_em: row.assinado_em,
    publicado_em: row.publicado_em,
    rvdd_url: row.rvdd_url,
    xml_url: row.xml_url,
    xml_historico_url: row.xml_historico_url,
    qrcode_url: row.qrcode_url,
    ies_nome: row.ies_nome,
    numero_documento: row.numero_documento,
  }
};
```

---

## Troubleshooting

### RPC Function Not Found
```sql
-- Check if function exists
SELECT proname, prosecdef FROM pg_proc
WHERE proname LIKE 'consultar_%' OR proname LIKE 'verificar_%';

-- If empty, migration didn't run. Re-apply it.
```

### Permission Denied Error
```
error: permission denied for schema public

Solution: Grant function execution to your role:
GRANT EXECUTE ON FUNCTION consultar_documentos_por_cpf(TEXT, TEXT)
  TO authenticated, anon;
```

### Slow Queries
```sql
-- Check if indexes exist
SELECT indexname, idx_scan FROM pg_stat_user_indexes
WHERE tablename IN ('diplomados', 'diplomas')
ORDER BY idx_scan DESC;

-- If idx_scan = 0, indexes aren't being used
-- Check query plan: EXPLAIN ANALYZE SELECT...
```

### No Results (But Data Exists)
- Verify CPF hash is correct (use same hash algorithm as API)
- Verify birth date format (must be YYYY-MM-DD)
- Verify diploma status = 'publicado' (check in diplomados table)
- Check two-factor: Both CPF hash AND birth date must match

---

## Performance Targets

| Query | Latency | Data Size |
|-------|---------|-----------|
| CPF Search | 10-50ms | 1-2 KB |
| Verification | 5-20ms | 3-5 KB |
| With CDN Cache | <100ms | 0 KB (cached) |

---

## Indexes Created

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| `idx_diplomados_cpf_hash_birthdate` | diplomados | cpf_hash, data_nascimento | CPF search |
| `idx_diplomas_codigo_validacao` | diplomas | codigo_validacao | Verification |
| `idx_diplomas_status` | diplomas | status | Published filter |
| `idx_verification_errors_codigo` | _verification_errors | codigo | Audit log |

---

## Monitoring

### Function Usage
```sql
SELECT
  p.proname,
  COALESCE(s.calls, 0) AS calls,
  COALESCE(s.total_time, 0)::NUMERIC(10,2) AS total_ms
FROM pg_proc p
LEFT JOIN pg_stat_user_functions s ON p.oid = s.funcid
WHERE p.proname LIKE 'consultar_%' OR p.proname LIKE 'verificar_%'
ORDER BY calls DESC;
```

### Index Performance
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename IN ('diplomados', 'diplomas')
ORDER BY idx_scan DESC;
```

### Slow Queries
```sql
-- If slow_query_log enabled:
SELECT query, mean_time, calls
FROM pg_stat_statements
WHERE query LIKE '%consultar_%' OR query LIKE '%verificar_%'
ORDER BY mean_time DESC;
```

---

## References

- **Full Documentation:** `docs/MIGRATION_RPC_PORTAL_PUBLICO.md`
- **Migration File:** `supabase/migrations/20260326_rpc_portal_publico.sql`
- **Original Queries:**
  - `src/app/api/portal/consultar-cpf/route.ts`
  - `src/app/api/documentos/verificar/[codigo]/route.ts`
  - `src/lib/documentos/engine.ts` (verificarDocumento function)
