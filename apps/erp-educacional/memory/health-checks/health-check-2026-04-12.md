# 🔍 BACKUP & DB HEALTH — Semana de 2026-04-12

**Executado em:** 2026-04-12 (tarefa agendada — sexta-feira 9h)
**Agente:** Verificação automática autônoma

---

## 📊 INTENTUS (bvryaopfjiyxjgsuhjsb)

| Métrica | Valor | Status |
|---------|-------|--------|
| Tabelas totais | **287** (baseline: 222, +29,3%) | ⚠️ ATENÇÃO |
| Edge Functions ACTIVE | **133 / 133** | ✅ OK |
| Edge Functions com erro | **0** | ✅ OK |
| Migrations últimos 7 dias | **13** | ℹ️ Ativo |
| Profiles | **1** | ℹ️ Dev |
| Tenants ativos | **1** | ℹ️ Dev |
| contract_audit_trail (7d) | **0 registros** | ℹ️ Normal p/ dev |

### Migrations dos últimos 7 dias (05–12/04/2026):
1. `parcelamento_solo_fase1_schema` (07/04)
2. `parcelamento_fase1_rls_perf_fix` (07/04)
3. `parcelamento_fase5_financial_schema` (08/04)
4. `parcelamento_masterplan_hierarchy` (08/04)
5. `parcelamento_urbanistic_params` (09/04)
6. `expand_developments_analysis_status_check` (09/04)
7. `fix_developments_rls_permissive` (09/04)
8. `add_sensitivity_and_efficient_frontier_to_parcelamento_financial` (09/04)
9. `enable_pgvector_and_create_knowledge_base_tables` (10/04)
10. `create_legal_knowledge_base_bucket` (10/04)
11. `add_missing_info_column_to_legal_analyses` (10/04)
12. `create_development_zoneamento_municipal` (11/04)
13. `bloco_l_status_transitions_and_soft_delete` (11/04)

**Contexto:** Crescimento de tabelas (+65 acima do baseline de 222) é esperado — está alinhado com o desenvolvimento ativo documentado nas sessões 133–139 (Parcelamento Blocos A–D, Knowledge Base, Bloco L, Zoneamento Municipal).

---

## 📊 ERP-EDUCACIONAL (ifdnjieklngcfodmtied)

| Métrica | Valor | Status |
|---------|-------|--------|
| Tabelas totais | **91** (baseline: 65, +40%) | ⚠️ ATENÇÃO |
| Edge Functions | **0** (nenhuma deployada) | ℹ️ Esperado |
| Migrations últimos 7 dias | **26** | ℹ️ Muito ativo |

### Migrations dos últimos 7 dias (05–12/04/2026):
1. `add_dados_rascunho_to_processos_emissao` (05/04)
2. `create_ia_skills_fase2` (06/04)
3. `fase3_rag_pgvector_chunks` (06/04)
4. `create_processo_arquivos_table` (06/04)
5. `seed_skills_fase3_conhecimento` (06/04)
6. `create_persistir_timestamp_historico_rpc` (07/04)
7. `validacao_overrides` (07/04)
8. `atos_curso` (07/04)
9. `20260407_documentos_comprobatorios_pdfa` (07/04)
10. `fix_tipo_documento_comprobatorio_enum_xsd_v105` (07/04)
11. `sprint1_fluxo_novo_processo_aditivo` (08/04)
12. `20260408_sprint1_hardening_rls` (08/04)
13. `20260408_sprint2_extracao_callback_nonce` (08/04)
14. `create_bucket_processo_arquivos_sprint2` (08/04)
15. `processo_arquivos_nullable_processo_id` (09/04)
16. `rpc_converter_sessao_em_processo` (09/04) ⚠️
17. `rpc_converter_sessao_em_processo` (10/04) ⚠️ ← NOME DUPLICADO
18. `vault_audit_trail` (11/04)
19. `rpc_update_extracao_with_audit` (11/04)
20. `hard_lock_juridico_epic_14` (11/04)
21. `fix_rpc_converter_sessao_e2e` (11/04)
22. `outbox_assinaturas` (11/04)
23. `fix_rpc_docente_key_coalesce` (11/04)
24. `fix_rpc_converter_docente_ch_comprobatorios_s075` (12/04 — HOJE)
25. `fix_rpc_comprobatorios_cast_s075` (12/04 — HOJE)
26. `fix_data_kauana_s075` (12/04 — HOJE)

**Contexto:** Crescimento de tabelas (+26 acima do baseline de 65) alinhado com desenvolvimento ativo das Sprints 1 e 2 (IA Skills, RAG, Processo de Arquivos, Hard Lock Jurídico). Nenhuma Edge Function deployada ainda — esperado para esta fase do projeto.

---

## ⚠️ ANOMALIAS ENCONTRADAS

### 1. Crescimento de tabelas acima do threshold de 10% (ambos os projetos)
- **Intentus:** +29,3% (esperado — desenvolvimento normal)
- **ERP:** +40% (esperado — sprint ativo)
- **Avaliação:** Não é crítico, está documentado nas sessões de desenvolvimento. Recomenda-se atualizar os baselines nos próximos checks para 287 (Intentus) e 91 (ERP).

### 2. ⚠️ Nome de migration duplicado no ERP
- `rpc_converter_sessao_em_processo` aparece com versões `20260409010335` e `20260410145636`
- Isso pode indicar que a migration foi recriada/corrigida em uma segunda sessão
- **Recomendação:** Verificar se ambas as migrations são necessárias ou se a segunda substituiu a primeira. Possível conflito se ambas tentaram criar o mesmo objeto.

### 3. contract_audit_trail (Intentus) com 0 registros nos últimos 7 dias
- Pode ser normal para ambiente de desenvolvimento com 1 tenant/1 usuário
- Verificar se os eventos de contrato estão chegando corretamente em produção quando houver mais usuários

---

## 🏥 SAÚDE GERAL: ATENÇÃO

**Motivo:** Dois alertas técnicos (crescimento de tabelas >10% e migration com nome duplicado no ERP), porém ambos são contextualizados pelo desenvolvimento ativo e não representam risco crítico imediato.

**Ação recomendada:**
- Atualizar baselines: Intentus → 287, ERP → 91
- Verificar migration duplicada `rpc_converter_sessao_em_processo` no ERP
- Continuar monitoramento normal

---

*Próximo check: 2026-04-19 (sexta-feira)*
