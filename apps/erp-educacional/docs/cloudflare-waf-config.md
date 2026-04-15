# Cloudflare WAF Configuration Guide — ERP Educacional (Diploma Digital)

## Overview

This guide provides comprehensive Cloudflare Web Application Firewall (WAF) configuration for the FIC Diploma Digital platform. The configuration uses a defense-in-depth approach combining Cloudflare's managed rulesets with custom firewall rules tailored to the application's API endpoints.

**Key Objectives:**
- Protect API endpoints from abuse and injection attacks
- Rate limit sensitive endpoints (CPF lookup, document verification)
- Enforce geographic restrictions for admin routes
- Block malicious bot traffic
- Maintain zero-trust validation at the edge

---

## Prerequisites

Before deploying WAF rules, ensure:

1. **Cloudflare Account Setup**
   - Domain registered with Cloudflare (nameservers updated)
   - Zone ID available (found in Overview page)
   - API Token created with `Zone.Firewall.Manage` permission

2. **Environment Variables**
   ```bash
   CF_API_TOKEN=your_cloudflare_api_token
   CF_ZONE_ID=your_cloudflare_zone_id
   CF_DOMAIN=diploma.fic.edu.br  # Example
   ```

3. **Cloudflare Plan**
   - Pro or Business plan recommended for WAF access
   - Rate Limiting available on Pro and above

---

## Firewall Rules Configuration

All custom rules are defined below. Use the automation script (`scripts/cloudflare-waf-setup.sh`) to deploy them programmatically, or configure manually via the Cloudflare Dashboard.

### 1. Block Requests to `/api/` Without Valid Origin/Referer (CORS Enforcement)

**Purpose:** Prevent direct API abuse from unauthorized origins or missing headers.

**Rule Expression:**
```
(cf.threat_score > 0 or (uri.path contains "/api/" and not (cf.bot_managed_score <= 20))) and
(http.referer eq "" or http.origin eq "") and
(not (http.referer contains "diploma.fic.edu.br" or http.referer contains "localhost"))
```

**Action:** Challenge (CAPTCHA)

**Priority:** 1

**Manual Setup (Dashboard):**
1. Go to **Security > WAF > Custom Rules**
2. Click **Create Rule**
3. Enter the rule expression above
4. Action: **Challenge**
5. Save

**API Configuration:**
```json
{
  "description": "Block API requests without valid origin/referer",
  "expression": "(cf.threat_score > 0 or (uri.path contains \"/api/\" and not (cf.bot_managed_score <= 20))) and (http.referer eq \"\" or http.origin eq \"\") and (not (http.referer contains \"diploma.fic.edu.br\" or http.referer contains \"localhost\"))",
  "action": "challenge",
  "priority": 1000
}
```

---

### 2. Rate Limit `/api/portal/consultar-cpf` (CPF Lookup Protection)

**Purpose:** Prevent brute force attacks on CPF lookup endpoint. CPF enumeration is a high-risk operation.

**Limit:** 3 requests per minute per IP address

**Rule Expression:**
```
(uri.path eq "/api/portal/consultar-cpf" or uri.path eq "/api/portal/consultar-cpf/") and
http.request.method eq "POST"
```

**Rate Limiting Configuration:**
- **Requests:** 3
- **Time Window:** 60 seconds
- **Per:** Client IP (`cf.colo_id` + `http.client_ip`)
- **Action:** Block (return 429)
- **Duration:** 300 seconds (5 minutes)

**Manual Setup (Dashboard):**
1. Go to **Security > Rate Limiting**
2. Click **Create Rate Limiting Rule**
3. Expression: Enter the rule expression above
4. For Requests: `3`
5. Time Window: `60 seconds`
6. Counting Expression: `cf.colo_id` (or use default IP tracking)
7. Mitigation: **Block**
8. Save

**API Configuration:**
```json
{
  "match": {
    "request": {
      "url": {
        "path": {
          "matches": "^/api/portal/consultar-cpf(/)?$"
        }
      },
      "method": ["POST"]
    }
  },
  "action": "block",
  "threshold": 3,
  "period": 60,
  "characteristics": ["ip.src"],
  "mitigation_timeout": 300
}
```

---

### 3. Rate Limit `/api/documentos/verificar/` (Document Verification Protection)

**Purpose:** Limit document verification requests to prevent abuse and DoS on signature verification system.

**Limit:** 30 requests per minute per IP address

