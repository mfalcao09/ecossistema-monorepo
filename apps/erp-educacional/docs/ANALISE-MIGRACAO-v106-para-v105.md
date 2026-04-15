# Análise de Migração XSD v1.06 → v1.05

**Data:** 2026-03-23
**Analisado por:** Claude (Opus 4) + Buchecha (MiniMax M2.7)
**Escopo:** Varredura completa do codebase + banco de dados Supabase
**Status:** Análise concluída — NENHUM CÓDIGO FOI ALTERADO

---

## 1. Resumo Executivo

O sistema está 100% construído para XSD v1.06. **Nenhum XML novo foi gerado ainda** (tabela `xml_gerados` vazia), então a migração não quebra dados existentes. Os 157 diplomas legados importados já são v1.05 na origem (`legado_versao_xsd: '1.05'`), mas foram marcados como `versao_xsd: '1.06'` no campo principal — isso precisa ser corrigido.

**Impacto total:** 22 arquivos precisam de alteração, distribuídos em 4 categorias:

| Categoria | Arquivos | Severidade |
|-----------|----------|------------|
| Motor XML (geração) | 4 | 🔴 CRÍTICO |
| Validadores XML | 2 | 🔴 CRÍTICO |
| Tipos/Interfaces TS | 3 | 🟡 MÉDIO |
| UI/Componentes/Páginas | 10 | 🔵 BAIXO (textos/labels) |
| API Routes | 2 | 🟡 MÉDIO |
| Documentação/Testes | 6+ | 🔵 BAIXO |

---

## 2. Dados do Banco de Dados (Supabase)

### 2.1 Estado Atual
```
┌─────────────┬────────────┬──────────┬──────────────────┬───────┐
│ status      │ versao_xsd │ is_legado│ legado_versao_xsd│ total │
├─────────────┼────────────┼──────────┼──────────────────┼───────┤
│ publicado   │ 1.06       │ true     │ 1.05             │  155  │
│ registrado  │ 1.06       │ true     │ 1.05             │    2  │
└─────────────┴────────────┴──────────┴──────────────────┴───────┘
```

### 2.2 Ações Necessárias no Banco
- [ ] **Corrigir `versao_xsd`** de `'1.06'` para `'1.05'` nos 157 diplomas legados (UPDATE simples)
- [ ] **Tabela `xml_gerados`** — vazia, nenhuma ação necessária
- [ ] **Tabela `diploma_config`** — verificar se `versao_xsd` default precisa mudar para `'1.05'`
- [ ] **Colunas faltantes** para v1.05:
  - `diplomados.codigo_municipio_ibge` — necessário para `<CodigoMunicipio>` na Naturalidade v1.05
  - `instituicoes.numero` (número do endereço) — necessário para `<Numero>` no Endereco v1.05
  - `instituicoes.bairro` — necessário para `<Bairro>` no Endereco v1.05
  - `instituicoes.complemento` — opcional
  - `instituicoes.codigo_municipio_ibge` — necessário para `<CodigoMunicipio>` no Endereco v1.05
  - `instituicoes.nome_municipio` — necessário para `<NomeMunicipio>` (ou usar o `municipio` existente)
  - `instituicoes.mantenedora_*` — campos para bloco `<Mantenedora>` (CNPJ, RazaoSocial)
  - `cursos.habilitacao` — para `<Habilitacao>` v1.05
  - `cursos.enfase` — para `<Enfase>` v1.05

---

## 3. Divergências Críticas — Motor de Geração XML

### 3.1 `src/lib/xml/gerador.ts` — REESCRITA NECESSÁRIA

#### 3.1.1 Elementos Raiz (Root Elements)

