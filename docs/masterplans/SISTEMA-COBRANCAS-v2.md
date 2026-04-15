# Sistema de Cobranças FIC — Plano v2
**Versão:** 2.0  
**Criado em:** 12/04/2026  
**Histórico:** v1.0 usava Asaas como gateway → v2.0 migra para Banco Inter (Bolepix)  
**Projeto:** MASTERPLAN-FIC-MULTIAGENTES-v1 — Entregável E1  
**Status:** 📋 Planejamento — aguardando decisão do canal WhatsApp  

---

## 1. Visão Geral

Sistema autônomo de cobrança mensal para alunos da FIC, cobrindo três fluxos:

| Fluxo | Nome | Gatilho | Autonomia |
|-------|------|---------|-----------|
| **F1** | Emissão e Envio Mensal | Cron — dia 20, 9h | ✅ Automático |
| **F2** | Confirmação de Pagamento | Webhook do Banco Inter | ✅ Automático |
| **F3** | Verificação de Comprovante | Aluno envia no WhatsApp | ✅ Automático (com re-verificação) |

**Princípio central:** nenhuma confirmação de pagamento é enviada ao aluno antes da baixa real no sistema Inter.

---

## 2. Stack Tecnológico

| Componente | Tecnologia | Justificativa |
|-----------|-----------|--------------|
| **Gateway de pagamento** | Banco Inter | Plano já negociado, Bolepix nativo, SDK Python oficial |
| **Formato de cobrança** | Bolepix | Boleto + QR Code PIX em um único PDF |
| **Banco de dados** | Supabase (ERP-Educacional) | Fonte única de verdade da FIC |
| **Hosting dos endpoints** | Vercel Functions | Já no ecossistema, sem servidor |
| **Agendamento** | Trigger.dev | Cron + delayed jobs |
| **Canal WhatsApp** | ⚠️ Em aberto — ver Seção 3 | — |
| **OCR de comprovantes** | Claude Vision API | Leitura de imagens de comprovantes |
| **SDK Inter** | `inter-co/pj-sdk-python` | Oficial, mantido pelo banco |
| **Monitoramento** | Sentry | Já configurado no ecossistema |

---

## 3. ⚠️ DECISÃO EM ABERTO — Canal WhatsApp

Esta é a única decisão pendente antes de iniciar a Fase B. O canal WhatsApp é usado nos 3 fluxos para comunicação com alunos.

### Opções Mapeadas

| Opção | Tipo | Custo estimado | Prós | Contras |
|-------|------|----------------|------|---------|
| **Meta Business API** ⭐ | Oficial Meta (direto) | Gratuito até 1.000 conv./mês + custo por conversa após isso | **Marcelo já possui acesso.** Oficial, sem intermediário, sem mensalidade de BSP, webhooks nativos, envio de PDFs, máxima confiabilidade | Requer número dedicado, aprovação de templates (~1–2 dias), configuração via Meta Business Suite |
| **Z-API** | Semi-oficial | ~R$70–150/mês | Popular no Brasil, fácil integração, webhook nativo, suporte ativo | Não é API oficial Meta — risco de bloqueio de conta |
| **Evolution API** | Open source | Gratuito + infra (~R$30/mês VPS) | Controle total, auto-hospedado, comunidade ativa | Requer servidor próprio, manutenção |
| **360Dialog** | Oficial Meta (BSP) | ~R$150–400/mês + por mensagem | Oficial, estável, templates aprovados | Mais caro, processo de aprovação de templates |
| **Twilio WhatsApp** | Oficial Meta | ~$0.05–0.08/msg | Enterprise, confiável, bem documentado | Mais caro em volume, burocracia de aprovação |
| **Nexvy** 🔮 | Próprio (futuro) | — | Integração total, marca própria, sem custo de terceiros | Ainda em desenvolvimento |

### Sobre a Meta Business API (WhatsApp Cloud API)

Marcelo já tem acesso à API oficial da Meta — o que elimina a necessidade de um BSP (Business Solution Provider) como 360Dialog ou Twilio. Na prática, isso significa:

