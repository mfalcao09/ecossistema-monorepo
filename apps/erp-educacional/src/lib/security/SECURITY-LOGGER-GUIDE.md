# Security Logger — Sistema Centralizado de Logging de Segurança

## Visão Geral

O **Security Logger** é um sistema centralizado, não-bloqueante e multi-sink para captura de eventos de segurança em toda a aplicação ERP Educacional. Implementa:

- ✅ Logging estruturado de 11 tipos de eventos de segurança
- ✅ Batch processing com flush automático (5s ou 10 eventos)
- ✅ Múltiplos sinks: Supabase (DB), Console (Vercel logs), Webhook (críticos)
- ✅ Detecção automática de padrões suspeitos (SQL injection, XSS, path traversal, etc.)
- ✅ Detecção de força bruta (múltiplas 401/404 em tempo real)
- ✅ Non-blocking: fire-and-forget com retry automático
- ✅ Índices otimizados para query em Supabase
- ✅ RLS (Row Level Security) para proteção de dados

## Tipos de Eventos

### 1. `AUTH_SUCCESS` / `AUTH_FAILURE` — Login

```typescript
import { logAuthAttempt } from '@/lib/security'

export async function POST(request: NextRequest) {
  const { email, senha } = await request.json()

  try {
    // Autenticar usuário
    const usuario = await autenticar(email, senha)

    logAuthAttempt(request, true, usuario.id, {
      metodo: 'email',
      provedor: 'local'
    })

    return Response.json({ token: '...' })
  } catch (err) {
    logAuthAttempt(request, false, undefined, {
      email,
      motivo: err.message,
      tentativa: 'login_falhou'
    })

    return Response.json({ erro: 'Credenciais inválidas' }, { status: 401 })
  }
}
```

### 2. `AUTH_LOGOUT` — Logout

```typescript
import { logLogout } from '@/lib/security'

export async function POST(request: NextRequest, context: AuthContext) {
  const userId = context.userId

  // Limpar sessão
  await limparSessao(userId)

  logLogout(request, userId)

  return Response.json({ sucesso: true })
}
```

### 3. `PERMISSION_DENIED` — Acesso Negado (RBAC)

```typescript
import { logPermissionDenied } from '@/lib/security'

export async function GET(request: NextRequest, context: AuthContext) {
  const usuario = context.usuario

  if (usuario.role !== 'admin') {
    logPermissionDenied(request, usuario.id, '/api/admin/usuarios', 'admin')
    return Response.json({ erro: 'Acesso negado' }, { status: 403 })
  }

  // Continuar...
}
```

### 4. `RATE_LIMIT_HIT` — Rate Limit Excedido

```typescript
import { logRateLimitHit } from '@/lib/security'

export async function POST(request: NextRequest, context: AuthContext) {
  const rateLimit = await verificarRateLimitERP(request, 'api_write', context.userId)

  if (!rateLimit.allowed) {
    logRateLimitHit(request, '/api/diplomados', context.userId)
    return Response.json({ erro: 'Muitas requisições' }, { status: 429 })
  }

  // Continuar...
}
```

### 5. `CAPTCHA_FAILURE` — Falha no Turnstile

```typescript
import { logCaptchaFailure } from '@/lib/security'

export async function POST(request: NextRequest) {
  const { token } = await request.json()

  const resultado = await verificarTurnstile(token)

  if (!resultado.success) {
    logCaptchaFailure(request, resultado.error_codes[0] || 'desconhecido')
    return Response.json({ erro: 'CAPTCHA inválido' }, { status: 400 })
  }

  // Continuar...
}
```

### 6. `SUSPICIOUS_INPUT` — Entrada Suspeita

```typescript
import { logSuspiciousInput } from '@/lib/security'
import { validarEntradaSegura } from '@/lib/security/security-logger-middleware'

export async function POST(request: NextRequest, context: AuthContext) {
  // Validação automática
  const validacao = await validarEntradaSegura(request, context.userId)

  if (!validacao.valido) {
    logSuspiciousInput(request, validacao.padraoBloqueado!.tipoAtaque, {
      padrao: validacao.padraoBloqueado!.pattern.source
    }, context.userId)

    return Response.json({ erro: 'Entrada inválida' }, { status: 400 })
  }

  // Continuar...
}
```

### 7. `DATA_ACCESS` — Acesso a Dados Sensíveis

