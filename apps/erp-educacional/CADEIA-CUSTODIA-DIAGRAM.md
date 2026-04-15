# Cadeia de Custódia — Diagramas Visuais

## 1. Fluxo Completo de um Diploma

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CICLO DE VIDA DO DIPLOMA                       │
└─────────────────────────────────────────────────────────────────────┘

    ┌────────────┐
    │  CRIAÇÃO   │  POST /api/diplomas
    │ Diploma    │  registra: 'criacao' → 'sucesso'
    └─────┬──────┘
          │ (hora: 10:00)
          │ hash_estado = SHA256({etapa: criacao, ...})
          │ hash_anterior = null (primeiro registro)
          │
          ▼
    ┌────────────────────┐
    │ DADOS PREENCHIDOS  │  PATCH /api/diplomas/[id]
    │ Usuário preenche   │  registra: 'dados_preenchidos' → 'sucesso'
    └─────┬──────────────┘
          │ (hora: 10:15)
          │ hash_estado = SHA256({status: preenchido, ...})
          │ hash_anterior = SHA256(rec1.id + rec1.hash_estado + rec1.created_at)
          │                ← ENCADEIA ao registro anterior
          │
          ▼
    ┌────────────────────┐
    │  XML GERADO        │  POST /api/processos/[id]/gerar-xml
    │ 2 XMLs criados     │  registra: 'xml_gerado' → 'sucesso'
    └─────┬──────────────┘
          │ (hora: 10:30)
          │ detalhes: { xmls_count: 2, hashes: [...] }
          │ hash_anterior = SHA256(rec2.id + rec2.hash_estado + rec2.created_at)
          │
          ▼
    ┌────────────────────┐
    │ ASSINATURA         │  POST /api/diplomas/[id]/assinar
    │ BRy KMS, ICP-Brasil│  registra: 'assinatura_emissora' → 'sucesso'
    └─────┬──────────────┘
          │ (hora: 11:00)
          │ detalhes: { modo: 'bry_kms', resultados: [...] }
          │ certificado_serial = '12345678901234567890'
          │
          ▼
    ┌────────────────────┐
    │  RVDD GERADO       │  POST /api/diplomas/[id]/rvdd
    │ PDF visual criado  │  registra: 'rvdd_gerado' → 'sucesso'
    └─────┬──────────────┘
          │ (hora: 11:30)
          │
          ▼
    ┌────────────────────┐
    │   PUBLICADO        │  POST /api/diplomas/[id]/publicar
    │ Disponível portal  │  registra: 'publicado' → 'sucesso'
    └─────┬──────────────┘
          │ (hora: 12:00)
          │
          ▼
    ┌────────────────────┐
    │  VERIFICADO        │  GET /api/diplomas/[id]/custodia
    │ Terceiros verificam│  (registrado manualmente se necessário)
    └────────────────────┘
