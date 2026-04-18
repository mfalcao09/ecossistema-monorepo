# Domain Knowledge — CFO FIC

## Identidade da FIC

- **Nome:** Faculdades Integradas de Cassilândia
- **Setor:** Ensino Superior Privado
- **Localização:** Cassilândia-MS (Mato Grosso do Sul)
- **Fundação:** ~1982 (44 anos de tradição)
- **Status:** Revitalização estratégica 2026 — CEO Marcelo Silva
- **Supabase:** `ifdnjieklngcfodmtied`
- **Cursos:** Administração, Direito, Pedagogia, Publicidade, Psicologia, Biomedicina
- **Alunos matriculados:** ~1.200

## Mensalidades

| Curso | Valor médio |
|---|---|
| Administração | R$ 850 |
| Pedagogia | R$ 850 |
| Publicidade | R$ 950 |
| Direito | R$ 1.150 |
| Psicologia | R$ 1.300 |
| Biomedicina | R$ 1.450 |

- **Vencimento:** dia 10 de cada mês
- **Multa:** 2% a partir do 1º dia de atraso (aplicada 1x)
- **Juros:** 1% ao mês (cobrado proporcionalmente)
- **Taxa de inadimplência histórica:** ~8% (meta: <6%)

## Banco Inter PJ

- **Conta:** FIC Faculdades Integradas de Cassilândia LTDA
- **API produção:** `https://cdpj.partners.bancointer.com.br`
- **API sandbox:** `https://cdpj.partners.uatinter.co`
- **Scopes:** `cobranca-read cobranca-write extrato-read`
- **Variável ambiente:** `INTER_AMBIENTE=sandbox` (produção: remover)

### Credenciais (SC-29 Modo B)

```
get_credential("INTER_CLIENT_ID", "fic")
get_credential("INTER_CLIENT_SECRET", "fic")
get_credential("INTER_CERT", "fic")    # .crt base64
get_credential("INTER_KEY", "fic")     # .key base64
```

**Nunca** logar ou exibir credenciais Inter. Sempre via SC-29 proxy.

### Boleto seuNumero pattern

`FIC-{aluno_id}-{mes_ref}` (ex: `FIC-abc123-2026-05`)
Garante idempotência — emitir 2x retorna o mesmo boleto na Inter.

## Evolution API (WhatsApp)

- **URL:** via env `EVOLUTION_API_URL`
- **Instance produção:** `fic-prod`
- **Instance sandbox/teste:** `fic-sandbox`
- **Credencial:** `get_credential("EVOLUTION_API_TOKEN", "fic")`
- **Endpoint:** `POST /message/sendText/{instance}`

## Régua de cobrança padrão

| Estágio | Dias | Canal | Tom |
|---|---|---|---|
| `lembrete-3d` | -3 dias | WhatsApp | Amigável, preventivo |
| `vencido-1d` | +1 dia | WhatsApp | Cordial, inclui PIX |
| `vencido-15d` | +15 dias | WhatsApp | Formal, urgente |
| `vencido-30d` | +30 dias | WhatsApp | Formal, risco extrajudicial |
| Serasa | +60 dias | Registro | **Requer aprovação Marcelo** |

## Tabelas Supabase FIC (ifdnjieklngcfodmtied)

```
alunos                      — cadastro (id, nome, cpf, email, whatsapp_jid, curso_id)
cursos                      — tabela de cursos
cobrancas                   — boletos (aluno_id, mes_ref, valor, status, inter_cobranca_id)
pagamentos                  — pagamentos confirmados via webhook Inter
comunicacoes                — log de envios (whatsapp, email) com idempotência
inadimplencia_diaria        — histórico diário de encargos (insert ON CONFLICT DO NOTHING)
alunos_view_inadimplencia   — view: alunos com cobrança vencida + dias_atraso calculado
fic_agente_logs             — log de ações do agente
fic_agente_aprovacoes_pendentes — fila HITL (Art. II)
```

### View `alunos_view_inadimplencia` — campos relevantes

```
aluno_id, nome, cpf_hash, curso, curso_id, dias_atraso,
mensalidade_valor, cobranca_ativa_id, whatsapp_hash
```

## Conformidade e LGPD

- CPF de alunos: dado sensível. **Nunca logar.** Usar `cpf_hash` nas views.
- WhatsApp: usar `whatsapp_hash` em logs; `whatsapp_jid` apenas no payload de envio.
- Diploma digital: regido pela Portaria MEC 554/2021 — ICP-Brasil obrigatório (Fase 1).
- NFS-e: município Cassilândia-MS — integração via PyNFe (Fase 1).

## Sazonalidade financeira

| Período | Característica |
|---|---|
| Janeiro / Julho | Picos de matrícula — receita maior |
| Março a Novembro | Ciclo regular |
| Dezembro | Queda típica, inadimplência sazonal |

## KPIs monitorados pelo CFO-FIC

- Taxa de inadimplência (meta: <6%)
- Ticket médio por curso
- Conversão de cobranças por estágio (% resolve com WhatsApp)
- Tempo médio de regularização após 1ª mensagem
- Receita mensal líquida

## Sinais de alerta (escalar para Marcelo)

- Inadimplência >10% em qualquer curso
- Queda de 20%+ em novas matrículas
- Aumento em pedidos de cancelamento (>5 no mês)
- Falha na integração Inter por >24h

## Limites Art. II (HITL obrigatório)

- Total de valor financeiro movimentado > **R$10.000** em uma régua
- Número de alunos notificados > **10** em uma execução única
- Ação de registro em Serasa: **sempre requer aprovação**
- Emissão de boleto em massa > 5 alunos: requer dry-run + confirmação

## Integrações previstas Fase 1

- Banco Inter PJ: webhook de pagamento → atualiza `pagamentos` + `cobrancas`
- NFS-e: geração automática após pagamento confirmado
- Conciliação bancária diária (cron pg_cron 06:00)
- WhatsApp resposta automática via Evolution API webhook
