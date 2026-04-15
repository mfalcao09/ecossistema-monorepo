# Lista Mestra dos Bugs do Motor XML — STATUS FINAL

> **Data desta atualização:** 2026-04-07 (após deploy dos Bugs #G + #H / Onda 3)
> **Substitui:** `bugs-motor-xml-status-verificado.md` (que era o snapshot pré-Ondas)
> **Mantém compatibilidade com:** `bugs-motor-xml-lista-mestra.md` (numeração #1–#12 original) e `decisoes-fix-motor-xml-onda1.md` (renumeração para letras)

---

## ⚠️ Por que existem DUAS numerações

Em 07/04/2026 uma sessão paralela commitou no `origin/main` usando "Bug #1, #2, #7, #11, #12" com **significados diferentes** dos desta sessão. Para evitar confusão, esta sessão renomeou seus próprios bugs para letras (`#A` em diante). A correspondência está na tabela abaixo.

| Letra (esta sessão) | Nº antigo (lista mestra) | Tema | Status |
|---|---|---|---|
| #A | #1  | `ambiente="Produção"` hardcoded → dinâmico | ✅ |
| #B | #5  | `<ID></ID>` vazio quando RA é null → throw 422 | ✅ |
| #C | #6  | Disciplinas em ordem lexicográfica → numérica | ✅ |
| #D | #10 | `prettyPrint: true` → `false` (compliance IN 05) | ✅ |
| #E | #3  | `DataExpedicaoDiploma` com fallback → derivada via helper | ✅ |
| #F | #4  | `<Documento>` vazio sem PDF base64 (sub-projeto) | 🔴 (próxima sessão) |
| #G | #8  | Atos regulatórios do curso (RenovacaoReconhecimento) | ✅ |
| #H | #9  | `carga_horaria_integralizada < carga_horaria_total` | ✅ |
| —  | #2  | `codigo_validacao_historico` SHA256 + persistência | ✅ (sessão paralela) |
| —  | #7  | Atos regulatórios IES (Recredenciamento) | ✅ (sessão paralela) |
| —  | #11 | `<Assinantes>` (TInfoAssinantes) ausente | ✅ (sessão paralela) |
| —  | #12 | Race condition timestamp histórico (RPC) | ✅ (sessão paralela) |
| —  | (lateral) | `codigo_validacao` da registradora opcional no tipo | ✅ (sessão paralela) |

---

## Resumo Executivo

| Status | Total | IDs |
|---|---|---|
| ✅ Resolvidos e em produção | **11** | #A, #B, #C, #D, #E, #G, #H + #2, #7, #11, #12 (antigos) |
| 🔴 Não resolvidos (sub-projeto bloqueante — próxima sessão) | **1** | #F |

**Cobertura:** 11 de 12 bugs originais resolvidos (~92%). O único bloqueador remanescente para emissão é o #F (PDF base64 dos documentos comprobatórios), que será tratado em uma sessão dedicada.

---

## ✅ RESOLVIDOS — detalhamento

### #A (era #1) — `ambiente` dinâmico
- **Commit:** `9902e87` "fix(motor-xml): ambiente dinâmico, validação RA, ordenação numérica, no pretty-print"
- **Como:** Campo `ambiente?: 'producao' | 'homologacao' | 'teste'` adicionado ao `DadosDiploma`. Mapeamento `producao→Produção`. Em `NODE_ENV=production` força `'producao'` independente do payload.
- **Fundamento:** IN SESu 05/2022 §2.2.2.3 — só "Produção" tem validade legal.

### #B (era #5) — `<ID>` vazio quando RA é null
- **Commit:** `9902e87`
- **Como:** Guardrail no montador antes de chamar `diplomado.builder.ts` — lança erro 422 se `d.ra` for null/vazio.
- **Fundamento:** XSD `tiposBasicos_v1.05.xsd` linhas 433-439, `TId.minLength=1`.

### #C (era #6) — Disciplinas em ordem lexicográfica
- **Commit:** `9902e87`
- **Como:** Após o fetch, ordenação via `parseInt(d.periodo, 10)` no JS com tiebreaker por nome da disciplina.

### #D (era #10) — `prettyPrint: true`
- **Commit:** `9902e87`
- **Como:** `base.builder.ts` agora chama `doc.end({ prettyPrint: false })`.
- **Fundamento:** Compliance IN 05 §1.2.2.V (XML enxuto, sem whitespace cosmético entre elementos — relevante para canonicalização da assinatura).

### #E (era #3) — `DataExpedicaoDiploma` com fallback
- **Commit:** `24755f2` "fix(motor-xml): DataExpedicaoDiploma derivada automaticamente (Bug #E / Onda 2)"
- **Deploy:** `dpl_4eAYuGbtKtVGvtHXaioUswmsXppv` READY ✅
- **Caminho escolhido:** **C** (refatoração completa).
- **Como:**
  1. Helper `gerarDataExpedicaoXML()` em `base.builder.ts` — retorna data atual em `America/Sao_Paulo` via `Intl.DateTimeFormat`.
  2. `historico.builder.ts` chama o helper diretamente ao montar `TSituacaoFormado.DataExpedicaoDiploma`.
  3. Removido `data_expedicao` de `DadosDiploma.diploma` e `data_expedicao_diploma` de `historico.situacao_discente` em `tipos.ts`. **TypeScript bloqueia em compile-time** qualquer chamador que tente passar esses campos.
  4. Limpeza em cascata: `montador.ts`, `business-rules.ts`, `exemplo-uso.ts`, `__tests__/gerador.test.ts`, `INTEGRACAO.md`.
- **Fundamento:** XSD `leiautehistoricoescolar_v1.05.xsd` linhas 415-421 (`TSituacaoFormado` → `DataExpedicaoDiploma` é `minOccurs=1`). Semanticamente é a data em que a IES expede — coincide com a geração do XML (per IN 05). FIC NUNCA preenche `DataExpedicaoDiploma` dentro de `TLivroRegistro` (XSD diploma 500/532) — isso é exclusivo da REGISTRADORA.

### #2 antigo — `codigo_validacao_historico` regenerado a cada chamada
- **Commit:** `1802e3e` (sessão paralela)
- **Como:** `gerarCodigoValidacaoHistorico(params)` implementa SHA256 do Anexo III IN 05/2020 (`RA || CPF || CodigoCursoEMEC || CNPJ || DDMMAAAAHHMM`). Persiste no banco via RPC `persistir_timestamp_historico`.

### #7 antigo — Atos regulatórios IES
- **Commit:** `1802e3e`
- **Como:** Função `buscarAtosIES(supabase, instituicaoId)` lê de `from('credenciamentos')`. Aplica regra: credenciamento mais antigo (1ª habilitação) + recredenciamento mais recente — respeita `maxOccurs=1` do XSD v1.05.

### #11 antigo — `<Assinantes>` (TInfoAssinantes)
- **Commit:** `0c25a58`
- **Como:** Builder `assinantes.builder.ts` (97 linhas). Whitelist `CARGOS_VALIDOS_XSD` com 8 cargos do enum `TCargosAssinantes`. Fallback automático para `<OutroCargo>` se cargo não estiver no enum. XSD não tem `<Nome>` no `<Assinante>` — apenas CPF + Cargo|OutroCargo.
- **Posicionamento:** Dentro de `<DadosDiploma>`, após `<IesEmissora>`, antes de `<ds:Signature>`.

### #12 antigo — Timestamp do hash não persistido (race condition)
- **Commit:** `1802e3e`
- **Como:** RPC PL/pgSQL `persistir_timestamp_historico` faz `SELECT FOR UPDATE` na linha do diploma + UPDATE atômico. Tuplo é write-once-then-frozen. Timezone em `Intl.DateTimeFormat('America/Sao_Paulo')`.

### #G (era #8) — Atos regulatórios do curso → tabela dedicada `atos_curso`
- **Commit:** `2518ed3` "feat(motor-xml): override humano de regras de negócio + atos_curso (Bugs #H e #G)"
- **Deploy:** `dpl_7mgBX54PMUEczE3JsPxUzP3fJQzJ` READY ✅ (07/04/2026)
- **Caminho:** **G2** (tabela dedicada espelhando `credenciamentos`).
- **Como:**
  1. Migration `20260407_atos_curso.sql` aplicada via Supabase MCP. Tabela com FK `curso_id` ON DELETE CASCADE, `tipo` CHECK ('Autorizacao' | 'Reconhecimento' | 'RenovacaoReconhecimento'), demais colunas espelham `credenciamentos`.
  2. Backfill idempotente (NOT EXISTS) a partir dos campos planos da `cursos`. Resultado verificado: 8 Autorizações, 8 Reconhecimentos, 6 Renovações.
  3. Helper `linhaAtoCursoParaAto()` + função `buscarAtosCurso(supabase, cursoId)` em `montador.ts` (espelho de `buscarAtosIES`).
  4. Regra do XSD v1.05 aplicada: Autorização e Reconhecimento mais ANTIGOS, Renovação mais RECENTE.
  5. Bloco `curso.autorizacao/reconhecimento/renovacao_reconhecimento` no payload usa padrão `atosCurso.* ?? fallback_planos` (compatibilidade com cursos legados).
- **Pendência menor:** marcar campos planos da `cursos` (`tipo_autorizacao`, `tipo_reconhecimento`, `tipo_renovacao` etc.) como `@deprecated` e remover em migração futura. Tela de gestão dos atos no painel admin fica para uma sprint posterior.

### #H (era #9) — Carga horária integralizada vs total → guardrail com override humano
- **Commit:** `2518ed3` "feat(motor-xml): override humano de regras de negócio + atos_curso (Bugs #H e #G)"
- **Deploy:** `dpl_7mgBX54PMUEczE3JsPxUzP3fJQzJ` READY ✅ (07/04/2026)
- **Princípio fundamental:** "A confirmação humana pode sobrescrever qualquer regra de negócio." (decisão Marcelo, 07/04/2026 — universal para todo o sistema, não apenas o motor XML).
- **Como:**
  1. Migration `20260407_validacao_overrides.sql` — tabela de auditoria com `entidade_tipo`, `entidade_id`, `regra_codigo`, `valores_originais` (JSONB), `justificativa` (CHECK length ≥ 10), `usuario_id`, `created_at`.
  2. Módulo `src/lib/xml/validation/regras-negocio.ts` — centraliza regras com `ValidacaoNegocioError` estruturado, `REGRAS_NEGOCIO` enum, função `avaliarRegrasNegocio(dados, regrasIgnoradas[])`. Primeira regra: `CARGA_HORARIA_INTEGRALIZADA_MENOR_QUE_TOTAL`.
  3. `montarDadosDiploma` agora aceita `options.pular_regras_negocio` e dispara a validação no fim do pipeline. Dynamic `await import()` evita dependência circular module-level.
  4. `POST /api/processos/[id]/gerar-xml` devolve **422 estruturado** quando há violação (`tipo: "regra_negocio"`, `violacoes[]`, `mensagem_usuario`) e aceita `body.overrides` para re-tentar com sobrescrita justificada. Após sucesso com overrides, INSERT em `validacao_overrides` por violação sobrescrita.
  5. Frontend: `src/components/diploma/ModalOverrideRegra.tsx` — modal com state per-violation, exige justificativa ≥ 10 caracteres por divergência, mostra valores originais em JSON. Integrado em `diploma/diplomas/[id]/page.tsx` via helper `chamarGerarXml(overrides)` que detecta 422+regra_negocio e abre o modal automaticamente.
- **H1 deferido:** highlight visual amarelo no módulo de extração — fica para o primeiro caso real.
- **H3 deferido:** versionamento de grades curriculares (`curso_grades`) — só implementar quando aparecer o caso de aluno antigo cursando grade descontinuada.

---

## 🔴 NÃO RESOLVIDOS — pendências

### #F (era #4) — `<Documento>` vazio sem PDF base64 — **BLOQUEANTE**
- **Onde:** `src/lib/xml/generators/doc-academica.generator.ts:69-72`
- **Sintoma:** Cria `<Documento tipo="DocumentoIdentidadeDoAluno"></Documento>` vazio (sem `.txt(base64)`)
- **Evidência XSD:** `leiauteDocumentacaoAcademicaRegistroDiplomaDigital_v1.05.xsd:228-244` — conteúdo precisa ser `TPdfA` (PDF/A em base64)
- **Por que é bloqueante:** Sem PDF embarcado, o XML de DocumentaçãoAcadêmica não passa na validação XSD da registradora. É o ÚNICO bloqueador real para emissão.
- **Sub-projeto necessário:**
  1. Pipeline de upload de documentos comprobatórios (UI no painel)
  2. Salvar no Supabase Storage (bucket dedicado, retenção 10 anos, backup R2)
  3. Conversão para PDF/A-2 (Ghostscript) se ainda não estiver no formato
  4. Leitura dos bytes → conversão base64 → injeção no builder via `.txt(base64)`
  5. Mínimo 1 documento obrigatório (RG/CNH/Passaporte do diplomado)
  6. Validação no montador: lança 422 se nenhum documento estiver presente
- **Esforço:** 2–4 dias (sub-projeto separado)

---

## 🟡 HISTÓRICO — Decisões originais (mantidas como contexto, agora resolvidas)

### #G (era #8) — Atos regulatórios do curso (RenovacaoReconhecimento) — DECIDIDO: G2
- **Onde hoje:** `montador.ts:735-748` lê campos planos da tabela `cursos` (`tipo_reconhecimento`, `numero_reconhecimento`, `data_reconhecimento`, `veiculo_publicacao_reconhecimento`, `tipo_renovacao`, `numero_renovacao`, `data_renovacao`, etc.).
- **Status funcional:** Marcelo já corrigiu manualmente os dados do curso da Kauana no banco (inversão data/data_publicacao). XML atual já sai correto para esse caso. **Bug funcional resolvido, dívida estrutural permanece.**
- **Decisão (07/04/2026):** Caminho **G2** — criar tabela dedicada `atos_curso` análoga a `credenciamentos`.
- **Por que G2:**
  - Mantém consistência com a arquitetura do Bug #7 (que usa `credenciamentos`)
  - Permite histórico de atos (reconhecimentos + renovações sucessivas) sem perda de dados
  - Diplomas emitidos no passado continuam apontando para os atos vigentes naquela data
  - Abre espaço para auditoria e trilha de mudanças
- **Plano de implementação:**
  1. Migração SQL: criar tabela `atos_curso` com colunas `id`, `curso_id` (FK), `tipo_ato` (enum: 'reconhecimento' \| 'renovacao_reconhecimento'), `tipo_documento`, `numero`, `data_ato`, `veiculo_publicacao`, `data_publicacao`, `secao_publicacao`, `pagina_publicacao`, `numero_dou`, `created_at`, `updated_at`, `deleted_at`
  2. Backfill: migrar os dados atuais dos campos planos de `cursos` para `atos_curso` (preservando histórico se houver)
  3. Refactor `buscarAtosCurso(supabase, cursoId)` em `montador.ts` análogo a `buscarAtosIES`
  4. Aplicar regra de cardinalidade: 1 reconhecimento + renovação mais recente
  5. Frontend: tela de gestão de atos do curso (listagem + adicionar/editar)
  6. Deprecação: marcar campos planos em `cursos` como `@deprecated` no schema, remover em migração futura
- **Esforço:** ~1-1.5 dia (migração + backfill + refactor + tela + testes)

### #H (era #9) — Carga horária integralizada vs total — DECIDIDO: H1+H2+H3 com override humano
- **Onde hoje:** `historico.builder.ts:250-256` emite fielmente o que vem do payload. `montador.ts:339,803-805` lê `diplomas.carga_horaria_integralizada` (com fallback para `cursos.carga_horaria_total`).
- **Origem dos dados:** A `carga_horaria_integralizada` **vem da extração/importação do histórico escolar** (OCR do PDF oficial), não de cadastro manual no diploma. Marcelo confirmou em 07/04/2026.
- **Por isso a divergência tem 3 causas possíveis:**
  1. Erro de OCR na extração
  2. Inconsistência real no histórico oficial — secretaria precisa corrigir
  3. Grade curricular antiga (integralizada cumprida sob grade com total menor que a atual)
- **Decisão (07/04/2026):** Implementar **H1 + H2 + H3**, com **regra-mestra de override humano** sobre todas as validações automáticas.

#### Princípio fundamental — Override humano
> **Qualquer regra automática pode ser sobrescrita por confirmação humana explícita.**
>
> O sistema NUNCA deve bloquear o operador em definitivo. As validações automáticas servem para CHAMAR ATENÇÃO sobre inconsistências — mas a palavra final é sempre do humano com responsabilidade definida.
>
> Exemplos:
> - H2 detecta `integralizada < total` → bloqueia geração → operador clica "Confirmar mesmo assim", justifica em texto livre, registra quem aprovou e quando, e prossegue
> - Sistema audita: log com user_id, timestamp, regra sobrescrita, justificativa
> - O override fica disponível para auditoria futura (relatório de exceções aprovadas)

#### Implementação
1. **H1 — Validação na extração** (~2h)
   - Quando o extrator do histórico detectar `integralizada < total`, destacar campos divergentes em amarelo
   - Mensagem ao operador: "Carga horária integralizada (X) é menor que o mínimo do curso (Y). Verifique se o OCR leu correto antes de salvar."
   - Operador pode editar OU confirmar com observação
2. **H2 — Guardrail no montador** (~30 min + 1h frontend)
   - Antes de gerar o XML, validar `integralizada >= total`. Se falhar, retornar HTTP 422 com mensagem clara
   - Frontend exibe modal: "⚠️ Inconsistência detectada — [valores]. Você confirma que os dados estão corretos?"
   - Botão "Confirmar e gerar mesmo assim" exige preenchimento de justificativa (textarea obrigatória)
   - Ao confirmar, salvar registro em `validacao_overrides` (regra, valores, justificativa, user_id, timestamp)
   - Re-chamar a geração com flag `overrideValidacao: true` no payload
3. **H3 — Grade histórica** (~1 dia, escopo opcional/futuro)
   - Tabela `curso_grades` com versionamento: cada vez que a grade muda, nova linha com `vigente_de`/`vigente_ate`
   - Ao gerar XML, montador busca a grade vigente na `data_ingresso` do aluno (não a grade ATUAL do curso)
   - Resolve casos legítimos de aluno antigo cursando grade descontinuada
   - **Quando implementar:** quando aparecer o primeiro caso real (ainda não temos evidência de necessidade)
4. **Schema do override (compartilhado por todas as regras automáticas do sistema):**
   ```sql
   CREATE TABLE validacao_overrides (
     id uuid PRIMARY KEY,
     entidade_tipo text NOT NULL,  -- 'diploma', 'processo', etc.
     entidade_id uuid NOT NULL,
     regra_codigo text NOT NULL,   -- 'H2_carga_horaria', 'X_data_inversa', etc.
     valores_originais jsonb,       -- snapshot dos valores que dispararam o aviso
     justificativa text NOT NULL,
     usuario_id uuid NOT NULL REFERENCES auth.users(id),
     created_at timestamptz DEFAULT now()
   );
   ```
- **Esforço total #H:** H1 (~2h) + H2 (~1h30) + override schema (~1h) = ~4h30. H3 fica para depois.

---

## Próximas ações (em ordem de criticidade)

1. **#F** — Sub-projeto Documento PDF/A base64 (~2-4 dias) ← BLOQUEADOR ÚNICO de emissão real, será tratado em sessão dedicada
2. (Pós #F) Tela de gestão de atos do curso no painel admin
3. (Pós #F) Marcar campos planos da `cursos` como `@deprecated` e remover em migração futura
4. (Pós #F) Implementar #H1 (highlight amarelo na extração) quando surgir o primeiro caso real

---

## Referências

- Lista mestra original (#1–#12): `bugs-motor-xml-lista-mestra.md`
- Decisões da Onda 1 (#A–#D + nota de colisão): `decisoes-fix-motor-xml-onda1.md`
- Plano técnico: `bugs-motor-xml-plano-tecnico.md`
- Status pré-Ondas: `bugs-motor-xml-status-verificado.md`
- Estrutura XSD v1.05: `xml-estrutura-xsd-v105.md`
- Memória auto: `~/.auto-memory/project_bug_e_dataexpedicao_caminho_c.md`

## Commits relevantes

| Commit | Bugs | Mensagem |
|---|---|---|
| `0c25a58` | #1ant + #11ant | fix(xml): corrigir bugs #1 e #11 + estrutura modular motor v2 |
| `1802e3e` | #2ant + #7ant + #12ant | fix(xml): corrigir bugs #7, #2 e #12 do motor XML + RPC anti-race |
| `9902e87` | #A + #B + #C + #D | fix(motor-xml): ambiente dinâmico, validação RA, ordenação numérica, no pretty-print |
| `dde4be3` | (dep) | chore(deps): adicionar fast-xml-parser ao package.json |
| `24755f2` | #E | fix(motor-xml): DataExpedicaoDiploma derivada automaticamente (Bug #E / Onda 2) |
| `2518ed3` | #G + #H | feat(motor-xml): override humano de regras de negócio + atos_curso (Bugs #H e #G) |
