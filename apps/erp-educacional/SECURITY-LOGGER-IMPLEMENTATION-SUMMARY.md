# Security Logger Implementation — Summary

**Date:** March 26, 2026
**Project:** ERP Educacional FIC
**Task:** Create centralized security logging system

## Files Created

### 1. Core Logger
**Path:** `/src/lib/security/security-logger.ts` (18 KB)

Centralized, non-blocking security event logger with:
- Singleton pattern for instance management
- Batch processing (flush every 5s or 10 events)
- Multiple sinks: Supabase, Console (Vercel logs), Webhooks
- Retry logic with exponential backoff
- 10 helper functions for common security events:
  - `logAuthAttempt()` — Login attempts (success/failure)
  - `logLogout()` — Session termination
  - `logPermissionDenied()` — RBAC access denied
  - `logRateLimitHit()` — Rate limit exceeded
  - `logCaptchaFailure()` — Turnstile verification failed
  - `logSuspiciousInput()` — Potential attacks detected
  - `logDataAccess()` — Sensitive data accessed
  - `logDataModification()` — Critical data modified
  - `logAdminAction()` — Admin operations
  - `logLGPDRequest()` — LGPD requests
- Plus utility functions:
  - `configurarWebhookSeguranca()` — Setup webhooks for critical events
  - `flushSecurityEvents()` — Force immediate flush

**Exports in:** `/src/lib/security/index.ts` ✅

---

### 2. Database Migration
**Path:** `/supabase/migrations/20260326_security_events.sql` (9.1 KB)

Creates `security_events` table with:
- Full-text structured fields: tipo, timestamp, usuario_id, ip, user_agent, rota, metodo, status_code, risco, detalhes
- Optimized indexes:
  - `idx_security_events_tipo_timestamp` — Primary query pattern
  - `idx_security_events_usuario_timestamp` — User audit trails
  - `idx_security_events_ip_timestamp` — Suspicious IP analysis
  - `idx_security_events_risco_timestamp` — Alert filtering
  - `idx_security_events_rota_timestamp` — Endpoint analysis
  - `idx_security_events_timestamp_brin` — Time-series optimization

- 4 RPC functions:
  - `analisar_eventos_suspeitos(p_horas, p_limite_falhas)` — Detect brute-force IPs
  - `auditoria_usuario(p_usuario_id, p_dias, p_limite)` — User audit trail
  - `estatisticas_seguranca(p_horas)` — Event statistics by type
  - `buscar_eventos_seguranca(...)` — Generic filtered search

- Row Level Security (RLS):
  - Admins: view all events
  - Users: view only own events

- Data retention:
  - Auto-delete events older than 90 days
  - `limpar_security_events_antigos()` function

---

### 3. Middleware & Utilities
**Path:** `/src/lib/security/security-logger-middleware.ts` (12 KB)

Automatic security protection for API routes:

**Pattern Detection:**
- SQL Injection / XSS detection
- Command Injection patterns
- Path Traversal attempts
- XXE (XML External Entity) attacks
- LDAP Injection patterns

**Brute-Force Detection:**
- Real-time tracking of failed authentication attempts
- Detects multiple 401s, 404s, rapid requests
- In-memory cache (note: use Redis for multi-worker deployments)
- 5-minute rolling window analysis

**4 Main Functions:**
- `protegerSeguranca(request, handler)` — Wrapper for handlers
- `validarEntradaSegura(request, userId?)` — Input validation & attack detection
- `logarRateLimitDetectado(request, userId?, endpoint?)` — Logging helper
- `criarHandlerSeguro(handler, options)` — All-in-one secured handler

**Options for `criarHandlerSeguro()`:**
```typescript
{
  validarEntrada?: boolean       // Enable input validation
  logEvent?: SecurityEventType   // Log type on success
  requerAuth?: boolean           // Require authentication
}
```

**Exports in:** `/src/lib/security/index.ts` ✅

