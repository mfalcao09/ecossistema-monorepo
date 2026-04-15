---
name: Motor XML — Bugs #7/#2/#12/#1/#11 corrigidos (Sessões 020/021)
description: Hardening SHA256 + RPC anti-race + codigo_validacao opcional + Assinantes builder (commits 1802e3e, 0c25a58)
type: project
---

Bugs do motor XML v2 corrigidos em 06/04/2026 nas Sessões 020 e 021.

**Sessão 021 (commit `0c25a58`):**

**Bug #1 — `codigo_validacao` do diploma é da REGISTRADORA**: `DadosDiploma.diploma.codigo_validacao` em `tipos.ts` agora é opcional. A FIC (emissora) NUNCA preenche — o XSD `TDadosDiploma` (dentro de `DocumentacaoAcademicaRegistro`) não tem o elemento. Aparece só em `TDadosRegistro`, gerado pela registradora (UFMS, código eMEC 694). Mantido opcional só para exibição pós-retorno.

**Bug #11 — `<Assinantes>` (TInfoAssinantes) ausente do `DadosDiploma`**: Criado `src/lib/xml/builders/assinantes.builder.ts`. Emite `<Assinante>` com `<CPF>` + `<Cargo>` (whitelist enum) ou `<OutroCargo>` (fallback). Posicionado APÓS `<IesEmissora>` e ANTES de `<ds:Signature>`. Bloco omitido se vazio (XSD exige minOccurs=1 de `<Assinante>`). Ordenação por `ordem_assinatura` (eCNPJ assina por último). XSD NÃO tem `<Nome>` dentro de `<Assinante>` — só CPF + Cargo.

**Descoberta crítica da sessão 021**: Todo o motor XML v2 (15+ arquivos em `builders/` e `generators/`) estava UNTRACKED localmente — nunca tinha sido commitado antes. O commit `0c25a58` finalmente subiu tudo + os fixes #1 e #11.

**Bugs residuais identificados na varredura (sessão 021, ainda pendentes):**
- 🔴 Bug #13: `GrauConferido` sem validação de enum (`curso.builder.ts:73`)
- 🔴 Bug #19: `fmtData` retorna `''` para data null — XSD `xs:date` reprova
- 🟡 Bug #15: Filiação placeholder fake `<Genitor><Nome>-</Nome>...`
- 🟡 Bug #16: Docente placeholder fake `<Docente><Nome>-</Nome>...`
- 🟢 Bugs #17/#18/#20: namespace, schemaLocation, schemaVersion (boas práticas)

---

**Sessão 020 (commit `1802e3e`):**

**Bug #7 — Recredenciamento maxOccurs=1**: já corrigido em sessão anterior, validado aqui.

**Bug #2 — Hardening SHA256**: `gerarCodigoValidacaoHistorico()` em `src/lib/xml/montador.ts` agora aplica `.trim()` em `codigoMecEmissora` antes de compor `{codigoMec}.{hex12}`. Blinda contra whitespace silencioso vindo do banco.

**Bug #12 — Race condition**: 2 requests paralelos sobre o mesmo diploma fresh poderiam divergir entre o SHA256 retornado no XML e o tuplo persistido no banco. Resolvido com função PL/pgSQL `persistir_timestamp_historico(uuid, date, time, text)` em `supabase/migrations/20260406_rpc_persistir_timestamp_historico.sql`. SELECT FOR UPDATE + pivot único: se `codigo_validacao_historico` já preenchido, retorna tuplo existente; senão persiste os 3 candidatos atomicamente. SECURITY DEFINER, GRANT EXECUTE para authenticated/service_role.

**Why:** Auditoria do MEC exige reprodutibilidade do SHA256 do Anexo III IN 05/2020. Hash do XML retornado DEVE bater com hash recalculado a partir dos campos do banco — qualquer divergência queima credibilidade do diploma.

**How to apply:** Daqui pra frente, qualquer campo write-once-then-frozen com derivação criptográfica deve seguir o mesmo padrão (RPC com FOR UPDATE + pivot). Marcelo escolheu Opção B (RPC) explicitamente por ser "mais robusta e já resolve definitivamente o problema" — preferir transação no banco a otimizações no app.

**Pendências (Marcelo: "ainda temos coisas para corrigir e implementar"):**
- Bug #1: `codigo_validacao` do diploma deve vir da REGISTRADORA (UFMS) — deferido até integração
- Bug #11: Verificação do `AutoridadesIesEmissora` — deferido
- Validar XML gerado contra dados reais do frontend (Kauana)
- Sincronizar com `/Users/marcelosilva/Projects/GitHub/CENTRAL-MEMORY.md` quando a pasta central voltar a ser montada (não estava disponível na sessão 020)
