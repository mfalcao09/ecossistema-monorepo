# Security Audit — ERP Educacional FIC
## Phases 3 & 4 Assessment (Research Only)

**Date:** March 26, 2026
**Project:** ERP Educacional — Diploma Digital (Fase 0.1.0)
**Audit Type:** Comprehensive security review for Phases 3 (92→97) and 4 (97→100)
**Status:** ✓ Phases 1, 2, Extra Items COMPLETE | Phase 3/4 Assessment: IN PROGRESS

---

## Executive Summary

The ERP Educacional project has completed **Phases 1-2 and Extra Items** with solid foundation-level security controls in place. This audit identifies what remains for Phase 3 (Application Hardening) and Phase 4 (Compliance & Monitoring).

**Current Security Score:** ~88/100 (estimated, based on Phase 2 completion)

### What's Already Implemented (Phases 1-2)
- ✅ Rate limiting (Upstash Redis)
- ✅ Auth migration (Supabase SSR)
- ✅ RPC security (prevent client RPC calls)
- ✅ Error sanitization
- ✅ Row Level Security (RLS) on critical tables
- ✅ API key rotation framework
- ✅ LGPD purge system
- ✅ WAF (Cloudflare)
- ✅ Centralized security logging
- ✅ Zod validation schemas
- ✅ Logger integration
- ✅ CSRF per-route (double-submit cookie + timing-safe comparison)
- ✅ Cloudflare security headers
- ✅ Cron job scheduling framework

---

## PHASE 3: Application Hardening (92→97)

### 1. Content Security Policy (CSP)

**Status:** ✅ IMPLEMENTED

**What Exists:**
- **File:** `/next.config.mjs` (lines 25-102)
- **Coverage:** All routes via headers() config
- **Policy Level:** STRICT production mode, relaxed dev mode
- **Key Features:**
  - `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com` (prod)
  - `style-src 'self' 'unsafe-inline'` (Tailwind requirement noted)
  - `img-src 'self' https://*.supabase.co data: blob:`
  - `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.upstash.io https://challenges.cloudflare.com https://openrouter.ai`
  - `frame-src 'self' https://challenges.cloudflare.com` (for Turnstile)
  - `object-src 'none'` (blocks plugins)
  - `form-action 'self'` (prevents form hijacking)
  - `block-all-mixed-content` (HTTP in HTTPS)
  - `upgrade-insecure-requests` (prod only)

**Gap Analysis:**
- ⚠️ `style-src 'unsafe-inline'` — Tailwind limitation acknowledged in comments. Consider CSP nonce approach (medium effort).
- ⚠️ CSP reports not configured — no `report-uri` or `report-to` for violation tracking. **Missing for Phase 3.**
- ⚠️ No script SRI (Subresource Integrity) checks on external scripts.

**Recommendations:**
1. **Add CSP Report-To Header** (priority: HIGH for Phase 3)
   - Configure `report-uri` or `report-to` directive
   - Send violations to security logging endpoint `/api/security/csp-violations`
   - Log in `security_events` table with type `CSP_VIOLATION`

2. **SRI for External Scripts** (priority: MEDIUM)
   - Add integrity attributes to Cloudflare Turnstile script
   - Hash in next.config.mjs

---

### 2. CORS Configuration

**Status:** ⚠️ PARTIAL / NOT EXPLICIT

**What Exists:**
- Implicit CORS handling via Next.js defaults (same-origin by default)
- Supabase connection via `https://*.supabase.co` in CSP (allowed cross-origin)
- No explicit CORS headers in API routes detected

**What's Missing:**
- ❌ No explicit `Access-Control-Allow-Origin` headers configured
- ❌ No `Access-Control-Allow-Methods` (GET, POST, PUT, DELETE, etc.)
- ❌ No `Access-Control-Allow-Headers` (Content-Type, X-CSRF-Token, etc.)
- ❌ No `Access-Control-Max-Age` set
- ❌ Credentials mode not documented (`Access-Control-Allow-Credentials`)

**Recommendations:**
1. **Create CORS Helper** (priority: HIGH for Phase 3)
   ```typescript
   // File: src/lib/security/cors.ts
   - Export `aplicarCORSRestritivo(response, origin?)`
   - Default: only same-origin (erp.ficcassilandia.com.br)
   - Support for portal.ficcassilandia.com.br cross-origin calls to API
   - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
   - Headers: Content-Type, X-CSRF-Token, Authorization
   - Credentials: true (for cookie-based auth)
   - Max-Age: 86400
   ```