```typescript
import { logDataAccess } from '@/lib/security'

export async function GET(request: NextRequest, context: AuthContext) {
  // Buscar diplomas
  const diplomas = await buscarDiplomas({
    usuarioId: context.userId
  })

  // Log de acesso
  logDataAccess(request, context.userId, 'diplomas', 'consulta', diplomas.length)

  return Response.json(diplomas)
}
```

### 8. `DATA_MODIFICATION` — Modificação de Dados Críticos

```typescript
import { logDataModification } from '@/lib/security'

export async function POST(request: NextRequest, context: AuthContext) {
  const novosDados = await request.json()

  // Criar diploma
  const diploma = await criarDiploma(novosDados)

  logDataModification(request, context.userId, 'diplomas', 'insert', 1, {
    diplomado_id: diploma.diplomado_id,
    curso_id: diploma.curso_id,
    status: diploma.status
  })

  return Response.json(diploma, { status: 201 })
}
```

### 9. `ADMIN_ACTION` — Ação Administrativa

```typescript
import { logAdminAction } from '@/lib/security'

export async function POST(request: NextRequest, context: AuthContext) {
  if (context.usuario.role !== 'admin') {
    return Response.json({ erro: 'Acesso negado' }, { status: 403 })
  }

  const { usuarioId, novaRole } = await request.json()

  // Alterar permissão
  await alterarRoleUsuario(usuarioId, novaRole)

  logAdminAction(request, context.userId, 'alterar_role_usuario', {
    usuarioAlvo: usuarioId,
    novaRole,
    roleAnterior: 'usuario'
  })

  return Response.json({ sucesso: true })
}
```

### 10. `LGPD_REQUEST` — Requisição LGPD

```typescript
import { logLGPDRequest } from '@/lib/security'

export async function POST(request: NextRequest, context: AuthContext) {
  const { tipo } = await request.json() // 'acesso', 'exclusao', 'portabilidade'

  // Criar requisição LGPD
  const req = await criarRequisicaoLGPD({
    usuarioId: context.userId,
    tipo
  })

  logLGPDRequest(request, tipo, context.userId, 'criada')

  return Response.json(req, { status: 201 })
}
```

## Middleware de Proteção Automática

### `protegerSeguranca()` — Wrapper para handlers

```typescript
import { protegerSeguranca } from '@/lib/security/security-logger-middleware'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  return protegerSeguranca(request, async (req) => {
    const dados = await req.json()
    // handler implementation
    return Response.json({ sucesso: true })
  })
}
```

### `validarEntradaSegura()` — Detecção de ataques

Valida automaticamente contra:
- SQL Injection
- XSS (Cross-site Scripting)
- Command Injection
- Path Traversal
- XXE (XML External Entity)
- LDAP Injection

```typescript
import { validarEntradaSegura } from '@/lib/security/security-logger-middleware'

export async function POST(request: NextRequest, context: AuthContext) {
  // Validar entrada automaticamente
  const validacao = await validarEntradaSegura(request, context.userId)

  if (!validacao.valido) {
    return Response.json({ erro: 'Entrada inválida' }, { status: 400 })
  }

  // Continuar com segurança...
}
```

### `criarHandlerSeguro()` — All-in-one

```typescript
import { criarHandlerSeguro } from '@/lib/security/security-logger-middleware'

export const POST = criarHandlerSeguro(
  async (request) => {
    const dados = await request.json()
    const result = await processarDados(dados)
    return Response.json(result, { status: 201 })
  },
  {
    validarEntrada: true,
    logEvent: 'DATA_MODIFICATION',
    requerAuth: true
  }
)
```

## Configuração de Webhook para Eventos Críticos

```typescript
import { configurarWebhookSeguranca } from '@/lib/security'

// Em middleware.ts ou route initialization
configurarWebhookSeguranca(
  'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
  'seu-secret-opcional',
  ['PERMISSION_DENIED', 'SUSPICIOUS_INPUT', 'RATE_LIMIT_HIT'] // opcional
)
```

Quando um evento crítico é registrado, é enviado POST para o webhook com payload:

```json
{
  "tipo": "SUSPICIOUS_INPUT",
  "timestamp": "2026-03-26T10:30:00Z",
  "userId": "uuid-123",
  "ip": "192.168.1.1",
  "rota": "/api/diplomas",
  "risco": "critico",
  "detalhes": {
    "tipoAtaque": "SQL_INJECTION_OR_XSS",
    "campos": ["nome"]
  }
}
```

