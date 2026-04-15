# Security Gaps — Quick Reference
## Phases 3 & 4 Missing Items (Research Only)

**Last Updated:** March 26, 2026
**Document Type:** Research Summary (NO CODE written)

---

## PHASE 3 Gaps (Application Hardening)

### Critical Issues (Fix Before Phase 4)

| Gap | File(s) | Severity | Effort | Solution |
|-----|---------|----------|--------|----------|
| **XXE/XML Bomb** | `/api/portal/validar-xml/route.ts` | CRITICAL | 4-6h | Disable entity expansion in XML parser |
| **No Malware Scan** | `/api/portal/validar-xml`, `/api/cursos/importar` | CRITICAL | 8-16h | Integrate ClamAV or VirusTotal API |
| **Explicit CORS** | All `/api/**` routes | CRITICAL | 4-8h | Create CORS middleware with whitelist |
| **Dependency Audit** | `package.json` (adm-zip concern) | CRITICAL | 2-4h | Run `npm audit`, review findings |
| **No Health Check** | N/A | CRITICAL | 2-4h | Create `GET /api/health` endpoint |

### High Priority Issues

| Gap | File(s) | Severity | Effort | Solution |
|-----|---------|----------|--------|----------|
| **DOMPurify Missing** | All JSX output | HIGH | 4-6h | Add library + sanitize user strings |
| **CSP Reports** | `next.config.mjs` | HIGH | 2-4h | Add `report-uri` + logging endpoint |
| **Storage Sanitization** | File upload routes | HIGH | 4-6h | Randomize filenames, use signed URLs |
| **Request Size Limits** | `next.config.mjs` | MEDIUM | 1-2h | Configure bodyParser limits per route |
| **Missing Headers** | `next.config.mjs` | MEDIUM | 1h | Add `X-Permitted-Cross-Domain-Policies`, `Expect-CT` |

### Medium Priority Issues

| Gap | File(s) | Severity | Effort | Solution |
|-----|---------|----------|--------|----------|
| **API Versioning Plan** | N/A (design phase) | MEDIUM | 4-8h | Design versioning strategy, plan migration |
| **SRI for Scripts** | `next.config.mjs` | MEDIUM | 1-2h | Add integrity hashes to CSP |
| **Cookie Attributes** | Supabase SSR config | MEDIUM | 1-2h | Verify `Domain`, `Path` restrictions |

---

## PHASE 4 Gaps (Compliance & Monitoring)

### Critical Issues

| Gap | File(s) | Severity | Effort | Solution |
|-----|---------|----------|--------|----------|
| **Audit Trail Incomplete** | `/src/lib/security/audit-trail.ts` | CRITICAL | 8-12h | Add middleware auto-logging for all endpoints |
| **LGPD Portal Missing** | N/A (UI needed) | CRITICAL | 16-24h | Build `/lgpd/`, `/api/lgpd/*` endpoints |
| **Enforce XSD Validation** | `/api/diplomas/gerar-xml` | CRITICAL | 4-8h | Validate all diploma XML against XSD v1.06 |
| **No Incident Response** | N/A (docs needed) | CRITICAL | 4-6h | Create `docs/INCIDENT-RESPONSE.md` |
| **No Backup Plan** | N/A (docs needed) | CRITICAL | 4-8h | Document RTO/RPO, test recovery |

### High Priority Issues

| Gap | File(s) | Severity | Effort | Solution |
|-----|---------|----------|--------|----------|
| **Sentry Integration** | N/A (new) | HIGH | 4-6h | Add `@sentry/nextjs`, error tracking |
| **Alert Rules** | N/A (new) | HIGH | 12-16h | Create alert pipeline + dashboard |
| **A3 Certificate Check** | `/src/lib/security/icp-brasil.ts` | HIGH | 2-4h | Enforce A3 requirement in signature validation |
| **MEC Validation Endpoint** | N/A (new) | HIGH | 4-6h | Create `/api/mec/validar-diploma` public endpoint |

### Medium Priority Issues

| Gap | File(s) | Severity | Effort | Solution |
|-----|---------|----------|--------|----------|
| **Token Blacklist** | N/A (new table) | MEDIUM | 6-8h | Implement logout revocation list |
| **Device Management** | N/A (new) | MEDIUM | 8-12h | Track & manage user sessions by device |
| **Logout All Devices** | N/A (new) | MEDIUM | 2-4h | Add force-logout endpoint |

---

## What EXISTS vs What's MISSING

### CSP (Content Security Policy)
```
✅ Headers configured (next.config.mjs)
✅ Strict production mode
✅ Frame options, plugin blocking, form actions
❌ Report-To directive
❌ CSP violation logging endpoint
❌ SRI hashes on external scripts
```

### CORS
```
❌ No explicit CORS headers
❌ No origin whitelist
❌ No credentials mode set
✅ Implicit same-origin handling (OK for SPA)
```

### File Upload Security
```
✅ Extension validation (.xml)
✅ Size limit (10 MB)
✅ Content check (starts with <?xml>)
✅ CAPTCHA (Turnstile)
✅ Rate limiting
❌ MIME type validation
❌ Malware scanning
❌ XXE protection
❌ Storage sanitization (random filenames)
```

### XSS Protection
```
✅ React auto-escaping
✅ CSP (no eval in prod)
✅ Input validation (Zod)
❌ DOMPurify (HTML sanitization)
⚠️ Some manual sanitization exists
```

### Audit Trail
```
✅ Basic audit_trail table
✅ Fire-and-forget logging
✅ IP + User-Agent capture
✅ Security events (11 types)
✅ Attack pattern detection
❌ Middleware auto-logging
❌ Immutable audit log
❌ All endpoints covered
❌ Config changes logged
```