| Função | v1.06 (atual) | v1.05 (necessário) |
|--------|---------------|-------------------|
| `gerarDiplomaDigital()` | `<DiplomaDigital>` | `<Diploma>` |
| `gerarHistoricoEscolar()` | `<HistoricoEscolarDigital>` | `<DocumentoHistoricoEscolarFinal>` |
| `gerarDocAcademicaRegistro()` | `<DocumentacaoAcademicaRegistro>` | Mantém (mas estrutura interna muda totalmente) |

#### 3.1.2 Namespace

| v1.06 (atual) | v1.05 (necessário) |
|---------------|-------------------|
| `xmlns="http://portal.mec.gov.br/diplomadigital/arquivos-em-xsd"` | `xmlns="https://portal.mec.gov.br/diplomadigital/arquivos-em-xsd"` |
| `DiplomaDigital_v1.06.xsd` | `ldd_ndd_v1.05.xsd` |
| `HistoricoEscolarDigital_v1.06.xsd` | `hist_v1.05.xsd` (verificar nome exato) |
| `DocumentacaoAcademicaRegistroDiplomaDigital_v1.06.xsd` | `doc_acad_v1.05.xsd` (verificar nome exato) |

#### 3.1.3 Wrappers Ausentes (v1.05 requer, v1.06 não tem)

**Diploma v1.05:**
```xml
<Diploma xmlns="https://portal.mec.gov.br/diplomadigital/arquivos-em-xsd">
  <infDiploma versao="1.05" id="VDip{44 dígitos}" ambiente="Produção">
    <DadosDiploma id="Dip{44 dígitos}">
      <!-- conteúdo do diploma -->
    </DadosDiploma>
    <DadosRegistro id="RDip{44 dígitos}">
      <!-- dados de registro com IesRegistradora -->
    </DadosRegistro>
  </infDiploma>
  <!-- Assinaturas ficam FORA do infDiploma -->
</Diploma>
```

**Histórico v1.05:**
```xml
<DocumentoHistoricoEscolarFinal xmlns="https://portal.mec.gov.br/diplomadigital/arquivos-em-xsd">
  <infHistoricoEscolar versao="1.05" ambiente="Produção">
    <!-- conteúdo do histórico -->
  </infHistoricoEscolar>
</DocumentoHistoricoEscolarFinal>
```

#### 3.1.4 Renomeação de Elementos Filhos

| Função | Elemento v1.06 (atual) | Elemento v1.05 (necessário) |
|--------|----------------------|---------------------------|
| `gerarDadosDiplomado()` | `<DadosDiplomado>` | `<Diplomado>` |
| `gerarDadosCurso()` | `<CodigoEmec>` | `<CodigoCursoEMEC>` |
| `gerarDadosCurso()` | `<Grau>` | `<GrauConferido>` |
| `gerarDadosIES()` | `<DadosIES>` | `<IesEmissora>` |
| `gerarDadosIES()` | `<NomeIES>` | `<Nome>` |
| `gerarHistoricoEscolar()` | Usa `<DadosDiplomado>` | Deve usar `<Aluno>` |

#### 3.1.5 Estruturas Internas Diferentes

**Naturalidade (v1.05):**
```xml
<!-- v1.06 (atual) -->
<Naturalidade>
  <Municipio>Cassilândia</Municipio>
  <UF>MS</UF>
</Naturalidade>

<!-- v1.05 (necessário) -->
<Naturalidade>
  <CodigoMunicipio>5002902</CodigoMunicipio>
  <NomeMunicipio>Cassilândia</NomeMunicipio>
  <UF>MS</UF>
</Naturalidade>
```

**Filiação (v1.05):**
```xml
<!-- v1.06 (atual) -->
<Filiacao>
  <NomeMae>Maria da Silva</NomeMae>
  <NomePai>José da Silva</NomePai>
</Filiacao>

<!-- v1.05 (necessário) -->
<Filiacao>
  <Genitor>
    <Nome>Maria da Silva</Nome>
    <Sexo>F</Sexo>
  </Genitor>
  <Genitor>
    <Nome>José da Silva</Nome>
    <Sexo>M</Sexo>
  </Genitor>
</Filiacao>
```

