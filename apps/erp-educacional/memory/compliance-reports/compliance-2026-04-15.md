# ⚖️ Compliance Check — ERP-Educacional — 15/04/2026

> Gerado automaticamente toda quarta-feira pela automação `erp-compliance-checker`.
> Referência anterior: N/A (primeiro relatório desta série).

---

## 📊 Banco de Dados (Supabase `ifdnjieklngcfodmtied`)

| Métrica | Valor | Esperado | Status |
|---------|-------|----------|--------|
| Tabelas públicas | **111** | 65+ | ✅ OK |
| Diplomas cadastrados | **158** | — | ℹ️ |
| Diplomados cadastrados | **158** | — | ℹ️ |
| Assinaturas pendentes (fluxo_assinaturas ≠ concluído) | **0** | — | ✅ |
| XMLs gerados | **2** | 3/diploma | ⚠️ |
| Templates RVDD | **0** | ≥1 | ❌ |
| Consultas portal (portal_logs_consulta) | **30** | — | ℹ️ |

**Status dos diplomas:**
- 155 → `publicado`
- 2 → `registrado`
- 1 → `aguardando_envio_registradora`

**Detalhe XMLs gerados (últimos 2):**
- `doc_academica_registro` — XSD **v1.05** — validado ✅ — status: assinado
- `historico_escolar` — XSD **v1.05** — validado ✅ — status: assinado
- `diploma_digital` — **NÃO GERADO ❌** (3º XML obrigatório faltando)

---

## 📋 Conformidade MEC — Portaria 70/2025

| Requisito | Status | Evidência | Risco |
|-----------|--------|-----------|-------|
| **Motor XML — 3 XMLs obrigatórios** | ⚠️ PARCIAL | 2/3 gerados; DiplomaDigital ausente; Sprint 2 E2.1 ✅ mas incompleto | 🔴 ALTO |
| **XSD v1.06** | ❌ FALHOU | XMLs em produção usam v1.05; 19 itens pendentes desde s010; Sprint 4 (Compliance) = 0% | 🔴 CRÍTICO |
| **Assinatura ICP-Brasil A3 (BRy)** | ⚠️ INFRA OK / NÃO TESTADA | Sprint 7 ✅ construiu HUB Signer BRy + webhook; mas credenciais BRy homologação ausentes; Token A3 físico não testado | 🔴 ALTO |
| **PDF/A — ISO 19005 (Ghostscript)** | ✅ IMPLEMENTADO | Sprint 6 ✅ — POST /acervo/converter com Ghostscript (s094). E2.4 compressão/verificação pós ainda pendente | 🟡 MÉDIO |
| **RVDD com QR code** | ❌ NÃO INICIADO | Sprint 3 = 0%. Tabela rvdd_templates existe mas vazia (0 templates) | 🔴 CRÍTICO |
| **Repositório público HTTPS** | ❌ NÃO INICIADO | Sprint 3 = 0%. Endpoint /api/documentos/verificar não implementado | 🔴 CRÍTICO |
| **Portal do diplomado (consulta CPF)** | ⚠️ ESTRUTURA EXISTE | Tabela portal_logs_consulta tem 30 registros. Sprint 3 = 0% — portal público provavelmente não funcional | 🔴 ALTO |

---

## ⚠️ Alertas — Por Severidade

### 🔴 CRÍTICOS (bloqueiam emissão legal de diplomas)

1. **Prazo MEC expirado há 288 dias** — 01/07/2025 já passou. A FIC está operando em não-conformidade regulatória. Cada diploma emitido sem o fluxo digital completo é um risco jurídico e regulatório.

2. **XSD v1.05 no lugar de v1.06** — Os únicos 2 XMLs gerados até hoje usam a versão antiga do schema. A Portaria MEC 70/2025 exige v1.06. Os 19 itens identificados na auditoria da sessão 010 **não foram corrigidos**. Sprint 4 (Compliance MEC) está em 0% e nem foi iniciado.

3. **DiplomaDigital (3º XML) não gerado** — Os 3 XMLs obrigatórios são: DocumentacaoAcademicaRegistro ✅, HistoricoEscolarDigital ✅, e DiplomaDigital ❌. Este último é o que o diplomado recebe e é o documento público central. Sem ele, nenhum diploma pode ser considerado emitido legalmente.