- **Custo:** gratuito para as primeiras 1.000 conversas/mês iniciadas pelo usuário; conversas iniciadas pelo negócio (como envio de boleto) têm custo por conversa (~R$0,30–0,60/conversa no Brasil — escala com volume)
- **Integração:** REST API direta. Você recebe um `PHONE_NUMBER_ID` e um `WHATSAPP_BUSINESS_ACCOUNT_ID` no Meta for Developers, e usa o token para enviar mensagens via `POST https://graph.facebook.com/v19.0/{phone_number_id}/messages`
- **Webhooks:** nativo — o Meta envia eventos de entrega, leitura e resposta do usuário para um endpoint seu (exatamente o `/api/whatsapp-webhook` do plano)
- **Templates:** necessário aprovar os templates de cobrança no Meta Business Suite (processo de 1–2 dias para templates simples)
- **PDF:** suporte nativo a envio de documentos (o bolepix em PDF é enviado como `type: "document"`)

```
Exemplo de chamada — envio de PDF (bolepix):
POST /v19.0/{phone_number_id}/messages
{
  "messaging_product": "whatsapp",
  "to": "5567999990000",
  "type": "document",
  "document": {
    "link": "https://supabase.../bolepix-FIC-001-2025-05.pdf",
    "caption": "Mensalidade FIC — Maio/2025 | Venc. 10/05"
  }
}
```

### Critérios para Decisão

- **Volume:** quantos alunos ativos? (define custo por mensagem)
- **Templates:** cobranças precisam de template aprovado pela Meta (regra das APIs oficiais)
- **Urgência:** Z-API é mais rápido para começar; APIs oficiais levam dias para aprovar templates
- **Risco:** conta WhatsApp Business pode ser banida com APIs não-oficiais em uso intenso

### Recomendação Condicional

- Se Marcelo **já tem a API da Meta configurada e ativa:** usar diretamente — é a melhor opção (sem BSP, sem mensalidade, totalmente oficial)
- Se quiser **começar mais rápido** (enquanto aprova templates na Meta): Z-API provisoriamente
- Quando **Nexvy estiver pronto:** migrar para lá — elimina custo de terceiros

**→ Decisão de Marcelo necessária antes de iniciar Fase B. Forte candidata: Meta Business API direta.**

---

## 4. O Banco Inter — Detalhes Técnicos

### Autenticação OAuth 2.0 + mTLS (feita uma vez)

```
1. Inter Empresas → painel de desenvolvedores → criar integração
2. Definir escopos:
   • cobranças.read   → consultar boletos
   • cobranças.write  → emitir e cancelar
   • webhook.read     → consultar webhooks
   • webhook.write    → configurar webhooks
3. Baixar: certificado.crt + chave.key
4. Guardar com segurança (nunca commitar no Git)
5. Configurar no ambiente Vercel como variáveis de ambiente
```

### O Bolepix — O que é

O Inter emite um único PDF com boleto e PIX integrados. O aluno vê:

```
┌─────────────────────────────────────────┐
│  BOLEPIX — FIC / Banco Inter            │
│                                         │
│  Valor: R$ 850,00                       │
│  Vencimento: 10/05/2025                 │
│                                         │
│  ████ QR CODE PIX ████   ← paga na hora │
│                                         │
│  Linha digitável: 00190.00009...        │
│  ─────────────────────────────          │
│  |||||||||||||||||||||||||||||||         │
└─────────────────────────────────────────┘
```

O aluno escolhe: paga pelo PIX (instantâneo) ou pelo boleto (até 3 dias úteis). Um único documento cobre os dois.

### SDK Python — Métodos Principais

```python
from inter_sdk_python import InterSdk

sdk = InterSdk()
sdk.set_environment("PRODUCTION")   # ou "SANDBOX"
sdk.set_account("12345678")         # conta Inter PJ
sdk.set_certificate("cert.crt")
sdk.set_key("chave.key")

# Emitir bolepix
sdk.billing.issue_billing(cobranca)          # → request_code

# Buscar PDF
sdk.billing.retrieve_billing_pdf(code, path) # → arquivo .pdf

# Consultar status
sdk.billing.retrieve_billing(code)           # → situation, valor_recebido

# Cancelar
sdk.billing.cancel_billing(code, motivo)

# Configurar webhook (uma vez)
sdk.billing.include_webhook("https://app.vercel.app/api/payment-webhook")
```

---

## 5. Fluxo 1 — Emissão e Envio Mensal

### Diagrama