---

### 4. Comprehensive Guide
**Path:** `/src/lib/security/SECURITY-LOGGER-GUIDE.md` (15+ KB)

Complete documentation with:
- 10 event type examples with code
- Middleware integration examples
- Webhook configuration for Slack/Discord
- All 4 RPC functions with usage
- Performance & scalability notes
- RLS policy explanation
- Monitoring dashboard example
- Troubleshooting guide
- Best practices

---

## Integration Checklist

### Before Using

1. **Run migration:**
   ```bash
   supabase migration up
   ```
   Or manually execute `/supabase/migrations/20260326_security_events.sql`

2. **Verify environment variables:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```

3. **Test connection:**
   ```typescript
   import { logSecurityEvent } from '@/lib/security'

   logSecurityEvent({
     tipo: 'AUTH_SUCCESS',
     ip: '127.0.0.1',
     rota: '/test',
     metodo: 'GET',
     risco: 'baixo'
   })
   ```

### Usage Patterns

#### Pattern 1: Explicit Logging (recommended)
```typescript
import { logAuthAttempt, logDataAccess } from '@/lib/security'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request)
    logAuthAttempt(request, true, user.id)
    return Response.json({ user })
  } catch (err) {
    logAuthAttempt(request, false)
    return Response.json({ erro: 'Auth failed' }, { status: 401 })
  }
}
```

#### Pattern 2: Middleware-Protected Handler
```typescript
import { criarHandlerSeguro } from '@/lib/security/security-logger-middleware'

export const POST = criarHandlerSeguro(
  async (request) => {
    const data = await request.json()
    // Process data...
    return Response.json({ success: true }, { status: 201 })
  },
  {
    validarEntrada: true,
    logEvent: 'DATA_MODIFICATION'
  }
)
```

#### Pattern 3: Manual Validation
```typescript
import { validarEntradaSegura, logSuspiciousInput } from '@/lib/security'

export async function POST(request: NextRequest, context: AuthContext) {
  const validation = await validarEntradaSegura(request, context.userId)

  if (!validation.valido) {
    logSuspiciousInput(
      request,
      validation.padraoBloqueado!.tipoAtaque,
      { pattern: 'detected' },
      context.userId
    )
    return Response.json({ erro: 'Invalid input' }, { status: 400 })
  }

  // Continue...
}
```

---

## Key Features

### ✅ Non-Blocking
- Fire-and-forget architecture
- Background batch processing
- Doesn't impact request latency

### ✅ Multi-Sink Storage
- **Primary:** Supabase (queryable, auditable)
- **Secondary:** Console JSON (Vercel logs, searchable)
- **Tertiary:** Webhook (real-time alerts for critical events)

### ✅ Intelligent Pattern Detection
- 5 categories of attack patterns
- Real-time brute-force detection
- Configurable thresholds

### ✅ Compliance-Ready
- Structured event format
- LGPD-ready with `logLGPDRequest()`
- MEC audit trail support (extends existing audit_trail)
- 90-day retention policy
- RLS for data privacy

### ✅ Performance-Optimized
- Batch writes (reduce DB calls)
- Indexed queries (fast searches)
- BRIN index for time-series data
- Minimal memory footprint

### ✅ Scalable
- Singleton pattern prevents memory leaks
- Queue size limits (100 events max)
- Automatic cleanup of old records
- Ready for Redis-backed sessions (multi-worker)

---

## Security Event Types

| Type | Risco | Exemplo |
|------|-------|---------|
| `AUTH_SUCCESS` | baixo | Login bem-sucedido |
| `AUTH_FAILURE` | medio | Credenciais inválidas |
| `AUTH_LOGOUT` | baixo | Logout de sessão |
| `PERMISSION_DENIED` | medio | Acesso negado (RBAC) |
| `RATE_LIMIT_HIT` | medio | Limite de requisições |
| `CAPTCHA_FAILURE` | medio | Turnstile falhou |
| `SUSPICIOUS_INPUT` | alto/critico | SQL injection, XSS, etc. |
| `DATA_ACCESS` | baixo | Acesso a dados sensíveis |
| `DATA_MODIFICATION` | alto | Edição/exclusão de dados |
| `ADMIN_ACTION` | alto | Operação administrativa |
| `LGPD_REQUEST` | medio | Requisição LGPD |

---

## Monitoring & Alerting

### Real-Time Alerts (via Webhook)
Configure Slack/Discord webhook:
```typescript
import { configurarWebhookSeguranca } from '@/lib/security'