4. **RVDD + QR code — Sprint 3 a 0%** — A Representação Visual do Diploma Digital é obrigatória. Não há templates, não há gerador de PDF/A com QR, não há aprovação de layout. Sprint 3 não foi sequer iniciado.

5. **Repositório público HTTPS** — O endpoint de verificação pública de diplomas (/api/documentos/verificar) é requisito da Portaria. Não implementado.

### 🟠 BLOQUEADORES EXTERNOS

6. **BRy credenciais de homologação ausentes** — Sprint 7 entregou a infraestrutura de assinatura (HUB Signer, webhook, UI), mas sem credenciais reais da BRy o fluxo de assinatura ICP-Brasil A3 **nunca foi testado de verdade**. Sprint 8 (Envio UFMS) depende disso.

7. **Token A3 físico não testado** — A assinatura A3 (obrigatória pelo MEC) requer hardware físico. Nenhum teste end-to-end foi realizado com certificado real.

### 🟡 ATENÇÃO (sem bloqueador técnico, mas parados)

8. **E2.3 Reconciler XML** — Comparação XML enviado vs. retornado pela registradora. Sem bloqueador técnico. Parado há 4 dias desde 11/04.

9. **E2.4 Compressão + Verificação PDF/A** — Pass de compressão (72dpi), threshold 15MB, e verificação pós com veraPDF. Sem bloqueador técnico. Parado há 4 dias.

10. **Sprint 8 (Envio UFMS)** — Fluxo manual de envio para UFMS + teste ZIP Kauana (id: 5e197846). Sem bloqueador técnico. É a próxima sessão (096) mas ainda não iniciou.

---

## 📅 Próximos Marcos — Sequência Crítica para Conformidade

Para que a FIC emita diplomas em conformidade com a Portaria MEC 70/2025, esta é a sequência mínima necessária:

```
AGORA (sem bloqueador técnico):
 1. Gerar DiplomaDigital (3º XML) — complementar motor XML
 2. E2.3 Reconciler + E2.4 Compressão — Sprint 2 finalizar
 3. Sprint 8 — Fluxo UFMS + teste ZIP Kauana

DEPENDE DE TERCEIROS:
 4. Receber credenciais BRy homologação → testar assinatura A3 real

SEGUIR APÓS E2.2 DESBLOQUEADO:
 5. Sprint 3 — RVDD + Portal (3 epics, 0% — CRÍTICO)
    → Gerar PDF/A com QR code
    → Portal consulta por CPF funcional
    → Repositório público HTTPS

CONFORMIDADE XSD:
 6. Sprint 4 — Compliance MEC (3 epics, 0%)
    → Corrigir 19 itens XSD v1.05 → v1.06
    → Atualizar motor XML + validadores
    → Testes de conformidade completos

FINALIZAÇÃO:
 7. Sprint 5 — Backup + Expedição (3 epics, 0%)
```

---

## 📈 Comparação com Período Anterior

| Métrica | Semana Passada | Hoje | Δ |
|---------|---------------|------|---|
| Sprints concluídos | S1 + parcial S2 | + S6 (Acervo) + S7 (Pacote Registradora) | +2 ✅ |
| Tabelas no banco | 65 (s010) | 111 | +46 |
| XMLs conformes com v1.06 | 0 | 0 | = |
| RVDD templates | 0 | 0 | = |
| Infraestrutura assinatura BRy | ❌ | ⚠️ Construída | melhora |
| PDF/A Ghostscript | ❌ | ✅ Implementado | +1 |

**Resumo da evolução:** Houve progresso real e significativo em infraestrutura (pipeline de assinatura BRy, PDF/A, pacote registradora, acervo digital). Porém, os bloqueadores de conformidade regulatória permanecem os mesmos: XSD desatualizado, 3º XML faltando, e Sprint 3 (RVDD+Portal) a zero.

---

> Próxima verificação automática: **22/04/2026** (quarta-feira)
> Referência: sessão 095 (15/04/2026) como linha de base deste relatório
