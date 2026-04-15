# PII Encryption Key Rotation System

## Overview

This system provides secure, versioned encryption key rotation for PII (Personally Identifiable Information) data in the ERP Educacional project. It enables seamless key rotation without requiring a complete system restart or data re-encryption at once.

## Architecture

### Key Components

1. **key-rotation.ts** — Core encryption/decryption with versioning
2. **key-rotation-worker.ts** — Background batch re-encryption utility
3. **20260326_key_rotation_metadata.sql** — Database metadata table and helpers

### Design Principles

- **Versioned Ciphertexts**: Every encrypted value is prefixed with its key version (`v{version}:...`)
- **Multiple Active Keys**: Keep old keys for decryption while activating new ones
- **AES-256-GCM**: Military-grade authenticated encryption
- **No Key Storage in DB**: Keys live only in environment variables
- **Graceful Rotation**: Decrypt with old key, re-encrypt with new key

## Environment Setup

### 1. Configure Environment Variables

```bash
# At minimum, configure V1
PII_ENCRYPTION_KEY_V1="your-32-character-minimum-random-key-here-v1"

# For future rotations, add new versions
PII_ENCRYPTION_KEY_V2="your-next-32-character-random-key-here-v2"
PII_ENCRYPTION_KEY_V3="your-third-32-character-random-key-here-v3"
```

**Key Requirements:**
- Minimum 32 characters per key
- Use cryptographically secure random generators (e.g., `openssl rand -hex 32`)
- Store securely in your hosting provider's secret management (Vercel, Supabase, etc.)
- Never commit to git

### 2. Run the Migration

```bash
# Apply the SQL migration to create tracking tables
supabase migration up

# Or manually in Supabase dashboard
# Copy contents of: supabase/migrations/20260326_key_rotation_metadata.sql
# Paste into SQL editor and execute
```

## Usage

### Basic Encryption/Decryption

```typescript
import { encryptPII, decryptPII } from '@/lib/security/key-rotation'

// Encrypt data with current key version (auto-detected)
const result = encryptPII('12345678901')
if (result.success) {
  console.log(result.data) // "v1:salt:iv:authTag:ciphertext"
}

// Decrypt (detects version from prefix)
const decrypted = decryptPII(result.data!)
if (decrypted.success) {
  console.log(decrypted.data) // "12345678901"
  console.log(decrypted.usedVersion) // 1
}
```

### Key Rotation Workflow

#### Step 1: Add New Key to Environment

```bash
# Generate new key
openssl rand -base64 32

# Add to environment (secrets manager)
PII_ENCRYPTION_KEY_V2="your-new-key-here"
```

#### Step 2: Activate New Key Version

```typescript
import { rotateKey } from '@/lib/security/key-rotation'

// Activate V2 (requires admin context)
const result = await rotateKey(2, 'admin@fic.edu.br')
// Logs rotation to key_rotation_log table
```

#### Step 3: Re-encrypt Existing Data

```typescript
import { reEncryptTable, validateReEncryption } from '@/lib/security/key-rotation-worker'

// Option A: Dry-run first to validate
const validation = await validateReEncryption('pessoas', 'cpf_criptografado', 50)
console.log(`Would re-encrypt: ${validation.reEncryptedRecords}`)

// Option B: Analyze distribution first
const analysis = await analyzeEncryptionVersions('pessoas', 'cpf_criptografado')
console.log(analysis.byVersion) // { 1: 5000, 2: 3000 }

// Option C: Perform actual re-encryption
const result = await reEncryptTable('pessoas', 'cpf_criptografado', {
  batchSize: 100,
  dryRun: false,
  logProgress: true,
})

console.log(`Re-encrypted: ${result.reEncryptedRecords}`)
console.log(`Failed: ${result.failedRecords}`)
console.log(`Duration: ${result.duration}ms`)
```

#### Step 4: Re-encrypt Multiple Tables (Batch)