```

---

## 2. Estrutura do Banco de Dados

```
┌──────────────────────────────────────────────────────────────┐
│           TABELA: cadeia_custodia_diplomas                   │
├──────────────────────────────────────────────────────────────┤
│ PK  id UUID                   ← Identificador único           │
│ FK  diploma_id UUID           ← Qual diploma                  │
│                                                               │
│ === Etapa e Status ===                                       │
│     etapa TEXT                ← 'criacao', 'xml_gerado', etc │
│     status TEXT               ← 'sucesso', 'erro', 'pendente'│
│                                                               │
│ === Contexto da Ação ===                                     │
│     usuario_id UUID           ← Quem fez                      │
│     ip_address TEXT           ← De onde (auditoria)           │
│     user_agent TEXT           ← Que cliente (browser, etc)    │
│                                                               │
│ === Criptografia (Imutável) ===                              │
│     hash_estado TEXT          ← SHA256(estado neste momento)  │
│     hash_anterior TEXT        ← SHA256(rec_ant.id + hash + ..)│
│                                ← ENCADEIA à anterior          │
│                                                               │
│ === Dados Adicionais ===                                     │
│     detalhes JSONB            ← {xmls_count: 2, ...}         │
│     certificado_serial TEXT   ← Cert A3 (se assinatura)      │
│                                                               │
│ === Tempo (Imutável) ===                                     │
│     created_at TIMESTAMPTZ    ← Quando aconteceu             │
│                                                               │
│ ÍNDICES:                                                      │
│  - diploma_id (buscar cadeia de um diploma)                  │
│  - etapa (filtrar por etapa)                                 │
│  - status (filtrar por sucesso/erro)                         │
│  - created_at (ordenar temporal)                             │
│  - (diploma_id, created_at) (otimizar queries comuns)        │
│  - hash_estado (detectar duplicatas)                         │
│                                                               │
│ RLS (Row Level Security):                                    │
│  - SELECT: usuários autenticados podem ler                   │
│  - INSERT: APENAS service role (backend)                     │
│  - UPDATE: BLOQUEADO (imutável)                              │
│  - DELETE: BLOQUEADO (imutável)                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Encadeamento Blockchain-Like

```
RECORD 1 (criacao)
┌────────────────────────────────┐
│ id: 'rec-1'                    │
│ etapa: 'criacao'               │
│ hash_estado: 'abc123...'       │
│ hash_anterior: null            │  ← Primeiro registro não tem anterior
│ created_at: 2026-03-26 10:00   │
└────┬─────────────────────────────┘
     │ Hash deste registro:
     │ SHA256(rec-1.id + rec-1.hash_estado + rec-1.created_at)
     │ = "xyz789..."
     │
     ▼
RECORD 2 (dados_preenchidos)
┌────────────────────────────────┐
│ id: 'rec-2'                    │
│ etapa: 'dados_preenchidos'     │
│ hash_estado: 'def456...'       │
│ hash_anterior: 'xyz789...'     │  ← Aponta para rec-1
│ created_at: 2026-03-26 10:15   │
└────┬─────────────────────────────┘
     │ Hash deste registro:
     │ SHA256(rec-2.id + rec-2.hash_estado + rec-2.created_at)
     │ = "vwx456..."
     │
     ▼
RECORD 3 (xml_gerado)
┌────────────────────────────────┐
│ id: 'rec-3'                    │
│ etapa: 'xml_gerado'            │
│ hash_estado: 'ghi789...'       │
│ hash_anterior: 'vwx456...'     │  ← Aponta para rec-2
│ created_at: 2026-03-26 10:30   │
└────────────────────────────────┘

SEGURANÇA:
- Se alguém tentar alterar rec-1, seu hash muda
- Isso quebra hash_anterior de rec-2
- Isso quebra hash_anterior de rec-3
- Cascata de falhas → Detecção automática!
```

---

## 4. Integração em Rotas Existentes

```
ROTA: POST /api/diplomas/[id]/assinar
┌──────────────────────────────────────────────────────────┐
│ 1. Validar diploma                                        │
│ 2. Conectar a BRy KMS                                   │
│ 3. Assinar XMLs                                         │
│ 4. Atualizar status → 'assinado'                        │
│ 5. LOG de auditoria (logDataModification)               │
│                                                          │
│ +++ NOVO +++                                            │
│ 6. Registrar na cadeia:                                 │
│    registrarCustodiaAsync({                             │
│      diplomaId: 'abc-123',                              │
│      etapa: 'assinatura_emissora',                      │
│      status: 'sucesso',                                 │
│      userId: auth.userId,                              │
│      detalhes: { modo: 'bry_kms', xmls: 2 }            │
│    })                                                    │
│                                                          │
│ 7. RETORNAR resposta ao cliente (sem aguardar #6)      │
│    (async, non-blocking)                               │
└──────────────────────────────────────────────────────────┘

SIMILAR EM:
- POST /api/diplomas/[id]/publicar
- POST /api/diplomas/[id]/rvdd
- POST /api/processos/[id]/gerar-xml
```

