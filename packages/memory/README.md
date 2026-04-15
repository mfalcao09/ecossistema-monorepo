# @ecossistema/memory

Cliente canônico do `ecosystem_memory` no Supabase ECOSYSTEM. Implementa Art. XXII (Aprendizado é Infraestrutura) — **nada se perde**.

## Status

**STUB** — implementação completa é responsabilidade da **Sessão A** (ver `docs/sessions/BRIEFING-SESSAO-A-memory.md`).

## API planejada

```ts
import { saveMemory, searchMemory, bootstrapSession } from '@ecossistema/memory';

await saveMemory({
  type: 'decision',
  title: 'Aprovamos monorepo V4',
  content: '...',
  project: 'ecosystem',
  actor: 'claudinho',
  sessionId: 'sess-042'
});

const related = await searchMemory('emissão de boleto FIC', { project: 'erp-fic', limit: 5 });

const context = await bootstrapSession('continuar implementação da régua de cobrança', 'erp-fic', 10);
```
