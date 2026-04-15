# Security Logger — Quick Start (TL;DR)

## Setup (1 minute)

1. **Run migration:**
   ```bash
   supabase migration up
   # Or manually run: supabase/migrations/20260326_security_events.sql
   ```

2. **Verify variables are set:**
   ```
   NEXT_PUBLIC_SUPABASE_URL ✓
   SUPABASE_SERVICE_ROLE_KEY ✓
   ```

Done! Events start logging automatically.

---

## Simplest Usage (Copy-Paste)

### Log Login Success/Failure
```typescript
import { logAuthAttempt } from '@/lib/security'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateUser(request)
    logAuthAttempt(request, true, user.id)  // ← Add this
    return Response.json({ token: '...' })
  } catch (err) {
    logAuthAttempt(request, false)  // ← Add this
    return Response.json({ erro: 'Failed' }, { status: 401 })
  }
}
```

### Log Data Modification
```typescript
import { logDataModification } from '@/lib/security'

export async function POST(request: NextRequest, context: AuthContext) {
  const novosDados = await request.json()

  // Create diploma
  const diploma = await criarDiploma(novosDados)

  // Log the change
  logDataModification(
    request,
    context.userId,
    'diplomas',
    'insert',
    1,
    { diplomado_id: diploma.diplomado_id }
  )

  return Response.json(diploma, { status: 201 })
}
```

### Log Permission Denied
```typescript
import { logPermissionDenied } from '@/lib/security'

if (usuario.role !== 'admin') {
  logPermissionDenied(request, usuario.id, '/api/admin/usuarios', 'admin')
  return Response.json({ erro: 'Acesso negado' }, { status: 403 })
}
```

### Log Data Access
```typescript
import { logDataAccess } from '@/lib/security'

const diplomas = await buscarDiplomas({ usuarioId: context.userId })
logDataAccess(request, context.userId, 'diplomas', 'consulta', diplomas.length)
```

---

## Automatic Protection (Zero Code)

Use this on sensitive endpoints to get automatic attack detection:

```typescript
import { criarHandlerSeguro } from '@/lib/security/security-logger-middleware'

export const POST = criarHandlerSeguro(
  async (request) => {
    const data = await request.json()
    // Your handler here
    return Response.json(data, { status: 201 })
  },
  {
    validarEntrada: true,      // ← Detects SQL injection, XSS, etc.
    logEvent: 'DATA_MODIFICATION'
  }
)
```

That's it. The middleware handles:
- Input validation (blocks attacks)
- Automatic logging
- Error handling
- Returns 400 if suspicious input detected

---

## View Events in Supabase

```sql
-- See all events from last 24 hours
SELECT * FROM security_events
WHERE timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

-- See failed logins
SELECT * FROM security_events
WHERE tipo = 'AUTH_FAILURE'
ORDER BY timestamp DESC;

-- See suspicious IPs
SELECT ip, COUNT(*) as tentativas
FROM security_events
WHERE risco IN ('alto', 'critico')
AND timestamp > NOW() - INTERVAL '1 hour'
GROUP BY ip
ORDER BY tentativas DESC;

-- See a user's audit trail
SELECT timestamp, tipo, rota, risco
FROM security_events
WHERE usuario_id = 'user-uuid'
ORDER BY timestamp DESC
LIMIT 50;
```

---

## Query Via RPC

```typescript
// Find suspicious IPs
const { data } = await supabase.rpc('analisar_eventos_suspeitos', {
  p_horas: 24,
  p_limite_falhas: 5
})

// User audit trail
const { data } = await supabase.rpc('auditoria_usuario', {
  p_usuario_id: 'uuid-123',
  p_dias: 7,
  p_limite: 100
})

// Statistics
const { data } = await supabase.rpc('estatisticas_seguranca', {
  p_horas: 24
})

// Custom search
const { data } = await supabase.rpc('buscar_eventos_seguranca', {
  p_tipo: 'SUSPICIOUS_INPUT',
  p_risco: 'critico',
  p_limite: 50
})
```

---

## Available Log Functions