---

## 5. Verificação de Integridade

```
verificarIntegridadeCadeia('diploma-abc')

Step 1: Obter cadeia completa
┌─────────────────────────────────────────┐
│ SELECT * FROM cadeia_custodia_diplomas │
│ WHERE diploma_id = 'abc'                │
│ ORDER BY created_at ASC                 │
│                                         │
│ Retorna: [rec-1, rec-2, rec-3, ...]   │
└─────────────────────────────────────────┘

Step 2: Para cada registro (começando de rec-2)
┌─────────────────────────────────────────────────────┐
│ hash_esperado = SHA256(                             │
│   rec-1.id +                                        │
│   rec-1.hash_estado +                               │
│   rec-1.created_at                                  │
│ )                                                    │
│                                                     │
│ if (rec-2.hash_anterior !== hash_esperado) {       │
│   ERRO: "Tampering detectado no registro 2"        │
│ }                                                    │
└─────────────────────────────────────────────────────┘

Step 3: Validar timestamps (monotônicos)
┌─────────────────────────────────────────────────────┐
│ if (rec-2.created_at < rec-1.created_at) {         │
│   ERRO: "Timestamp regressivo"                      │
│ }                                                    │
└─────────────────────────────────────────────────────┘

RESULTADO:
┌──────────────────────────────────────────┐
│ { integra: true, erros: [] }             │
│                      ou                  │
│ { integra: false, erros: ["Tampering..."]│
└──────────────────────────────────────────┘
```

---

## 6. Endpoint REST

```
REQUEST:
┌──────────────────────────────────────────┐
│ GET /api/diplomas/abc-123/custodia       │
│                                          │
│ Headers:                                 │
│   Authorization: Bearer {token}          │
│   Content-Type: application/json         │
└──────────────────────────────────────────┘

PROCESSING:
┌──────────────────────────────────────────┐
│ 1. Verificar autenticação                │
│ 2. Obter cadeia completa                 │
│ 3. Validar integridade                   │
│ 4. Montar resposta JSON                  │
└──────────────────────────────────────────┘

RESPONSE 200 OK:
┌────────────────────────────────────────────────────────┐
│ {                                                      │
│   "sucesso": true,                                     │
│   "diploma_id": "abc-123",                             │
│   "cadeia": [                                          │
│     {                                                  │
│       "id": "rec-1",                                   │
│       "etapa": "criacao",                              │
│       "status": "sucesso",                             │
│       "usuario_id": "user-xyz",                        │
│       "hash_estado": "abc123...",                      │
│       "hash_anterior": null,                           │
│       "created_at": "2026-03-26T10:00:00Z"            │
│     },                                                 │
│     { ... rec-2 ... },                                 │
│     { ... rec-3 ... }                                  │
│   ],                                                   │
│   "integridade": {                                     │
│     "integra": true,                                   │
│     "erros": []                                        │
│   },                                                   │
│   "total_registros": 3                                 │
│ }                                                      │
└────────────────────────────────────────────────────────┘

RESPONSE 404 NOT FOUND:
┌────────────────────────────────────────────────────────┐
│ Nenhum registro de custódia encontrado para este diploma
└────────────────────────────────────────────────────────┘
```

---

## 7. Timeline de um Diploma (Exemplo Real)