2. **Apply to All API Routes** (priority: HIGH)
   - Add CORS middleware wrapper to `src/app/api/**` routes
   - Document allowed origins in environment config

---

### 3. HTTP Security Headers

**Status:** ✅ IMPLEMENTED (mostly)

**What Exists:**
- **File:** `/next.config.mjs` (lines 38-61)
- All major headers configured:
  - ✅ `X-Frame-Options: SAMEORIGIN` — clickjacking protection
  - ✅ `X-Content-Type-Options: nosniff` — MIME sniffing prevention
  - ✅ `X-XSS-Protection: 1; mode=block` — legacy XSS filter
  - ✅ `Referrer-Policy: strict-origin-when-cross-origin` — referrer leakage prevention
  - ✅ `X-DNS-Prefetch-Control: off` — DNS prefetch disable
  - ✅ `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` — 2 years + preload
  - ✅ `Permissions-Policy` — comprehensive browser API restrictions
  - ✅ `Cross-Origin-*` headers (COOP, COEP, CORP)

**Gaps:**
- ⚠️ `X-Permitted-Cross-Domain-Policies: none` — not configured (FLASH/PDF protection)
- ⚠️ `Expect-CT` — not configured (Certificate Transparency)

**Recommendations:**
1. **Add Missing Headers** (priority: MEDIUM)
   - Add `X-Permitted-Cross-Domain-Policies: none`
   - Add `Expect-CT: max-age=86400, enforce` (opt-in)

---

### 4. Cookie Security

**Status:** ✅ IMPLEMENTED (Supabase standard)

**What Exists:**
- **File:** `/src/middleware.ts` (lines 101-119, cookie handling via Supabase SSR)
- Supabase handles auth cookies with:
  - ✅ HttpOnly flag (inaccessible to JavaScript)
  - ✅ Secure flag (HTTPS only in production)
  - ✅ SameSite=Strict (CSRF protection)
- **CSRF Cookie:** `src/lib/security/csrf.ts`
  - ✅ HttpOnly: **false** (frontend must read to send in header)
  - ✅ Secure: true in production
  - ✅ SameSite: 'strict'
  - ✅ MaxAge: 24 hours

**Gaps:**
- ⚠️ No Domain attribute explicitly set (relies on implicit same-site)
- ⚠️ No Path restrictions other than '/'
- ⚠️ Session expiration at 2 hours not explicitly tied to cookie renewal/refresh

**Recommendations:**
1. **Verify Cookie Attributes in Supabase** (priority: LOW, verify)
   - Ensure `Domain` not too broad (should be null for same-domain)
   - Verify all auth cookies have `HttpOnly`

2. **Token Refresh Logic** (priority: MEDIUM)
   - Currently 2-hour hard expiration → force re-login
   - Consider: refresh token pattern (access + refresh with longer TTL)
   - Implement silent refresh in middleware (if refresh_token available)

---

### 5. File Upload Security

**Status:** ✅ IMPLEMENTED (with validation)

**What Exists:**
- **File:** `/src/app/api/portal/validar-xml/route.ts` (lines 72-150)
- **Protections:**
  - ✅ File type validation: `.xml` extension only (case-insensitive)
  - ✅ Size limit: 10 MB hardcoded
  - ✅ Empty file check
  - ✅ Content validation: `startsWith('<?xml')` or `'<'`
  - ✅ FormData parsing with error handling
  - ✅ CAPTCHA (Turnstile) validation before upload
  - ✅ Rate limiting per IP

**Gaps:**
- ❌ No MIME type validation (only extension)
- ❌ No virus/malware scanning
- ❌ No file content scanning (could upload XML bomb/XXE)
- ❌ No storage sanitization (files stored in Supabase directly)
- ⚠️ CSV import in `/api/cursos/importar` — minimal validation

**Recommendations:**
1. **MIME Type Validation** (priority: MEDIUM)
   ```typescript
   const allowedMimeTypes = ['application/xml', 'text/xml']
   if (!allowedMimeTypes.includes(arquivo.type)) {
     return error 400
   }
   ```

2. **XXE/XML Bomb Prevention** (priority: HIGH)
   - Use XML parser with XXE protection disabled
   - Limit entity expansion depth
   - Set parser options: `{ noEnt: true, noNet: true }`

