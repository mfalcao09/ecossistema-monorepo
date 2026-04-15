# Fluxo Completo: IES Emissora (FIC) × IES Registradora (UFMS)

**Data:** 2026-03-23
**Pesquisado por:** Claude (Opus 4) + Buchecha (MiniMax M2.7)
**Fontes:** Portaria MEC 554/2019, IN SESU 1/2020, FAQ MEC, FAQ RNP, documentação UFPB, LedgerTec, XSD v1.05
**Status:** Pesquisa concluída — aprovação pendente do Marcelo

---

## 1. Visão Geral — Quem Faz O Quê

O processo de diploma digital é **sequencial e colaborativo** entre duas instituições:

```
┌──────────────────────────────────┐     ┌──────────────────────────────────┐
│        IES EMISSORA (FIC)        │     │     IES REGISTRADORA (UFMS)      │
│                                  │     │                                  │
│  • Organiza dados do diplomado   │     │  • Valida documentação recebida  │
│  • Gera DocumentacaoAcademica    │────▶│  • Gera DadosRegistro            │
│  • Gera HistoricoEscolar         │     │  • Gera Código de Validação      │
│  • Assina DadosDiploma           │     │  • Monta XML final do Diploma    │
│  • Envia para registro           │◀────│  • Assina e arquiva (AD-RA)      │
│  • Recebe diploma registrado     │     │  • Retorna diploma à emissora    │
│  • Entrega ao diplomado          │     │                                  │
└──────────────────────────────────┘     └──────────────────────────────────┘
```

---

## 2. As 5 Etapas Sequenciais (Obrigatórias nesta ordem)

### Etapa 1 — FIC gera e assina a Documentação Acadêmica
**Responsável:** IES Emissora (FIC)
**XML gerado:** `<DocumentacaoAcademicaRegistro>`

Conteúdo que a FIC preenche:
- `<RegistroReq>` (wrapper com versao="1.05", id, ambiente)
  - `<DadosDiploma>` — dados do diplomado, curso, IES emissora
  - `<DadosPrivadosDiplomado>` — CPF, RG, endereço, filiação
  - `<HistoricoEscolar>` — referência ao histórico
  - `<DocumentacaoComprobatoria>` — documentos digitalizados

Assinaturas da FIC nesta etapa:
1. Representantes da FIC assinam `<DadosDiploma>` com e-CPF A3
2. FIC assina `<DadosDiploma>` com e-CNPJ A3
3. FIC assina a raiz `<DocumentacaoAcademicaRegistro>` com AD-RA

### Etapa 2 — FIC gera e assina o Histórico Escolar
**Responsável:** IES Emissora (FIC)
**XML gerado:** `<DocumentoHistoricoEscolarFinal>`

Conteúdo que a FIC preenche:
- `<infHistoricoEscolar>` (wrapper)
  - `<Aluno>` — mesma estrutura do `<Diplomado>`
  - `<DadosCurso>` — dados do curso
  - `<IesEmissora>` — dados da FIC
  - `<HistoricoEscolar>` — disciplinas, notas, cargas horárias
  - `<SegurancaHistorico>` — código de validação do histórico

**Nota:** O código de validação do HISTÓRICO usa formato `{eMEC_emissora}.{hex12}` (ex: `1606.a1b2c3d4e5f6`). Este sim é gerado pela emissora.

Assinaturas:
1. Mínimo 1 assinatura PJ (e-CNPJ da FIC) — obrigatória
2. Assinaturas PF (e-CPF) — recomendadas

### Etapa 3 — FIC envia documentação para a UFMS
**Responsável:** IES Emissora (FIC)

A FIC envia para a UFMS:
- XML da DocumentacaoAcademicaRegistro (assinado)
- XML do HistoricoEscolar (assinado)
- Método: via sistema RNP (Conector de Diplomas Externos) ou protocolo direto

### Etapa 4 — UFMS valida, registra e gera o Diploma
**Responsável:** IES Registradora (UFMS)