**Rule Expression:**
```
(uri.path contains "/api/documentos/verificar/" or uri.path contains "/api/documentos/verificar-assinatura") and
(http.request.method eq "GET" or http.request.method eq "POST")
```

**Rate Limiting Configuration:**
- **Requests:** 30
- **Time Window:** 60 seconds
- **Per:** Client IP
- **Action:** Block (return 429)
- **Duration:** 600 seconds (10 minutes)

**Manual Setup (Dashboard):**
1. Go to **Security > Rate Limiting**
2. Click **Create Rate Limiting Rule**
3. Expression: Enter the rule expression above
4. For Requests: `30`
5. Time Window: `60 seconds`
6. Mitigation: **Block**
7. Save

**API Configuration:**
```json
{
  "match": {
    "request": {
      "url": {
        "path": {
          "matches": "^/api/documentos/verificar"
        }
      },
      "method": ["GET", "POST"]
    }
  },
  "action": "block",
  "threshold": 30,
  "period": 60,
  "characteristics": ["ip.src"],
  "mitigation_timeout": 600
}
```

---

### 4. Block Common Attack Patterns (SQL Injection & XSS Payloads)

**Purpose:** Block requests containing SQL injection and XSS attack patterns in query strings and POST bodies.

**Rule Expression:**
```
(
  (querystring contains "union select" or querystring contains "drop table") or
  (querystring contains "<script" or querystring contains "javascript:") or
  (querystring contains "onclick=" or querystring contains "onerror=") or
  (http.request.body.string contains "exec(" or http.request.body.string contains "eval(")
)
and (uri.path contains "/api/")
```

**Action:** Block (return 403)

**Priority:** 2000

**Manual Setup (Dashboard):**
1. Go to **Security > WAF > Custom Rules**
2. Click **Create Rule**
3. Enter the rule expression above
4. Action: **Block**
5. Save

**API Configuration:**
```json
{
  "description": "Block SQL injection and XSS patterns",
  "expression": "((querystring contains \"union select\" or querystring contains \"drop table\") or (querystring contains \"<script\" or querystring contains \"javascript:\") or (querystring contains \"onclick=\" or querystring contains \"onerror=\") or (http.request.body.string contains \"exec(\" or http.request.body.string contains \"eval(\")) and (uri.path contains \"/api/\")",
  "action": "block",
  "priority": 2000
}
```

---

### 5. Block Known Malicious Bots (User-Agent Filtering)

**Purpose:** Block requests from known bot user-agents associated with scanners and attack tools. Whitelist legitimate crawlers (Google, Bing).

**Rule Expression:**
```
(
  (http.user_agent contains "sqlmap") or
  (http.user_agent contains "nikto") or
  (http.user_agent contains "nmap") or
  (http.user_agent contains "masscan") or
  (http.user_agent contains "metasploit") or
  (http.user_agent contains "acunetix") or
  (http.user_agent contains "nessus") or
  (http.user_agent contains "openvas")
)
and not (http.user_agent contains "Googlebot" or http.user_agent contains "Bingbot")
```

**Action:** Block (return 403)

**Priority:** 1500

**Manual Setup (Dashboard):**
1. Go to **Security > WAF > Custom Rules**
2. Click **Create Rule**
3. Enter the rule expression above
4. Action: **Block**
5. Save

**API Configuration:**
```json
{
  "description": "Block known malicious bot user-agents",
  "expression": "((http.user_agent contains \"sqlmap\") or (http.user_agent contains \"nikto\") or (http.user_agent contains \"nmap\") or (http.user_agent contains \"masscan\") or (http.user_agent contains \"metasploit\") or (http.user_agent contains \"acunetix\") or (http.user_agent contains \"nessus\") or (http.user_agent contains \"openvas\")) and not (http.user_agent contains \"Googlebot\" or http.user_agent contains \"Bingbot\")",
  "action": "block",
  "priority": 1500
}
```

---

### 6. Country Blocking for Admin Routes (Geo-Fencing)

**Purpose:** Enforce Brazil-only access for admin API routes. Portal routes remain globally accessible.

**Admin Routes (BR Only):**
- `/api/admin/*`
- `/api/auth/*`
- `/api/usuarios/*`
- `/api/emitentes/*`

**Public Routes (Global):**
- `/api/portal/*`
- `/api/documentos/*`
- `/api/validacao/*`

**Rule Expression (Admin - Block non-BR):**
```
(
  (uri.path contains "/api/admin/" or uri.path contains "/api/auth/" or
   uri.path contains "/api/usuarios/" or uri.path contains "/api/emitentes/")
)
and cf.country ne "BR"
```