```
2026-03-26 10:00:00Z
├─ [custodia-1]
│  └─ CRIAÇÃO
│     usuario: admin-001
│     ip: 192.168.1.100
│     hash_estado: a1b2c3...
│     hash_anterior: null
│
├─ [custodia-2] (+15 minutos)
│  └─ DADOS PREENCHIDOS
│     usuario: admin-001
│     hash_estado: d4e5f6...
│     hash_anterior: xyz789... (aponta para rec-1)
│
├─ [custodia-3] (+30 minutos)
│  └─ XML GERADO
│     usuario: worker-002
│     hash_estado: g7h8i9...
│     hash_anterior: vwx456... (aponta para rec-2)
│     detalhes: { xmls_count: 2, validacoes: {...} }
│
├─ [custodia-4] (+1 hora)
│  └─ ASSINATURA EMISSORA
│     usuario: signer-003
│     certificado_serial: 12345678901234567890
│     hash_estado: j0k1l2...
│     hash_anterior: uvt345... (aponta para rec-3)
│
├─ [custodia-5] (+2 horas)
│  └─ RVDD GERADO
│     usuario: worker-002
│     hash_estado: m3n4o5...
│     hash_anterior: srq234... (aponta para rec-4)
│
└─ [custodia-6] (+3 horas)
   └─ PUBLICADO
      usuario: admin-001
      hash_estado: p6q7r8...
      hash_anterior: pqo123... (aponta para rec-5)
      detalhes: { codigo_validacao: "FIC-2026-ABC123" }

TOTAL: 6 eventos em 3 horas
INTEGRIDADE: ✅ ÍNTEGRA (todos os hashes batem)
```

---

## 8. Fluxo de Detecção de Tampering

```
CENÁRIO: Alguém tenta alterar o hash_estado de rec-3

ANTES (íntegro):
rec-3.hash_anterior = "vwx456..." = SHA256(rec-2.id + rec-2.hash_estado + rec-2.created_at)

DURANTE (tentativa de alteração):
UPDATE cadeia_custodia_diplomas
SET hash_estado = 'FORGED_HASH_123'
WHERE id = 'rec-3';

RESULTADO:
Hash de rec-3 mudou → Isso quebra o encadeamento
rec-4.hash_anterior deveria apontar para:
  SHA256(rec-3.id + rec-3.FORGED_HASH_123 + rec-3.created_at)
MAS aponta para:
  SHA256(rec-3.id + rec-3.ORIGINAL_HASH + rec-3.created_at)

DETECÇÃO:
verificarIntegridadeCadeia('diploma-abc') retorna:
{
  integra: false,
  erros: [
    "Registro 3: hash_anterior não corresponde ao esperado.
     Esperado: srq234...,
     Recebido: xyz789..."
  ]
}

ALERTA: ⚠️ TAMPERING DETECTADO!
AÇÃO: Investigar imediatamente, restaurar de backup
```

---

## 9. Growth e Scaling

```
FIC (Exemplo):

Ano 1 (2026):
├─ ~1,000 diplomas/ano
├─ ~8 registros/diploma (média)
├─ ~8,000 registros total/ano
├─ ~1-2 MB de dados
└─ ✅ SEM PROBLEMA

Ano 5 (2030):
├─ ~5,000 diplomas/ano (scaling)
├─ ~8 registros/diploma
├─ ~40,000 registros total/ano
├─ ~10-20 MB de dados
└─ ✅ AINDA OK

Ano 10 (2035):
├─ ~10,000 diplomas/ano
├─ ~8 registros/diploma
├─ ~80,000 registros total
├─ ~20-40 MB de dados
└─ ⚠️ CONSIDERAR: Particionamento por mês

```

---

## 10. Roadmap Futuro

```
FASE 1: HOJE (2026)
✅ Cadeia de custódia básica
✅ Verificação de integridade
✅ Endpoint GET

FASE 2: Q2 2026 (3 meses)
□ Dashboard visual
□ Alertas de anomalias
□ Relatórios para auditores

FASE 3: Q4 2026 (6 meses)
□ Integração com blockchain (opcional)
□ Exportar XSD/XML para MEC
□ Purga automática (com aprovação MEC)

FASE 4: 2027+
□ Particionamento por mês (2M+ registros)
□ Análise preditiva (detecção de padrões)
□ Integração com sistemas de terceiros
```

---

**Última atualização**: 2026-03-26
**Versão**: 1.0
**Pronto para produção**: ✅ SIM