**Endereço da IES (v1.05 — campos adicionais):**
```xml
<Endereco>
  <Logradouro>Av. Brasil</Logradouro>
  <Numero>123</Numero>            <!-- NOVO -->
  <Bairro>Centro</Bairro>         <!-- NOVO -->
  <Complemento>Sala 1</Complemento> <!-- NOVO (opcional) -->
  <CodigoMunicipio>5002902</CodigoMunicipio> <!-- NOVO -->
  <NomeMunicipio>Cassilândia</NomeMunicipio> <!-- NOVO -->
  <UF>MS</UF>
  <CEP>79540000</CEP>
</Endereco>
```

**DadosRegistro (v1.05 — estrutura completamente diferente):**
```xml
<DadosRegistro id="RDip{44 dígitos}">
  <IesRegistradora>
    <Nome>Universidade Federal...</Nome>
    <CodigoMEC>694</CodigoMEC>
    <CNPJ>...</CNPJ>
  </IesRegistradora>
  <LivroRegistro>
    <LivroRegistroDiploma>
      <NumeroLivro>...</NumeroLivro>
      <NumeroFolha>...</NumeroFolha>
      <NumeroSequenciaDiploma>...</NumeroSequenciaDiploma>
      <NumeroProcesso>...</NumeroProcesso>
      <DataRegistro>...</DataRegistro>
      <DataColacaoGrau>...</DataColacaoGrau>
    </LivroRegistroDiploma>
  </LivroRegistro>
  <IdDocumentacaoAcademica>...</IdDocumentacaoAcademica>
  <Seguranca>
    <CodigoValidacao>1606.694.3590b90ce266</CodigoValidacao>
  </Seguranca>
</DadosRegistro>
```

**DocumentacaoAcademicaRegistro (v1.05 — sem RitoEmissao):**
```xml
<!-- v1.05 usa RegistroReq como wrapper -->
<DocumentacaoAcademicaRegistro>
  <RegistroReq versao="1.05" id="ReqDip{44 dígitos}" ambiente="Produção">
    <DadosDiploma>...</DadosDiploma>
    <DadosPrivadosDiplomado>
      <CPF>...</CPF>
      <RG>...</RG>
      <Endereco>...</Endereco>
    </DadosPrivadosDiplomado>
    <DocumentacaoComprobatoria>
      <TipoDocumento>...</TipoDocumento>
      <CodigoDocumento>...</CodigoDocumento>
    </DocumentacaoComprobatoria>
  </RegistroReq>
</DocumentacaoAcademicaRegistro>
```

#### 3.1.6 Código de Validação (Formato)

| v1.06 (atual) | v1.05 (necessário) |
|---------------|-------------------|
| `FIC{ano}{13 chars aleatórios}` | `{eMEC_emissora}.{eMEC_registradora}.{hex12+}` |
| Ex: `FIC2026ABCDEFGHIJKLM` | Ex: `1606.694.3590b90ce266` |

**Arquivo:** `src/lib/xml/montador.ts` — função `gerarCodigoValidacao()`

#### 3.1.7 Padrão de IDs (v1.05)
```
VDip + 44 dígitos    → id do infDiploma
Dip + 44 dígitos     → id do DadosDiploma
RDip + 44 dígitos    → id do DadosRegistro
ReqDip + 44 dígitos  → id do RegistroReq
```
Estes IDs não existem no código atual.

---

### 3.2 `src/lib/xml/tipos.ts` — Interfaces TypeScript