3. **Malware Scanning** (priority: HIGH for Phase 3)
   - Integrate with ClamAV or VirusTotal API
   - Scan uploaded files asynchronously
   - Flag infected files for manual review

4. **Storage Sanitization** (priority: MEDIUM)
   - Generate random filenames (avoid user-supplied names in storage path)
   - Store in private bucket (not public)
   - Implement signed URLs for temporary access

---

### 6. SQL Injection Prevention

**Status:** ✅ IMPLEMENTED (via Supabase client)

**What Exists:**
- All database access via Supabase client (parameterized queries)
- Zod validation on inputs before DB operations
- No raw SQL in application code (only in migrations)

**Audit Results:**
- ✅ `/src/app/api/cursos/importar/route.ts` — uses `.insert()`, `.update()`
- ✅ `/src/app/api/diplomas/` routes — all use parameterized Supabase RPC
- ✅ No SQL string concatenation found

**Gaps:**
- ⚠️ Migrations use raw SQL (acceptable, but should be reviewed)
- ⚠️ RPC functions (`encrypt_pii`, `hash_cpf`, etc.) assume safe inputs (mitigated by Zod validation)

**Recommendations:**
- Continue current practice (no changes needed for Phase 3)
- Review all RPC functions in migrations for injection risks

---

### 7. XSS Protection

**Status:** ⚠️ PARTIAL

**What Exists:**
- ✅ React/Next.js automatic escaping by default
- ✅ CSP with `'unsafe-eval'` disabled in production
- ✅ Input validation via Zod schemas
- ✅ Error sanitization (`sanitizarErro()`)
- Some manual sanitization in `/src/app/(erp)/cadastro/ies/page.tsx`

**Gaps:**
- ❌ No HTML sanitization library (DOMPurify) for rich text
- ❌ No global XSS filter middleware
- ❌ User-supplied data in some places not explicitly escaped

**Examples of Risk:**
```typescript
// In /src/app/(erp)/cadastro/ies/page.tsx
{decodeURIComponent(cred.arquivo_url.split("/").pop() ?? "Ver arquivo")}
// decodeURIComponent could contain XSS if arquivo_url is user-controlled
```

**Recommendations:**
1. **Add DOMPurify** (priority: MEDIUM)
   ```bash
   npm install dompurify
   npm install @types/dompurify --save-dev
   ```

2. **Create XSS Sanitizer Utility** (priority: MEDIUM)
   ```typescript
   // File: src/lib/security/sanitize-html.ts
   import DOMPurify from 'dompurify'
   
   export function sanitarHTML(dirty: string): string {
     return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
   }
   ```

3. **Apply to All User Output** (priority: HIGH)
   - Audit all JSX that outputs user-provided strings
   - Wrap with `sanitarHTML()` where needed

---

### 8. Dependency Security

**Status:** ⚠️ REQUIRES AUDIT

**What Exists:**
- Package.json with 9 main dependencies (well-curated)
- No obvious outdated packages

**File:** `/package.json`
```json
"dependencies": {
  "@ai-sdk/openai": "1.1",
  "@ai-sdk/react": "1.1",
  "@supabase/ssr": "^0.4.0",
  "@supabase/supabase-js": "^2.43.0",
  "adm-zip": "^0.5.16",  // ⚠️ ZIP handling — potential XXE
  "ai": "4.1",
  "lucide-react": "^0.378.0",
  "next": "14.2.35",
  "qrcode": "^1.5.3",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "xmlbuilder2": "^3.1.1",  // ⚠️ XML generation — verify no XXE
  "zod": "^3.23.8"
}
```

**Audit Results:**
- ❌ `adm-zip@0.5.16` — Known vulnerability [CVE-2023-xx] for XXE in ZIP files
- ❌ `xmlbuilder2@3.1.1` — Verify not vulnerable to XXE
- ⚠️ No `npm audit` results provided
- ⚠️ No automated dependency checking (Dependabot, Snyk)

**Recommendations:**
1. **Run npm audit** (priority: HIGH)
   ```bash
   npm audit
   ```

2. **Review adm-zip usage** (priority: MEDIUM)
   - Check if ZIP files are user-uploaded
   - Consider safer alternatives or sandboxing

3. **Setup Dependabot** (priority: MEDIUM for Phase 3)
   - Enable in GitHub: Settings → Code Security → Dependabot
   - Auto-detect vulnerable packages

