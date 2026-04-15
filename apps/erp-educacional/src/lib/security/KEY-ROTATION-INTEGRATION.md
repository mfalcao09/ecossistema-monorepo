# Key Rotation System — Integration Checklist

## Files Created

- [x] `src/lib/security/key-rotation.ts` — Core encryption module (368 lines)
- [x] `src/lib/security/key-rotation-worker.ts` — Batch re-encryption worker (439 lines)
- [x] `supabase/migrations/20260326_key_rotation_metadata.sql` — Database schema (114 lines)
- [x] `src/lib/security/KEY-ROTATION-README.md` — Complete documentation
- [x] `src/lib/security/KEY-ROTATION-INTEGRATION.md` — This integration guide

## Pre-Integration Checklist

Before using this system in production, complete these steps:

### 1. Environment Configuration

- [ ] Generate encryption keys using: `openssl rand -base64 32`
- [ ] Add `PII_ENCRYPTION_KEY_V1` to environment (minimum)
- [ ] For staging/production, use secrets manager (Vercel, Supabase, etc.)
- [ ] Never commit keys to git
- [ ] Test that environment loads correctly: `process.env.PII_ENCRYPTION_KEY_V1`

### 2. Database Migration

- [ ] Run Supabase migration: `supabase migration up`
- [ ] Or manually execute SQL from `20260326_key_rotation_metadata.sql` in Supabase dashboard
- [ ] Verify tables created: `key_rotation_log`
- [ ] Verify functions created: `get_active_key_version()`, `list_key_versions()`
- [ ] Test helper functions in SQL editor

### 3. Code Integration

#### Option A: New PII Encryption (Recommended for new code)

```typescript
// Replace direct encryption calls with:
import { encryptPII, decryptPII } from '@/lib/security/key-rotation'

// When storing new PII:
const encrypted = encryptPII('12345678901')
if (encrypted.success) {
  await supabase.from('table').insert({ cpf_criptografado: encrypted.data })
}

// When retrieving PII:
const result = await supabase.from('table').select('cpf_criptografado').single()
const decrypted = decryptPII(result.cpf_criptografado)
if (decrypted.success) {
  console.log(decrypted.data) // plaintext
}
```

#### Option B: Gradual Migration (For existing code)

1. Keep existing `pii-encryption.ts` RPC calls working
2. Add new code using `key-rotation.ts` functions
3. Gradually migrate old PII columns using `reEncryptTable()`
4. Eventually deprecate old RPC calls

### 4. Testing

- [ ] Unit tests for `encryptPII()` and `decryptPII()`
  - Test with various data types (CPF, email, RG, etc.)
  - Test with special characters
  - Verify ciphertext format (v{version}:...)

- [ ] Integration tests for `reEncryptTable()`
  - Test on staging database only
  - Test dry-run mode first
  - Verify batch processing
  - Check error handling

- [ ] Verify version detection
  - Encrypt with V1, add V2 key, decrypt with auto-detection
  - Re-encrypt V1 data to V2
  - Ensure both versions coexist

### 5. Production Deployment

- [ ] Review and approve code changes
- [ ] Ensure environment variables set in production
- [ ] Deploy to staging first
- [ ] Run smoke tests in staging
- [ ] Deploy to production
- [ ] Monitor logs for any decryption failures
- [ ] Verify `key_rotation_log` table populated correctly

### 6. Documentation Updates

- [ ] Update team wiki/docs with key rotation procedure
- [ ] Document how to add new team members to key management
- [ ] Create ops runbook for handling key rotation
- [ ] Document monitoring/alerting setup

## Integration Points

### With Existing pii-encryption.ts

The new system is **complementary**, not a replacement:

```typescript
// Old system (still works)
import { criptografarPII, descriptografarPII } from '@/lib/security/pii-encryption'
// Uses: PII_ENCRYPTION_KEY (env), pgcrypto RPC functions

// New system (recommended for new code)
import { encryptPII, decryptPII } from '@/lib/security/key-rotation'
// Uses: PII_ENCRYPTION_KEY_V1, V2, etc., pure Node.js crypto

// Both can coexist during transition period
```

### With Supabase Storage

If you're storing files with PII metadata:

```typescript
import { encryptPII } from '@/lib/security/key-rotation'

// Encrypt metadata before storing
const metadata = {
  cpf: encryptPII(user.cpf).data,
  email: encryptPII(user.email).data,
}

await supabase.storage
  .from('pii-documents')
  .upload(filename, file, { metadata })
```

### With Audit Trails

The key rotation system logs to `key_rotation_log`. Connect to your audit system:

```typescript
import { rotateKey } from '@/lib/security/key-rotation'
import { logAudit } from '@/lib/security/audit-trail'

// When rotating:
const result = await rotateKey(2, userId)
if (result.success) {
  await logAudit({
    usuario_id: userId,
    acao: 'rotacao_chave_pii',
    entidade: 'key_rotation',
    entidade_id: '2',
    detalhes: { nova_versao: 2 }
  })
}
```