```typescript
import {
  // Basic
  logSecurityEvent,           // Generic

  // Auth
  logAuthAttempt,             // Login success/failure
  logLogout,                  // Logout

  // Access Control
  logPermissionDenied,        // RBAC denied

  // Rate Limiting
  logRateLimitHit,           // Rate limit exceeded

  // Validation
  logCaptchaFailure,         // CAPTCHA failed
  logSuspiciousInput,        // Attack pattern detected

  // Data
  logDataAccess,             // Data read
  logDataModification,       // Data create/update/delete

  // Admin
  logAdminAction,            // Admin operation

  // LGPD
  logLGPDRequest,            // LGPD request (access, deletion, etc.)

  // Utilities
  configurarWebhookSeguranca, // Setup Slack/Discord alerts
  flushSecurityEvents        // Force immediate save (on shutdown)
} from '@/lib/security'
```

---

## Middleware Functions

```typescript
import {
  protegerSeguranca,         // Wrapper for any handler
  validarEntradaSegura,      // Check input for attacks
  criarHandlerSeguro,        // All-in-one secure handler
  logarRateLimitDetectado    // Logging helper
} from '@/lib/security/security-logger-middleware'
```

---

## Risk Levels

- `baixo` — Normal operations
- `medio` — Failed auth, rate limits, normal denied access
- `alto` — Data modification, admin actions, attack patterns
- `critico` — Serious attacks, multiple failures, suspicious patterns

---

## Event Types Explained

| Type | When to Log |
|------|------------|
| `AUTH_SUCCESS` | After successful login |
| `AUTH_FAILURE` | Failed login (wrong password, user not found) |
| `AUTH_LOGOUT` | User logs out |
| `PERMISSION_DENIED` | User lacks required role/permission |
| `RATE_LIMIT_HIT` | User exceeded rate limit |
| `CAPTCHA_FAILURE` | CAPTCHA/Turnstile verification failed |
| `SUSPICIOUS_INPUT` | Detected attack pattern (SQL injection, XSS, etc.) |
| `DATA_ACCESS` | User read sensitive data (diplomas, records) |
| `DATA_MODIFICATION` | User created/updated/deleted important data |
| `ADMIN_ACTION` | Admin performed privileged action |
| `LGPD_REQUEST` | User requested data access/deletion/export |

---

## Common Patterns

### Secure All `/api/*` Routes (Recommended)

Add to every sensitive route:

```typescript
export const POST = criarHandlerSeguro(myHandler, {
  validarEntrada: true,
  logEvent: 'DATA_MODIFICATION'
})
```

### Log Reads & Writes

```typescript
// READ
logDataAccess(request, userId, 'tabela', 'consulta', count)

// WRITE
logDataModification(request, userId, 'tabela', 'insert', 1, { campos })
```

### Protect Admin Routes

```typescript
if (!usuario.roles.includes('admin')) {
  logPermissionDenied(request, usuario.id, rota, 'admin')
  return Response.json({ erro: 'Acesso negado' }, { status: 403 })
}
```

---

## Dashboard Query (Copy-Paste)

```typescript
// Get dashboard data
const [criticos, suspeitas, stats] = await Promise.all([
  // Critical events in last 24h
  supabase
    .from('security_events')
    .select('*')
    .eq('risco', 'critico')
    .gte('timestamp', new Date(Date.now() - 24*60*60*1000).toISOString())
    .order('timestamp', { ascending: false })
    .limit(10),

  // Suspicious IPs
  supabase.rpc('analisar_eventos_suspeitos', {
    p_horas: 24,
    p_limite_falhas: 5
  }),

  // Stats
  supabase.rpc('estatisticas_seguranca', {
    p_horas: 24
  })
])
```

---

## Troubleshooting

### Events not saving?
- Check `SUPABASE_SERVICE_ROLE_KEY` is set
- Check migration was run: `SELECT * FROM security_events LIMIT 1`
- Check console.error for errors

### Pattern detection too strict?
- Edit `SUSPICIOUS_PATTERNS` in `security-logger-middleware.ts`
- Adjust regex patterns to be less aggressive

### Performance issues?
- Increase `BATCH_SIZE` (default: 10)
- Increase `FLUSH_INTERVAL_MS` (default: 5000ms)
- Add more indexes to `security_events` table

### Need real-time alerts?
```typescript
configurarWebhookSeguranca(
  'https://hooks.slack.com/services/YOUR/WEBHOOK'
)
```

---

## Full Examples

See: `/src/lib/security/SECURITY-LOGGER-GUIDE.md` for comprehensive examples.

---

## Summary

1. **Setup:** Run migration → Done
2. **Add logs:** Copy examples above into your routes
3. **Monitor:** Query Supabase or use RPC functions
4. **Alert:** Setup webhook for critical events
5. **Done!** Security events are now logged & tracked

Next: Read `SECURITY-LOGGER-GUIDE.md` for deep dive.