## Bancos de Dados e Queries

### Tabela Principal: `security_events`

Estrutura:
```sql
CREATE TABLE security_events (
  id UUID PRIMARY KEY,
  tipo VARCHAR(50),           -- AUTH_SUCCESS, PERMISSION_DENIED, etc.
  timestamp TIMESTAMP,        -- ISO 8601
  usuario_id UUID,           -- Reference to auth.users
  ip INET,                   -- Endereço IP do cliente
  user_agent TEXT,           -- Browser/client info
  rota VARCHAR(255),         -- /api/...
  metodo VARCHAR(10),        -- GET, POST, etc.
  status_code INTEGER,       -- HTTP status
  risco VARCHAR(20),         -- baixo, medio, alto, critico
  detalhes JSONB             -- Dados flexíveis por tipo
)
```

### RPC: Eventos Suspeitos por IP

```typescript
// Detectar IPs com múltiplas falhas
const { data } = await supabase.rpc('analisar_eventos_suspeitos', {
  p_horas: 1,
  p_limite_falhas: 5
})

// Resultado:
// [
//   {
//     ip: '192.168.1.1',
//     total_falhas: 7,
//     tipos_evento: ['AUTH_FAILURE', 'PERMISSION_DENIED'],
//     risco_calculado: 'critico'
//   }
// ]
```

### RPC: Auditoria por Usuário

```typescript
const { data } = await supabase.rpc('auditoria_usuario', {
  p_usuario_id: 'uuid-123',
  p_dias: 7,
  p_limite: 100
})

// Resultado: todos os eventos de um usuário nos últimos 7 dias
```

### RPC: Estatísticas de Segurança

```typescript
const { data } = await supabase.rpc('estatisticas_seguranca', {
  p_horas: 24
})

// Resultado:
// [
//   { tipo: 'AUTH_FAILURE', total: 12, critico: 0, alto: 2, medio: 5, bajo: 5 },
//   { tipo: 'PERMISSION_DENIED', total: 8, critico: 0, alto: 3, ... }
// ]
```

### RPC: Busca Genérica de Eventos

```typescript
const { data } = await supabase.rpc('buscar_eventos_seguranca', {
  p_tipo: 'SUSPICIOUS_INPUT',
  p_risco: 'critico',
  p_usuario_id: 'uuid-123',
  p_desde: '2026-03-20T00:00:00Z',
  p_ate: '2026-03-26T23:59:59Z',
  p_limite: 50
})
```

## Performance e Escalabilidade

### Batch Processing

- Queue automática de eventos
- Flush automático a cada 5 segundos OU 10 eventos
- Máximo de 100 eventos em queue (proteção contra memory leak)
- Retry automático com exponential backoff

### Índices Otimizados

```sql
CREATE INDEX idx_security_events_tipo_timestamp
  ON security_events(tipo, timestamp DESC);

CREATE INDEX idx_security_events_usuario_timestamp
  ON security_events(usuario_id, timestamp DESC);

CREATE INDEX idx_security_events_risco_timestamp
  ON security_events(risco, timestamp DESC)
  WHERE risco IN ('alto', 'critico');

CREATE INDEX idx_security_events_timestamp_brin
  ON security_events USING BRIN(timestamp);
```

### Políticas de Retenção

- Limpeza automática de eventos com > 90 dias
- Função RPC `limpar_security_events_antigos()`
- Pode ser acionada via cron job ou manualmente

```typescript
// Chamar manualmente
const { data } = await supabase.rpc('limpar_security_events_antigos')
console.log(`${data[0]} registros removidos`)
```

## RLS (Row Level Security)

Políticas implementadas:

1. **Admins podem ver todos os eventos**
   ```sql
   SELECT * FROM security_events  -- ✅ Admins
   ```

2. **Usuários podem ver apenas seus próprios eventos**
   ```sql
   SELECT * FROM security_events
   WHERE usuario_id = current_user_id  -- ✅ Usuários
   ```

## Exemplo Completo: Route Handler com Security Logger