**Action:** Block (return 403)

**Priority:** 3000

**Manual Setup (Dashboard):**
1. Go to **Security > WAF > Custom Rules**
2. Click **Create Rule**
3. Enter the rule expression above
4. Action: **Block**
5. Save

**API Configuration:**
```json
{
  "description": "Block non-Brazil access to admin routes",
  "expression": "((uri.path contains \"/api/admin/\" or uri.path contains \"/api/auth/\" or uri.path contains \"/api/usuarios/\" or uri.path contains \"/api/emitentes/\")) and cf.country ne \"BR\"",
  "action": "block",
  "priority": 3000
}
```

---

### 7. Challenge Suspicious IPs Hitting Auth Endpoints

**Purpose:** Require CAPTCHA challenge for IPs with suspicious behavior (high threat score) attempting auth routes.

**Rule Expression:**
```
(uri.path contains "/api/auth/login" or
 uri.path contains "/api/auth/signin" or
 uri.path contains "/api/auth/token")
and cf.threat_score >= 50
```

**Action:** Challenge (CAPTCHA)

**Priority:** 2500

**Manual Setup (Dashboard):**
1. Go to **Security > WAF > Custom Rules**
2. Click **Create Rule**
3. Enter the rule expression above
4. Action: **Challenge**
5. Save

**API Configuration:**
```json
{
  "description": "Challenge high-threat IPs accessing auth endpoints",
  "expression": "(uri.path contains \"/api/auth/login\" or uri.path contains \"/api/auth/signin\" or uri.path contains \"/api/auth/token\") and cf.threat_score >= 50",
  "action": "challenge",
  "priority": 2500
}
```

---

## Managed Rulesets

Enable the following Cloudflare managed rulesets to provide comprehensive protection.

### Cloudflare Managed Ruleset (OWASP Core)

**Purpose:** Core OWASP Top 10 protection against common web vulnerabilities.

**Enable via Dashboard:**
1. Go to **Security > WAF > Managed Rules**
2. Find **Cloudflare Managed Ruleset**
3. Click **Enable**
4. Configure sensitivity:
   - **Sensitivity:** High (for strict enforcement)
   - **Paranoia Level:** 2 or 3 (balance between protection and false positives)
5. Optionally disable specific rules if they conflict with your app

**API Configuration:**
```bash
# Enable Cloudflare Managed Ruleset
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/rulesets/phases/http_request_firewall_managed/rulesets" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cloudflare Managed Ruleset",
    "description": "OWASP Core Rule Set",
    "kind": "managed",
    "phase": "http_request_firewall_managed",
    "rules": [{
      "action": "execute",
      "action_parameters": {
        "id": "62d9f77b2e3c6f3c9b0d4e5f"
      }
    }]
  }'
```

### Cloudflare Bot Management

**Purpose:** Detect and block malicious bot traffic (available on Business plan).

**Enable via Dashboard:**
1. Go to **Security > Bots > Bot Management**
2. Enable **Bot Management**
3. Configure:
   - **Super Bot Fight Mode:** On
   - **Verified Bots:** Allow
   - **Static Resources:** Block (or challenge)
   - **Cloudflare Verified Bots:** Allow (Google, Bing, etc.)

**Key Settings:**
- Block traffic from bots with low reputation
- Allow legitimate crawlers (Googlebot, Bingbot)
- Challenge suspicious automation

---

## Page Rules Configuration

Configure Cloudflare Page Rules for caching and SSL enforcement.

### Rule 1: Static Asset Caching

**URL Pattern:** `diploma.fic.edu.br/static/*`

**Settings:**
- **Cache Level:** Aggressive
- **Browser Cache TTL:** 30 days
- **Cache on Cookie:** Disable
- **Respect Strong ETag:** On

**Dashboard:**
1. Go to **Rules > Page Rules**
2. Click **Create Page Rule**
3. URL: `diploma.fic.edu.br/static/*`
4. Cache Level: **Aggressive**
5. Browser Cache TTL: **30d**
6. Save

### Rule 2: API Caching (Cache Control Headers)

**URL Pattern:** `diploma.fic.edu.br/api/*`