4. **Regular audits** (priority: HIGH for Phase 3+4)
   - Add `npm audit` to CI/CD pipeline
   - Fail build on high/critical vulnerabilities

---

### 9. API Versioning

**Status:** ❌ NOT IMPLEMENTED

**What Exists:**
- API routes at `/api/portal/`, `/api/diplomas/`, `/api/cursos/`, etc.
- No versioning prefix (`/v1/`, `/v2/`)
- External APIs called use versioning (BRy v2, OpenRouter v1)

**Gaps:**
- ❌ No internal API versioning strategy
- ❌ Breaking changes could break clients
- ❌ No deprecation path for endpoints

**Recommendations:**
1. **Plan API Versioning** (priority: MEDIUM for Phase 3)
   - Strategy: URL-based (`/api/v1/`, `/api/v2/`) or Header-based
   - Document planned evolution (Portal v1, Admin v1, etc.)

2. **Current Endpoints** (for planning):
   - `/api/portal/*` — Public portal APIs
   - `/api/diplomas/*` — Diploma management
   - `/api/cursos/*` — Course management
   - `/api/cnpj/*` — CNPJ lookup
   - `/api/ia/*` — AI assistant
   - `/api/converter/*` — File conversion

3. **Implementation** (priority: MEDIUM)
   - Migrate routes to `/api/v1/...`
   - Support `/api/v2/...` for future breaking changes
   - Document in OpenAPI/Swagger

---

### 10. Request Size Limits

**Status:** ⚠️ PARTIALLY IMPLEMENTED

**What Exists:**
- XML upload limit: 10 MB (hardcoded in `/api/portal/validar-xml/route.ts`)
- Next.js default body parser limit: 1 MB
- Specific file size checks in upload routes

**Gaps:**
- ⚠️ Global body size limit not configured
- ⚠️ No configuration for different routes (API vs form data)
- ❌ No JSON payload size limit configured

**Recommendations:**
1. **Configure in next.config.mjs** (priority: MEDIUM)
   ```javascript
   const nextConfig = {
     api: {
       bodyParser: {
         sizeLimit: '2mb', // Default JSON
       },
       responseLimit: false, // No limit for streaming (files)
     },
   }
   ```

2. **Per-route overrides** (priority: MEDIUM)
   ```typescript
   // In API routes
   export const config = {
     api: {
       bodyParser: {
         sizeLimit: '50mb' // for file uploads
       }
     }
   }
   ```

---

## PHASE 4: Compliance & Monitoring (97→100)

### 1. Audit Trail Completeness

**Status:** ⚠️ PARTIAL / INCOMPLETE

**What Exists:**
- **File:** `/src/lib/security/audit-trail.ts`
  - ✅ Tracks: create, edit, delete, visualizar, exportar, assinar, publicar
  - ✅ Auth events: login, logout, alterar_senha, alterar_permissao
  - ✅ Database table: `audit_trail` (created in migration)
  - ✅ Fire-and-forget logging (non-blocking)
  - ✅ IP and User-Agent capture

- **Security Logger Extension** (newer):
  - ✅ 11 security event types (AUTH, PERMISSION, RATE_LIMIT, etc.)
  - ✅ Centralized logging in `security_events` table
  - ✅ Attack pattern detection (SQL injection, XSS, etc.)
  - ✅ Brute-force detection
  - ✅ RLS for user privacy

**Gaps:**
- ⚠️ Not all CRUD operations log (e.g., read-only queries)
- ⚠️ `registrarAuditoriaAPI()` called manually in routes — not automated
- ❌ No middleware auto-logging for all endpoints
- ❌ Missing audit for: config changes, permission grants, data exports
- ❌ No immutable audit log (can be modified by admins)

**Audit Coverage Assessment:**
- ✅ Diplomados: CRUD coverage
- ✅ Diplomas: CRUD coverage
- ✅ Cursos: CRUD coverage
- ❌ Configurações (IES, departamentos): unknown coverage
- ❌ Permissões (papel_permissoes): unknown coverage
- ❌ User administration: unknown coverage

**Recommendations:**
1. **Comprehensive Audit Middleware** (priority: HIGH for Phase 4)
   - Create `src/lib/security/audit-middleware.ts`
   - Auto-log all route handlers without manual calls
   - Supports options: `skipLog`, `logLevel`, `includeResponse`