```typescript
// app/api/diplomados/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { protegerRota, validarBody, logDataAccess, logDataModification } from '@/lib/security'
import { criarHandlerSeguro } from '@/lib/security/security-logger-middleware'
import { diplomadoSchema } from '@/lib/security/zod-schemas'

// GET — Listar diplomados (com auditoria)
export const GET = protegerRota(async (request: NextRequest, context) => {
  // Validação automática
  const validacao = await validarEntradaSegura(request, context.userId)
  if (!validacao.valido) {
    return Response.json({ erro: 'Entrada inválida' }, { status: 400 })
  }

  // Buscar dados
  const diplomados = await buscarDiplomados({
    usuarioId: context.userId
  })

  // Log de acesso
  logDataAccess(request, context.userId, 'diplomados', 'listagem', diplomados.length)

  return Response.json(diplomados)
})

// POST — Criar diplomado (com logging)
export const POST = criarHandlerSeguro(
  async (request: NextRequest) => {
    // Body já foi validado via middleware
    const novosDados = await request.json()

    // Validar schema
    const resultado = diplomadoSchema.safeParse(novosDados)
    if (!resultado.success) {
      return Response.json(
        { erro: 'Dados inválidos', detalhes: resultado.error },
        { status: 400 }
      )
    }

    // Criar diploma
    const diplomado = await criarDiplomado(resultado.data)

    return Response.json(diplomado, { status: 201 })
  },
  {
    validarEntrada: true,
    logEvent: 'DATA_MODIFICATION',
    requerAuth: true
  }
)
```

## Monitoramento em Tempo Real

### Dashboard (recomendado implementar)

```typescript
// components/admin/SecurityDashboard.tsx

import { supabase } from '@/lib/supabase'

export async function SecurityDashboard() {
  // Eventos críticos nas últimas 24h
  const { data: criticos } = await supabase
    .from('security_events')
    .select('*')
    .eq('risco', 'critico')
    .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('timestamp', { ascending: false })

  // IPs suspeitos
  const { data: ipsuspeitos } = await supabase
    .rpc('analisar_eventos_suspeitos', {
      p_horas: 24,
      p_limite_falhas: 5
    })

  // Estatísticas
  const { data: stats } = await supabase
    .rpc('estatisticas_seguranca', {
      p_horas: 24
    })

  return (
    <div>
      <h1>Dashboard de Segurança</h1>
      {/* Render events, IPs, stats */}
    </div>
  )
}
```

## Boas Práticas

1. **Log sempre após autenticação/autorização**
   - Capture userId quando disponível
   - Use IP para rastrear sessões

2. **Use níveis de risco corretos**
   - `baixo`: operações normais
   - `medio`: falhas de autenticação, rate limits
   - `alto`: modificação de dados, admin actions
   - `critico`: ataques detectados, múltiplas falhas

3. **Flush em Graceful Shutdown**
   ```typescript
   // pages/api/shutdown.ts
   import { flushSecurityEvents } from '@/lib/security'

   process.on('SIGTERM', async () => {
     await flushSecurityEvents()
     process.exit(0)
   })
   ```

4. **Não log de senhas ou tokens**
   - Já está protegido no schema validation
   - Sanitize dados sensíveis manualmente se necessário

5. **Usar Webhook para alertas críticos**
   - Configure Slack/Discord para notificações
   - Monitorar em tempo real padrões suspeitos

## Troubleshooting

### Events não estão sendo salvos
1. Verificar `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`
2. Checar se tabela `security_events` foi criada (migração)
3. Verificar console.error para mensagens de erro

### Performance lenta
1. Aumentar `BATCH_SIZE` em security-logger.ts
2. Aumentar `FLUSH_INTERVAL_MS` (cuidado com memory)
3. Verificar índices em Supabase (Performance tab)
4. Considerar particionamento por mês (para volumes > 1M eventos/mês)

### Webhook não disparando
1. Verificar URL do webhook (acessível externamente)
2. Verificar secret se configurado
3. Confirmar eventos críticos são disparados (risco = 'critico')
4. Checar console.error para erros

## Conclusão

O **Security Logger** fornece visibilidade completa em eventos de segurança da aplicação, permitindo:
- ✅ Auditoria de conformidade MEC
- ✅ Detecção de ataques em tempo real
- ✅ Investigação de incidentes
- ✅ Análise forense de segurança
- ✅ Compliance com LGPD e regulamentações

Integre em suas rotas críticas e monitore regularmente!