O que a UFMS faz:
1. Valida sintaticamente os XMLs recebidos (conformidade XSD)
2. Valida semanticamente os dados (coerência, completude)
3. **Extrai `<DadosDiploma>` da DocumentacaoAcademica** (com assinaturas da FIC)
4. **Gera `<DadosRegistro>`** contendo:
   - `<IesRegistradora>` — dados completos da UFMS (Nome, CodigoMEC, CNPJ, Endereco, Credenciamento, Mantenedora)
   - `<LivroRegistro>` — dados do livro de registro (número, folha, sequência, processo, datas)
   - `<IdDocumentacaoAcademica>` — referência ao XML da documentação
   - `<Seguranca><CodigoValidacao>` — código no formato `1606.694.{hex12}`
   - `<ResponsavelRegistro>` — nome e CPF de quem registra na UFMS
5. **Monta o XML `<Diploma>`** combinando DadosDiploma (da FIC) + DadosRegistro (da UFMS)
6. Assina DadosRegistro com e-CPF do responsável pelo registro
7. Assina o diploma completo com e-CNPJ da UFMS + AD-RA (assinatura de arquivamento)

### Etapa 5 — UFMS retorna diploma registrado para FIC
**Responsável:** IES Registradora (UFMS)

A UFMS retorna à FIC:
- XML completo do `<Diploma>` (com DadosDiploma + DadosRegistro + todas as assinaturas)
- A FIC armazena este XML e o disponibiliza ao diplomado

---

## 3. Mapa de Responsabilidade por Elemento XML

### 3.1 DocumentacaoAcademicaRegistro — 100% FIC

```xml
<DocumentacaoAcademicaRegistro>        ← FIC gera
  <RegistroReq versao="1.05">          ← FIC gera
    <DadosDiploma>                     ← FIC gera
      <Diplomado>                      ← FIC (dados do aluno)
        <Nome>, <CPF>, <Sexo>, <Nacionalidade>, <Naturalidade>, <RG>, <DataNascimento>
      </Diplomado>
      <DataConclusao>                  ← FIC
      <DadosCurso>                     ← FIC (dados do curso)
        <NomeCurso>, <CodigoCursoEMEC>, <Modalidade>, <TituloConferido>, <GrauConferido>
        <Autorizacao>, <Reconhecimento>, <RenovacaoReconhecimento>
      </DadosCurso>
      <IesEmissora>                    ← FIC (dados da própria FIC)
        <Nome>, <CodigoMEC>, <CNPJ>, <Endereco>, <Credenciamento>, <Mantenedora>
      </IesEmissora>
    </DadosDiploma>
    <DadosPrivadosDiplomado>           ← FIC (dados sensíveis)
      <Filiacao>, <Endereco>, <HistoricoEscolar>
    </DadosPrivadosDiplomado>
    <DocumentacaoComprobatoria>        ← FIC (docs digitalizados)
  </RegistroReq>
  <ds:Signature>                       ← FIC assina (AD-RA)
</DocumentacaoAcademicaRegistro>
```

### 3.2 HistoricoEscolar — 100% FIC

```xml
<DocumentoHistoricoEscolarFinal>       ← FIC gera
  <infHistoricoEscolar versao="1.05">  ← FIC gera
    <Aluno>...</Aluno>                 ← FIC (= mesma struct do Diplomado)
    <DadosCurso>...</DadosCurso>       ← FIC
    <IesEmissora>...</IesEmissora>     ← FIC
    <HistoricoEscolar>                 ← FIC
      <Disciplina>, <AtividadeComplementar>, <Estagio>, <ENADE>
    </HistoricoEscolar>
    <SegurancaHistorico>               ← FIC gera código: "1606.{hex12}"
      <CodigoValidacao>1606.a1b2c3d4e5f6</CodigoValidacao>
    </SegurancaHistorico>
  </infHistoricoEscolar>
  <ds:Signature>                       ← FIC assina
</DocumentoHistoricoEscolarFinal>
```

