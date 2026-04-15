# Referência Completa — XSD Diploma Digital v1.05

> **Versão XSD:** 1.05
> **Namespace:** `https://portal.mec.gov.br/diplomadigital/arquivos-em-xsd`
> **TVersao aceita:** `1.05`
> **Data de referência:** 2026-03-23

---

## 1. Arquivos XSD e Hierarquia de Dependências

```
diplomadigital_v1-05.xsd
  └── leiauteDiplomaDigital_v1.05.xsd
        └── tiposBasicos_v1.05.xsd
        └── xmldsig-core-schema_v1.1.xsd

historicoescolardigital_v1-05.xsd
  └── leiauteHistoricoEscolar_v1.05.xsd
        └── leiauteDiplomaDigital_v1.05.xsd
        └── tiposBasicos_v1.05.xsd
        └── xmldsig-core-schema_v1.1.xsd

documentacaoacademicaregistrodiplomadigital_v1-05.xsd
  └── leiauteDocumentacaoAcademicaRegistroDiplomaDigital_v1.05.xsd
        └── leiauteDiplomaDigital_v1.05.xsd
        └── leiauteHistoricoEscolar_v1.05.xsd
        └── tiposBasicos_v1.05.xsd
        └── xmldsig-core-schema_v1.1.xsd

curriculoescolardigital_v1-05.xsd
  └── leiauteCurriculoEscolar_v1.05.xsd
        └── leiauteHistoricoEscolar_v1.05.xsd

arquivofiscalizacao_v1-05.xsd
  └── leiauteArquivoFiscalizacao_v1.05.xsd
        └── leiauteDiplomaDigital_v1.05.xsd
        └── tiposBasicos_v1.05.xsd
```

---

## 2. Os 3 XMLs Obrigatórios — Elementos Raiz

### 2.1 Diploma Digital
- **Elemento raiz:** `<Diploma>` (tipo `TDiploma`)
- **NÃO é** `<DiplomaDigital>` (isso é v1.06)
- **Estrutura:**
  ```xml
  <Diploma xmlns="https://portal.mec.gov.br/diplomadigital/arquivos-em-xsd">
    <infDiploma versao="1.05" id="VDip{44 dígitos}" ambiente="Produção">
      <!-- choice 1: normal -->
      <DadosDiploma id="Dip{44 dígitos}">
        <Diplomado>...</Diplomado>
        <DataConclusao>AAAA-MM-DD</DataConclusao>  <!-- opcional -->
        <DadosCurso>...</DadosCurso>
        <IesEmissora>...</IesEmissora>
        <Assinantes>...</Assinantes>  <!-- opcional -->
        <ds:Signature>...</ds:Signature>  <!-- 1..n assinaturas emissora -->
      </DadosDiploma>
      <DadosRegistro id="RDip{44 dígitos}">
        <IesRegistradora>...</IesRegistradora>
        <LivroRegistro>...</LivroRegistro>
        <IdDocumentacaoAcademica>ReqDip{44 dígitos}</IdDocumentacaoAcademica>
        <Seguranca>
          <CodigoValidacao>EMEC_EMISSORA.EMEC_REG.hex12+</CodigoValidacao>
        </Seguranca>
        <InformacoesAdicionais>...</InformacoesAdicionais>  <!-- opcional -->
        <Assinantes>...</Assinantes>  <!-- opcional -->
        <ds:Signature>...</ds:Signature>  <!-- 1..n assinaturas registradora -->
      </DadosRegistro>
    </infDiploma>
    <ds:Signature>...</ds:Signature>  <!-- assinatura externa (AD-RA) -->
  </Diploma>
  ```

### 2.2 Histórico Escolar Digital
- **Elementos raiz possíveis:**
  - `<DocumentoHistoricoEscolarFinal>` (tipo `TDocumentoHistoricoEscolarDigital`)
  - `<DocumentoHistoricoEscolarParcial>` (tipo `TDocumentoHistoricoEscolarDigital`)
  - `<DocumentoHistoricoEscolarSegundaViaNatoFisico>` (tipo `TDocumentoHistoricoEscolarSegundaViaNatoFisico`)
