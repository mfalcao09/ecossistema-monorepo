# @ecossistema/observability

Wrapper **Langfuse** + **OTel** para o Ecossistema — correlation ID com AsyncLocalStorage, traces por negócio, instrumentação automática de tools e agentes.

## Instalação

```bash
pnpm add @ecossistema/observability
# OTel é opcional:
pnpm add @opentelemetry/api @opentelemetry/sdk-node
```

## Uso básico

```typescript
import { ObservabilityClient } from '@ecossistema/observability';

const obs = new ObservabilityClient({
  langfuse: {
    baseUrl: process.env.LANGFUSE_HOST!,
    publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
    secretKey: process.env.LANGFUSE_SECRET_KEY!,
  },
  businessId: 'fic',
  service: 'cfo-fic',
});

const trace = obs.trace({
  name: 'regua-cobranca-execution',
  user_id: 'marcelo',
  session_id: crypto.randomUUID(),
});

const span = trace.span({ name: 'check_inadimplentes', input: { date: '2026-04' } });
const result = await checkInadimplentes();
span.end({ output: result, success: true });

const gen = trace.generation({ name: 'agent-reasoning', model: 'sonnet-4-6', input: messages });
const llmResult = await llm.complete(...);
gen.end({ output: llmResult.content, usage: llmResult.usage });

trace.score({ name: 'task_success', value: 1.0 });
trace.end();
```

## Correlation ID (propagação automática)

```typescript
import { withCorrelationId, getCorrelationId, extractFromHeaders } from '@ecossistema/observability';

// Extrair do header HTTP
app.use((req, res, next) => {
  const id = extractFromHeaders(req.headers) ?? crypto.randomUUID();
  withCorrelationId(id, () => next());
});

// Acessar em qualquer ponto da cadeia async
console.log(getCorrelationId()); // 'req-abc-123'
```

## OTel bridge

```typescript
import { instrumentFn } from '@ecossistema/observability/otel';

const emitBoleto = instrumentFn('emit_boleto', async (args) => {
  // sua lógica aqui
  return result;
});
```

## Instrumentação automática

```typescript
import { instrumentTool, instrumentAgent } from '@ecossistema/observability';

// Wrap uma tool com spans automáticos
const trackedTool = instrumentTool('check_inadimplentes', checkInadimplentes, trace);

// Wrap um agente com trace + correlation ID automático
const trackedAgent = instrumentAgent(
  { agentName: 'cfo-fic', observability: obs },
  cfoAgent,
);
```

## Propagação `correlation_id`

Cada trace registra `correlation_id` no Langfuse. O mesmo ID deve ser propagado para:
- Header `X-Correlation-ID` em chamadas HTTP
- Campo `metadata.correlation_id` em audit_log
- Campo `metadata.correlation_id` em Memory
- Callback LiteLLM (via metadata)

Resultado: **1 correlation_id liga audit_log + Langfuse + logs LiteLLM**.
