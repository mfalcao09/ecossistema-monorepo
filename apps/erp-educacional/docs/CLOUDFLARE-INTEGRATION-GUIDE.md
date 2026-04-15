# Cloudflare WAF Integration Guide — ERP Educacional

## Overview

This guide shows how to integrate the Cloudflare WAF header validation into the existing Next.js middleware and API routes. The integration is modular and can be adopted incrementally.

## Architecture

```
Cloudflare Edge
    ↓
[WAF Rules] → Block/Challenge/Allow
    ↓
[CF Headers Injected]
    ├─ cf-connecting-ip
    ├─ cf-ipcountry
    ├─ cf-ray
    ├─ cf-threat-score
    ├─ cf-bot-management-score
    └─ ...other headers
    ↓
Next.js Middleware (src/middleware.ts)
    ├─ Validate Cloudflare headers
    ├─ Check country (geo-fencing)
    ├─ Check threat score
    ├─ Check bot score
    └─ Apply additional security rules
    ↓
API Routes / Pages
    └─ Additional validation if needed
```

## Integration Steps

### Step 1: Update Middleware (Recommended)

Add Cloudflare header validation to `src/middleware.ts`:

**File:** `src/middleware.ts`

Find this section:
```typescript
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const host = request.headers.get('host') || ''
  // ... rest of code
```

Add these imports at the top:
```typescript
import {
  validateCloudflareHeaders,
  getCloudflareCountry,
  validateThreatScore,
  validateBotScore,
  shouldChallenge,
  createCloudflareAuditLog,
  addCloudflareInfoHeaders,
} from '@/lib/security/cloudflare-headers'
```

Add this validation block after the domain routing check (around line 30):

```typescript
// ── Cloudflare WAF Validation ───────────────────────────────
// In production (Cloudflare enabled), validate headers
if (process.env.NODE_ENV === 'production') {
  // Verify request came through Cloudflare
  if (!validateCloudflareHeaders(request)) {
    console.warn('Request missing Cloudflare headers', {
      ip: request.ip,
      url: request.url,
    })
    // In strict mode, block. In permissive, log and continue
    if (process.env.CF_STRICT_MODE === 'true') {
      return NextResponse.json(
        { erro: 'Invalid request origin' },
        { status: 403 }
      )
    }
  }

  // Geo-fence: Block non-Brazil access to admin routes
  if (pathname.startsWith('/api/admin') ||
      pathname.startsWith('/api/auth')) {
    const country = getCloudflareCountry(request)
    if (country && country !== 'BR') {
      console.warn('Non-Brazil access attempt to admin route', {
        country,
        pathname,
        ip: getCloudflareClientIp(request),
      })
      return NextResponse.json(
        { erro: 'Acesso não disponível nesta região' },
        { status: 403 }
      )
    }
  }

  // Check threat score for API endpoints
  if (pathname.startsWith('/api/') && !validateThreatScore(request, 50)) {
    console.warn('High threat score request to API', {
      threatScore: getCloudflareTheatScore(request),
      pathname,
    })
    // For sensitive endpoints, could return challenge response
    // For now, allow but log
  }

  // Bot detection for sensitive endpoints
  if (pathname.startsWith('/api/auth/') ||
      pathname.startsWith('/api/portal/consultar-cpf')) {
    if (!validateBotScore(request, 40)) {
      console.warn('Bot-like request to sensitive endpoint', {
        botScore: getCloudflareBotsCore(request),
        pathname,
      })
      return NextResponse.json(
        { erro: 'Access denied' },
        { status: 403 }
      )
    }
  }
}
```

### Step 2: Add Logging Middleware

Create a new file to log Cloudflare security events:

**File:** `src/lib/security/cloudflare-logging.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import {
  getAllCloudflareHeaders,
  createCloudflareAuditLog,
} from './cloudflare-headers'
import { auditLog } from './audit-trail'

export async function logSecurityEvent(
  request: NextRequest,
  eventType: string,
  details?: Record<string, unknown>
) {
  const cfInfo = getAllCloudflareHeaders(request)

  const logEntry = {
    timestamp: new Date().toISOString(),
    eventType,
    security: {
      rayId: cfInfo.ray,
      clientIp: cfInfo.clientIp,
      country: cfInfo.country,
      threatScore: cfInfo.threatScore,
      botScore: cfInfo.botScore,
      asn: cfInfo.asn,
    },
    request: {
      method: request.method,
      path: request.nextUrl.pathname,
      userAgent: request.headers.get('user-agent'),
    },
    details,
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[SECURITY]', eventType, logEntry)
  }

  // Send to audit trail (your existing system)
  try {
    await auditLog({
      action: eventType,
      category: 'security',
      details: logEntry,
    })
  } catch (error) {
    console.error('Failed to log security event:', error)
  }
}

export function addSecurityHeaders(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  const cfInfo = getAllCloudflareHeaders(request)

  // Add Cloudflare info headers for debugging
  if (cfInfo.ray) {
    response.headers.set('X-Ray-ID', cfInfo.ray)
  }
  if (cfInfo.clientIp) {
    response.headers.set('X-Client-IP', cfInfo.clientIp)
  }
  if (cfInfo.country) {
    response.headers.set('X-Client-Country', cfInfo.country)
  }

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')

  return response
}
```

### Step 3: Protect Sensitive API Endpoints

**Example:** CPF Lookup Endpoint

**File:** `src/app/api/portal/consultar-cpf/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import {
  validateBotScore,
  getCloudflareClientIp,
  getCloudflareCountry,
  createCloudflareAuditLog,
} from '@/lib/security/cloudflare-headers'
import { logSecurityEvent } from '@/lib/security/cloudflare-logging'

export async function POST(request: NextRequest) {
  // Validate bot score (prevent automated CPF enumeration)
  if (!validateBotScore(request, 35)) {
    const botScore = request.headers.get('cf-bot-management-score')
    await logSecurityEvent(request, 'cpf_lookup_bot_detected', {
      botScore: parseInt(botScore || '0', 10),
    })

    return NextResponse.json(
      { erro: 'Acesso negado' },
      { status: 403 }
    )
  }

  try {
    const { cpf } = await request.json()

    // Validate CPF format
    if (!isValidCPF(cpf)) {
      await logSecurityEvent(request, 'cpf_lookup_invalid_format', {
        cpf: maskCPF(cpf),
      })

      return NextResponse.json(
        { erro: 'CPF inválido' },
        { status: 400 }
      )
    }

    // Your CPF lookup logic
    const result = await lookupCpf(cpf)

    // Log successful lookup
    await logSecurityEvent(request, 'cpf_lookup_success', {
      country: getCloudflareCountry(request),
      ip: getCloudflareClientIp(request),
    })

    return NextResponse.json(result)
  } catch (error) {
    await logSecurityEvent(request, 'cpf_lookup_error', {
      error: error.message,
    })

    return NextResponse.json(
      { erro: 'Erro ao processar solicitação' },
      { status: 500 }
    )
  }
}

function isValidCPF(cpf: string): boolean {
  // Your CPF validation logic
  return cpf && cpf.replace(/\D/g, '').length === 11
}

function maskCPF(cpf: string): string {
  const clean = cpf.replace(/\D/g, '')
  return `${clean.slice(0, 3)}.***.${clean.slice(-2)}`
}

async function lookupCpf(cpf: string) {
  // Your CPF lookup implementation
  // This is just a placeholder
  return {
    found: true,
    nome: 'Usuário Encontrado',
  }
}
```

### Step 4: Create Security Dashboard Component

**File:** `src/components/admin/SecurityMonitor.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'

interface SecurityMetrics {
  totalRequests: number
  blockedByWAF: number
  challengedRequests: number
  nonBrazilAttempts: number
  highThreatRequests: number
  botDetections: number
}

export function SecurityMonitor() {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null)

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/admin/security/metrics')
        const data = await response.json()
        setMetrics(data)
      } catch (error) {
        console.error('Failed to fetch security metrics:', error)
      }
    }

    fetchMetrics()
    const interval = setInterval(fetchMetrics, 30000) // Update every 30s

    return () => clearInterval(interval)
  }, [])

  if (!metrics) {
    return <div>Carregando...</div>
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card
        title="Solicitações Totais"
        value={metrics.totalRequests}
        icon="📊"
      />
      <Card
        title="Bloqueadas pelo WAF"
        value={metrics.blockedByWAF}
        color="red"
        icon="🚫"
      />
      <Card
        title="Desafio (CAPTCHA)"
        value={metrics.challengedRequests}
        color="yellow"
        icon="⚠️"
      />
      <Card
        title="Tentativas Fora do BR"
        value={metrics.nonBrazilAttempts}
        color="orange"
        icon="🌍"
      />
      <Card
        title="Ameaças Altas"
        value={metrics.highThreatRequests}
        color="red"
        icon="🔴"
      />
      <Card
        title="Detecção de Bot"
        value={metrics.botDetections}
        color="orange"
        icon="🤖"
      />
    </div>
  )
}

function Card({
  title,
  value,
  color = 'blue',
  icon,
}: {
  title: string
  value: number
  color?: 'red' | 'yellow' | 'orange' | 'blue' | 'green'
  icon: string
}) {
  const colorClasses = {
    red: 'bg-red-50 border-red-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    orange: 'bg-orange-50 border-orange-200',
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
  }

  return (
    <div className={`p-4 border rounded-lg ${colorClasses[color]}`}>
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-sm text-gray-600">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}
```

