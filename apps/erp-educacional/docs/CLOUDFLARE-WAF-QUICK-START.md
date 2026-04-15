# Cloudflare WAF Quick Start — ERP Educacional

## 5-Minute Setup

### Step 1: Get Your Credentials

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your zone (e.g., `diploma.fic.edu.br`)
3. Copy the **Zone ID** from Overview page (right panel)
4. Create API Token:
   - Click your profile (bottom left)
   - Go to **API Tokens**
   - Click **Create Token**
   - Choose **Custom Token**
   - Permissions: `Zone.Firewall.Manage`
   - Copy the token

### Step 2: Set Environment Variables

```bash
export CF_API_TOKEN="your_api_token_here"
export CF_ZONE_ID="your_zone_id_here"
```

### Step 3: Deploy WAF Rules

```bash
cd /path/to/ERP-Educacional
chmod +x scripts/cloudflare-waf-setup.sh
./scripts/cloudflare-waf-setup.sh
```

The script will:
- Validate your credentials
- Deploy 6 custom firewall rules
- Generate a deployment report
- Display next steps

### Step 4: Manual Configuration (Dashboard)

Some features require dashboard configuration:

**A. Rate Limiting**
1. Go to **Security > Rate Limiting**
2. Create rule for `/api/portal/consultar-cpf`:
   - Threshold: 3 requests/min
   - Action: Block
3. Create rule for `/api/documentos/verificar/`:
   - Threshold: 30 requests/min
   - Action: Block

**B. Managed Rulesets**
1. Go to **Security > WAF > Managed Rules**
2. Enable **Cloudflare Managed Ruleset**
3. Set sensitivity to **High**

**C. SSL/TLS**
1. Go to **SSL/TLS > Edge Certificates**
2. **Always Use HTTPS:** Toggle ON
3. **Automatic HTTPS Rewrites:** Toggle ON
4. **Minimum TLS Version:** 1.2

---

## Using the TypeScript Helper in Your App

### Example 1: Middleware Protection

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  validateCloudflareHeaders,
  getCloudflareCountry,
  shouldChallenge,
} from '@/lib/security/cloudflare-headers';