**Campos faltantes para v1.05:**
- `diplomado.codigo_municipio_ibge` — obrigatório (atualmente opcional)
- `diplomado.id` — campo `<ID>` do diplomado
- `ies.numero` — número do endereço
- `ies.bairro` — bairro
- `ies.complemento` — complemento (opcional)
- `ies.codigo_municipio_ibge` — código IBGE do município
- `ies.nome_municipio` — nome do município
- `ies.mantenedora_cnpj` — CNPJ da mantenedora
- `ies.mantenedora_razao_social` — razão social da mantenedora
- `ies.recredenciamento_*` — dados de recredenciamento
- `ies.renovacao_recredenciamento_*` — dados de renovação
- `curso.habilitacao` — habilitação
- `curso.enfase` — ênfase
- `curso.endereco_curso` — endereço do curso
- `curso.autorizacao_*` — dados de autorização
- `curso.reconhecimento_*` — dados de reconhecimento
- `curso.renovacao_reconhecimento_*` — dados de renovação de reconhecimento

**Comentários a atualizar:**
- Linha 3: "XSD v1.06" → "XSD v1.05"
- Linha 20: "OBRIGATÓRIO pelo XSD v1.06" → "XSD v1.05"
- Linha 137: "Conforme XSD v1.06" → "XSD v1.05"

### 3.3 `src/lib/xml/montador.ts` — Montador de Dados

**Problemas:**
1. `gerarCodigoValidacao()` — formato `FIC{ano}{13chars}` incompatível com v1.05 (deve ser `{eMEC}.{eMEC}.{hex12}`)
2. Query da tabela `instituicoes` — faltam campos: `numero`, `bairro`, `complemento`, `codigo_municipio_ibge`
3. Query da tabela `diplomados` — falta campo: `codigo_municipio_ibge`
4. Não gera IDs no formato v1.05 (VDip, Dip, RDip, ReqDip + 44 dígitos)
5. Não busca dados da IES Registradora (assume IES Emissora = Registradora, que é correto para FIC mas a estrutura XML é diferente)

### 3.4 `src/lib/xml/validador.ts` — Validador Interno

**Problemas identificados pela Buchecha:**
1. `validarDiplomaDigital()` — verifica `<DiplomaDigital` → deve verificar `<Diploma`
2. `validarDiplomaDigital()` — campos: `NomeIES`, `CodigoEmec`, `Grau` → `Nome`, `CodigoCursoEMEC`, `GrauConferido`
3. `validarHistoricoEscolar()` — verifica `<HistoricoEscolarDigital` → `<DocumentoHistoricoEscolarFinal`
4. `validarDocAcademicaRegistro()` — verifica `<RitoEmissao>` → não existe em v1.05

---

## 4. Divergências nos Validadores do Portal

### 4.1 `src/lib/portal/validar-xml.ts`

| Linha | Problema | Correção |
|-------|----------|----------|
| 31-38 | `NAMESPACES_DIPLOMA` usa `http://` | Adicionar variantes `https://` para v1.05 |
| 44 | `HistoricoEscolarDigital` mapeado | Adicionar `DocumentoHistoricoEscolarFinal` |
| 65-78 | `CAMPOS_OBRIGATORIOS['HistoricoEscolar']` lista `DadosAluno`, `DadosIESEmissora` | Corrigir para `Aluno`, `IesEmissora` |
| 72-78 | `CAMPOS_OBRIGATORIOS['HistoricoEscolar']` (duplicado com nomes errados) | Corrigir ambas entradas |
| 230-234 | "Vigente: v1.06" | Alterar para "Vigente: v1.05" |
| 186-191 | `TIPOS_PRIORIDADE` — falta `DocumentoHistoricoEscolarFinal` | Adicionar à lista |

---

## 5. Divergências em API Routes

### 5.1 `src/app/api/processos/[id]/gerar-xml/route.ts`

| Linha | Problema | Correção |
|-------|----------|----------|
| 94, 105, 116 | `versao_xsd: "1.06"` hardcoded | Mudar para `"1.05"` |
| 166-167 | Mensagem diz "XSD v1.06 do MEC" | Mudar para v1.05 |
| 81 | Chama `validarDiplomaDigital()` (v1.06) | Deve chamar validador v1.05 |

