# Deployment Checklist: Security & Backup System

## Pre-Deployment Steps

### 1. Generate Required Keys

Run these commands locally:

```bash
# Generate BACKUP_ENCRYPTION_KEY (AES-256 - must be 32+ bytes)
openssl rand -base64 48

# Generate CRON_SECRET (for Vercel cron authorization)
openssl rand -base64 32

# Generate PII_ENCRYPTION_KEY (if not already created)
openssl rand -base64 48
```

**Save these values securely** - you'll need them for Vercel.

### 2. Prepare Environment Variables

Create these in Vercel Project Settings → Environment Variables:

```
BACKUP_ENCRYPTION_KEY=<generated-key-1>
CRON_SECRET=<generated-key-2>
PII_ENCRYPTION_KEY=<generated-key-3>
NEXT_PUBLIC_SUPABASE_URL=<existing>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<existing>
SUPABASE_SERVICE_ROLE_KEY=<existing>
```

Add to all environments: Production, Preview, Development

### 3. Verify Git Configuration

```bash
# Ensure you're in the project root
cd /path/to/ERP-Educacional

# Check git status
git status

# Verify all new files are tracked
git ls-files | grep -E "(backup|security|\.zap|npm-audit)"
```

---

## Deployment Phase 1: Database Migration

### 1. Connect to Supabase

```bash
# Link project
supabase link --project-ref YOUR_PROJECT_REF

# Verify connection
supabase status
```

### 2. Apply Migration

```bash
# Push migration to Supabase
supabase db push

# Verify table created
supabase db query "SELECT tablename FROM pg_tables WHERE tablename = 'backup_log';"
```

**Expected output**: Should show `backup_log` table exists

### 3. Test RLS Policies

```sql
-- Connect to Supabase database console and run:
SELECT * FROM backup_log;  -- Should work if you're admin
```

---

## Deployment Phase 2: Edge Function

### 1. Deploy Edge Function

```bash
# Deploy to Supabase
supabase functions deploy backup-criptografado

# Verify deployment
supabase functions list
```

**Expected output**: Should list `backup-criptografado` function

### 2. Test Edge Function

```bash
# Test locally (optional)
supabase functions serve

# In another terminal:
curl -X POST http://localhost:54321/functions/v1/backup-criptografado \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tipo": "manual"}'
```

**Expected response**: JSON with backup metadata or error details

---

## Deployment Phase 3: Code Deployment

### 1. Commit Changes

```bash
git add -A

git commit -m "feat: add encrypted backup system and OWASP ZAP security scanning

- Add AES-256-GCM encrypted database backups
- Implement backup log tracking with RLS
- Create Supabase Edge Function for automated backups
- Add Vercel cron job (daily 3AM UTC)
- Integrate OWASP ZAP security scanning
- Add npm audit vulnerability checking
- Create GitHub Actions workflows
- Update environment variables and documentation"

# Or if using conventional commits:
git commit -m "feat(security): encrypted backups and OWASP ZAP scanning"
```

### 2. Push to Repository

```bash
git push origin main

# Or if using different branch:
git push origin feature/security-backups
```

**If using pull request flow**:
```bash
git push origin feature/security-backups
# Create PR on GitHub for review
```

### 3. Monitor Deployment

```bash
# Watch Vercel deployment
vercel deploy --prod

# Or check Vercel dashboard
# https://vercel.com/dashboard/deployments
```

**Expected outcomes**:
- Build completes without errors
- Functions deploy successfully
- Edge functions available

---

## Deployment Phase 4: GitHub Actions Setup

### 1. Verify Workflows Exist

```bash
ls -la .github/workflows/

# Should show:
# - npm-audit.yml
# - security-scan.yml
```

### 2. Add GitHub Secrets

Go to GitHub → Settings → Secrets and variables → Actions

Add these secrets (if not already present):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

### 3. Trigger Workflows

Option A: Manual trigger via GitHub UI
- Actions tab → Select workflow → Run workflow

Option B: Automatic trigger
- Workflows run automatically on push/PR
- Check Actions tab to monitor

**Expected behavior**:
- `security-scan` workflow runs in ~15-20 minutes
- `npm-audit` workflow runs in ~5-10 minutes
- Both produce artifacts (HTML reports)

---

## Post-Deployment Verification

### 1. Test Backup System

```bash
# Trigger manual backup
curl -X POST https://your-app.vercel.app/api/cron/backup \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"

# Check backup log
# Via Supabase dashboard:
# Database → backup_log table → view all rows
# Should show new entry with status='sucesso'
```

### 2. Verify Backup Files

```bash
# Check Supabase Storage
# Go to Supabase dashboard → Storage → backups folder
# Should see encrypted files: backup-*.json.enc

# Or via API:
curl -s https://your-project.supabase.co/storage/v1/object/public/backups/ \
  -H "Authorization: Bearer $ANON_KEY"
```

### 3. Check Security Scan Results