**Settings:**
- **Cache Level:** Respect Server Headers (default)
- **Browser Cache TTL:** 5 minutes
- **Cache on Cookie:** Disable (APIs usually shouldn't cache)

**Note:** API responses should set `Cache-Control: max-age=300, private` headers.

### Rule 3: SSL Enforcement

**URL Pattern:** `diploma.fic.edu.br/*`

**Settings:**
- **SSL:** Full (Strict)
- **Always Use HTTPS:** On
- **Automatic HTTPS Rewrites:** On

**Dashboard:**
1. Go to **SSL/TLS > Edge Certificates**
2. **Always Use HTTPS:** On
3. **Automatic HTTPS Rewrites:** On
4. **Minimum TLS Version:** 1.2

---

## Recommended Additional Security Configurations

### 1. Origin Server Header Protection

Add to your Next.js middleware or API:
```typescript
// src/middleware.ts
response.headers.set('X-Protected-By', 'Cloudflare-WAF');
response.headers.set('Server', 'Cloudflare');
```

### 2. Content Security Policy (CSP)

Set via Page Rule or Next.js headers:
```javascript
// next.config.js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-inline'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline';"
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  }
];
```

### 3. DDoS Protection

Cloudflare DDoS protection is automatic on all plans. For advanced options:
1. Go to **Security > DDoS**
2. Set sensitivity to **High** (for critical endpoints)
3. Whitelist known partners if needed

### 4. WAF Logging

Enable WAF event logging for audit:
1. Go to **Analytics > Logs**
2. Filter by firewall events
3. Set up alerts for repeated rule triggers

---

## Monitoring and Alerts

### 1. Set Up Alerts

Go to **Notifications > Alert Rules** and create:

- **Firewall Rules Triggered Frequently**
  - Trigger: 50+ firewall rule hits in 5 minutes
  - Action: Email notification

- **DDoS Event Detected**
  - Trigger: Any DDoS attack detected
  - Action: Email + Slack notification

- **High Rate Limiting Activations**
  - Trigger: 20+ rate limit blocks in 10 minutes
  - Action: Email notification

### 2. Review Firewall Analytics

1. Go to **Analytics > Security**
2. Review:
   - Top blocked countries
   - Top blocked user-agents
   - Rules triggered most frequently
   - Rate limiting activations

### 3. Log Analysis

Access Cloudflare Logs API to integrate with SIEM:
```bash
# Query firewall logs (requires Log Push)
curl -X GET "https://api.cloudflare.com/client/v4/zones/{zone_id}/logs/received" \
  -H "Authorization: Bearer $CF_API_TOKEN"
```

---

## Deployment Checklist

- [ ] Cloudflare domain configured (nameservers updated)
- [ ] API token created with `Zone.Firewall.Manage` permission
- [ ] Environment variables exported (`CF_API_TOKEN`, `CF_ZONE_ID`)
- [ ] Automation script reviewed and tested
- [ ] WAF rules deployed using `scripts/cloudflare-waf-setup.sh`
- [ ] Managed rulesets enabled
- [ ] Page rules configured
- [ ] SSL/TLS settings enforced
- [ ] Alerts configured in Cloudflare dashboard
- [ ] Load testing performed (ensure legitimate traffic not blocked)
- [ ] Team members trained on WAF management
- [ ] Monitoring dashboard configured

---

## Troubleshooting

### Issue: Legitimate Traffic Blocked

**Solution:**
1. Check Cloudflare Analytics for rule hits
2. Identify the rule blocking traffic
3. Whitelist IPs if needed: Create exception rule with `not (cf.client_ip in $trusted_ips)`
4. Adjust rule sensitivity or disable for specific paths

### Issue: Rate Limit Too Strict

**Solution:**
1. Increase rate limit thresholds
2. Adjust per IP vs. per session basis
3. Whitelist specific IPs for testing
4. Use `cf.bot_managed_score` to exclude good bots

### Issue: API Endpoints Returning 429

**Solution:**
1. Check rate limiting rules are not overlapping
2. Verify client IP seen by Cloudflare matches expected
3. Whitelist IP ranges if needed
4. Consider using session-based rate limiting instead of IP-based

---

## References

- [Cloudflare Firewall Rules Documentation](https://developers.cloudflare.com/firewall/cf-dashboard/custom-rules/)
- [Cloudflare Rate Limiting API](https://developers.cloudflare.com/firewall/rate-limiting-api/)
- [Cloudflare Bot Management](https://developers.cloudflare.com/bots/get-started/)
- [WAF Managed Rules](https://developers.cloudflare.com/waf/managed-rules/)
- [Firewall Expressions Reference](https://developers.cloudflare.com/firewall/cf-dashboard/edit-expressions/)

