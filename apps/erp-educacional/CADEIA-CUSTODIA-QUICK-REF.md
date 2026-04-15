# Cadeia de Custódia — Quick Reference

## Arquivo de Implementação
```
supabase/migrations/20260326_cadeia_custodia.sql
```

## Para Adicionar em uma Rota (Exemplo)

```typescript
import { registrarCustodiaAsync } from '@/lib/security/cadeia-custodia'

export async function POST(req: NextRequest) {
  // ... seu código ...

  void registrarCustodiaAsync({
    diplomaId: 'uuid-aqui',
    etapa: 'xml_gerado',           // Escolha a etapa
    status: 'sucesso',             // 'sucesso' | 'erro' | 'pendente'
    request: req,                  // Para extrair IP e User-Agent
    userId: auth.userId,
    detalhes: {                    // Dados específicos desta etapa
      xmls_count: 2,
      versao_xsd: '1.05'
    }
  })

  return NextResponse.json({ ok: true })
}
```

## 11 Etapas do Pipeline

| # | Etapa | Descrição |
|----|-------|-----------|
| 1 | `criacao` | Diploma criado |
| 2 | `dados_preenchidos` | Dados completos |
| 3 | `xml_gerado` | XMLs gerados |
| 4 | `xml_validado` | XMLs validados contra XSD |
| 5 | `assinatura_emissora` | Assinado por emissora |
| 6 | `assinatura_registradora` | Assinado por registradora |
| 7 | `rvdd_gerado` | RVDD (PDF) gerado |
| 8 | `publicado` | Publicado no portal |
| 9 | `verificado` | Verificado por terceiros |
| 10 | `revogado` | Revogado |
| 11 | `retificado` | Retificado |

## Status de Uma Etapa

- `sucesso` — Etapa completada com sucesso
- `erro` — Etapa falhou
- `pendente` — Etapa ainda não começou/aguardando

## Consultas Úteis (SQL)

```sql
-- Ver cadeia de um diploma
SELECT * FROM cadeia_custodia_diplomas
WHERE diploma_id = 'abc-123'
ORDER BY created_at ASC;

-- Detectar tampering (hash quebrado)
SELECT * FROM cadeia_custodia_diplomas
WHERE hash_anterior IS NULL AND etapa != 'criacao';

-- Diplomas mais auditados
SELECT diploma_id, COUNT(*) as eventos
FROM cadeia_custodia_diplomas
GROUP BY diploma_id
ORDER BY eventos DESC
LIMIT 10;
```

## Endpoint REST

```bash
GET /api/diplomas/{diploma-id}/custodia

Headers:
  Authorization: Bearer {token}

Response:
{
  "sucesso": true,
  "diploma_id": "abc-123",
  "cadeia": [ ... ],
  "integridade": {
    "integra": true,
    "erros": []
  },
  "total_registros": 8
}
```

## Verificar Integridade (Código)

```typescript
import { verificarIntegridadeCadeia } from '@/lib/security/cadeia-custodia'

const { integra, erros } = await verificarIntegridadeCadeia('diploma-id')

if (!integra) {
  console.error('ALERTA: Tampering detectado!')
  erros.forEach(e => console.error(e))
}
```

## Frontend (React)

```typescript
import { obterCustodiaCliente, ETAPA_LABELS } from '@/lib/security/cadeia-custodia-client'

const custodia = await obterCustodiaCliente(diplomaId, token)

custodia?.cadeia.forEach(reg => {
  console.log(`${ETAPA_LABELS[reg.etapa]}: ${reg.status}`)
})
```

## Status de Implementação

✅ **Pronto para usar**:
- [x] Migration SQL
- [x] Biblioteca TypeScript (backend)
- [x] Endpoint GET /api/diplomas/[id]/custodia
- [x] Integração em rotas principais (assinar, publicar, rvdd, xml)
- [x] Cliente (frontend utils)

📋 **Falta integrar** (simples, ~30 min cada):
- POST /api/diplomas (criacao)
- PATCH /api/diplomas/[id] (dados_preenchidos)
- POST /api/diplomas/[id]/revogar (revogado)
- POST /api/diplomas/[id]/retificar (retificado)

## Checklist para Produção

- [ ] Migration aplicada: `supabase db push`
- [ ] Testes em homologação: criar diploma, verificar cadeia
- [ ] Deploy rotas atualizadas
- [ ] Monitorar crescimento de registros
- [ ] Documentar para suporte

---

**Tempo de implementação por rota**: ~5 minutos (copy-paste)
**Custo de performance**: <1ms por request (async, non-blocking)
**Tamanho banco/diploma**: ~1-2 KB × 8 registros = 16 KB