### Monitoring
```
✅ Security logging table + RPC functions
✅ Brute-force detection
✅ Webhook hooks (configurable)
❌ Health check endpoint
❌ Sentry integration
❌ Alert dashboard
❌ Real-time alerts (configured by default)
```

### Session Management
```
✅ 2-hour expiration
✅ Forced logout on expiration
✅ Token auto-refresh (Supabase)
✅ CSRF protection
❌ Concurrent session handling
❌ Logout from all devices
❌ Device tracking
❌ Token blacklist
```

### MEC/LGPD Compliance
```
✅ XSD validation reference
✅ ICP-Brasil certificate verification module
✅ XAdES signature support (structural)
✅ LGPD purge system
✅ Data retention policies
❌ XSD validation enforced in API
❌ A3 certificate requirement
❌ Public MEC validation endpoint
❌ LGPD data export UI
❌ LGPD data deletion UI
❌ User consent management UI
```

---

## Effort Breakdown

| Phase | Category | Total Hours | Weeks (1 FTE) |
|-------|----------|-------------|---------------|
| **Phase 3** | Critical | 20-28h | 1 week |
| | High | 20-28h | 1 week |
| | Medium | 8-12h | 1-2 days |
| | **SUBTOTAL** | **50-80h** | **2-3 weeks** |
| **Phase 4** | Critical | 40-60h | 1-2 weeks |
| | High | 26-40h | 1 week |
| | Medium | 16-24h | 1 week |
| | **SUBTOTAL** | **80-120h** | **3-4 weeks** |
| **TOTAL** | **ALL** | **130-200h** | **4-7 weeks** |

---

## Recommended Priority Order

### If Starting Now (Tight Timeline)

**Week 1-2 (Phase 3 Critical)**
1. [ ] `npm audit` — Identify vulns (4h)
2. [ ] XXE prevention — XML parser config (4h)
3. [ ] CORS middleware — Whitelist origins (6h)
4. [ ] Health check endpoint (3h)
5. [ ] Dependency audit + fixes (4h)

**Week 3 (Phase 3 High)**
6. [ ] Malware scanning integration (12h)
7. [ ] DOMPurify + XSS audit (6h)
8. [ ] CSP reports + logging (3h)

**Week 4 (Phase 3 Medium)**
9. [ ] Request size limits (2h)
10. [ ] API versioning plan + partial migration (6h)
11. [ ] Missing headers + SRI (3h)

**Week 5-6 (Phase 4 Critical)**
12. [ ] Audit middleware — auto-log all routes (10h)
13. [ ] LGPD portal UI (16h) — 2 engineers in parallel
14. [ ] XSD validation enforcement (6h)
15. [ ] Backup + Incident Response docs (8h)

**Week 7-8 (Phase 4 High)**
16. [ ] Sentry integration (5h)
17. [ ] Alert rules + dashboard (14h)
18. [ ] A3 cert + MEC validation (6h)

**Week 9 (Phase 4 Medium)**
19. [ ] Token blacklist + device management (14h)

---

## Files to Create/Modify

### New Files (Phase 3)
- [ ] `src/lib/security/cors.ts` — CORS middleware
- [ ] `src/lib/security/sanitize-html.ts` — DOMPurify wrapper
- [ ] `src/app/api/health/route.ts` — Health check
- [ ] `src/app/api/security/csp-violations/route.ts` — CSP report collector
- [ ] `src/lib/security/malware-scan.ts` — ClamAV/VirusTotal integration
- [ ] `docs/API-VERSIONING-PLAN.md` — Strategy + roadmap

### New Files (Phase 4)
- [ ] `src/app/(erp)/privacidade/page.tsx` — LGPD portal
- [ ] `src/app/api/lgpd/export-request/route.ts` — Data export
- [ ] `src/app/api/lgpd/delete-request/route.ts` — Data deletion
- [ ] `src/lib/security/alert-rules.ts` — Alert engine
- [ ] `src/app/api/admin/alerts/dashboard/route.ts` — Alert dashboard API
- [ ] `docs/INCIDENT-RESPONSE.md` — IR plan
- [ ] `docs/DISASTER-RECOVERY.md` — Backup plan
- [ ] `supabase/migrations/20260326_token_blacklist.sql` — Token revocation
- [ ] `supabase/migrations/20260326_device_management.sql` — Session tracking

### Modified Files (Phase 3)
- [ ] `next.config.mjs` — CSP reports, missing headers
- [ ] `package.json` — Add DOMPurify
- [ ] `src/middleware.ts` — Add CORS validation
- `src/lib/security/icp-brasil.ts` — Add A3 check, enhance validation

### Modified Files (Phase 4)
- [ ] `src/lib/security/audit-trail.ts` — Enhance with middleware support
- [ ] `src/middleware.ts` — Add audit logging for all routes
- [ ] `supabase/migrations/*` — Add alert_rules table

---

## Critical Path Items (Must Do First)

1. **Dependency audit** — Unblock all other work (identify blockers)
2. **XXE prevention** — Unblock diploma features
3. **CORS config** — Unblock portal integration
4. **Health check** — Unblock monitoring setup
5. **Malware scan** — Unblock file uploads in prod
6. **Audit middleware** — Unblock Phase 4 compliance
7. **LGPD portal** — Unblock LGPD compliance

---

## Testing Checklist (for each gap)

- [ ] Unit tests for new functions
- [ ] Integration tests with existing modules
- [ ] Staging environment testing
- [ ] Pentesting (after Phase 3)
- [ ] Load testing (for alert + audit systems)
- [ ] Backup restore test (quarterly)
- [ ] Incident response drill (quarterly)

---

**Document Type:** Research only — NO code written
**Next Step:** Approval + sprint planning for Phase 3