- **NÃO é** `<HistoricoEscolarDigital>` (isso é v1.06)
- **Estrutura (Final/Parcial):**
  ```xml
  <DocumentoHistoricoEscolarFinal xmlns="https://portal.mec.gov.br/diplomadigital/arquivos-em-xsd">
    <infHistoricoEscolar versao="1.05" ambiente="Produção">
      <Aluno>...</Aluno>  <!-- tipo TDadosDiplomado (mesma struct do Diplomado) -->
      <DadosCurso>...</DadosCurso>  <!-- ou DadosCursoNSF -->
      <IesEmissora>...</IesEmissora>
      <HistoricoEscolar>
        <CodigoCurriculo>...</CodigoCurriculo>
        <ElementosHistorico>
          <Disciplina>...</Disciplina>  <!-- 1..n: Disciplina|AtividadeComplementar|Estagio|SituacaoDiscente -->
        </ElementosHistorico>
        <DataEmissaoHistorico>AAAA-MM-DD</DataEmissaoHistorico>
        <HoraEmissaoHistorico>HH:MM:SS</HoraEmissaoHistorico>
        <SituacaoAtualDiscente>...</SituacaoAtualDiscente>
        <ENADE>...</ENADE>
        <CargaHorariaCursoIntegralizada>...</CargaHorariaCursoIntegralizada>
        <CargaHorariaCurso>...</CargaHorariaCurso>
        <IngressoCurso>
          <Data>AAAA-MM-DD</Data>
          <FormaAcesso>Vestibular|Enem|...</FormaAcesso>
        </IngressoCurso>
      </HistoricoEscolar>
      <SegurancaHistorico>
        <CodigoValidacao>EMEC_EMISSORA.hex12+</CodigoValidacao>
      </SegurancaHistorico>
      <InformacoesAdicionais>...</InformacoesAdicionais>  <!-- opcional -->
    </infHistoricoEscolar>
    <ds:Signature>...</ds:Signature>  <!-- 1..n assinaturas -->
  </DocumentoHistoricoEscolarFinal>
  ```

### 2.3 Documentação Acadêmica de Registro
- **Elemento raiz:** `<DocumentacaoAcademicaRegistro>` (tipo `TDocumentacaoAcademicaRegistro`)
- **Estrutura:**
  ```xml
  <DocumentacaoAcademicaRegistro xmlns="https://portal.mec.gov.br/diplomadigital/arquivos-em-xsd">
    <!-- choice: RegistroReq | RegistroReqNSF | RegistroSegundaViaReq | RegistroPorDecisaoJudicialReq -->
    <RegistroReq versao="1.05" id="ReqDip{44 dígitos}" ambiente="Produção">
      <DadosDiploma>...</DadosDiploma>
      <DadosPrivadosDiplomado>
        <Filiacao>
          <Genitor>
            <Nome>...</Nome>
            <Sexo>M|F</Sexo>
          </Genitor>
        </Filiacao>
        <HistoricoEscolar>...</HistoricoEscolar>
      </DadosPrivadosDiplomado>
      <TermoResponsabilidadeEmissora>...</TermoResponsabilidadeEmissora>  <!-- opcional -->
      <DocumentacaoComprobatoria>
        <Documento tipo="DocumentoIdentidadeDoAluno">base64...</Documento>
      </DocumentacaoComprobatoria>
    </RegistroReq>
    <ds:Signature>...</ds:Signature>
  </DocumentacaoAcademicaRegistro>
  ```

---

## 3. Diferenças Críticas: v1.05 vs v1.06

| Aspecto | v1.05 | v1.06 |
|---------|-------|-------|
| **Namespace** | `https://portal.mec.gov.br/diplomadigital/arquivos-em-xsd` | Namespaces específicos por documento |
| **Raiz Diploma** | `<Diploma>` | `<DiplomaDigital>` |
| **Raiz Histórico** | `<DocumentoHistoricoEscolarFinal>` / `<DocumentoHistoricoEscolarParcial>` | `<HistoricoEscolarDigital>` |
| **Raiz DocAcad** | `<DocumentacaoAcademicaRegistro>` | `<DocumentacaoAcademicaRegistro>` (igual) |
| **Diplomado no Diploma** | `<Diplomado>` (dentro de `<DadosDiploma>`) | `<DadosDiplomado>` |
| **IES Emissora** | `<IesEmissora>` | `<DadosIESEmissora>` |
| **Aluno no Histórico** | `<Aluno>` | `<DadosAluno>` |
| **Wrapper Diploma** | `<infDiploma>` com `<DadosDiploma>` + `<DadosRegistro>` | Estrutura diferente |
| **Wrapper Histórico** | `<infHistoricoEscolar>` | Estrutura diferente |
| **Código Validação Diploma** | `\d+\.\d+\.[a-f0-9]{12,}` (ex: `1606.694.3590b90ce266`) | Mesmo padrão |
| **Código Validação Histórico** | `\d+\.[a-f0-9]{12,}` (ex: `1606.a1b2c3d4e5f6`) | Mesmo padrão |
| **ID Diploma (attr)** | `id="VDip{44 dígitos}"` | Diferente |
| **ID DadosDiploma (attr)** | `id="Dip{44 dígitos}"` | Diferente |
| **ID DadosRegistro (attr)** | `id="RDip{44 dígitos}"` | Diferente |
| **ID DocAcad (attr)** | `id="ReqDip{44 dígitos}"` | Diferente |
| **Versão (attr)** | `versao="1.05"` | `versao="1.06"` |