```
TRIGGER.DEV (dia 20, 9h)
    ↓
Vercel Function: /api/emit-boletos
    ↓
Consulta Supabase → lista alunos ativos + valores da mensalidade
    ↓
Para cada aluno:
  → Inter SDK: issue_billing() → inter_request_code
  → Inter SDK: retrieve_billing_pdf() → PDF do bolepix
  → Supabase Storage: upload PDF → URL pública
  → Supabase: INSERT cobranca (status: "gerado")
  → Canal WhatsApp: envia PDF + linha digitável + PIX copia-e-cola
  → Email: envia boleto (backup)
  → Supabase: UPDATE cobranca (status: "enviado")
```

### Campos da Requisição Inter (BillingIssueRequest)

```python
cobranca = BillingIssueRequest(
    your_number   = f"FIC-{aluno_id}-{ano}-{mes}",  # seu ID único rastreável
    nominal_value = Decimal("850.00"),
    due_date      = "2025-05-10",                    # YYYY-MM-DD
    payer         = Person(
        cpf_cnpj    = "123.456.789-00",
        person_type = "FISICA",
        name        = "João da Silva",
        address     = "Rua das Flores, 123",
        city        = "Cassilândia",
        state       = "MS",
        zip_code    = "79540-000",
        email       = "joao@email.com",
        area_code   = "67",
        phone       = "999999999"
    ),
    fine = Fine(rate=Decimal("2.00")),       # 2% de multa por atraso
    mora = Mora(rate=Decimal("0.033")),      # ~1% de juros/mês
    message = "Mensalidade FIC — Maio/2025. Em caso de dúvidas: (67) 3xxx-xxxx"
)
```

---

## 6. Fluxo 2 — Confirmação Automática de Pagamento

### Diagrama

```
Aluno paga (PIX ou Boleto)
    ↓
Banco Inter detecta pagamento
    ↓
POST → Vercel Function: /api/payment-webhook
    ↓
Extrai payload Inter (BillingPayload)
    ↓
Verifica idempotência: cobranca já marcada como "pago"?
    ├── SIM → ignora (evita notificação duplicada)
    └── NÃO → continua
           ↓
       Atualiza Supabase: status = "pago", data_pagamento, forma_pagamento
           ↓
       Busca dados do aluno (nome, telefone)
           ↓
       Canal WhatsApp: envia mensagem de confirmação
           ↓
       Registra em `comunicacoes`
```

### Payload do Webhook Inter (campos reais)

```json
{
  "payload": [{
    "requestCode":         "abc123-def456",
    "yourNumber":          "FIC-aluno789-2025-05",
    "situation":           "RECEBIDO",
    "statusDateTime":      "2025-05-08T14:31:45",
    "totalAmountReceived": 850.00,
    "receivingOrigin":     "PIX",
    "txid":                "E12345678202505...",
    "pixCopyAndPaste":     "00020126..."
  }]
}
```

**Campo `situation`:**
| Valor | Ação |
|-------|------|
| `RECEBIDO` | ✅ Confirmar pagamento — disparar WhatsApp |
| `EXPIRADO` | ⚠️ Registrar vencimento — opcional: avisar coordenação |
| `CANCELADO` | 📋 Registrar cancelamento |
| `A_RECEBER` | ⏳ Ignorar — ainda pendente |

**Campo `receivingOrigin`:** `PIX` ou `BOLETO` — usado na mensagem de confirmação.

---

## 7. Fluxo 3 — Verificação de Comprovante

### Diagrama

```
Aluno envia comprovante no WhatsApp (imagem ou texto)
    ↓
Canal WhatsApp recebe → webhook → Vercel Function: /api/whatsapp-webhook
    ↓
Identifica aluno pelo número de telefone (Supabase)
    ↓
Extrai dados do comprovante:
  • Texto → lê diretamente
  • Imagem → Claude Vision API (OCR)
    ↓
Consulta Inter: sdk.billing.retrieve_billing(request_code)
    ↓
         ↓                    ↓                      ↓
   situation =          situation =            Não encontrado
   "RECEBIDO"          "A_RECEBER"
         ↓                    ↓                      ↓
  Atualiza Supabase    WhatsApp:              WhatsApp:
  status = "pago"      "Aguardando..."        "Não localizamos.
  WhatsApp:            Trigger.dev:            Fale com a
  "✅ Confirmado!"      delayed 2h              secretaria."
                             ↓
                       Re-verifica em 2h
                       → ✅ ou ❌
```

### Lógica de Re-verificação (Trigger.dev Delayed Job)

