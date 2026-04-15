# Relatório de Conformidade — XSD v1.05 vs Sistema ERP FIC

**Data:** 26 de março de 2026
**Responsável:** Claude (Opus 4) — Arquiteto-chefe
**Sessão:** 010
**Objetivo:** Verificar se o código-fonte e o banco de dados estão em conformidade com o XSD v1.05 do MEC, após migração da v1.06 e perda de histórico por crash da VM.

---

## 1. RESUMO EXECUTIVO

### Resultado geral: O sistema tem a ESTRUTURA correta, mas precisa de ajustes para conformidade total com XSD v1.05.

**O que está BOM (já conforme):**
- Estrutura de banco de dados cobre a maioria dos campos obrigatórios
- Tabelas de disciplinas, ENADE, estágios e atividades complementares existem
- Tipos TypeScript reconhecem a versão 1.05
- Arquivo `gerador.ts` já referencia XSD v1.05 no cabeçalho

**O que PRECISA ser corrigido (19 itens):**
- 6 problemas no **banco de dados** (dados marcados como v1.06, campos IBGE vazios)
- 10 problemas no **gerador XML** (namespace, elementos raiz, estrutura)
- 3 problemas nos **tipos TypeScript** (campos opcionais que deveriam ser obrigatórios)

---

## 2. DIAGNÓSTICO DO BANCO DE DADOS

### 2.1. Versão XSD nos dados — CRÍTICO

| Item | Situação | Impacto |
|------|----------|---------|
| `diplomas.versao_xsd` | **157 diplomas marcados como "1.06"** — zero como "1.05" | XMLs gerados terão versão errada |
| `diploma_config` (homologação) | `versao_xsd: "1.06"` | Config usa versão errada |
| `diploma_config` (produção) | `versao_xsd: "1.06"` | Config usa versão errada |

**Correção necessária:**
```sql
-- 1. Atualizar todos os diplomas existentes
UPDATE diplomas SET versao_xsd = '1.05' WHERE versao_xsd = '1.06';

-- 2. Atualizar configurações
UPDATE diploma_config SET versao_xsd = '1.05' WHERE versao_xsd = '1.06';
```

### 2.2. Código Município IBGE — CRÍTICO

O XSD v1.05 usa o grupo `GMunicipio` que exige 3 campos obrigatórios juntos: `CodigoMunicipio` (IBGE 7 dígitos) + `NomeMunicipio` + `UF`. Esse grupo aparece em TDadosDiplomado (naturalidade), TDadosCurso (endereço do curso), e TDadosIesEmissora (endereço da IES).

| Tabela | Campo | Situação |
|--------|-------|----------|
| `diplomados` | `codigo_municipio_ibge` | **0 de 157 diplomados têm esse campo preenchido** |
| `cursos` | `codigo_municipio` | Campo existe, precisa verificar se tem dados |
| `instituicoes` | `codigo_municipio` | Campo existe, precisa verificar se tem dados |

**Correção necessária:**
```sql
-- Popular código IBGE de Cassilândia/MS para todos os diplomados (caso padrão)
-- Código IBGE de Cassilândia/MS = 5002902
UPDATE diplomados SET codigo_municipio_ibge = '5002902'
WHERE codigo_municipio_ibge IS NULL OR codigo_municipio_ibge = '';
-- ATENÇÃO: Verificar caso a caso se TODOS os diplomados são naturais de Cassilândia
```

### 2.3. Tabelas de Histórico Escolar — DADOS VAZIOS

| Tabela | Registros | XSD v1.05 exige |
|--------|-----------|-----------------|
| `diploma_disciplinas` | **0 registros** | Obrigatório (pelo menos 1 disciplina por diploma) |
| `diploma_enade` | Existe, vazia | Obrigatório (situação ENADE de cada diplomado) |
| `diploma_estagios` | Existe | Opcional no XSD |
| `diploma_atividades_complementares` | Existe | Opcional no XSD |
| `diploma_habilitacoes` | Existe | Opcional no XSD |

**Impacto:** Sem disciplinas, é impossível gerar o XML `HistoricoEscolarDigital` válido.

### 2.4. Assinantes — Tipos de Certificado Inconsistentes