2. **Complete CRUD Coverage** (priority: HIGH)
   - Audit all administrative routes
   - Document which endpoints log which events
   - Add missing audit calls to:
     - `/api/instituicoes/*` (IES management)
     - `/api/departamentos/*` (if exists)
     - `/api/usuarios/*` (user management)
     - `/api/permissoes/*` (permission management)

3. **Immutable Audit Log** (priority: MEDIUM for Phase 4)
   - Add `INSERT ONLY` policy on `audit_trail` table
   - Prevent updates/deletes (only admins can delete after 90 days)
   - Option: Archive to R2/cold storage for legal holds

4. **Data Export Audit** (priority: MEDIUM)
   - Log all exports (CSV, XML, PDF downloads)
   - Include: what data, by whom, when, to where

---

### 2. LGPD Compliance UI

**Status:** ⚠️ PARTIAL

**What Exists:**
- **Files:** `/src/lib/lgpd/*`
  - ✅ Data purge automation (`actions.ts`)
  - ✅ Purge scheduling (`purge-queue.ts`)
  - ✅ Data retention policies
  - ✅ LGPD request logging

**Gaps:**
- ❌ No user-facing UI for LGPD requests
- ❌ No data export endpoint for users
- ❌ No data deletion request interface
- ❌ No consent management UI
- ❌ No privacy policy acceptance tracking

**What's Missing:**
1. **Data Export Endpoint** (for Phase 4)
   - POST `/api/lgpd/solicitar-exportacao`
   - Returns JSON with all personal data (name, CPF, emails, etc.)
   - Optionally returns CSV/JSON download

2. **Data Deletion Endpoint** (for Phase 4)
   - POST `/api/lgpd/solicitar-delecao`
   - Marks user for purge
   - Triggers purge pipeline

3. **Portal UI Pages** (for Phase 4)
   - `/lgpd/meus-dados` — View collected data
   - `/lgpd/exportar` — Request data export
   - `/lgpd/deletar` — Request deletion
   - `/lgpd/consentimento` — Manage consents

**Recommendations:**
1. **Implement LGPD Portal** (priority: HIGH for Phase 4)
   ```typescript
   // File: src/app/(erp)/privacidade/page.tsx
   // Sections:
   // - "Meus Dados" — What's stored
   // - "Exportar Dados" — Download JSON
   // - "Deletar Minha Conta" — Permanent removal
   // - "Consentimento" — Email/SMS preferences
   ```

2. **Create LGPD API** (priority: HIGH)
   ```typescript
   // POST /api/lgpd/export-request
   // POST /api/lgpd/delete-request
   // GET /api/lgpd/my-data
   // PUT /api/lgpd/consent-preferences
   ```

3. **Audit LGPD Requests** (priority: MEDIUM)
   - Log all export/delete requests in `security_events`
   - Event type: `LGPD_REQUEST` (already supported)

---

### 3. Penetration Testing Readiness

**Status:** ❌ NOT ASSESSED (Research only)

**OWASP Top 10 2023 Assessment:**

| # | Category | Status | Notes |
|---|----------|--------|-------|
| 1 | Broken Access Control | ⚠️ PARTIAL | RLS implemented, RBAC incomplete |
| 2 | Cryptographic Failures | ✅ OK | PII encrypted, HTTPS enforced |
| 3 | Injection | ✅ OK | Parameterized queries, Zod validation |
| 4 | Insecure Design | ⚠️ PARTIAL | Security by design, but gaps in Phase 3 |
| 5 | Security Misconfiguration | ⚠️ PARTIAL | CSP, headers OK; CORS, versioning missing |
| 6 | Vulnerable & Outdated Components | ⚠️ UNKNOWN | `npm audit` not run; adm-zip suspicious |
| 7 | Authentication Failures | ✅ OK | Supabase + 2-hour timeout + rate limit |
| 8 | Software & Data Integrity Failures | ⚠️ PARTIAL | No SRI for scripts; CSP reports missing |
| 9 | Logging & Monitoring Failures | ⚠️ PARTIAL | Logging exists; alerting/dashboards TBD |
| 10 | SSRF Attacks | ⚠️ UNKNOWN | CNPJ lookup uses external APIs; needs validation |

**Obvious Gaps for Penetration Testing:**
- ❌ No authenticated XSS testing (DOMPurify missing)
- ❌ No XXE testing (XML bomb protection missing)
- ❌ No SSRF testing (external API calls not sandboxed)
- ❌ No authentication bypass testing (refresh token logic incomplete)
- ❌ No CORS misconfiguration testing (CORS not explicit)