```python
# Agenda re-verificação 2 horas depois
trigger_dev.schedule_delayed(
    function = "verificar_pagamento_inter",
    payload  = {"request_code": code, "aluno_id": aluno_id, "tentativa": 2},
    delay    = "2h"
)

# Máximo de tentativas: 3 (2h, 6h, 24h)
# Após 3 tentativas sem confirmação → encaminha para secretaria
```

---

## 8. Modelo de Dados (Supabase)

### Tabela `cobrancas`

```sql
CREATE TABLE cobrancas (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id             UUID REFERENCES alunos(id),

  -- Identificadores Inter
  inter_request_code   TEXT UNIQUE,     -- ID gerado pelo Inter (chave do webhook)
  your_number          TEXT UNIQUE,     -- "FIC-{aluno_id}-{ano}-{mes}" (seu ID)

  -- Dados da cobrança
  valor                DECIMAL(10,2)    NOT NULL,
  mes_referencia       DATE             NOT NULL,   -- 2025-05-01 = maio/2025
  data_vencimento      DATE             NOT NULL,

  -- Status
  status               TEXT NOT NULL DEFAULT 'gerado'
                        CHECK (status IN ('gerado','enviado','pago','vencido','cancelado')),
  data_pagamento       TIMESTAMP,
  forma_pagamento      TEXT,            -- 'PIX' | 'BOLETO'
  valor_recebido       DECIMAL(10,2),   -- pode diferir do nominal (descontos/juros)
  txid_pix             TEXT,            -- ID da transação PIX (quando aplicável)

  -- Acesso ao documento
  bolepix_pdf_url      TEXT,            -- URL do PDF no Supabase Storage
  bolepix_linha_dig    TEXT,            -- linha digitável (para WhatsApp)
  bolepix_pix_copia    TEXT,            -- PIX copia e cola

  -- Comprovante manual (Fluxo 3)
  comprovante_recebido    BOOLEAN DEFAULT FALSE,
  comprovante_verificado  BOOLEAN DEFAULT FALSE,

  -- Controle
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_cobrancas_aluno     ON cobrancas(aluno_id);
CREATE INDEX idx_cobrancas_status    ON cobrancas(status);
CREATE INDEX idx_cobrancas_referencia ON cobrancas(mes_referencia);
```

### Tabela `comunicacoes`

```sql
CREATE TABLE comunicacoes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id     UUID REFERENCES alunos(id),
  cobranca_id  UUID REFERENCES cobrancas(id),

  tipo    TEXT NOT NULL,  -- 'envio_boleto' | 'confirmacao' | 'lembrete' | 'comprovante_recebido'
  canal   TEXT NOT NULL,  -- 'whatsapp' | 'email'
  status  TEXT NOT NULL,  -- 'enviado' | 'entregue' | 'falhou'
  conteudo    TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

### Tabela `comprovantes_recebidos`

```sql
CREATE TABLE comprovantes_recebidos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id      UUID REFERENCES alunos(id),
  cobranca_id   UUID REFERENCES cobrancas(id),

  tipo_arquivo  TEXT,     -- 'imagem' | 'texto' | 'pdf'
  conteudo_raw  TEXT,     -- texto extraído pelo Claude Vision ou direto

  -- Resultado da verificação Inter
  verificado        BOOLEAN DEFAULT FALSE,
  resultado         TEXT,     -- 'confirmado' | 'pendente' | 'nao_encontrado'
  tentativas        INT DEFAULT 1,
  proxima_tentativa TIMESTAMP,

  created_at  TIMESTAMP DEFAULT NOW()
);
```

---

## 9. Endpoints da API (Vercel Functions)

| Endpoint | Chamado por | Função |
|----------|------------|--------|
| `POST /api/emit-boletos` | Trigger.dev (cron) | Gera e envia todos os boletos do mês |
| `POST /api/payment-webhook` | Banco Inter | Recebe confirmação de pagamento |
| `POST /api/whatsapp-webhook` | Canal WhatsApp | Recebe mensagens dos alunos |

---

## 10. Templates de Mensagens WhatsApp

### Envio do Bolepix (Fluxo 1)
```
🎓 *FIC — Faculdades Integradas de Cassilândia*

Olá, [Nome]! 👋

Sua mensalidade de *[Mês/Ano]* está disponível.

💰 *Valor:* R$ [valor]
📅 *Vencimento:* [data]

*Pague via PIX (instantâneo):*
[chave PIX copia-e-cola]

*Ou via Boleto:*
`[linha digitável]`
📄 PDF completo: [link]