---

## 4. Estrutura do Diplomado (TDadosDiplomado)

```xml
<Diplomado>  <!-- ou <Aluno> no histórico -->
  <ID>identificador_interno</ID>
  <Nome>NOME COMPLETO</Nome>
  <NomeSocial>...</NomeSocial>  <!-- opcional -->
  <Sexo>M|F</Sexo>
  <Nacionalidade>Brasileira</Nacionalidade>
  <Naturalidade>
    <CodigoMunicipio>5003702</CodigoMunicipio>
    <NomeMunicipio>Cassilândia</NomeMunicipio>
    <UF>MS</UF>
  </Naturalidade>
  <CPF>00000000000</CPF>
  <RG>  <!-- ou OutroDocumentoIdentificacao -->
    <Numero>000000000</Numero>
    <OrgaoExpedidor>SSP</OrgaoExpedidor>  <!-- opcional -->
    <UF>MS</UF>
  </RG>
  <DataNascimento>1990-01-15</DataNascimento>
</Diplomado>
```

---

## 5. Estrutura da IES Emissora (TDadosIesEmissora)

```xml
<IesEmissora>
  <Nome>Faculdades Integradas de Cassilândia</Nome>
  <CodigoMEC>1606</CodigoMEC>
  <CNPJ>03412093000184</CNPJ>
  <Endereco>
    <Logradouro>Av. Siqueira Campos</Logradouro>
    <Numero>505</Numero>
    <Complemento>...</Complemento>  <!-- opcional -->
    <Bairro>Jardim Paraná</Bairro>
    <CodigoMunicipio>5003702</CodigoMunicipio>
    <NomeMunicipio>Cassilândia</NomeMunicipio>
    <UF>MS</UF>
    <CEP>79540000</CEP>
  </Endereco>
  <Credenciamento>
    <Tipo>Portaria</Tipo>
    <Numero>2.160</Numero>
    <Data>2001-11-20</Data>
    <VeiculoPublicacao>DOU</VeiculoPublicacao>  <!-- opcional -->
    <DataPublicacao>2001-11-21</DataPublicacao>  <!-- opcional -->
  </Credenciamento>
  <Recredenciamento>...</Recredenciamento>  <!-- opcional -->
  <RenovacaoDeRecredenciamento>...</RenovacaoDeRecredenciamento>  <!-- opcional -->
  <Mantenedora>  <!-- opcional -->
    <RazaoSocial>...</RazaoSocial>
    <CNPJ>...</CNPJ>
    <Endereco>...</Endereco>
  </Mantenedora>
</IesEmissora>
```

---

## 6. Estrutura da IES Registradora (TDadosIesRegistradora)

Igual à emissora, mas com campo adicional:
- `<AtoRegulatorioAutorizacaoRegistro>` (opcional) — ato que autoriza a IES a registrar diplomas
- `<Mantenedora>` — **obrigatório** (diferente da emissora onde é opcional)

---

## 7. Estrutura de DadosCurso (TDadosCurso)