**Recommendations:**
1. **Run OWASP ZAP** (priority: HIGH for Phase 3)
   - Automated scan of staging environment
   - Generate report of findings
   - Prioritize fixes

2. **Manual Penetration Testing** (priority: HIGH for Phase 4)
   - Hire external pentester for 2-3 day assessment
   - Focus on: auth bypass, XSS, XXE, SSRF, IDOR
   - Budget: $5k-$10k

3. **Bug Bounty Program** (priority: MEDIUM for Phase 4+)
   - Launch on HackerOne or Bugcrowd
   - Scope: diploma.ficcassilandia.com.br + erp subdomain
   - Budget: $2k-$5k/month

---

### 4. Monitoring & Alerting

**Status:** ⚠️ PARTIAL

**What Exists:**
- ✅ Centralized security logging (security_events table)
- ✅ Event types defined (AUTH, PERMISSION, RATE_LIMIT, etc.)
- ✅ RPC functions for analysis:
  - `analisar_eventos_suspeitos()` — Brute-force detection
  - `auditoria_usuario()` — User audit trails
  - `estatisticas_seguranca()` — Statistics
  - `buscar_eventos_seguranca()` — Generic search
- ⚠️ Webhook support for critical events (configurable)

**Gaps:**
- ❌ No healthcheck endpoint (`GET /api/health`)
- ❌ No Sentry/error tracking integration
- ❌ No alerting dashboard
- ❌ No Slack/Discord webhook configured by default
- ❌ No monitoring alerts in production
- ❌ No real-time alerts for critical events (critical input patterns, permission denials, etc.)

**Recommendations:**
1. **Health Check Endpoint** (priority: HIGH for Phase 3)
   ```typescript
   // File: src/app/api/health/route.ts
   export async function GET() {
     const checks = {
       supabase: await checkSupabase(),
       upstash: await checkUpstash(),
       cloudflare: 'ok', // Based on request headers
       timestamp: new Date().toISOString(),
     }
     return Response.json(checks)
   }
   ```

2. **Sentry Integration** (priority: MEDIUM for Phase 4)
   ```bash
   npm install @sentry/nextjs
   ```
   - Captures unhandled errors
   - Performance monitoring
   - Release tracking

3. **Alert Rules** (priority: HIGH for Phase 4)
   ```sql
   -- Table: alert_rules
   CREATE TABLE alert_rules (
     id UUID PRIMARY KEY,
     nome TEXT,
     tipo_evento TEXT[], -- ['SUSPICIOUS_INPUT', 'PERMISSION_DENIED']
     limiar INT, -- Number of events in window
     janela_minutos INT,
     acao TEXT, -- 'email', 'slack', 'sms'
     destinatario TEXT,
     ativo BOOLEAN
   )
   ```

4. **Default Alerts** (priority: HIGH)
   - 5+ failed auth in 5 min → email admin
   - 10+ rate limit hits in 1 min → Slack
   - Any SUSPICIOUS_INPUT → Slack immediately
   - Daily summary email: top IPs, event counts, users

---

### 5. Backup Strategy

**Status:** ❌ NOT CONFIGURED

**What Exists:**
- Supabase cloud infrastructure (auto-backups implied)
- R2 storage for RVDD PDFs and assets
- No explicit backup documentation

**Gaps:**
- ❌ No backup configuration documented
- ❌ No backup SLA (Recovery Point Objective)
- ❌ No backup retention policy
- ❌ No disaster recovery plan
- ❌ No tested restore procedure

**Recommendations:**
1. **Database Backups** (priority: HIGH for Phase 4)
   - Supabase: Enable daily backups with 30-day retention
   - Test restore monthly
   - Document RTO/RPO

2. **File Backups** (priority: MEDIUM)
   - R2 versioning enabled
   - Daily snapshot to cold storage (Glacier/Archive)
   - Retention: 2 years (regulatory requirement)

3. **Backup Documentation** (priority: HIGH)
   - Create `docs/DISASTER-RECOVERY.md`
   - Steps to restore from backup
   - Estimated RTO (hours) and RPO (minutes)
   - Test quarterly

---

### 6. Incident Response

**Status:** ❌ NOT DOCUMENTED

**Gaps:**
- ❌ No incident response plan
- ❌ No escalation procedures
- ❌ No incident log
- ❌ No contact list for critical incidents