Dúvidas? Responda aqui. ✉️
_FIC — 44 anos formando profissionais_
```

### Confirmação de Pagamento (Fluxo 2)
```
✅ *Pagamento Confirmado!*

Olá, [Nome]!

Recebemos seu pagamento:
📋 *Referência:* [Mês/Ano]
💰 *Valor:* R$ [valor_recebido]
📅 *Data:* [data]
🔑 *Forma:* [PIX / Boleto]

Guarde esta mensagem como comprovante. 🗂️

_FIC — 44 anos formando profissionais_ 🎓
```

### Aguardando Processamento (Fluxo 3 — pendente)
```
⏳ *Comprovante Recebido!*

Olá, [Nome]! Recebemos seu comprovante.

Seu pagamento ainda está sendo processado.
Verificaremos novamente em *2 horas* e avisamos aqui. 👍

Não precisa fazer nada agora.
```

### Pagamento Não Localizado (Fluxo 3 — não encontrado)
```
⚠️ *Pagamento Não Localizado*

Olá, [Nome]. Recebemos seu comprovante, mas não
encontramos a confirmação no sistema após [X] tentativas.

Por favor, entre em contato com a secretaria:
📞 [(DDD) telefone]
📧 [email]
🕐 [horário de atendimento]

Guarde o comprovante original. 🗂️
```

### Lembrete de Vencimento (D-3 e D-1) — opcional, Fase futura
```
⚠️ *Lembrete FIC — Mensalidade Vencendo*

Olá, [Nome]!

Sua mensalidade de [Mês/Ano] vence em *[X] dia(s)*.

💰 Valor: R$ [valor]
📅 Vencimento: [data]

[linha digitável]
📄 PDF: [link]

_FIC — 44 anos formando profissionais_
```

---

## 11. Segurança

| Ponto | Implementação |
|-------|--------------|
| **Autenticação webhook Inter** | Verificar header de autorização enviado pelo Inter em cada POST |
| **Idempotência** | Checar `status == "pago"` no Supabase antes de processar webhook |
| **Certificados Inter** | Armazenados como variáveis de ambiente no Vercel (nunca no Git) |
| **Identificação do aluno** | Número de telefone deve estar cadastrado no Supabase com formato padronizado |
| **Claude Vision** | Processar apenas imagens enviadas por alunos identificados |
| **Rate limiting** | Máximo de 3 tentativas de verificação por comprovante |
| **RLS no Supabase** | Tabela `cobrancas` com Row Level Security ativa |

---

## 12. Fases de Implementação

| Fase | O que construir | Entregável | Estimativa |
|------|----------------|-----------|------------|
| **A** | Inter sandbox + Supabase tables + Trigger.dev + envio por email | Bolepix gerado e enviado por e-mail | 1–2 semanas |
| **B** | Canal WhatsApp + templates | Bolepix entregue por WhatsApp + email | 1 semana |
| **C** | Webhook Inter + idempotência + confirmação | WhatsApp de confirmação em < 30s | 1 semana |
| **D** | Webhook WhatsApp + Claude Vision + re-verificação | Fluxo 3 completo | 1–2 semanas |
| **+** | Lembretes D-3 e D-1 | Redução de inadimplência | Fase futura |

---

## 13. Mudanças v1 → v2

| Item | v1 (Asaas) | v2 (Banco Inter) |
|------|-----------|-----------------|
| Gateway | Asaas | Banco Inter |
| Custo | ~R$2,49/boleto | Plano negociado |
| Bolepix | Boleto + PIX separados | ✅ Unificado — um PDF |
| Autenticação | API Key | OAuth 2.0 + Certificado X.509 |
| SDK Python | Não oficial | ✅ Oficial (`inter-co/pj-sdk-python`) |
| Webhook payload | Padrão Asaas | Padrão Inter (mapeado neste doc) |
| Canal WhatsApp | Z-API definido | ⚠️ Em aberto — decisão pendente |

---

## 14. Próximo Passo

**Antes de começar a Fase A:**
1. ✅ Definir o canal WhatsApp (Seção 3)
2. ✅ Marcelo acessa o Inter Empresas e cria a integração (certificados)
3. ✅ Confirmar se usa tabelas do ERP-Educacional existente ou cria schema separado

---

*Plano gerado em sessão de 12/04/2026 — parte do MASTERPLAN-FIC-MULTIAGENTES-v1.*
