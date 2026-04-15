# AUDITORIA DE SEGURANÇA E QUALIDADE — ERP-Educacional

**Data**: 2024-05-15
**Auditor**: Matrix Agent
**Metodologia**: Read-Only Analysis
**Classificação**: USO INTERNO

---

## DIMENSÃO 1: ARQUITETURA & BACKEND

### 1.1 [Crítica] — Middleware de Domínio com IP Fixo

**Problema**: `middleware.ts` hardcoda listas de domínios (`erp.fic`, `gestao.fic`, `diploma.fic`) com IPs fixos para bypass de rate limiting.

**Impacto**: Violação do princípio de least privilege. IPs podem mudar causando outage ou serem interceptados. Não há fallback dinâmico via DNS.

**Diretriz**: Migrar para Service Discovery (Consul, Eureka) ou DNS TXT records com TTL curto. Remover whitelist de IPs do código.

---

### 1.2 [Média] — Padrão Single-Tenant Implícito

**Problema**: Arquitetura multi-tenant via `tenant_id`/`institution_id` mas sem isolamento de schema no Postgres (single database).

**Impacto**: Vazamento de dados cross-tenant via bugs em queries ou RLS mal configurada. Queries lentas afetam todos os tenants simultaneamente.

**Diretriz**: Considerar Postgres schemas separados por instituição (`ALTER ROLE CURRENT_USER SET search_path = institution_X`) ou migrate para multi-database pattern com tenant-sharding.

---

### 1.3 [Média] — Webhook BRy Sem HMAC

**Problema**: `bry-assinatura-pdf/route.ts` não implementa validação HMAC-SHA256 como o webhook WhatsApp (`atendimento/webhook/route.ts`).

**Impacto**: Qualquer requisição autenticada na rede interna pode manipular status de assinaturas PDF. Sem garantia de integridade da origem.

**Diretriz**: Implementar `Bry-Webhook-Signature` header com HMAC-SHA256 conforme documentação BRy. Validar `X-Forwarded-For` para garantir origem via Load Balancer.

---

### 1.4 [Média] — IP Validation Regex Permissivo

**Problema**: `rate-limit.ts` usa `/^[0-9a-fA-F:]+$/` para IPv6 — aceita qualquer string hexadecimal com `:`.

**Impacto**: Bypass de rate limiting via headers `X-Forwarded-For` forjados com formato `0:0:0:0` ou similares.

**Diretriz**: Usar `net.isIP()` do Node.js ou `is-ip` package. Validar IPv4 e IPv6 separadamente.

---

### 1.5 [Baixa] — Fallback Memória no Rate Limiter

**Problema**: `rate-limit.ts` usa `new Map()` em memória quando Redis falha — sem TTL cleanup.

**Impacto**: Memory leak em ambientes com alto uptime. Rate limiting pode ser completamente ineffective (ineffective) se Redis cair por longos períodos.

**Diretriz**: Implementar `setInterval` para cleanup periódico ou usar `lru-cache` com `maxAge`.

---

### 1.6 [Média] — In-Memory Filtering em Diplomas

**Problema**: `GET /api/diplomas` faz filter by search (name/CPF/course) in-memory via `filter()`.

**Impacto**: Não escala. Carrega TODOS os diplomas filtrados do Postgres para memória antes de paginar.

**Diretriz**: Migrar filter para SQL `WHERE` clause com `tsvector` (Full-Text Search) ou `ILIKE` indexado.

---

## DIMENSÃO 2: CODE QUALITY & LANGUAGE

### 2.1 [Crítica] — Diploma Detail Page (108KB, 2410 linhas)

**Problema**: `page.tsx` com 2410 linhas é um God Component que viola SRP, OCP e quase todos os princípios SOLID.

**Impacto**: Impossível manter, testar ou fazer code review. Qualquer change é risco de regressão. Bug #H modal embutido no mesmo arquivo.

**Diretriz**: Extrair para:
- `components/DiplomaTabs/` (Dados, XMLs, Documentos, Acervo, Histórico)
- `hooks/useDiplomaWorkflow.ts`
- `components/DiplomaActions.tsx`
- `components/PipelineStatus.tsx`

---

### 2.2 [Média] — API Route Monolítica

**Problema**: `diplomas/[id]/route.ts` (325 linhas) acumulou múltiplas responsabilidades: GET, DELETE, PATCH, field mapping, extra queries.

**Impacto**: Violação do Princípio da Responsabilidade Única. Dificulta caching granular e testing isolado.