```xml
<DadosCurso>
  <NomeCurso>Pedagogia</NomeCurso>
  <CodigoCursoEMEC>123456</CodigoCursoEMEC>
  <!-- OU: <SemCodigoCursoEMEC><NumeroProcesso>...</NumeroProcesso>...</SemCodigoCursoEMEC> -->
  <Habilitacao>...</Habilitacao>  <!-- 0..n -->
  <Modalidade>Presencial|EAD</Modalidade>
  <TituloConferido>
    <Titulo>Licenciado|Bacharel|Tecnólogo|Médico</Titulo>
    <!-- OU: <OutroTitulo>texto livre</OutroTitulo> -->
  </TituloConferido>
  <GrauConferido>Licenciatura|Bacharelado|Tecnólogo|Curso sequencial</GrauConferido>
  <Enfase>...</Enfase>  <!-- 0..n -->
  <EnderecoCurso>...</EnderecoCurso>  <!-- TEndereco -->
  <Polo>...</Polo>  <!-- opcional -->
  <Autorizacao>...</Autorizacao>  <!-- TAtoRegulatorioComOuSemEMEC -->
  <Reconhecimento>...</Reconhecimento>
  <RenovacaoReconhecimento>...</RenovacaoReconhecimento>  <!-- opcional -->
</DadosCurso>
```

---

## 8. Livro de Registro (TLivroRegistro)

```xml
<LivroRegistro>
  <LivroRegistro>L001</LivroRegistro>
  <!-- choice 1: -->
  <NumeroRegistro>R2024-001</NumeroRegistro>
  <!-- OU choice 2: -->
  <!-- <NumeroFolhaDoDiploma>123</NumeroFolhaDoDiploma> -->
  <!-- <NumeroSequenciaDoDiploma>456</NumeroSequenciaDoDiploma> -->
  <ProcessoDoDiploma>...</ProcessoDoDiploma>  <!-- opcional -->
  <DataColacaoGrau>2024-07-15</DataColacaoGrau>
  <DataExpedicaoDiploma>2024-08-01</DataExpedicaoDiploma>
  <DataRegistroDiploma>2024-08-15</DataRegistroDiploma>
  <ResponsavelRegistro>
    <Nome>Nome do Responsável</Nome>
    <CPF>00000000000</CPF>
    <IDouNumeroMatricula>M12345</IDouNumeroMatricula>  <!-- opcional -->
  </ResponsavelRegistro>
</LivroRegistro>
```

---

## 9. Padrão de IDs (Atributos)

| Contexto | Padrão | Exemplo |
|----------|--------|---------|
| `infDiploma.id` | `VDip` + 44 dígitos | `VDip00000000000000000000000000000000000000000001` |
| `DadosDiploma.id` | `Dip` + 44 dígitos | `Dip00000000000000000000000000000000000000000001` |
| `DadosRegistro.id` | `RDip` + 44 dígitos | `RDip0000000000000000000000000000000000000000001` |
| `RegistroReq.id` (DocAcad) | `ReqDip` + 44 dígitos | `ReqDip000000000000000000000000000000000000000001` |

---

## 10. Segurança — Códigos de Validação

### Diploma (TCodigoValidacao)
- Padrão: `{eMEC_emissora}.{eMEC_registradora}.{hex 12+ chars}`
- Exemplo: `1606.694.3590b90ce266`

### Histórico (TCodigoValidacaoHistorico)
- Padrão: `{eMEC_emissora}.{hex 12+ chars}`
- Exemplo: `1606.a1b2c3d4e5f6`

### Currículo (TCodigoValidacaoCurriculo)
- Padrão: `{eMEC_IES}.{hex 12+ chars}`
- Exemplo: `1606.c1d2e3f4a5b6`

---

## 11. Assinaturas Digitais

### Diploma (`<Diploma>`)
- **Dentro de `<DadosDiploma>`:** 1..n `<ds:Signature>` (assinaturas da emissora)
- **Dentro de `<DadosRegistro>`:** 1..n `<ds:Signature>` (assinaturas da registradora)
- **Dentro de `<Diploma>` (raiz):** 1 `<ds:Signature>` (assinatura externa AD-RA para arquivamento)

### Histórico (`<DocumentoHistoricoEscolarFinal>`)
- **Dentro da raiz:** 1..n `<ds:Signature>` (assinaturas da emissora)

### Documentação Acadêmica (`<DocumentacaoAcademicaRegistro>`)
- **Dentro da raiz:** 1 `<ds:Signature>` (assinatura da emissora)

---

## 12. Tipos de Ato Regulatório

### TTipoAto (sem "Ato Próprio")
Parecer, Resolução, Decreto, Portaria, Deliberação, Despacho, Lei Federal, Lei Estadual, Lei Municipal