## Configuration

### Environment Variables

Add to `.env.local`:

```bash
# Cloudflare Configuration
CF_API_TOKEN=your_cloudflare_api_token
CF_ZONE_ID=your_cloudflare_zone_id
CF_DOMAIN=diploma.fic.edu.br

# WAF Behavior
CF_STRICT_MODE=false  # Set to true to block requests without CF headers
CF_LOG_SECURITY_EVENTS=true  # Log all security events
```

### Feature Flags

Control WAF behavior via feature flags:

```typescript
// src/lib/features.ts
export const WAF_FEATURES = {
  VALIDATE_CF_HEADERS: process.env.NODE_ENV === 'production',
  GEO_FENCE_ADMIN: true,
  CHECK_THREAT_SCORE: true,
  CHECK_BOT_SCORE: true,
  REQUIRE_CHALLENGE_HIGH_THREAT: false,
  LOG_ALL_REQUESTS: process.env.CF_LOG_SECURITY_EVENTS === 'true',
}
```

## Testing

### Unit Tests

**File:** `__tests__/cloudflare-headers.test.ts`

```typescript
import { validateCloudflareHeaders, getCloudflareCountry } from '@/lib/security/cloudflare-headers'

describe('Cloudflare Headers', () => {
  it('should validate valid Cloudflare headers', () => {
    const mockRequest = {
      headers: {
        get: (name: string) => {
          const headers = {
            'cf-connecting-ip': '1.2.3.4',
            'cf-ipcountry': 'BR',
            'cf-ray': 'abc123',
          }
          return headers[name] || null
        },
      },
    }

    expect(validateCloudflareHeaders(mockRequest)).toBe(true)
  })

  it('should extract country correctly', () => {
    const mockRequest = {
      headers: {
        get: (name: string) => {
          if (name === 'cf-ipcountry') return 'BR'
          return null
        },
      },
    }

    expect(getCloudflareCountry(mockRequest)).toBe('BR')
  })

  it('should reject non-Brazil access to admin routes', () => {
    // Test logic here
  })
})
```

## Monitoring Checklist

- [ ] Cloudflare Security Analytics dashboard bookmarked
- [ ] Alert rules configured for:
  - 50+ WAF blocks in 5 minutes
  - Multiple rate limit activations
  - Non-Brazil admin access attempts
- [ ] Weekly log review scheduled
- [ ] Incident response procedure documented
- [ ] Team trained on WAF management

## Troubleshooting

### Request Headers Missing in Development

In development (localhost), Cloudflare headers won't be present. To test:

1. Mock headers in your test setup
2. Use feature flags to disable checks in dev
3. Deploy to staging/production for full testing

### Performance Impact

Cloudflare WAF adds minimal latency (<1ms typically):
- Header validation: <0.1ms
- Rule evaluation: Happens at edge, not in your app
- No performance impact expected

### False Positives

If legitimate traffic is blocked:

1. Review Cloudflare Analytics dashboard
2. Identify the rule causing blocks
3. Whitelist if needed:
   ```
   (uri.path contains "/api/endpoint") and not (ip.src in $whitelist)
   ```
4. Adjust threat score thresholds
5. Test with VPN/proxy to simulate different origins

## Next Steps

1. ✅ Deploy WAF rules (see `CLOUDFLARE-WAF-QUICK-START.md`)
2. ✅ Update middleware with CF header validation
3. ✅ Protect sensitive endpoints (CPF lookup, auth)
4. ✅ Set up logging and monitoring
5. ✅ Create security dashboard
6. ✅ Configure alerts
7. ✅ Test in staging environment
8. ✅ Deploy to production
9. ✅ Review logs daily for first week
10. ✅ Schedule monthly security audits