## Migration Timeline

### Phase 1: Setup (Week 1)
- [ ] Generate encryption keys
- [ ] Configure environment variables
- [ ] Run database migration
- [ ] Run smoke tests

### Phase 2: Integration (Week 2-3)
- [ ] Update code to use new functions for NEW PII
- [ ] Keep old system working for compatibility
- [ ] Test encryption/decryption flows
- [ ] Deploy to staging

### Phase 3: Migration (Week 4+)
- [ ] Run `analyzeEncryptionVersions()` on all tables
- [ ] Plan batch re-encryption jobs
- [ ] Execute `reEncryptBatch()` during low-traffic hours
- [ ] Verify migration success
- [ ] Deploy to production

### Phase 4: Rotation (Quarter basis)
- [ ] Generate new key (PII_ENCRYPTION_KEY_V2)
- [ ] Add to environment
- [ ] Call `rotateKey(2)`
- [ ] Schedule `reEncryptBatch()` for off-peak
- [ ] Update status in `key_rotation_log` when complete
- [ ] Monitor for any failures

## Key Rotation Procedure (Template)

When it's time to rotate (typically every 90-180 days):

```bash
# 1. Generate new key
openssl rand -base64 32

# 2. Add to secrets manager (example: Vercel)
# Settings → Environment Variables → Add:
# PII_ENCRYPTION_KEY_V2=<generated-key>

# 3. Deploy (triggers environment reload)
git push origin main
# Wait for deployment

# 4. Activate in application (via admin dashboard or API)
curl -X POST https://api.fic.edu.br/admin/crypto/rotate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"newVersion": 2, "rotatedBy": "admin@fic.edu.br"}'

# 5. Re-encrypt existing data (background job)
# Can run via cron, manual trigger, or scheduled task

# 6. Monitor progress
curl https://api.fic.edu.br/admin/crypto/status

# 7. Deprecate old version (after 90 days of new version)
# Update key_rotation_log: SET status = 'deprecated' WHERE version = 1
```

## Monitoring & Alerts

### Metrics to Track

- [ ] `key_rotation_log` entries (ensure new rotations recorded)
- [ ] Failed decryptions (monitor logs for auth tag failures)
- [ ] Re-encryption progress (batch job completion)
- [ ] Key version distribution (which versions in use)

### Alerts to Set Up

```bash
# Alert if:
1. No active key version found
   SELECT COUNT(*) FROM key_rotation_log WHERE status = 'active' = 0

2. Decryption failures spike
   SELECT COUNT(*) FROM logs WHERE message LIKE '%Auth tag mismatch%' AND created_at > NOW() - INTERVAL '1 hour'

3. Old versions still in use after deprecation period
   SELECT * FROM key_rotation_log WHERE status = 'deprecated' AND deprecated_at < NOW() - INTERVAL '90 days'
```

## Rollback Procedure

If rotation goes wrong:

1. **Decryption failures (auth tag mismatch)**
   - Ensure all old key versions still configured in env
   - Check that ciphertext format is correct
   - Verify data wasn't corrupted during migration

2. **Re-encryption failures**
   - Stop re-encryption job (kill process)
   - Check database for partial updates
   - Rollback failed batches from backup if needed
   - Fix issue and restart with smaller batch size

3. **Complete rollback**
   - Revert code changes (git revert)
   - Keep environment variables (they're backward compatible)
   - Old encrypted data remains readable by old keys
   - No data loss

## Support & Troubleshooting

### Common Issues

**Q: "PII_ENCRYPTION_KEY_V1 não configurada"**
- A: Add to environment and redeploy

**Q: "Auth tag mismatch" errors**
- A: Ensure correct key version. Check if ciphertext corrupted.

**Q: Re-encryption hangs**
- A: Reduce batch size. Check database connections. Monitor memory.

**Q: Version not auto-incrementing correctly**
- A: Keys are loaded once at startup. Restart application after adding new env vars.

See `KEY-ROTATION-README.md` for full troubleshooting section.

## Success Criteria

- [ ] All PII encrypted with version prefix
- [ ] All ciphertexts decrypt successfully
- [ ] Re-encryption jobs complete without errors
- [ ] Key rotation can be done without downtime
- [ ] Audit trail shows all rotations
- [ ] Team trained on rotation procedure
- [ ] Monitoring/alerts configured
- [ ] Backup/rollback procedure documented

## Next Review

- Schedule key rotation review: **90 days from today**
- Audit team: Verify encryption is working as expected
- Compliance: Check against LGPD/NIST requirements
- Performance: Monitor any encryption/decryption latency

---

**Prepared by:** Claude Agent
**Date:** 2026-03-26
**Status:** Ready for Integration
**Contact:** Marcelo Silva (mrcelooo@gmail.com)