### 3.3 Diploma — COLABORATIVO (FIC + UFMS)

```xml
<Diploma>                              ← UFMS monta o XML final
  <infDiploma versao="1.05" id="VDip{44}">

    <DadosDiploma id="Dip{44}">        ← COPIADO da DocumentacaoAcademica (gerado pela FIC)
      <Diplomado>...</Diplomado>       ← FIC
      <DadosCurso>...</DadosCurso>     ← FIC
      <IesEmissora>...</IesEmissora>   ← FIC
      <ds:Signature>                   ← FIC (assinaturas copiadas da DocAcademica)
    </DadosDiploma>

    <DadosRegistro id="RDip{44}">      ← UFMS GERA TUDO AQUI ⚠️
      <IesRegistradora>               ← UFMS (dados da própria UFMS)
        <Nome>UNIVERSIDADE FEDERAL DE MATO GROSSO DO SUL</Nome>
        <CodigoMEC>694</CodigoMEC>
        <CNPJ>15461510000133</CNPJ>
        <Endereco>...</Endereco>
        <Credenciamento>...</Credenciamento>
        <Mantenedora>...</Mantenedora>  ← OBRIGATÓRIO para registradora
      </IesRegistradora>
      <LivroRegistro>                  ← UFMS
        <NumeroRegistro>69205</NumeroRegistro>
        <DataColacaoGrau>...</DataColacaoGrau>
        <DataExpedicaoDiploma>...</DataExpedicaoDiploma>
        <DataRegistroDiploma>...</DataRegistroDiploma>
        <ResponsavelRegistro>          ← UFMS
          <Nome>...</Nome>
          <CPF>...</CPF>
        </ResponsavelRegistro>
      </LivroRegistro>
      <IdDocumentacaoAcademica>ReqDip{44}</IdDocumentacaoAcademica>  ← UFMS
      <Seguranca>                      ← UFMS
        <CodigoValidacao>1606.694.3590b90ce266</CodigoValidacao>     ← UFMS gera!
      </Seguranca>
      <ds:Signature>                   ← UFMS assina
    </DadosRegistro>

  </infDiploma>
  <ds:Signature>                       ← UFMS assina (AD-RA final)
</Diploma>
```

---

## 4. Tabela Resumo — Quem Gera O Quê

| Dado | Responsável | Observação |
|------|-------------|------------|
| Dados do Diplomado (nome, CPF, etc.) | FIC | Extraídos do cadastro acadêmico |
| Dados do Curso | FIC | Cadastro institucional |
| Dados da IES Emissora | FIC | Dados da própria FIC |
| Histórico Escolar (disciplinas) | FIC | Grade curricular + notas |
| Documentação Comprobatória | FIC | Docs digitalizados |
| Código de validação do Histórico | FIC | Formato: `1606.{hex12}` |
| Assinaturas em DadosDiploma | FIC | e-CPF + e-CNPJ da FIC |
| **Dados da IES Registradora** | **UFMS** | Nome, CNPJ, endereço, credenciamento |
| **Livro de Registro** | **UFMS** | Número, folha, processo, datas |
| **Responsável pelo Registro** | **UFMS** | Nome + CPF do responsável |
| **Código de validação do Diploma** | **UFMS** | Formato: `1606.694.{hex12}` |
| **DadosRegistro (bloco inteiro)** | **UFMS** | Montado e assinado pela UFMS |
| **XML final do Diploma** | **UFMS** | Combina DadosDiploma (FIC) + DadosRegistro (UFMS) |
| **Assinatura AD-RA final** | **UFMS** | Assinatura de arquivamento |

---

## 5. Impacto na Arquitetura do Sistema FIC

### O que o sistema da FIC DEVE fazer:

1. **Gerar DocumentacaoAcademicaRegistro** (XML completo, assinado)
2. **Gerar HistoricoEscolar** (XML completo, assinado)
3. **Gerar RVDD** (Representação Visual — PDF do diploma para o diplomado)
4. **Enviar XMLs para registro** (via API/sistema da registradora)
5. **Receber de volta o XML do Diploma registrado** (da UFMS)
6. **Armazenar o XML final** para consulta pública e entrega ao diplomado
7. **Importar diplomas legados** (XMLs já registrados pela UFMS)

### O que o sistema da FIC NÃO DEVE fazer:

1. ~~Gerar `<DadosRegistro>`~~ — responsabilidade da UFMS
2. ~~Gerar código de validação do diploma~~ — responsabilidade da UFMS
3. ~~Preencher dados da IES Registradora nos XMLs~~ — a UFMS faz isso
4. ~~Gerar assinatura AD-RA do diploma~~ — a UFMS faz isso
5. ~~Gerar o XML final do `<Diploma>`~~ — a UFMS monta combinando as partes

### Exceção importante — Código de Validação do HISTÓRICO:

O código de validação do **Histórico Escolar** TEM formato diferente: `{eMEC_emissora}.{hex12}` (só o eMEC da emissora, sem a registradora). **Este SIM é gerado pela FIC.**

---

## 6. Estados do Diploma no Sistema

```
┌─────────────┐     ┌───────────────┐     ┌──────────────┐     ┌─────────────┐
│  RASCUNHO   │────▶│  ASSINADO_FIC │────▶│  EM_REGISTRO │────▶│ REGISTRADO  │
│  (dados ok) │     │  (XMLs prontos│     │  (enviado p/  │     │ (XML final  │
│             │     │   e assinados)│     │   UFMS)       │     │  da UFMS)   │
└─────────────┘     └───────────────┘     └──────────────┘     └─────────────┘
                                                                       │
                                                                       ▼
                                                               ┌─────────────┐
                                                               │ PUBLICADO   │
                                                               │ (disponível │
                                                               │  consulta)  │
                                                               └─────────────┘

┌─────────────┐     Para diplomas legados (157 diplomas):
│  IMPORTADO  │     XML completo já existe, pula todas as etapas
│  (legado)   │     anteriores e vai direto para PUBLICADO
└─────────────┘
```

---

## 7. Perguntas que a FIC NÃO precisa responder

Com base nesta pesquisa, as perguntas que fiz anteriormente sobre dados da UFMS **NÃO são necessárias para o sistema da FIC**:

| Pergunta anterior | Resposta |
|---|---|
| Credenciamento da UFMS? | A UFMS preenche isso ela mesma |
| Mantenedora da UFMS? | A UFMS preenche isso ela mesma |
| Responsável pelo Registro? | A UFMS define quem assina |
| Código IBGE de Campo Grande? | A UFMS preenche seu próprio endereço |

A FIC só precisa saber os dados da UFMS que já tem no banco (nome, código MEC, CNPJ) para **exibir na interface** e no **portal de consulta** — mas esses dados vêm extraídos do XML registrado, não são inseridos pela FIC nos XMLs.

---

## 8. Fontes

- [FAQ MEC — Diploma Digital para Instituições](https://portal.mec.gov.br/diplomadigital/?pagina=faq-instituicoes)
- [FAQ RNP — Perguntas Frequentes](https://ajuda.rnp.br/diplomas-digitais/perguntas-frequentes)
- [LedgerTec — Assinatura de Diplomas Digitais](https://ledgertec.com.br/docs/degree-sign-service/diploma-digital/)
- [UFPB — Diploma Digital Externo](https://conhecimento.sti.ufpb.br/books/diploma-digital-externo/page/introducao)
- [Portaria MEC 554/2019](https://www.in.gov.br/materia/-/asset_publisher/Kujrw0TZC2Mb/content/id/66544171)
- [IN SESU/MEC 1/2020](https://portal.mec.gov.br/diplomadigital/arquivos/in_01_15122020.pdf)
- XSD v1.05 — referência local: `docs/XSD-v1.05-REFERENCIA.md`