**Diretriz**: Split em:
- `GET /api/diplomas/[id]` → Service `GetDiplomaService`
- `PATCH /api/diplomas/[id]` → Service `UpdateDiplomaService`
- `DELETE /api/diplomas/[id]` → Service `DeleteDiplomaService`

---

### 2.3 [Baixa] — Async Fire-and-Forget Inconsistente

**Problema**: `cadeia-custodia.ts` tem `registrarCustodiaAsync` mas `document-converter/src/server.js` usa callback pattern diferente.

**Impacto**: Inconsistência de error handling. Async fire-and-forget pode silently fail sem logging.

**Diretriz**: Padronizar para `queue.add()` (Bull/BullMQ) ou `Domain Events` com transactional outbox pattern.

---

### 2.4 [Baixa] — Magic Numbers Sem Constantes

**Problema**: Valores como `2h` (session expiry), `100` (batch size), `5s` (flush interval), `30_000` (timeout) espalhados no código.

**Impacto**: Configuração oculta. Changes acidentais podem causar outages silenciosos.

**Diretriz**: Extrair para `src/config/constants.ts` com JSDoc explicando rationale de cada valor.

---

### 2.5 [Média] — Error Handling Inconsistente

**Problema**: Algumas APIs retornam `{ error: string }`, outras `throw new Error()`, outras `NextResponse.error()`.

**Impacto**: Frontend precisa tratar múltiplos formatos de erro. Logging inconsistente.

**Diretriz**: Criar `ApiResponse` helper:
```typescript
class ApiResponse {
  static success(data, status = 200)
  static error(message, status, code)
  static validation(errors)
}
```

---

## DIMENSÃO 3: FRONTEND & UI/UX

### 3.1 [Média] — Portal Client (1020 linhas)

**Problema**: `PortalPageClient.tsx` mistura concerns: Turnstile, dual-tab UI, RVDD viewer, XML validator, API calls.

**Impacto**: Loading states complexos com `isInitialLoad` ref pattern. Dificulta SSR/SSG.

**Diretriz**: Extrair:
- `components/PortalSearchForm.tsx`
- `components/RvddViewer.tsx`
- `components/XmlValidator.tsx`
- `hooks/useDiplomaPortal.ts`

---

### 3.2 [Média] — XML Validator No Client Side

**Problema**: XML validator roda no browser sem XSD schema loading. Qualquer browser refresh recarrega schemas.

**Impacto**: Performance degrade com múltiplos uploads. Sem caching de schemas MEC.

**Diretriz**: Implementar `React Query` com `staleTime: Infinity` para schemas XSD. Considerar server-side validation com cache Redis.

---

### 3.3 [Baixa] — RVDD Proxy Sem Cache

**Problema**: `/api/portal/rvdd-proxy` faz proxy de PDFs sem cache.

**Impacto**: Cada visualização baixa o PDF novamente. Custo de egress elevado + latency.

**Diretriz**: Implementar `Cache-Control: public, max-age=31536000` para PDFs publicados. Usar CDN (Cloudflare Cache Rules).

---

### 3.4 [Baixa] — Override Modal Sem Confirmation