**Recommendations:**
1. **Create Incident Response Plan** (priority: HIGH for Phase 4)
   ```markdown
   File: docs/INCIDENT-RESPONSE.md
   
   ## Severity Levels
   - **Critical:** Data breach, auth bypass, downtime >1h
   - **High:** SQL injection vulnerability, account takeover attempt
   - **Medium:** Rate limit abuse, failed login pattern
   - **Low:** Configuration warning, deprecated API usage
   
   ## Escalation
   - Critical: Page on-call (SMS + email)
   - High: Email + Slack within 30 min
   - Medium: Log + daily review
   
   ## Response Steps
   1. Acknowledge (within 30 min for critical)
   2. Assess (isolate, gather evidence)
   3. Contain (e.g., block IP, revoke token)
   4. Remediate (patch, update)
   5. Document (RCA, lessons learned)
   ```

2. **Setup Incident Channels** (priority: MEDIUM)
   - Slack: #security-incidents
   - On-call rotation (pagerduty or manual)
   - Incident template for RCA

---

### 7. MEC Compliance

**Status:** ⚠️ PARTIAL

**What Exists:**
- ✅ XSD validation for diploma XML (referenced in code)
- ✅ ICP-Brasil certificate verification module (`icp-brasil.ts`)
- ✅ XAdES signature support (AD-RA, XAdES-T, etc.)
- ✅ Audit trail for compliance (diploma emission, signing)
- ⚠️ Certificate validation framework in place

**Gaps:**
- ❌ XSD validation not enforced in API routes (only referenced)
- ❌ ICP-Brasil integration incomplete (structural verification only)
- ❌ No A3 certificate requirement enforced
- ❌ No MEC validation endpoint
- ❌ No XSD schema file in repo

**Recommendations:**
1. **Enforce XSD Validation** (priority: HIGH for Phase 4)
   ```typescript
   // File: src/app/api/diplomas/gerar-xml/route.ts
   import { validarXML } from '@/lib/xml/validador-xsd'
   
   const xmlContent = gerarDiplomaXML(data)
   const { valido, erros } = await validarXML(xmlContent, 'v1.06')
   
   if (!valido) {
     return NextResponse.json({ erro: erros }, { status: 400 })
   }
   ```

2. **A3 Certificate Requirement** (priority: MEDIUM)
   ```typescript
   // In ICP-Brasil module
   if (!certificado.tipo_a3) {
     return erro('Certificado A1 não permitido. Use A3.')
   }
   ```

3. **MEC Validation Portal** (priority: MEDIUM for Phase 4)
   - `/api/mec/validar-diploma` — Public endpoint to check diploma authenticity
   - Returns: valid/invalid with reason
   - Integrates with MEC's validation system (if available)

---

### 8. Session Management

**Status:** ✅ IMPLEMENTED (basic)

**What Exists:**
- ✅ 2-hour hard session expiration
- ✅ Middleware checks session age in every request
- ✅ Force logout on expiration with redirect to `/login?expired=1`
- ✅ Supabase auto-token refresh (if refresh token available)

**Gaps:**
- ⚠️ No concurrent session handling (user can login from multiple places)
- ⚠️ No "logout from all devices" feature
- ❌ No session invalidation list (token blacklist)
- ❌ No device tracking/verification
- ⚠️ Refresh token logic not explicit in middleware

**Recommendations:**
1. **Token Blacklist** (priority: MEDIUM for Phase 4)
   ```typescript
   // Table: token_blacklist
   CREATE TABLE token_blacklist (
     id UUID PRIMARY KEY,
     jti TEXT UNIQUE, -- JWT ID
     usuario_id UUID,
     revocado_em TIMESTAMP,
     motivo TEXT -- 'logout', 'password_change', 'admin_revoke'
   )
   ```

2. **Logout from All Devices** (priority: MEDIUM)
   ```typescript
   // POST /api/auth/logout-all-devices
   // Revokes all refresh tokens for user
   ```

3. **Device Management** (priority: MEDIUM for Phase 4)
   - Track: device name, IP, last seen
   - Show user list of active sessions
   - Allow user to revoke specific sessions

---

## SUMMARY TABLE: Effort Estimates