| Valor atual no banco | Valor esperado pelo XSD |
|---------------------|------------------------|
| `eCPF` | Correto — usado para pessoas físicas (Reitor, Secretário) |
| `ICP-Brasil A3` | Redundante — o XSD não tem esse tipo, é implícito (todo certificado é ICP-Brasil) |
| `ICP-Brasil e-CNPJ A3` | Deveria ser apenas `eCNPJ` — para a assinatura da IES |

### 2.5. Tabela `instituicoes` — Campos da Mantenedora

O XSD v1.05 exige dados da Mantenedora dentro de `TDadosIesEmissora`:

| Campo | Coluna no banco | Situação |
|-------|----------------|----------|
| Nome Mantenedora | `mantenedora_nome` | **Precisa verificar se preenchido** |
| CNPJ Mantenedora | `mantenedora_cnpj` | **Precisa verificar se preenchido** |
| Razão Social | `mantenedora_razao_social` | Existe |
| Código MEC | `mantenedora_codigo_mec` | Existe |
| Endereço | `mantenedora_endereco` (JSONB) | Existe |

### 2.6. Tabelas que existem e estão OK

| Tabela | Observação |
|--------|-----------|
| `diplomas` (157) | Estrutura OK, só precisa corrigir versao_xsd |
| `diplomados` (157) | Estrutura OK, precisa popular codigo_municipio_ibge |
| `cursos` (com 80+ colunas) | Muito completa — inclui autorização, reconhecimento, renovação |
| `assinantes` | Estrutura OK |
| `fluxo_assinaturas` (785) | Populado |
| `instituicoes` | Estrutura completa com mantenedora |
| `credenciamentos` | Tabela separada para atos regulatórios |

---

## 3. DIAGNÓSTICO DO GERADOR XML (`src/lib/xml/gerador.ts`)

### 3.1. Namespace — CRÍTICO

**Problema:** O namespace usa `http://` mas o XSD v1.05 exige `https://`.

| Local | Atual (ERRADO) | Correto |
|-------|----------------|---------|
| Linha 169 (DiplomaDigital) | `http://portal.mec.gov.br/...` | `https://portal.mec.gov.br/diplomadigital/arquivos-em-xsd` |
| Linha 241 (HistoricoEscolar) | `http://portal.mec.gov.br/...` | `https://portal.mec.gov.br/diplomadigital/arquivos-em-xsd` |
| Linha 282-283 (DocAcademica) | `http://portal.mec.gov.br/...` | `https://portal.mec.gov.br/diplomadigital/arquivos-em-xsd` |

### 3.2. Elementos Raiz — CRÍTICO

| XML | Elemento atual (ERRADO) | Elemento correto (XSD v1.05) |
|-----|------------------------|------------------------------|
| Diploma Digital | `<DiplomaDigital>` | `<Diploma>` (tipo `TDiploma`) |
| Histórico Escolar | `<HistoricoEscolarDigital>` | `<DocumentoHistoricoEscolarFinal>` (tipo `TDocumentoHistoricoEscolarDigital`) |
| Doc. Acadêmica | `<DocumentacaoAcademicaRegistro>` | `<DocumentacaoAcademicaRegistro>` — **CORRETO** |

### 3.3. Atributos nos Elementos Raiz — AUSENTES

O XSD v1.05 exige dois atributos em cada elemento raiz:

| Atributo | Tipo | Padrão | Exemplo |
|----------|------|--------|---------|
| `versao` | `TVersao` | Fixo `"1.05"` | `versao="1.05"` |
| `id` | `xs:ID` | Específico por XML | `id="Dip00000000000000000000000000000000000000000001"` |

**Padrões do atributo `id`:**
- Diploma: `VDip[0-9]{44}` (validação) ou `Dip[0-9]{44}` (diploma)
- Histórico: `Hist[0-9]{44}`
- Doc. Acadêmica: `DocAcReg[0-9]{40}`

### 3.4. Estrutura de `TDadosDiplomado` — INCOMPLETA

**Problemas encontrados:**

| # | Problema | Detalhe |
|---|---------|---------|
| 1 | Falta `<ID>` (RA) | O XSD exige `<ID>` como identificador do aluno (número de RA) — campo obrigatório |
| 2 | Falta `<CodigoMunicipio>` | Dentro de `<Naturalidade>`, o GMunicipio exige: CodigoMunicipio + NomeMunicipio + UF |
| 3 | Ordem dos elementos | XSD é `sequence` (ordem fixa): Nome, NomeSocial, Sexo, Nacionalidade, CPF, DataNascimento, Naturalidade, RG, ID |