```bash
# GitHub Actions → security-scan workflow
# Look for:
# - Baseline scan completed
# - npm audit results
# - TypeScript check status
# - Artifacts available for download
```

### 4. Verify Cron Job Registration

```bash
# Check Vercel cron configuration
vercel crons list

# Should show:
# - /api/cron/backup (0 3 * * *)
# - /api/cron/lgpd-purge (0 2 * * *)
# - /api/cron/key-rotation (0 3 * * 0)
```

### 5. Test Encryption/Decryption

```typescript
// In Node.js console or script:
import { criptografarBackup, descriptografarBackup } from '@/lib/backup/crypto'

const testData = Buffer.from('test backup data')
const key = process.env.BACKUP_ENCRYPTION_KEY!

// Encrypt
const encrypted = await criptografarBackup(testData, key)
console.log('Encrypted:', encrypted)

// Decrypt
const decrypted = await descriptografarBackup({
  encrypted: encrypted.encrypted,
  iv: encrypted.iv,
  tag: encrypted.tag,
  key,
})

console.log('Decrypted:', decrypted.toString())
// Should output: test backup data
```

---

## Rollback Procedure

If issues occur, follow this rollback procedure:

### Quick Rollback (Code Only)

```bash
# Revert last commit
git revert HEAD
git push origin main

# Vercel auto-redeploys previous version
```

### Full Rollback (with Database)

```bash
# 1. Revert code
git revert HEAD
git push origin main

# 2. Remove migration (if needed)
supabase db reset  # WARNING: Resets entire database

# 3. Re-apply previous migrations only
supabase db push
```

### Disable Cron Job (temporary)

```bash
# Edit vercel.json and remove/comment backup cron:
# "crons": [
#   # {
#   #   "path": "/api/cron/backup",
#   #   "schedule": "0 3 * * *"
#   # }
# ]

git add vercel.json
git commit -m "chore: temporarily disable backup cron"
git push origin main
```

---

## Monitoring & Ongoing Operations

### Daily Checks

```bash
# Check backup executed successfully
# Supabase dashboard → backup_log table
# Filter: created_at >= today AND status = 'sucesso'

# Check for failed backups
# Filter: status = 'erro' ORDER BY created_at DESC
```

### Weekly Checks

```bash
# Review security scan results
# GitHub → Actions → security-scan
# Look for new vulnerabilities

# Check npm audit results
# GitHub → Actions → npm-audit
# Ensure no critical issues
```

### Monthly Tasks

```bash
# Test backup recovery
# Download encrypted backup
# Decrypt and verify data integrity

# Review and update security rules
# Update .zap/rules.tsv if needed

# Rotate encryption keys (annually)
# Generate new key
# Update BACKUP_ENCRYPTION_KEY
# Don't delete old key (for old backups)
```

---

## Troubleshooting

### Backup Fails to Execute

**Check Vercel logs**:
```bash
vercel logs --since 1d
```

**Common causes**:
- Missing `BACKUP_ENCRYPTION_KEY` env var
- Service role key invalid
- Supabase quota exceeded
- Edge function timeout

**Fix**:
1. Verify all env vars set correctly
2. Check Supabase function logs
3. Increase function timeout if needed

### GitHub Actions Fails

**Check workflow logs**:
- GitHub → Actions → failed workflow → view logs

**Common causes**:
- Node.js version mismatch
- Missing dependencies
- Secrets not configured
- Network timeout

**Fix**:
1. Verify `node-version` in workflow
2. Run `npm ci` locally and commit lock file
3. Verify secrets in GitHub settings
4. Increase timeout values if needed

### ZAP Scan Times Out

**Solutions**:
1. Increase timeout in workflow:
   ```yaml
   timeout-minutes: 90
   ```

2. Reduce scan scope in workflow
3. Check application is responding to requests
4. Review ZAP action-baseline documentation

---

## Success Criteria

Deployment is successful when:

- [x] All files created in correct locations
- [x] Migration applies without errors
- [x] Edge function deploys successfully
- [x] Code deploys to Vercel
- [x] GitHub Actions workflows registered
- [x] Manual backup trigger succeeds
- [x] Backup log entries appear in database
- [x] Encrypted files stored in Supabase Storage
- [x] Security scan completes and generates reports
- [x] npm audit finds/reports vulnerabilities
- [x] Cron job executes at scheduled time
- [x] Can decrypt and recover test backup

---

## Support & Documentation

- **Setup Guide**: See `SECURITY-BACKUP-SETUP.md`
- **Files Created**: See `SECURITY-FILES-CREATED.md`
- **OWASP ZAP Docs**: https://www.zaproxy.org/docs/
- **Vercel Cron Docs**: https://vercel.com/docs/crons
- **Supabase Functions**: https://supabase.com/docs/guides/functions

---

## Sign-Off

**Deployment Date**: _____________

**Deployed By**: _____________

**Verified By**: _____________

**Notes**: _________________________________________________________________

________________________________________________________________________

--------

✓ Deployment checklist completed successfully!