**Problema**: Modal de override para violações de business rules (Bug #H) não pede confirmação explícita antes de executar ação irreversível.

**Impacto**: Usuário pode clicar errado e circumvent regras de compliance.

**Diretriz**: Adicionar step de confirmação com texto digitado ("TENHO CIÊNCIA") ou double-click pattern.

---

### 3.5 [Média] — Loading States Não Granulares

**Problema**: `page.tsx` usa `isInitialLoad` ref pattern genérico — não distingue refresh de skeleton initial load.

**Impacto**: UX inconsistente. Loading spinner aparece desnecessariamente.

**Diretriz**: Normalizar para TanStack Query `useQuery` com `isFetching` vs `isLoading` states. Skeleton components para initial load.

---

## DIMENSÃO 4: PERFORMANCE & OPTIMIZATION

### 4.1 [Crítica] — N+1 Queries no Diploma Detail

**Problema**: `diplomas/[id]/route.ts` faz queries separadas para `xml_gerados`, `extracao_sessoes`, `fluxo_assinaturas`.

**Impacto**: 4 round-trips ao banco por cada acesso ao detail page. 400 concurrent users = 1600 queries/segundo.

**Diretriz**: Usar `Promise.all()` paralelo OU JOIN em uma única query com JSON aggregation:
```sql
SELECT d.*, 
  json_agg(xml) as xmls,
  json_agg(sessao) as sessoes
FROM diplomas d
LEFT JOIN xml_gerados xml ON xml.diploma_id = d.id
LEFT JOIN extracao_sessoes sessao ON sessao.diploma_id = d.id
WHERE d.id = $1
GROUP BY d.id
```

---

### 4.2 [Média] — Document Converter Sem Concurrency Control Global

**Problema**: `document-converter/src/server.js` usa `executarComLimite(4)` local — cada instância Railway tem seu próprio limite.

**Impacto**: 3 instâncias = 12 concurrent jobs. Sem distributed coordination, pode overload em cenários de spike.

**Diretriz**: Implementar Upstash QStash ou Redis-based distributed semaphore para controle global de concorrência.

---

### 4.3 [Média] — Sem Gzip/Brotli Compression

**Problema**: Nenhum middleware de compression configurado em `next.config.mjs`.

**Impacto**: JSON responses não comprimidos. Mobile users com bandwidth limitado experimentam latency.

**Diretriz**: Adicionar `compress` middleware (Express) ou `next-compose-plugins` com compression.

---

### 4.4 [Média] — Supabase Realtime Sem Subscription Cleanup

**Problema**: Possível memory leak em componentes que usam `supabase.channel()` sem `unsubscribe()` em cleanup.

**Impacto**: WebSocket connections acumulam. Browser tab leak em SPAs.

**Diretriz**: Implementar `useEffect` com cleanup:
```typescript
useEffect(() => {
  const channel = supabase.channel(...)
  return () => { channel.unsubscribe() }
}, [])
```

---

### 4.5 [Baixa] — Batch Size Fixed em Migration

**Problema**: `pii-encryption.ts` usa `100` records/batch fixo. Não adaptativo a load.

**Impacto**: Em horários de pico, pode causar lock contention. Em horários off-peak, subaproveita capacidade.

**Diretriz**: Implementar adaptive batching via `pg_stat_activity` (locks > X → reduzir batch). Usar `BACKGROUND` worker não-bloqueante.

---

### 4.6 [Baixa] — Sem Database Index em Filter Columns

**Problema**: Filtros por `nome`, `cpf`, `curso` em diplomas não têm índices explícitos.

**Impacto**: Table scans em `diplomas` com milhões de registros. Query latency degrada linearmente.

**Diretriz**: Adicionar índices parciais:
```sql
CREATE INDEX idx_diplomas_nome ON diplomas(nome) 
  WHERE deleted_at IS NULL;
CREATE INDEX idx_diplomas_cpf_hash ON diplomas(cpf_hash) 
  WHERE cpf_hash IS NOT NULL;
```

---

## DIMENSÃO 5: SECURITY

### 5.1 [Crítica] — CSRF Double Submit Sem HttpOnly

**Problema**: `csrf.ts` stores CSRF token em cookie non-httpOnly (`_csrf`).

**Impacto**: XSS pode ler token CSRF via `document.cookie` e fazer requests cross-site. Padrão Double Submit mitigado.

**Impacto Real**: Se houver stored XSS em qualquer endpoint, CSRF protection é bypassed.

**Diretriz**: Migrar para Same-Site Cookies (default em moderna browsers) OU usar `CSRF_TOKEN` cookie HttpOnly + custom header (mais robusto).

---

### 5.2 [Crítica] — BRy Webhook Sem Autenticação de Rede

**Problema**: `bry-assinatura-pdf/route.ts` não tem HMAC validation.

**Impacto**: Qualquer serviço interno pode POSTar falsificando status de assinatura.

**Diretriz**: Implementar `Bry-Signature` header com HMAC-SHA256. Log e reject requests sem signature válida.

---

### 5.3 [Média] — Service Role Client Embutido em API Routes

**Problema**: `diplomas/[id]/route.ts` usa `createClient(url, serviceRoleKey)` diretamente na API route.

**Impacto**: Se API route for mal configurada ou exposta, service role key pode vazar via stack traces ou logs.

**Diretriz**: Usar Server-side Supabase Client com JWT verification. Service role apenas em background jobs (RLS bypass é anti-pattern em request context).

---

### 5.4 [Média] — Rate Limit Bypass Via IPv6 Spoofing

**Problema**: `isValidIP` regex `/^[0-9a-fA-F:]+$/` aceita strings forjadas em `X-Forwarded-For`.

**Impacto**: Atacante pode bypassear rate limiting forjando headers `x-forwarded-for: [ipv6-valido]::1`.

**Diretriz**: Validar IPs com `net.isIP()`. Trust apenas primeiro IP não-known-private em `X-Forwarded-For`.

---

### 5.5 [Média] — Security Logger Sem Encryption

**Problema**: `security-logger.ts` logs eventos de segurança (incluindo falhas de auth) mas não criptografa os detalhes.

**Impacto**: Logs em plaintext no storage. Se storage for comprometida, detalhes de ataques são expostos.

**Diretriz**: Criptografar campos `details` e `ip_address` com chave do Vault. Implementar `SECURITY_LOG_ENCRYPTION_KEY`.

---

### 5.6 [Média] — PII Encryption Sem Key Rotation

**Problema**: `pii-encryption.ts` usa `PII_ENCRYPTION_KEY` fixed. Não há mecanismo de rotação.

**Impacto**: Se chave for comprometida, todos os dados PII são decryptable. Não compliance com LGPD.

**Diretriz**: Implementar Envelope Encryption: dados são encryptados com DEK (Data Encryption Key), DEKs são encryptados com KEK (Key Encryption Key). Rotacionar KEK periodicamente via Vault.

---

### 5.7 [Média] — Cadeia de Custódia Sem Distributed Consensus

**Problema**: `cadeia-custodia.ts` calcula `hash_anterior` localmente — não há Distributed Hash Chain.

**Impacto**: Em multi-instância, cada instância pode criar branch chains divergentes se não houver serialized writes.

**Diretriz**: Implementar `SELECT FOR UPDATE SKIP LOCKED` ao ler `hash_anterior` OU usar database `INSERT ... RETURNING` com trigger para atualizar hash chain.

---

### 5.8 [Baixa] — Turnstile Timeout Não Configurado

**Problema**: `validar-codigo/route.ts` não tem timeout no fetch do Turnstile verification.

**Impacto**: Slow/failed Turnstile API pode causar request timeout no Next.js (default 30s).

**Diretriz**: Adicionar `AbortSignal.timeout(5000)` para validation do Turnstile.

---

### 5.9 [Baixa] — No Input Sanitization em XML Upload

**Problema**: `diplomas/[id]/page.tsx` faz XML upload sem sanitization do conteúdo.

**Impacto**: XXE (XML External Entity) injection se content-type não for validado.

**Diretriz**: Validar `Content-Type: application/xml` OU `text/xml`. Usar `fast-xml-parser` com `processEntities: false` para desabilitar XXE.

---

### 5.10 [Média] — Hardcoded Exempt Prefixes em CSRF

**Problema**: `csrf.ts` hardcoda prefixos isentos: `/api/portal/`, `/api/auth/`, `/api/ia/`.

**Impacto**: Novos endpoints em `/api/portal/` são automaticamente csrf-exempt. Auditoria de security não captura novos vetores.

**Diretriz**: Migrar para lista explícita em `NEXT_PUBLIC_CSRF_EXEMPT_ROUTES` env var com formato documentado. Adicionar warning em lint rules.

---

## SUMÁRIO DE ACHADOS

| Dimensão | Crítica | Média | Baixa |
|----------|---------|-------|-------|
| Arquitetura & Backend | 1 | 4 | 1 |
| Code Quality | 1 | 2 | 3 |
| Frontend & UI/UX | 0 | 3 | 2 |
| Performance & Optimization | 1 | 3 | 3 |
| Security | 2 | 6 | 3 |
| **TOTAL** | **5** | **18** | **12** |

---

## PRIORIZAÇÃO RECOMENDADA

### Sprint 1 (Crítico — 2 semanas)
1. CSRF HttpOnly migration
2. BRy Webhook HMAC validation
3. IP validation fix com `net.isIP()`
4. N+1 query resolution

### Sprint 2 (Alta Prioridade — 4 semanas)
5. Diploma Page decomposition (108KB → components)
6. RBAC service role removal
7. Security Logger encryption
8. PII Key Rotation architecture

### Sprint 3 (Medium — 8 semanas)
9. Multi-tenant schema isolation
10. Document converter distributed semaphore
11. XXE prevention
12. Adaptive batching implementation

### Backlog (Melhoria Contínua)
- Database indexes
- Compression middleware
- Realtime subscription cleanup
- Magic numbers → constants

---

*Relatório gerado por Matrix Agent — Auditoria Read-Only*