**Código atual (simplificado):**
```xml
<DadosDiplomado>
  <Nome>...</Nome>
  <CPF>...</CPF>
  <DataNascimento>...</DataNascimento>
  <Sexo>...</Sexo>
  <Nacionalidade>...</Nacionalidade>
  <Naturalidade>
    <Municipio>...</Municipio>
    <UF>...</UF>
  </Naturalidade>
</DadosDiplomado>
```

**Código correto (XSD v1.05):**
```xml
<DadosDiplomado>
  <Nome>...</Nome>
  <NomeSocial>...</NomeSocial>           <!-- opcional -->
  <Sexo>M</Sexo>                         <!-- antes do CPF -->
  <Nacionalidade>Brasileira</Nacionalidade>
  <CPF>...</CPF>
  <DataNascimento>2000-01-01</DataNascimento>
  <Naturalidade>
    <CodigoMunicipio>5002902</CodigoMunicipio>  <!-- IBGE 7 dígitos -->
    <NomeMunicipio>Cassilândia</NomeMunicipio>
    <UF>MS</UF>
  </Naturalidade>
  <RG>                                    <!-- opcional -->
    <Numero>...</Numero>
    <OrgaoExpedidor>...</OrgaoExpedidor>
    <UF>...</UF>
  </RG>
  <ID>123456</ID>                         <!-- RA do aluno - OBRIGATÓRIO -->
</DadosDiplomado>
```

### 3.5. Estrutura de `TDadosCurso` — SIMPLIFICADA DEMAIS

O XSD v1.05 define uma estrutura bem mais complexa para `TDadosCurso`:

**Campos obrigatórios ausentes no gerador:**

| Campo | Tipo XSD | Descrição |
|-------|----------|-----------|
| `Autorizacao` | `TAtoRegulatorioComOuSemEMEC` | Ato de autorização do curso |
| `Reconhecimento` | `TAtoRegulatorioComOuSemEMEC` | Ato de reconhecimento |
| `RenovacaoReconhecimento` | Opcional, mesmo tipo | Renovação de reconhecimento |
| `Habilitacao` | Sequência | Habilitação conferida |
| `Endereco` | `GMunicipio` obrigatório | Endereço do curso com IBGE |

**Tipo `TAtoRegulatorioComOuSemEMEC`:**
```xml
<Autorizacao>
  <Tipo>Decreto</Tipo>
  <Numero>12345</Numero>
  <Data>2010-01-01</Data>
  <NumeroEMEC>202001234567</NumeroEMEC>     <!-- opcional -->
  <VeiculoPublicacao>Diário Oficial da União</VeiculoPublicacao>  <!-- opcional -->
  <DataPublicacao>2010-02-01</DataPublicacao>
  <SecaoDOU>1</SecaoDOU>
  <PaginaDOU>15</PaginaDOU>
</Autorizacao>
```

**Status no banco:** A tabela `cursos` TEM essas colunas (`tipo_autorizacao`, `numero_autorizacao`, `data_autorizacao`, `veiculo_publicacao_autorizacao`, `data_publicacao_autorizacao`, `secao_publicacao_autorizacao`, `pagina_publicacao_autorizacao`, etc.) — mas o gerador NÃO usa esses campos.

### 3.6. Estrutura de `TDadosIesEmissora` — INCOMPLETA

**Código atual (simplificado):**
```xml
<DadosIES>
  <Nome>...</Nome>
  <CNPJ>...</CNPJ>
  <CodigoMEC>...</CodigoMEC>
  <Endereco>...</Endereco>
  <Credenciamento>...</Credenciamento>
</DadosIES>
```

