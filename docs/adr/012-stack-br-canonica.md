# ADR-012: Stack BR canônica (Chatwoot + Evolution + Documenso + pyHanko + PyNFe + MariTalk)

- **Status:** aceito
- **Data:** 2026-04-16
- **Decisores:** Marcelo Silva (CEO), Claudinho (VP)
- **Relacionado:** MASTERPLAN-V9 § Parte IX §34 §35 §36 §37, `docs/analises/ANALISE-VERTICAIS-BRASIL-PROFUNDA.md`

## Contexto e problema

Os 5 negócios operam no **Brasil** e têm requisitos legais/fiscais específicos:

- **WhatsApp como canal primário** (FIC atendimento aluno, Klésis responsáveis, Nexvy white-label)
- **Assinatura digital ICP-Brasil** (contratos imobiliários Intentus/Splendori; diplomas FIC MEC 554/2021)
- **NFe/NFS-e** (mensalidades FIC/Klésis; locação Intentus)
- **Educacenso INEP** (Klésis K-12)
- **Atendimento PT-BR** com contexto cultural (MariTalk Sabiá-4)
- **Omnichannel** para unificar canais

Stack canônica deve servir todos os negócios com o mínimo de fragmentação.

## Opções consideradas

Avaliamos ferramentas cross-categoria (atendimento, CLM, NFe, LLM PT-BR, WhatsApp). Comparativo em `ANALISE-VERTICAIS-BRASIL-PROFUNDA.md`. As finalistas:

- **Chatwoot** (MIT) — omnichannel com integração nativa Evolution
- **Evolution API** (Apache) — gateway WhatsApp Baileys + Meta Cloud API, integração Chatwoot nativa
- **Documenso** (**AGPL self-host sem modificar**) — CLM base open-source maduro
- **pyHanko** (MIT) — biblioteca Python PAdES ICP-Brasil
- **PyNFe** (MIT) — NFe/NFS-e PT-BR
- **MariTalk / Sabiá-4** (comercial) — LLM PT-BR nativo, OpenAI-compat
- **i-Educar** (GPL-v2) — Educacenso INEP (Klésis fork)
- **Twenty** (AGPL) — CRM pattern study

## Critérios de decisão

- Cobertura do requisito legal BR
- Licença (Apache/MIT preferível; AGPL permitido com cuidado)
- Integração com stack V9 (Supabase, Railway, agentes)
- Suporte PT-BR e específico BR (ICP-Brasil, NFe)

## Decisão

**Stack BR canônica (§37 V9):**

| Função | Ferramenta | Licença |
|---|---|---|
| Omnichannel | Chatwoot (fork para Nexvy) | MIT |
| WhatsApp gateway | Evolution API | Apache-2.0 |
| CLM base | Documenso (self-host SEM modificar) | **AGPLv3** ⚠️ |
| PAdES ICP-Brasil | pyHanko (Python sidecar) | MIT |
| NFe/NFS-e | PyNFe | MIT |
| LLM PT-BR | MariTalk Sabiá-4 (via OpenAI-compat) | Comercial |
| K-12 Educacenso | i-Educar (fork Klésis) | GPL-v2 |
| CRM pattern | Twenty (study — NÃO fork) | AGPLv3 |

**Stack per negócio (§36 V9):** ver tabela no masterplan.

## Consequências

### Positivas
- Evolution API já integra Chatwoot nativamente (`src/api/integrations/chatbot/chatwoot/`) — zero glue code
- Documenso + pyHanko = diferencial jurídico ICP-Brasil (especialmente Intentus/Splendori/FIC diplomas)
- MariTalk OpenAI-compat plugga no LiteLLM com 1 config
- Cobertura legal completa (NFe, PAdES, Educacenso)

### Negativas
- **AGPL requer atenção** — Documenso e Twenty não podem ser forkeados-modificados em produto comercial fechado
- i-Educar é GPL-v2 — SaaS interno OK, distribuir para terceiros exige publicar código
- MariTalk é comercial — custo por token (mas mitigado por fallback no LiteLLM)

### Neutras / riscos
- **Risco:** AGPL surpresa. **Mitigação:** política documentada no `LICENSE-AUDIT.md` (a criar) + hook Art. XIX bloqueia `modify` em repos forkados AGPL.
- **Risco:** Evolution API quebra em upgrade Meta. **Mitigação:** dual-provider: Baileys (legado) + Meta Cloud API (oficial).

## Evidência / pesquisa

- MASTERPLAN-V9 § Parte IX §34 tabela completa
- `docs/analises/ANALISE-VERTICAIS-BRASIL-PROFUNDA.md` — comparativo aprofundado
- `EvolutionAPI/evolution-api` — integração Chatwoot validada em código
- `MatthiasValvekens/pyHanko` — suporte PAdES + ICP-Brasil confirmado
- MEC Portaria 554/2021 (diplomas digitais)

## Ação de implementação

- Integração Evolution + Chatwoot para E2 (Jarvis WhatsApp) — sessão futura
- pyHanko Python sidecar no Railway para diplomas FIC + contratos (sessão futura)
- PyNFe integration em `@ecossistema/billing` (sessão futura)
- MariTalk como provider em LiteLLM config (sessão S05)
- Fork i-Educar para Klésis (sessão futura)
- `LICENSE-AUDIT.md` documentando obrigações AGPL/GPL (próxima Fase)

## Revisão

Revisar quando (a) Meta mudar política WhatsApp Cloud API materialmente, ou (b) Documenso mudar licença, ou (c) Anthropic/OpenAI lançarem modelo PT-BR superior ao Sabiá-4.