### TTipoAtoComAtoProprio (inclui "Ato Próprio")
Usado em: Credenciamento, Reconhecimento, RenovacaoReconhecimento, Autorizacao
Mesmos valores + `Ato Próprio`

---

## 13. Enumerações Importantes

### GrauConferido
`Tecnólogo`, `Bacharelado`, `Licenciatura`, `Curso sequencial`

### TituloConferido (TTitulo)
`Licenciado`, `Tecnólogo`, `Bacharel`, `Médico` (ou `OutroTitulo` como texto livre)

### Modalidade
`Presencial`, `EAD` (+ `Semipresencial` para NSF)

### Sexo
`F`, `M`

### FormaAcesso
`Vestibular`, `Enem`, `Avaliação Seriada`, `Seleção Simplificada`, `Egresso BI/LI`, `PEC-G`, `Transferência Ex Officio`, `Decisão judicial`, `Seleção para Vagas Remanescentes`, `Seleção para Vagas de Programas Especiais`

### CargosAssinantes
`Reitor`, `Reitor em Exercício`, `Responsável pelo registro`, `Coordenador de Curso`, `Subcoordenador de Curso`, `Coordenador de Curso em exercício`, `Chefe da área de registro de diplomas`, `Chefe em exercício da área de registro de diplomas`

### TTipoDocumentacao (comprobatória)
`DocumentoIdentidadeDoAluno`, `ProvaConclusaoEnsinoMedio`, `ProvaColacao`, `ComprovacaoEstagioCurricular`, `CertidaoNascimento`, `CertidaoCasamento`, `TituloEleitor`, `AtoNaturalizacao`, `Outros`

### Ambiente
`Produção`, `Homologação`

### FormaIntegralizacao
`Cursado`, `Validado`, `Aproveitado`

### Titulação (docente)
`Tecnólogo`, `Graduação`, `Especialização`, `Mestrado`, `Doutorado`

### Conceitos
`A+` a `F-` (TConceito) ou `A`, `B`, `C`, `APD`, `APP`, `APR` (TConceitoRM)

---

## 14. Documentos Auxiliares

### Currículo Escolar
- **Raiz:** `<CurriculoEscolar>` (tipo `TCurriculoEscolar`)
- Descreve a grade curricular do PPC
- Contém: unidades curriculares, etiquetas, áreas, critérios de integralização

### Arquivo de Fiscalização
- **Raiz:** `<ArquivoFiscalizacao>` (tipo `TArquivoFiscalizacao`)
- Lista diplomas emitidos/registrados para fiscalização MEC
- Duas variantes: Emissora e Registradora

---

## 15. Variantes Especiais

### NSF (Não Sistema Federal)
Universidades fora do sistema federal têm tipos flexibilizados:
- `TDadosDiplomaNSF`, `TDadosCursoNSF`, `TRegistroReqNSF`, `TDadosRegistroNSF`, `TLivroRegistroNSF`
- Diferenças: campos obrigatórios tornam-se opcionais, modalidade aceita "Semipresencial"

### Segunda Via Nato Físico
- Histórico: `<DocumentoHistoricoEscolarSegundaViaNatoFisico>`
- DocAcad: `<RegistroSegundaViaReq>`
- Flexibiliza exigência de docentes e códigos de disciplina

### Por Decisão Judicial
- Diploma: `<DadosDiplomaPorDecisaoJudicial>`
- DocAcad: `<RegistroPorDecisaoJudicialReq>`
- Permite campos `_Indisponivel` (ex: `<Sexo_Indisponivel/>`, `<Filiacao_Indisponivel/>`)
- Adiciona `<InformacoesProcessoJudicial>` com número do processo

---

## 16. Observações Técnicas para Geração

1. **Namespace:** Todos os documentos usam o mesmo namespace `https://portal.mec.gov.br/diplomadigital/arquivos-em-xsd`
2. **xmldsig:** Namespace `https://www.w3.org/2000/09/xmldsig#` para assinaturas
3. **Encoding:** UTF-8
4. **FIC é do Sistema Federal:** Usar tipos normais (não NSF)
5. **FIC é APENAS emissora** — a Registradora (historicamente UFMS/694) pode mudar e NUNCA deve ser presumida
6. **44 dígitos nos IDs:** Padrão para todos os atributos `id`
7. **Assinatura AD-RA:** Tipo XAdES com Referência de Arquivamento
8. **Certificado A3 obrigatório** — não aceita A1