**Código correto (XSD v1.05 `TDadosIesEmissora`):**
```xml
<IesEmissora>
  <Nome>FIC</Nome>
  <CodigoMEC>3167</CodigoMEC>
  <CNPJ>...</CNPJ>
  <Endereco>
    <Logradouro>...</Logradouro>
    <Numero>...</Numero>
    <Complemento>...</Complemento>
    <Bairro>...</Bairro>
    <CodigoMunicipio>5002902</CodigoMunicipio>   <!-- IBGE -->
    <NomeMunicipio>Cassilândia</NomeMunicipio>
    <UF>MS</UF>
    <CEP>79540000</CEP>
  </Endereco>
  <Credenciamento>
    <Tipo>Decreto</Tipo>
    <Numero>...</Numero>
    <Data>...</Data>
    <VeiculoPublicacao>...</VeiculoPublicacao>
    <DataPublicacao>...</DataPublicacao>
    <SecaoDOU>1</SecaoDOU>
    <PaginaDOU>...</PaginaDOU>
  </Credenciamento>
  <Recredenciamento>...</Recredenciamento>        <!-- se houver -->
  <Mantenedora>
    <RazaoSocial>...</RazaoSocial>
    <CNPJ>...</CNPJ>
    <Endereco>...</Endereco>
  </Mantenedora>
</IesEmissora>
```

**Problemas:**
1. Tag errada: `<DadosIES>` deveria ser `<IesEmissora>`
2. Faltam campos no Endereço: `Numero`, `Complemento`, `Bairro`, `CodigoMunicipio` (IBGE)
3. Falta seção `<Mantenedora>` completa
4. Falta `<Recredenciamento>` (se aplicável)
5. Credenciamento simplificado — falta `VeiculoPublicacao`, `DataPublicacao`, `SecaoDOU`, `PaginaDOU`

### 3.7. Histórico Escolar — Estrutura Faltante

**Campos obrigatórios no `THistoricoEscolar` (XSD v1.05) que NÃO estão no gerador:**

| Campo | Descrição |
|-------|-----------|
| `CodigoCurriculo` | Código do currículo do aluno |
| `SituacaoAtualDiscente` | "Formado", "Em curso", etc. |
| `CargaHorariaCurso` | CH total do currículo |
| `CargaHorariaCursoIntegralizada` | CH efetivamente cumprida |
| `IngressoCurso` | Bloco com FormaAcesso + DataIngresso |
| `ENADE.Condicao` | "Habilitado", "NaoHabilitado" — obrigatório dentro de ENADE |

### 3.8. Tag `<Disciplina>` no Histórico — Ajustes de Estrutura

**Campos que o XSD v1.05 exige em `TEntradaHistoricoDisciplina`:**

| Campo XSD | Nosso campo | Status |
|-----------|-------------|--------|
| `CodigoDisciplina` | `codigo` | OK |
| `NomeDisciplina` | `nome` | OK |
| `Periodo` | `periodo` | OK |
| `SituacaoDisciplina` | `situacao` | OK (mas verificar enum) |
| `CargaHoraria` (hora-aula) | `carga_horaria_aula` | OK |
| `CargaHorariaEmHoraRelogio` | `carga_horaria_relogio` | OK |
| `NotaDisciplina` | `nota` | OK |
| `Docente` (opcional) | `docente_*` | OK na estrutura |

**Ponto de atenção:** O XSD v1.05 usa nomes de tags diferentes dos nossos (ex: `<CodigoDisciplina>` e não `<Codigo>`).

---

## 4. DIAGNÓSTICO DOS TIPOS TYPESCRIPT

### 4.1. `src/types/diplomas.ts`

| Linha | Problema | Correção |
|-------|---------|----------|
| 113 | Comentário diz `// Default: '1.06'` | Mudar para `// Default: '1.05'` |

### 4.2. `src/lib/xml/tipos.ts`

| Campo | Atual | Deveria ser |
|-------|-------|-------------|
| `codigo_municipio_ibge` | Opcional (`?`) | **Obrigatório** (sem `?`) |
| `diplomado.ra` (ID) | Existe como `string` | OK — mas não está sendo usado no gerador |

### 4.3. `src/types/diploma-config.ts`

| Linha | Situação |
|-------|----------|
| `VERSOES_XSD = ['1.05', '1.06', '1.04']` | OK — v1.05 já está listada |

---

## 5. PLANO DE CORREÇÃO — PRIORIZADO

### FASE 1: Dados (pode fazer AGORA — SQL direto)