### 5.2 `src/app/api/diplomas/migracao/lote/route.ts`

| Linha | Problema | Notas |
|-------|----------|-------|
| 53-55 | Detecta tipo por `DiplomaDigital`/`HistoricoEscolarDigital` | Já funciona para legado (que é v1.05) mas precisa adicionar `Diploma`/`DocumentoHistoricoEscolarFinal` |
| 233 | Extrai versão XSD de `DiplomaDigital` atributo | Adicionar extração de atributo `versao` do `infDiploma` (v1.05) |
| 246 | Extrai CPF de `DadosDiplomado` | Adicionar extração de `Diplomado` (v1.05) |

---

## 6. Divergências em Tipos TypeScript

### 6.1 `src/types/diplomas.ts`

| Linha | Problema | Correção |
|-------|----------|----------|
| 15 | Comentário "XSD v1.06" | Atualizar |
| 113 | `versao_xsd: string // Default: '1.06'` | Default: `'1.05'` |
| 242 | `tipo: 'DiplomaDigital' \| 'HistoricoEscolarDigital' \| ...` | Adicionar `'Diploma' \| 'DocumentoHistoricoEscolarFinal'` |
| 368 | `versao_xsd` comentário diz `'1.06'` | Atualizar |

### 6.2 `src/types/diploma-config.ts`

| Linha | Problema | Correção |
|-------|----------|----------|
| 89 | `VERSOES_XSD = ['1.06', '1.05', '1.04']` | Reordenar: `['1.05', '1.06', '1.04']` (v1.05 primeiro) |

---

## 7. Divergências em UI/Componentes

### 7.1 Páginas do ERP (textos e labels)

| Arquivo | Linhas | Problema |
|---------|--------|----------|
| `src/app/(erp)/home/page.tsx` | 163 | "XSD v1.06" no rodapé |
| `src/app/(erp)/diploma/page.tsx` | 213 | "XSD v1.06" no pipeline |
| `src/app/(erp)/diploma/layout.tsx` | 36 | "XSD v1.06 · MEC" no header |
| `src/app/(erp)/diploma/diplomados/page.tsx` | 36, 56, 181 | "obrigatório XSD v1.06" |
| `src/app/(erp)/diploma/assinantes/page.tsx` | 188, 863, 984 | "XSD v1.06" em 3 lugares |
| `src/app/(erp)/diploma/diplomas/[id]/page.tsx` | 98-99, 180, 326, 724 | `DiplomaDigital`/`HistoricoEscolarDigital` labels + "XSD v1.06" |

### 7.2 Componentes de Config

| Arquivo | Linhas | Problema |
|---------|--------|----------|
| `src/components/config/AbaInstituicao.tsx` | 269 | "IesRegistradora no XSD v1.06" |
| `src/components/config/AbaRegras.tsx` | 40, 46, 223, 231, 361, 370, 374 | Múltiplas refs a v1.06 |

### 7.3 RVDD

| Arquivo | Linhas | Problema |
|---------|--------|----------|
| `src/app/rvdd/[id]/page.tsx` | 363 | "XSD DiplomaDigital v{versao_xsd}" |

---

## 8. Divergências em Prompts de IA

### 8.1 `src/lib/ai/prompts/system-migracao.ts`

Múltiplas referências a `DiplomaDigital`, `HistoricoEscolarDigital`, "XSD v1.06" nas linhas:
164, 210, 267, 293, 332, 358

**Nota:** Este é o prompt do assistente de migração de legado. Como os XMLs legados JÁ SÃO v1.05, as referências a v1.06 neste prompt estão tecnicamente incorretas.

---

## 9. Documentação e Testes