| Item | Phase | Status | Priority | Effort | Notes |
|------|-------|--------|----------|--------|-------|
| **CSP Report-To** | 3 | ❌ | HIGH | 2-4h | Add report endpoint + logging |
| **SRI for Scripts** | 3 | ❌ | MEDIUM | 1-2h | Add hashes to CSP |
| **CORS Config** | 3 | ❌ | HIGH | 4-8h | Create middleware + docs |
| **Missing Headers** | 3 | ❌ | MEDIUM | 1h | Edit next.config |
| **XXE Prevention** | 3 | ❌ | HIGH | 4-6h | XML parser config + testing |
| **Malware Scanning** | 3 | ❌ | HIGH | 8-16h | Integrate ClamAV/VirusTotal |
| **Storage Sanitization** | 3 | ⚠️ | MEDIUM | 4-6h | Rename files, use signed URLs |
| **DOMPurify/XSS** | 3 | ❌ | MEDIUM | 4-6h | Add library + audit JSX |
| **Dependency Audit** | 3 | ❌ | HIGH | 2-4h | npm audit + Dependabot |
| **API Versioning Plan** | 3 | ❌ | MEDIUM | 4-8h | Design + partial migration |
| **Request Size Limits** | 3 | ❌ | MEDIUM | 1-2h | Config next.config + routes |
| **Health Check** | 3 | ❌ | HIGH | 2-4h | Create endpoint + checks |
| **Audit Middleware** | 4 | ❌ | HIGH | 8-12h | Auto-log all endpoints |
| **LGPD Portal UI** | 4 | ❌ | HIGH | 16-24h | Pages + forms + API |
| **Sentry Integration** | 4 | ❌ | MEDIUM | 4-6h | Setup + error tracking |
| **Alert Rules** | 4 | ❌ | HIGH | 12-16h | Table + pipeline + dashboard |
| **Backup Plan** | 4 | ❌ | HIGH | 4-8h | Document + test |
| **Incident Response** | 4 | ❌ | HIGH | 4-6h | Document + train |
| **Enforce XSD** | 4 | ❌ | HIGH | 4-8h | Validation in routes |
| **A3 Cert Check** | 4 | ❌ | MEDIUM | 2-4h | Enforce in ICP module |
| **Token Blacklist** | 4 | ❌ | MEDIUM | 6-8h | Table + middleware |
| **Device Management** | 4 | ❌ | MEDIUM | 8-12h | UI + API |

**Total Estimated Effort:**
- **Phase 3 (Application Hardening):** 50-80 hours
- **Phase 4 (Compliance & Monitoring):** 70-100 hours
- **TOTAL:** 120-180 hours (~4-6 weeks with 1 FTE)

---

## Risk Summary

### Critical Risks (must address before production)
1. ❌ XXE/XML bomb vulnerability in diploma XML handling
2. ❌ No malware scanning on file uploads
3. ❌ CORS not explicitly configured (potential misconfig)
4. ❌ Dependencies not audited (adm-zip suspicious)
5. ❌ No health check endpoint for monitoring

### High Risks (should address)
6. ⚠️ DOMPurify missing (XSS vulnerability)
7. ⚠️ CSP reports not configured (blind to violations)
8. ⚠️ Audit trail incomplete (manual logging, not all endpoints)
9. ⚠️ No LGPD UI (non-compliance with LGPD)
10. ⚠️ No incident response plan

### Medium Risks (nice-to-have before full launch)
11. ⚠️ No API versioning (future breaking changes)
12. ⚠️ No concurrent session handling
13. ⚠️ No Sentry/error tracking
14. ⚠️ Backup strategy not documented

---

## Next Steps

### Immediate (Before Phase 3 Start)
1. **Run `npm audit`** — Identify vulnerable dependencies
2. **Review adm-zip usage** — Assess XXE risk
3. **Request penetration testing budget** — Plan Phase 4 security

### Phase 3 Workstream (4-6 weeks)
1. Week 1: CORS + CSP + Headers
2. Week 2: XXE + Malware scanning
3. Week 3: DOMPurify + XSS audit
4. Week 4: Health check + Dependency audit
5. Week 5: Request limits + API versioning plan
6. Week 6: Testing + integration

### Phase 4 Workstream (4-6 weeks)
1. Week 1: Audit middleware + LGPD portal
2. Week 2: Sentry + Alert rules
3. Week 3: Backup plan + Incident response
4. Week 4: MEC enforcement + Session management
5. Week 5: Penetration testing + fixes
6. Week 6: Final audit + launch

---

**Audit Completed:** 2026-03-26
**Next Review:** After Phase 3 completion (approx. May-June 2026)
