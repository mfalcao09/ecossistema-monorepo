# Parcelamento de Solo — Fase 5: Controle de Patrimônio de Afetação

**Data:** 2026-04-08
**Sessão:** 123
**Origem:** Insight de Marcelo durante aprovação do schema financeiro
**Base legal:** Lei 10.931/2004 (art. 31-A a 31-F)

---

## Contexto

Durante a aprovação do schema da Fase 5 Bloco A, Marcelo levantou que o campo "alíquota de IR" não pode ter default, porque a escolha do regime tributário é uma **decisão fiscal estratégica** que dispara obrigações legais acessórias.

> "Precisamos abrir uma forma de controlar as obrigações do patrimônio de afetação (pois a opção pelo regime gera contraprestações de obrigações), vinculadas à opção fiscal. Ou seja, habilitou aqui Patrimônio de afetação + RET -> habilita controle das obrigações." — Marcelo, sessão 123

Isso vira um **módulo transversal** que atravessa Financeiro + CLM + Legal.

## Modelo Implementado (sessão 123)

### Campos novos em `development_parcelamento_scenarios`
- `regime_tributario` — enum: `lucro_presumido | lucro_real | ret_afetacao | simples_nacional | nao_definido` (default: `nao_definido`)
- `patrimonio_afetacao` — boolean (default false)
- `ret_ativo` — boolean (default false)
- `aliquota_ir_pct` — SEM default, usuário deve informar

### Nova tabela `development_parcelamento_afetacao_obligations`
Uma linha por obrigação acessória ativa. Controla:
- `obligation_key` (chave taxonômica)
- `periodicity` (unica | mensal | trimestral | semestral | anual | continua)
- `status` (pendente | em_dia | atrasada | cumprida | dispensada | suspensa)
- `next_due_date` (próximo vencimento)
- `responsible_role` + `responsible_user`
- `last_evidence_url` + `last_evidence_at` (comprovante)

## Catálogo de Obrigações (inicial — a ser implementado como seed)

Quando o usuário ativa `patrimonio_afetacao = true`, o sistema deve **criar automaticamente** as seguintes obrigações no cenário:

| obligation_key | Label | Periodicity | Base Legal |
|---|---|---|---|
| `averbacao_registro_imoveis` | Averbação do termo de afetação no CRI | única | Lei 10.931/04 art. 31-B |
| `conta_bancaria_segregada` | Manter conta bancária segregada da afetação | contínua | Lei 10.931/04 art. 31-A §1º |
| `contabilidade_segregada` | Manter escrituração contábil segregada | contínua | Lei 10.931/04 art. 31-D, IV |
| `nomeacao_comissao_representantes` | Nomear Comissão de Representantes dos adquirentes | única | Lei 10.931/04 art. 31-D, I |
| `demonstracoes_trimestrais` | Publicar DF trimestrais | trimestral | Lei 10.931/04 art. 31-D, IV |
| `relatorio_comissao_representantes` | Relatório trimestral à Comissão de Representantes | trimestral | Lei 10.931/04 art. 31-D, V |
| `prestacao_contas_adquirentes` | Prestação mensal de contas aos adquirentes | mensal | Lei 10.931/04 art. 31-D, III |

Se adicionalmente `ret_ativo = true`, acrescentar:

| obligation_key | Label | Periodicity | Base Legal |
|---|---|---|---|
| `ret_recolhimento_mensal` | Recolher RET 4% via DARF código 4095 | mensal (dia 20) | Lei 10.931/04 art. 4º + IN RFB 1.435/13 |
| `obrigacao_acessoria_receita` | EFD-Contribuições + DCTFWeb da afetação | mensal | IN RFB 1.435/13 |

## Integrações Futuras

1. **CLM module**: obrigações da afetação devem aparecer no "Painel de Obrigações" do CLM junto com as de contratos — mesma UI, mesmo tratamento de alertas/SLAs
2. **Notificações Smart**: alertas automatizados de vencimento (snooze + email digest já existem)
3. **Unified alerts**: integrar com a EF `unified-alerts` que já existe
4. **Dashboard do empreendimento**: card "Compliance da Afetação" mostrando % obrigações em dia
5. **Parecer PDF**: Bloco C precisa incluir seção "Obrigações acessórias ativas" quando afetação estiver habilitada

## Gatilho de Ativação (a implementar na EF ou trigger)

```
WHEN scenario.patrimonio_afetacao CHANGES TO true:
  FOR obligation IN catálogo_afetacao_base:
    INSERT INTO development_parcelamento_afetacao_obligations
    ...

WHEN scenario.ret_ativo CHANGES TO true:
  FOR obligation IN catálogo_ret_extra:
    INSERT ...
```

Implementação recomendada: Edge Function `parcelamento-afetacao-activate` chamada após UPDATE do cenário (ou via trigger SQL + pg_net). A decisão entre trigger vs EF fica para discussão no Bloco B.

## Status

- ✅ Schema criado e incluído na migration `20260408000001_parcelamento_fase5_financial_schema.sql`
- ⏳ Seed do catálogo de obrigações — será criado como segunda migration após validação
- ⏳ UI no wizard de cenário — toggle "Optar por Patrimônio de Afetação"
- ⏳ Painel "Obrigações da Afetação" — integrar ao CLM
- ⏳ Edge Function de ativação automática