| # | Ação | Prioridade | Dificuldade |
|---|------|-----------|-------------|
| 1 | `UPDATE diplomas SET versao_xsd = '1.05'` | CRÍTICA | Fácil |
| 2 | `UPDATE diploma_config SET versao_xsd = '1.05'` | CRÍTICA | Fácil |
| 3 | Popular `codigo_municipio_ibge` em `diplomados` | CRÍTICA | Média (precisa cruzar com dados de naturalidade) |
| 4 | Popular `diploma_disciplinas` (histórico de cada aluno) | CRÍTICA | Complexa (dados vêm do sistema acadêmico) |
| 5 | Popular `diploma_enade` | ALTA | Média |
| 6 | Verificar/popular dados de Mantenedora em `instituicoes` | ALTA | Fácil |

### FASE 2: Gerador XML (código)

| # | Ação | Prioridade | Dificuldade |
|---|------|-----------|-------------|
| 7 | Corrigir namespace `http://` → `https://` | CRÍTICA | Fácil |
| 8 | Corrigir elemento raiz: `DiplomaDigital` → `Diploma` | CRÍTICA | Fácil |
| 9 | Corrigir elemento raiz: `HistoricoEscolarDigital` → `DocumentoHistoricoEscolarFinal` | CRÍTICA | Fácil |
| 10 | Adicionar atributos `versao="1.05"` e `id` nos elementos raiz | CRÍTICA | Fácil |
| 11 | Reescrever `gerarDadosDiplomado()` — ordem, ID, CodigoMunicipio | CRÍTICA | Média |
| 12 | Reescrever `gerarDadosCurso()` — Autorização, Reconhecimento como TAtoRegulatorio | ALTA | Média |
| 13 | Reescrever `gerarDadosIES()` — tag IesEmissora, Mantenedora, endereço completo | ALTA | Média |
| 14 | Atualizar `gerarHistoricoEscolar()` — campos obrigatórios faltantes | ALTA | Média |
| 15 | Ajustar nomes de tags em `gerarDisciplinas()` | MÉDIA | Fácil |

### FASE 3: Tipos TypeScript

| # | Ação | Prioridade | Dificuldade |
|---|------|-----------|-------------|
| 16 | Tornar `codigo_municipio_ibge` obrigatório em `tipos.ts` | ALTA | Fácil |
| 17 | Atualizar comentário da versão em `diplomas.ts` | BAIXA | Fácil |
| 18 | Adicionar campos faltantes nas interfaces (`IngressoCurso`, etc.) | MÉDIA | Média |
| 19 | Validação de schemas (Zod) para os dados de entrada do gerador | MÉDIA | Média |

---

## 6. O QUE ESTÁ CORRETO E NÃO PRECISA MUDAR

Para ser justo, muita coisa já está bem encaminhada:

- A **decisão de que a FIC gera apenas 2 XMLs** (Histórico + DocAcademica) está correta — o `@deprecated` no `gerarDiplomaDigital()` é adequado
- O banco de dados tem **todas as tabelas necessárias** — `diploma_disciplinas`, `diploma_enade`, `diploma_estagios`, `diploma_atividades_complementares`, `diploma_habilitacoes`
- A tabela `cursos` é **extremamente completa** — tem autorização, reconhecimento, renovação, com todos os campos de publicação DOU
- A tabela `instituicoes` tem os campos de **Mantenedora** (nome, CNPJ, razão social, código MEC, endereço)
- Os **credenciamentos** têm tabela própria
- Os **assinantes** têm a estrutura correta com `tipo_certificado` e `ordem_assinatura`
- O campo `codigo_validacao` segue o padrão `TCodigoValidacao` correto
- O `TCodigoValidacao` pattern `\d{1,}\.\d{1,}\.[a-f0-9]{12,}` confere com o formato usado

---

## 7. CONCLUSÃO

O sistema tem uma **base sólida** — as tabelas do banco cobrem praticamente todos os campos que o XSD v1.05 exige. O principal trabalho pendente é:

1. **Dados:** Migrar a marcação de versão de 1.06 para 1.05 e popular campos obrigatórios (IBGE, disciplinas)
2. **Gerador XML:** Reestruturar para seguir a ordem e nomes exatos do XSD v1.05
3. **Tipos:** Pequenos ajustes de obrigatoriedade

A estimativa é de **2-3 sessões de trabalho** para atingir conformidade total, sendo que a Fase 1 (SQL) pode ser executada imediatamente.