| Arquivo | Tipo | Ação |
|---------|------|------|
| `src/lib/xml/README.md` | Doc | Reescrever (14+ refs a v1.06) |
| `src/lib/xml/CHECKLIST-MARCELO.md` | Doc | Atualizar refs |
| `src/lib/xml/RESUMO.txt` | Doc | Atualizar refs |
| `src/lib/xml/INTEGRACAO.md` | Doc | Atualizar refs |
| `src/lib/xml/__tests__/gerador.test.ts` | Teste | Reescrever testes (13+ refs a v1.06 elements) |
| `src/lib/xml/exemplo-uso.ts` | Exemplo | Atualizar chamadas |

---

## 10. Resumo de Ações por Prioridade

### 🔴 P0 — Crítico (bloqueia geração de XMLs válidos)

1. **Reescrever `gerador.ts`** — root elements, wrappers, nomes de elementos, namespace
2. **Reescrever `validador.ts`** — adaptar todas verificações para v1.05
3. **Atualizar `tipos.ts`** — adicionar campos faltantes para v1.05
4. **Atualizar `montador.ts`** — novo formato de código de validação, novos campos no SELECT, geração de IDs v1.05
5. **Atualizar `validar-xml.ts`** (portal) — corrigir CAMPOS_OBRIGATORIOS para HistoricoEscolar v1.05, adicionar DocumentoHistoricoEscolarFinal
6. **Adicionar colunas no Supabase** — `codigo_municipio_ibge` em diplomados e instituicoes, `numero`/`bairro` em instituicoes, mantenedora

### 🟡 P1 — Médio (funcionalidade incorreta mas não bloqueia)

7. **Atualizar `route.ts` (gerar-xml)** — versão hardcoded 1.06 → 1.05
8. **Atualizar `route.ts` (migracao/lote)** — detection de tipos v1.05
9. **Atualizar `diplomas.ts`** — tipos, defaults, comentários
10. **Atualizar `diploma-config.ts`** — reordenar VERSOES_XSD
11. **Corrigir `versao_xsd` no banco** — UPDATE 157 diplomas de '1.06' para '1.05'

### 🔵 P2 — Baixo (labels, textos, docs)

12. **Atualizar 10 páginas/componentes UI** — trocar "v1.06" por "v1.05"
13. **Atualizar prompt de migração IA** — refs a v1.06
14. **Reescrever testes** — adaptar para v1.05
15. **Atualizar documentação** — README, CHECKLIST, RESUMO, INTEGRACAO

---

## 11. Minha Avaliação (Claude) vs Buchecha (MiniMax)

### Concordância Total
Concordo 100% com todos os 13 problemas críticos identificados pela Buchecha nos dois reviews. Cada um é real e precisa de correção.

### Itens Adicionais que Identifiquei (não cobertos pela Buchecha)

1. **Formato do código de validação** (`montador.ts`) — Buchecha não analisou o montador
2. **Padrão de IDs v1.05** (VDip, Dip, RDip, ReqDip) — totalmente ausente no código
3. **Colunas faltantes no banco** — precisa de migration SQL
4. **157 diplomas com `versao_xsd` errado** — dado do banco, fora do escopo de code review
5. **Prompt de IA de migração** — precisa atualizar terminologia
6. **10+ páginas UI** com labels hardcoded v1.06

### Top 3 Ações Mais Impactantes

1. **Reescrever `gerador.ts` do zero** — É o coração do sistema. Cada função precisa de mudanças estruturais profundas (wrappers, nomes, namespace). Refatorar não basta — é melhor reescrever com base na referência `docs/XSD-v1.05-REFERENCIA.md`.

2. **Criar migration SQL** — Adicionar colunas faltantes (`codigo_municipio_ibge`, `numero`, `bairro`, mantenedora) e corrigir `versao_xsd` dos 157 diplomas.

3. **Validador versão-aware** — Concordo com a recomendação da Buchecha de criar um objeto de configuração por versão, em vez de duplicar funções. Isso prepara para eventual suporte a v1.06 quando o MEC atualizar.