```typescript
import { reEncryptBatch } from '@/lib/security/key-rotation-worker'

const jobs = [
  { table: 'pessoas', column: 'cpf_criptografado' },
  { table: 'pessoas', column: 'email_criptografado' },
  { table: 'diplomados', column: 'cpf_criptografado' },
]

const results = await reEncryptBatch(jobs, {
  batchSize: 100,
  logProgress: true,
})

results.forEach((r) => {
  console.log(`${r.table}.${r.column}: ${r.reEncryptedRecords} re-encrypted`)
})
```

#### Step 5: Mark Old Version as Deprecated

```typescript
// Update status in database (via SQL or API)
UPDATE key_rotation_log
SET status = 'deprecated', deprecated_at = NOW()
WHERE version = 1
```

#### Step 6: Monitor and Validate

```typescript
import { listKeyVersions, getKeyVersionInfo } from '@/lib/security/key-rotation'

// Check all versions
const versions = listKeyVersions() // [2, 1]

// Get info on specific version
const info = await getKeyVersionInfo(1)
console.log(info) // { version: 1, active: false, deprecatedAt: ... }
```

## Data Format

### Ciphertext Structure

```
v{version}:{salt}:{iv}:{authTag}:{ciphertext}

Example:
v2:Sa1tVa1ueBase64:IvVa1ueBase64:AuthTagBase64:EncryptedDataBase64
```

- **v{version}**: Version number prefix (1-20 supported)
- **salt**: 16 bytes (128 bits) random, base64-encoded
- **iv**: 12 bytes (96 bits) random for GCM, base64-encoded
- **authTag**: 16 bytes (128 bits) authentication tag, base64-encoded
- **ciphertext**: Encrypted plaintext, base64-encoded

### Encryption Details

- **Algorithm**: AES-256-GCM (NIST standard)
- **Key Derivation**: PBKDF2-like (SHA-256 based)
- **Salt**: Random per encryption (prevents rainbow tables)
- **IV**: Random per encryption (required for GCM)
- **Authentication**: Full AEAD (detects tampering)

## Database Schema

### key_rotation_log Table

```sql
CREATE TABLE key_rotation_log (
  id UUID PRIMARY KEY,
  version INTEGER UNIQUE NOT NULL,
  rotated_at TIMESTAMPTZ DEFAULT NOW(),
  rotated_by TEXT,
  status TEXT ('active' | 'deprecated' | 'retired'),
  deprecated_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  notes TEXT
);
```

### Helper Functions

**get_active_key_version()** — Returns current active version number

```sql
SELECT get_active_key_version(); -- Returns: 2
```

**list_key_versions()** — Lists all versions with status

```sql
SELECT * FROM list_key_versions();
-- version | status | rotated_at | rotated_by
-- 2 | active | 2026-03-26 | admin@fic.edu.br
-- 1 | deprecated | 2026-03-21 | system
```

## API Reference

### key-rotation.ts

#### `getCurrentKeyVersion(): number`
Returns the highest version number (currently active).

#### `encryptPII(plaintext: string): EncryptionResult`
Encrypts with active key version, returns versioned ciphertext.

#### `decryptPII(ciphertext: string): DecryptionResult`
Auto-detects key version and decrypts.

#### `rotateKey(newVersion: number, rotatedBy?: string): Promise<EncryptionResult>`
Activates new key version and logs in database.

#### `reEncryptWithCurrentKey(ciphertext: string): EncryptionResult`
Decrypts with any key version, re-encrypts with current.

#### `getKeyVersionInfo(version: number): Promise<KeyVersionInfo | null>`
Gets metadata about a specific version from database.

#### `listKeyVersions(): number[]`
Returns all configured versions in descending order.

### key-rotation-worker.ts

#### `reEncryptTable(table, column, options): Promise<ReEncryptionResult>`
Re-encrypts all records in a single table column.

**Options:**
- `batchSize` (default: 100) — Records per batch
- `dryRun` (default: false) — Simulate without saving
- `logProgress` (default: true) — Log each batch
- `stopOnError` (default: false) — Halt on first error

#### `reEncryptBatch(jobs, options): Promise<ReEncryptionResult[]>`
Re-encrypts multiple tables/columns sequentially.

