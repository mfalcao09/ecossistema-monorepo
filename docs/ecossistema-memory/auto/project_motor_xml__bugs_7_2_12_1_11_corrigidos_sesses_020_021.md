---
name: Motor XML — Bugs #7/#2/#12/#1/#11 corrigidos (Sessões 020/021)
description: Motor XML — Bugs #7/#2/#12/#1/#11 corrigidos (Sessões 020/021)
type: project
project: erp
tags: ["motor-xml", "bugs", "xsd", "assinantes", "código-validação"]
success_score: 0.85
supabase_id: 8a3ac815-4dc9-460b-8d95-45c0039db802
created_at: 2026-04-14 09:13:56.318028+00
updated_at: 2026-04-14 10:07:25.320695+00
---

Bugs do motor XML v2 corrigidos em 06/04/2026 nas Sessões 020 e 021.

**Bug #1 — `codigo_validacao` do diploma é da REGISTRADORA**: `DadosDiploma.diploma.codigo_validacao` em `tipos.ts` agora é opcional. A FIC (emissora) NUNCA preenche — o XSD `TDadosDiploma` (dentro de `DocumentacaoAcademicaRegistro`) não tem o elemento. Aparece só em `TDadosRegistro`, gerado pela registradora (UFMS, código eMEC 694).

**Bug #11 — `<Assinantes>` (TInfoAssinantes) ausente do `DadosDiploma`**: Criado `src/lib/xml/builders/assinantes.builder.ts`. Emite `<Assinante>` com `<CPF>` + `<Cargo>` (whitelist enum) ou `<OutroCargo>` (fallback). Posicionado APÓS `<IesEmissora>` e ANTES de `<ds:Signature>`.

**Descoberta crítica**: Todo o motor XML v2 (15+ arquivos em `builders/` e `generators/`) estava UNTRACKED localmente — o commit `0c25a58` finalmente subiu tudo + os fixes #1 e #11.

**Bugs residuais identificados:** Bug #13 (GrauConferido sem enum), Bug #19 (fmtData retorna `'` para data null), Bug #15 (Filiação placeholder fake).