export function middleware(request: NextRequest) {
  // Verify request came through Cloudflare
  if (!validateCloudflareHeaders(request)) {
    return NextResponse.json(
      { error: 'Invalid request origin' },
      { status: 403 }
    );
  }

  // Check for admin routes
  if (request.nextUrl.pathname.startsWith('/api/admin')) {
    const country = getCloudflareCountry(request);
    if (country !== 'BR') {
      return NextResponse.json(
        { error: 'Access denied outside Brazil' },
        { status: 403 }
      );
    }
  }

  // Check if request should be challenged
  if (shouldChallenge(request)) {
    return NextResponse.json(
      { error: 'Please complete CAPTCHA' },
      { status: 429 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
```

### Example 2: API Route Protection

```typescript
// src/app/api/portal/consultar-cpf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  validateBotScore,
  getCloudflareClientIp,
  createCloudflareAuditLog,
} from '@/lib/security/cloudflare-headers';

export async function POST(request: NextRequest) {
  // Block obvious bots
  if (!validateBotScore(request, 40)) {
    return NextResponse.json(
      { error: 'Access denied' },
      { status: 403 }
    );
  }

  const clientIp = getCloudflareClientIp(request);
  const { cpf } = await request.json();

  try {
    // Your CPF lookup logic here
    const result = await lookupCpf(cpf);

    return NextResponse.json(result);
  } catch (error) {
    // Log security event
    const auditLog = createCloudflareAuditLog(
      request,
      'cpf_lookup_error',
      { cpf: '***', error: error.message }
    );
    await logSecurityEvent(auditLog);

    return NextResponse.json(
      { error: 'Lookup failed' },
      { status: 500 }
    );
  }
}
```

### Example 3: Getting Visitor Information

```typescript
// src/app/api/visitors/info/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAllCloudflareHeaders } from '@/lib/security/cloudflare-headers';

export async function GET(request: NextRequest) {
  const cfInfo = getAllCloudflareHeaders(request);

  return NextResponse.json({
    visitor: {
      ip: cfInfo.clientIp,
      country: cfInfo.country,
      threat_score: cfInfo.threatScore,
      is_bot: cfInfo.botScore ? cfInfo.botScore > 50 : false,
    },
    debug: {
      ray_id: cfInfo.ray,
      tls_version: cfInfo.tlsVersion,
      asn: cfInfo.asn,
    },
  });
}
```

---

## Firewall Rules Reference

| Rule | Purpose | Action |
|------|---------|--------|
| **Block API without origin/referer** | Prevent direct API abuse | Challenge (CAPTCHA) |
| **Block SQL injection/XSS** | Protect against injection attacks | Block |
| **Block malicious bots** | Prevent scanner attacks (sqlmap, nikto, etc.) | Block |
| **Block non-Brazil admin routes** | Geo-fence admin access to Brazil | Block |
| **Challenge suspicious auth attempts** | Additional protection for login endpoints | Challenge (CAPTCHA) |

---

## Testing the WAF

### Test 1: Verify Brazil-only Admin Access

```bash
# Should work (from Brazil)
curl -H "CF-IpCountry: BR" https://diploma.fic.edu.br/api/admin/users

# Should be blocked (from USA)
curl -H "CF-IpCountry: US" https://diploma.fic.edu.br/api/admin/users
```

### Test 2: Rate Limit CPF Lookup

```bash
# First 3 should work
for i in {1..3}; do
  curl -X POST https://diploma.fic.edu.br/api/portal/consultar-cpf \
    -H "Content-Type: application/json" \
    -d '{"cpf":"12345678901"}' -w "HTTP %{http_code}\n"
done

# 4th should return 429
curl -X POST https://diploma.fic.edu.br/api/portal/consultar-cpf \
  -H "Content-Type: application/json" \
  -d '{"cpf":"12345678901"}' -w "HTTP %{http_code}\n"
```

### Test 3: Block SQL Injection

```bash
# Should be blocked
curl "https://diploma.fic.edu.br/api/documentos/verificar?id=1' UNION SELECT * FROM users--"

# Check response
# Expected: 403 Forbidden
```

---

## Monitoring

### View Firewall Events

1. Go to **Analytics > Security**
2. Filter by:
   - **Country:** Monitor non-Brazil access attempts
   - **Action:** See blocked vs challenged requests
   - **Rules:** Review which rules are triggering

### Set Up Alerts

1. Go to **Notifications > Alert Rules**
2. Create alert for:
   - 50+ firewall blocks in 5 minutes
   - Multiple rate limit triggers
   - High-threat requests

### Check Logs

```bash
# View firewall logs (if Log Push configured)
curl -X GET "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/logs/received" \
  -H "Authorization: Bearer ${CF_API_TOKEN}"
```

---

## Troubleshooting

### Issue: "Invalid Cloudflare headers"

**Cause:** Request not coming through Cloudflare (nameservers not updated)

**Solution:**
1. Verify nameservers point to Cloudflare:
   ```bash
   dig diploma.fic.edu.br NS
   ```
2. Wait for DNS propagation (up to 24 hours)
3. Check domain settings in Cloudflare Dashboard

### Issue: Rate Limiting Too Strict

**Cause:** Threshold too low for legitimate traffic

**Solution:**
1. Increase thresholds:
   - CPF lookup: Try 5-10 req/min
   - Document verify: Try 50-100 req/min
2. Whitelist IP ranges:
   ```
   (uri.path contains "/api/documentos/verificar/") and not (ip.src in $trusted_ips)
   ```

### Issue: Admin Routes Not Blocking Non-Brazil

**Cause:** CF-IpCountry header not being set

**Solution:**
1. Verify Cloudflare nameservers active
2. Check that "Cloudflare nameservers" is orange icon (✓ Active)
3. Test with browser (Cloudflare injects headers)

---

## File Locations

| File | Purpose |
|------|---------|
| `docs/cloudflare-waf-config.md` | Complete WAF configuration guide |
| `scripts/cloudflare-waf-setup.sh` | Automated deployment script |
| `src/lib/security/cloudflare-headers.ts` | TypeScript helper for header validation |

---

## Next Steps

1. ✅ Deploy WAF rules with setup script
2. ✅ Configure rate limiting manually
3. ✅ Enable managed rulesets
4. ✅ Set up SSL/TLS
5. ✅ Import TypeScript helper in middleware
6. ✅ Configure alerts
7. ✅ Test with sample traffic
8. ✅ Review firewall logs regularly

---

## Support

For complete documentation, see:
- `docs/cloudflare-waf-config.md` — Full reference
- [Cloudflare API Docs](https://developers.cloudflare.com/api/)
- [Firewall Rules Docs](https://developers.cloudflare.com/firewall/)