#### `validateReEncryption(table, column, sampleSize): Promise<ReEncryptionResult>`
Dry-run validation on sample data.

#### `analyzeEncryptionVersions(table, column): Promise<AnalysisResult>`
Reports which records use which key versions.

## Best Practices

### Key Rotation Timeline

1. **Generate new key** → `openssl rand -base64 32`
2. **Add to env** → `PII_ENCRYPTION_KEY_V2=...` (before deployment)
3. **Deploy code** → Include new version in environment
4. **Activate key** → `rotateKey(2, userId)` (from admin panel/API)
5. **Re-encrypt data** → `reEncryptBatch([...])` (background job)
6. **Verify migration** → Query `key_rotation_log` status
7. **Deprecate old key** → Update status to 'deprecated'
8. **Retire key** — After 90 days, set to 'retired' and stop loading from env

### Security Guidelines

- **Rotate keys every 90-180 days** for compliance
- **Keep 2-3 versions active** for decryption during rotation
- **Never share keys** — Use secure secret management only
- **Monitor failed decryptions** — May indicate tampering
- **Log all rotations** — Audit trail in `key_rotation_log`
- **Test rotation process** in staging before production

### Performance Considerations

- **Batch size**: Start with 100, adjust based on server resources
- **Off-peak execution**: Run re-encryption jobs during low-traffic hours
- **Connection pooling**: Supabase handles this, but monitor concurrent connections
- **Memory**: Processing 1000s of records may require increased RAM
- **Network**: Batching reduces number of database round-trips

## Troubleshooting

### "Chave V1 não configurada"

**Cause**: `PII_ENCRYPTION_KEY_V1` not in environment.

**Fix**: Add to your secrets manager and redeploy:
```bash
PII_ENCRYPTION_KEY_V1="your-32-char-key"
```

### "Falha ao descriptografar: Auth tag mismatch"

**Cause**: Ciphertext is corrupted or encrypted with different key.

**Fix**: Check that all key versions are configured. If data is lost, may need manual recovery from backups.

### "Re-encryption hangs"

**Cause**: Large batch size or network timeout.

**Fix**: Reduce `batchSize` parameter:
```typescript
await reEncryptTable('pessoas', 'cpf', { batchSize: 25 })
```

### "Out of memory during re-encryption"

**Cause**: Batch size too large.

**Fix**: Process in smaller batches or increase server RAM.

## Compliance

This system supports compliance with:

- **LGPD** (Lei Geral de Proteção de Dados) — PII encryption requirement
- **NIST SP 800-175B** — Encryption standards
- **MEC Portarias 554/2019 and 70/2025** — Brazilian education system requirements

## Testing

### Unit Tests Example

```typescript
import { encryptPII, decryptPII, reEncryptWithCurrentKey } from '@/lib/security/key-rotation'

describe('Key Rotation', () => {
  it('should encrypt and decrypt', () => {
    const plaintext = '12345678901'
    const encrypted = encryptPII(plaintext)

    expect(encrypted.success).toBe(true)
    expect(encrypted.data).toMatch(/^v\d+:/) // Has version prefix

    const decrypted = decryptPII(encrypted.data!)
    expect(decrypted.success).toBe(true)
    expect(decrypted.data).toBe(plaintext)
  })

  it('should re-encrypt to current version', () => {
    const plaintext = 'test@example.com'
    const v1 = encryptPII(plaintext)

    // Simulate rotation to V2
    process.env.PII_ENCRYPTION_KEY_V2 = 'new-key-at-least-32-chars-long'

    const v2 = reEncryptWithCurrentKey(v1.data!)
    expect(v2.data).toMatch(/^v2:/)
  })
})
```

## Support & Maintenance

For issues or questions:

1. Check logs in `/var/log/erp-educacional/key-rotation.log`
2. Query `key_rotation_log` for rotation history
3. Run `analyzeEncryptionVersions()` to diagnose data issues
4. Contact Marcelo Silva (mrcelooo@gmail.com)

---

**Last Updated:** 2026-03-26
**Version:** 1.0
**Status:** Production Ready