configurarWebhookSeguranca(
  'https://hooks.slack.com/services/YOUR/WEBHOOK',
  'optional-secret',
  ['SUSPICIOUS_INPUT', 'PERMISSION_DENIED'] // optional filtering
)
```

### Dashboard Queries
Use these RPCs for monitoring dashboards:
- `analisar_eventos_suspeitos()` — Identify attack sources
- `auditoria_usuario()` — User audit trails
- `estatisticas_seguranca()` — Overall statistics

### Data Cleanup
Automatic via function:
```typescript
const { data } = await supabase.rpc('limpar_security_events_antigos')
// Returns: number of records deleted
```

---

## Testing

### Test Basic Logging
```bash
# Add to a route handler temporarily
logSecurityEvent({
  tipo: 'AUTH_SUCCESS',
  ip: '127.0.0.1',
  rota: '/api/test',
  metodo: 'POST',
  statusCode: 200,
  risco: 'baixo'
})

# Check Supabase table
SELECT * FROM security_events ORDER BY timestamp DESC LIMIT 1
```

### Test Pattern Detection
```typescript
// This should trigger SUSPICIOUS_INPUT detection
const maliciousInput = "'; DROP TABLE users; --"
const validation = await validarEntradaSegura(createMockRequest(maliciousInput))
console.assert(!validation.valido, 'Pattern detection failed')
```

### Test RPC Functions
```typescript
// Check suspicious IPs
const { data } = await supabase.rpc('analisar_eventos_suspeitos', {
  p_horas: 24,
  p_limite_falhas: 5
})

// Should return IPs with multiple failed attempts
```

---

## Future Enhancements

1. **Redis Backend** — Replace in-memory cache for multi-worker deployments
2. **Elasticsearch Integration** — Full-text search on events
3. **ML-Based Anomaly Detection** — Detect unusual patterns
4. **Geographic IP Lookup** — Map IPs to locations
5. **Rate Limiting Dashboard** — Real-time visualizations
6. **Alert Rule Engine** — Custom alert conditions
7. **Event Retention Archive** — S3/R2 for long-term storage
8. **Compliance Reports** — Auto-generate LGPD audit reports

---

## File Sizes & Locations

| File | Size | Location | Created |
|------|------|----------|---------|
| security-logger.ts | 18 KB | src/lib/security/ | ✅ |
| security-logger-middleware.ts | 12 KB | src/lib/security/ | ✅ |
| 20260326_security_events.sql | 9.1 KB | supabase/migrations/ | ✅ |
| SECURITY-LOGGER-GUIDE.md | 15+ KB | src/lib/security/ | ✅ |
| index.ts (updated) | - | src/lib/security/ | ✅ |

**Total New Code:** ~54 KB

---

## Conclusion

The Security Logger system provides **production-ready centralized security event logging** for the ERP Educacional project. It integrates seamlessly with existing security infrastructure (audit-trail, rate-limit, api-guard) and adds:

- Real-time attack detection
- Compliance-ready event storage
- Non-blocking batch processing
- Multi-sink redundancy
- Alerting via webhooks
- RLS-protected data access

Ready for immediate integration into API routes. See `SECURITY-LOGGER-GUIDE.md` for detailed usage examples.
