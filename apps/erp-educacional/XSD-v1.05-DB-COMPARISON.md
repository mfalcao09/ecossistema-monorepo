# XSD v1.05 → Database Mapping Comparison

---

## 1. DIPLOMA DIGITAL (XML: Diploma)

### Diploma Root & Metadata
| XSD Element | DB Mapping | Status |
|-------------|-----------|--------|
| `infDiploma.id` (attr: VDip{44}) | diplomas.id (UUID) | PARTIAL - ID format differs |
| `infDiploma.versao` (attr) | diplomas.versao_xsd | EXISTS |
| `infDiploma.ambiente` (attr) | diplomas.ambiente | EXISTS |
| `DadosDiploma.id` (attr: Dip{44}) | diplomas.id (secondary) | PARTIAL - No separate ID |
| `DadosRegistro.id` (attr: RDip{44}) | diplomas.id (reuse) | PARTIAL - No separate ID |

### Diplomado (Student)
| XSD Element | DB Mapping | Status |
|-------------|-----------|--------|
| `Diplomado/ID` | diplomados.id | EXISTS |
| `Diplomado/Nome` | diplomados.nome | EXISTS |
| `Diplomado/NomeSocial` | diplomados.nome_social | EXISTS |
| `Diplomado/Sexo` | diplomados.sexo | EXISTS |
| `Diplomado/Nacionalidade` | diplomados.nacionalidade | EXISTS |
| `Diplomado/Naturalidade/CodigoMunicipio` | diplomados.codigo_municipio_ibge | EXISTS |
| `Diplomado/Naturalidade/NomeMunicipio` | diplomados.naturalidade_municipio | EXISTS |
| `Diplomado/Naturalidade/UF` | diplomados.naturalidade_uf | EXISTS |
| `Diplomado/CPF` | diplomados.cpf | EXISTS |
| `Diplomado/RG/Numero` | diplomados.rg_numero | EXISTS |
| `Diplomado/RG/OrgaoExpedidor` | diplomados.rg_orgao_expedidor | EXISTS |
| `Diplomado/RG/UF` | diplomados.rg_uf | EXISTS |
| `Diplomado/DataNascimento` | diplomados.data_nascimento | EXISTS |

### Dados Diploma (Course & Timing)
| XSD Element | DB Mapping | Status |
|-------------|-----------|--------|
| `DataConclusao` | diplomas.data_conclusao | EXISTS |
| `DataColacaoGrau` | diplomas.data_colacao_grau | EXISTS |
| `DataExpedicao` | diplomas.data_expedicao | EXISTS |

### Dados Curso (Course Details)
| XSD Element | DB Mapping | Status |
|-------------|-----------|--------|
| `NomeCurso` | cursos.nome | EXISTS |
| `CodigoCursoEMEC` | cursos.codigo_emec | EXISTS |
| `SemCodigoCursoEMEC/NumeroProcesso` | cursos.numero_processo_emec | EXISTS |
| `Habilitacao` | diploma_habilitacoes.nome | EXISTS |
| `Modalidade` | cursos.modalidade | EXISTS |
| `TituloConferido/Titulo` | diplomas.titulo_conferido | EXISTS |
| `TituloConferido/OutroTitulo` | diplomas.titulo_conferido | PARTIAL |
| `GrauConferido` | cursos.grau | EXISTS |
| `Enfase` | cursos.enfase | EXISTS |
| `EnderecoCurso/Logradouro` | cursos.logradouro | EXISTS |
| `EnderecoCurso/Numero` | cursos.numero | EXISTS |
| `EnderecoCurso/Bairro` | cursos.bairro | EXISTS |
| `EnderecoCurso/CodigoMunicipio` | cursos.codigo_municipio | EXISTS |
| `EnderecoCurso/NomeMunicipio` | cursos.municipio | EXISTS |
| `EnderecoCurso/UF` | cursos.uf | EXISTS |
| `EnderecoCurso/CEP` | cursos.cep | EXISTS |
| `Polo` | - | MISSING |

### Autorizacao/Reconhecimento/Renovacao (Course Credentials)
| XSD Element | DB Mapping | Status |
|-------------|-----------|--------|
| `Autorizacao/Tipo` | cursos.tipo_autorizacao | EXISTS |
| `Autorizacao/Numero` | cursos.numero_autorizacao | EXISTS |
| `Autorizacao/Data` | cursos.data_autorizacao | EXISTS |
| `Autorizacao/VeiculoPublicacao` | cursos.veiculo_publicacao_autorizacao | EXISTS |
| `Autorizacao/DataPublicacao` | cursos.data_publicacao_autorizacao | EXISTS |
| `Reconhecimento/Tipo` | cursos.tipo_reconhecimento | EXISTS |
| `Reconhecimento/Numero` | cursos.numero_reconhecimento | EXISTS |
| `Reconhecimento/Data` | cursos.data_reconhecimento | EXISTS |
| `Reconhecimento/VeiculoPublicacao` | cursos.veiculo_publicacao_reconhecimento | EXISTS |
| `Reconhecimento/DataPublicacao` | cursos.data_publicacao_reconhecimento | EXISTS |
| `RenovacaoReconhecimento/Tipo` | cursos.tipo_renovacao | EXISTS |
| `RenovacaoReconhecimento/Numero` | cursos.numero_renovacao | EXISTS |
| `RenovacaoReconhecimento/Data` | cursos.data_renovacao | EXISTS |
| `RenovacaoReconhecimento/VeiculoPublicacao` | cursos.veiculo_publicacao_renovacao | EXISTS |

### IES Emissora (Issuing Institution)
| XSD Element | DB Mapping | Status |
|-------------|-----------|--------|
| `IesEmissora/Nome` | diplomas.emissora_nome | EXISTS |
| `IesEmissora/CodigoMEC` | diplomas.emissora_codigo_mec | EXISTS |
| `IesEmissora/CNPJ` | diplomas.emissora_cnpj | EXISTS |
| `IesEmissora/Endereco/Logradouro` | instituicoes.logradouro | PARTIAL |
| `IesEmissora/Endereco/Numero` | instituicoes.numero | PARTIAL |
| `IesEmissora/Endereco/Complemento` | instituicoes.complemento | PARTIAL |
| `IesEmissora/Endereco/Bairro` | instituicoes.bairro | PARTIAL |
| `IesEmissora/Endereco/CodigoMunicipio` | instituicoes.codigo_municipio | PARTIAL |
| `IesEmissora/Endereco/NomeMunicipio` | instituicoes.municipio | PARTIAL |
| `IesEmissora/Endereco/UF` | instituicoes.uf | PARTIAL |
| `IesEmissora/Endereco/CEP` | instituicoes.cep | PARTIAL |
| `Credenciamento/Tipo` | credenciamentos.tipo | EXISTS |
| `Credenciamento/Numero` | credenciamentos.numero | EXISTS |
| `Credenciamento/Data` | credenciamentos.data | EXISTS |
| `Credenciamento/VeiculoPublicacao` | credenciamentos.veiculo_publicacao | EXISTS |
| `Credenciamento/DataPublicacao` | credenciamentos.data_publicacao_dou | EXISTS |
| `Recredenciamento` | credenciamentos (vigente=true filter) | PARTIAL |
| `RenovacaoDeRecredenciamento` | credenciamentos (tipo filter) | PARTIAL |
| `Mantenedora/RazaoSocial` | instituicoes.mantenedora_razao_social | EXISTS |
| `Mantenedora/CNPJ` | instituicoes.mantenedora_cnpj | EXISTS |
| `Mantenedora/Endereco` | instituicoes.mantenedora_endereco | PARTIAL |

### Assinantes (Signers)
| XSD Element | DB Mapping | Status |
|-------------|-----------|--------|
| `Assinantes/Assinante/Nome` | assinantes.nome | EXISTS |
| `Assinantes/Assinante/CPF` | assinantes.cpf | EXISTS |
| `Assinantes/Assinante/Cargo` | assinantes.cargo | EXISTS |
| `Assinantes/Assinante/OutroCargo` | assinantes.outro_cargo | EXISTS |
| Assinante papel (emissora vs registradora) | fluxo_assinaturas.papel | EXISTS |

### DadosRegistro (Registry Data)
| XSD Element | DB Mapping | Status |
|-------------|-----------|--------|
| `IesRegistradora/Nome` | diplomas.registradora_nome | EXISTS |
| `IesRegistradora/CodigoMEC` | diplomas.registradora_codigo_mec | EXISTS |
| `IesRegistradora/CNPJ` | diplomas.registradora_cnpj | EXISTS |
| `IesRegistradora/Endereco/*` | instituicoes (secondary lookup) | PARTIAL |
| `LivroRegistro/LivroRegistro` | diplomas.livro_numero | EXISTS |
| `LivroRegistro/NumeroRegistro` | diplomas.numero_registro | EXISTS |
| `LivroRegistro/NumeroFolha` | - | MISSING |
| `LivroRegistro/NumeroSequencia` | - | MISSING |
| `LivroRegistro/ProcessoDoDiploma` | diplomas.processo_registro | EXISTS |
| `LivroRegistro/DataColacaoGrau` | diplomas.data_colacao_grau | EXISTS |
| `LivroRegistro/DataExpedicaoDiploma` | diplomas.data_expedicao | EXISTS |
| `LivroRegistro/DataRegistroDiploma` | diplomas.data_registro | EXISTS |
| `ResponsavelRegistro/Nome` | diplomas.responsavel_registro_nome | EXISTS |
| `ResponsavelRegistro/CPF` | diplomas.responsavel_registro_cpf | EXISTS |
| `ResponsavelRegistro/IDouNumeroMatricula` | diplomas.responsavel_registro_matricula | EXISTS |
| `IdDocumentacaoAcademica` | xml_gerados (tipo='DocumentacaoAcademicaRegistro') | PARTIAL |
| `Seguranca/CodigoValidacao` | diplomas.codigo_validacao | EXISTS |
| `InformacoesAdicionais` | diplomas.informacoes_adicionais | EXISTS |

---

## 2. HISTÓRICO ESCOLAR DIGITAL (XML: DocumentoHistoricoEscolarFinal)

### Document Root & Metadata
| XSD Element | DB Mapping | Status |
|-------------|-----------|--------|
| `infHistoricoEscolar.versao` | diplomas.versao_xsd | EXISTS |
| `infHistoricoEscolar.ambiente` | diplomas.ambiente | EXISTS |

### Aluno (Student - same as Diplomado)
| XSD Element | DB Mapping | Status |
|-------------|-----------|--------|
| All Aluno/* fields | diplomados.* | EXISTS (see Diplomado section) |

### Dados Curso
| XSD Element | DB Mapping | Status |
|-------------|-----------|--------|
| All DadosCurso/* fields | cursos.* | EXISTS (see Dados Curso section) |

### Histórico Escolar (Academic History)
| XSD Element | DB Mapping | Status |
|-------------|-----------|--------|
| `CodigoCurriculo` | diplomas.codigo_curriculo | EXISTS |
| `ElementosHistorico/Disciplina/Codigo` | diploma_disciplinas.codigo | EXISTS |
| `ElementosHistorico/Disciplina/Nome` | diploma_disciplinas.nome | EXISTS |
| `ElementosHistorico/Disciplina/Periodo` | diploma_disciplinas.periodo | EXISTS |
| `ElementosHistorico/Disciplina/Situacao` | diploma_disciplinas.situacao | EXISTS |
| `ElementosHistorico/Disciplina/CargaHorariaAula` | diploma_disciplinas.carga_horaria_aula | EXISTS |
| `ElementosHistorico/Disciplina/CargaHoraria` | diploma_disciplinas.carga_horaria_relogio | EXISTS |
| `ElementosHistorico/Disciplina/Nota` | diploma_disciplinas.nota | EXISTS |
| `ElementosHistorico/Disciplina/Conceito` | diploma_disciplinas.conceito | EXISTS |
| `ElementosHistorico/Disciplina/FormaIntegralizacao` | diploma_disciplinas.forma_integralizacao | EXISTS |
| `ElementosHistorico/Disciplina/Etiqueta` | diploma_disciplinas.etiqueta | EXISTS |
| `ElementosHistorico/Disciplina/Docente/Nome` | diploma_disciplinas.docente_nome | EXISTS |
| `ElementosHistorico/Disciplina/Docente/Titulacao` | diploma_disciplinas.docente_titulacao | EXISTS |
| `ElementosHistorico/Disciplina/Docente/CPF` | diploma_disciplinas.docente_cpf | EXISTS |

### Atividades Complementares & Estágio
| XSD Element | DB Mapping | Status |
|-------------|-----------|--------|
| `ElementosHistorico/AtividadeComplementar/Codigo` | diploma_atividades_complementares.codigo | EXISTS |
| `ElementosHistorico/AtividadeComplementar/Tipo` | diploma_atividades_complementares.tipo | EXISTS |
| `ElementosHistorico/AtividadeComplementar/CargaHoraria` | diploma_atividades_complementares.carga_horaria_relogio | EXISTS |
| `ElementosHistorico/AtividadeComplementar/Data[Inicio/Fim]` | diploma_atividades_complementares.data_[inicio/fim] | EXISTS |
| `ElementosHistorico/AtividadeComplementar/Etiqueta` | diploma_atividades_complementares.etiqueta | EXISTS |
| `ElementosHistorico/AtividadeComplementar/Docente/*` | diploma_atividades_complementares.docente_* | EXISTS |
| `ElementosHistorico/Estagio/CodigoUnidadeCurricular` | diploma_estagios.codigo_unidade_curricular | EXISTS |
| `ElementosHistorico/Estagio/Data[Inicio/Fim]` | diploma_estagios.data_[inicio/fim] | EXISTS |
| `ElementosHistorico/Estagio/CargaHoraria` | diploma_estagios.carga_horaria_relogio | EXISTS |
| `ElementosHistorico/Estagio/Concedente/CNPJ` | diploma_estagios.concedente_cnpj | EXISTS |
| `ElementosHistorico/Estagio/Concedente/RazaoSocial` | diploma_estagios.concedente_razao_social | EXISTS |
| `ElementosHistorico/Estagio/Etiqueta` | diploma_estagios.etiqueta | EXISTS |

### SituacaoDiscente & ENADE
| XSD Element | DB Mapping | Status |
|-------------|-----------|--------|
| `SituacaoAtualDiscente` | diplomas.situacao_aluno | PARTIAL - may need enum mapping |
| `ENADE/Situacao` | diploma_enade.situacao | EXISTS |
| `ENADE/Condicao` | diploma_enade.condicao | EXISTS |
| `ENADE/AnoEdicao` | diploma_enade.ano_edicao | EXISTS |

### Carga Horária
| XSD Element | DB Mapping | Status |
|-------------|-----------|--------|
| `CargaHorariaCursoIntegralizada` | diplomas.carga_horaria_integralizada | EXISTS |
| `CargaHorariaCurso` | cursos.carga_horaria_total | PARTIAL |

### Ingresso Curso
| XSD Element | DB Mapping | Status |
|-------------|-----------|--------|
| `IngressoCurso/Data` | diplomas.data_ingresso | EXISTS |
| `IngressoCurso/FormaAcesso` | diplomas.forma_acesso | EXISTS |

### Datas & Segurança
| XSD Element | DB Mapping | Status |
|-------------|-----------|--------|
| `DataEmissaoHistorico` | diplomas.data_emissao_historico | EXISTS |
| `HoraEmissaoHistorico` | - | MISSING |
| `SegurancaHistorico/CodigoValidacao` | diplomas.codigo_validacao | EXISTS |
| `InformacoesAdicionais` | diplomas.informacoes_adicionais | EXISTS |

---

## 3. DOCUMENTAÇÃO ACADÊMICA DE REGISTRO (XML: DocumentacaoAcademicaRegistro)

### RegistroReq Root
| XSD Element | DB Mapping | Status |
|-------------|-----------|--------|
| `RegistroReq.id` (attr: ReqDip{44}) | xml_gerados.id (tipo='DocumentacaoAcademicaRegistro') | PARTIAL - ID format differs |
| `RegistroReq.versao` | diplomas.versao_xsd | EXISTS |
| `RegistroReq.ambiente` | diplomas.ambiente | EXISTS |

### DadosDiploma (inherited)
| XSD Element | DB Mapping | Status |
|-------------|-----------|--------|
| All DadosDiploma/* | diplomas.* + diplomados.* + cursos.* | EXISTS (see above) |

### DadosPrivadosDiplomado
| XSD Element | DB Mapping | Status |
|-------------|-----------|--------|
| `Filiacao/Genitor/Nome` | filiacoes.nome | EXISTS |
| `Filiacao/Genitor/Sexo` | filiacoes.sexo | EXISTS |
| Múltiplos genitores | filiacoes (multiple rows) | EXISTS |

### HistoricoEscolar (in DadosPrivados)
| XSD Element | DB Mapping | Status |
|-------------|-----------|--------|
| All HistoricoEscolar/* fields | diploma_disciplinas.* + diploma_enade.* + diploma_estagios.* | EXISTS (see above) |

### TermoResponsabilidadeEmissora
| XSD Element | DB Mapping | Status |
|-------------|-----------|--------|
| Content | - | MISSING |

### DocumentacaoComprobatoria
| XSD Element | DB Mapping | Status |
|-------------|-----------|--------|
| `Documento[@tipo="DocumentoIdentidadeDoAluno"]` | documentos_estudante (tipo='documento_identidade') | PARTIAL |
| `Documento[@tipo="..."]` (other types) | documentos_estudante (tipo filter) | PARTIAL |
| Base64 file content | documentos_estudante.arquivo_pdfa_base64 | EXISTS |

---

## 4. ARQUIVO XML GERADO (xml_gerados table)

| XSD Element → DB Column | Status |
|------------------------|--------|
| XML tipo | xml_gerados.tipo (Diploma / HistoricoEscolar / DocumentacaoAcademicaRegistro) | EXISTS |
| XML versao | xml_gerados.versao_xsd | EXISTS |
| Conteúdo XML completo | xml_gerados.conteudo_xml | EXISTS |
| Hash integridade | xml_gerados.hash_sha256 | EXISTS |
| Validação XSD | xml_gerados.validado_xsd + erros_validacao | EXISTS |
| Assinaturas | xml_gerados.assinantes_xml | EXISTS |

---

## GAPS IDENTIFIED (XSD Required → DB Missing)

### Critical Gaps
1. **TermoResponsabilidadeEmissora** — No storage for institutional responsibility statement (should be in DocumentacaoAcademicaRegistro)
2. **HoraEmissaoHistorico** — Time of issue for historical document (currently only date)
3. **Polo** — Campus/Polo location for distance education (courses table has no polo field)
4. **NumeroFolhaDoDiploma** — Diploma folio number (alternative to NumeroRegistro)
5. **NumeroSequenciaDoDiploma** — Diploma sequence number in folio (alternative to NumeroRegistro)

### Secondary Gaps
6. **Complemento (address)** — Address complement field exists in cursos but not consistently populated
7. **OutroDocumentoIdentificacao** — Alternative ID document type storage (only RG/CPF supported)
8. **Eleicao** (SituacaoDiscente) — Need to verify enum mapping for student status
9. **DocumentoIdentidadeDoAluno (Comprobatória)** — Stored differently, may need schema alignment

### Potential Issues
10. **TituloConferido choice** — Database has single field but XSD allows choice between enum + OutroTitulo (free text)
11. **Assinantes papel** — Need to ensure "emissora" vs "registradora" distinction is preserved in fluxo_assinaturas.papel
12. **IesRegistradora full data** — Currently only name/CNPJ/codigo_mec stored in diplomas; full address/credentials scattered

---

## EXTRA COLUMNS IN DATABASE (No XSD Mapping)

| Table | Column | Purpose |
|-------|--------|---------|
| diplomados | cpf_hash, cpf_encrypted, rg_encrypted, email_encrypted | Encryption/Privacy |
| diplomados | created_at, updated_at | Audit |
| diplomas | processo_id | Process tracking |
| diplomas | legado_* (multiple) | Legacy system import |
| diplomas | is_legado | Legacy flag |
| diplomas | turno | Shift/period |
| diplomas | municipio_colacao, uf_colacao | Ceremony location |
| diplomas | url_verificacao | Verification link |
| diplomas | data_publicacao | Publication date |
| diplomas | emitido_por_user_id | User audit trail |
| diplomas | observacoes_diploma | Notes |
| cursos | carga_horaria_hora_relogio | Alternative hour format |
| cursos | tipo_processo_emec | Process type detail |
| cursos | unidade_certificadora | Accreditation |
| cursos | coordenador_* (3 fields) | Course coordinator |
| cursos | carga_horaria_estagio, _atividades_complementares, _tcc | Specific hour breakdown |
| cursos | vagas_autorizadas, periodicidade | Operational |
| cursos | situacao_emec, data_inicio_funcionamento | Status tracking |
| cursos | conceito_curso, ano_cc, cpc_*, enade_* | Quality metrics |
| cursos | cine_*, codigo_grau_mec, codigo_habilitacao_mec | Classification |
| cursos | objetivo_curso, periodo_divisao_turmas, numero_etapas | Curriculum details |
| cursos | duracao_hora_aula_minutos, dias_letivos, relevancia | Scheduling |
| cursos | departamento_id | Organizational |
| cursos | descricao_*, codigo_curso | Internal reference |
| credenciamentos | vigente, alerta_renovacao_dias, observacoes, arquivo_url | Operational |
| credenciamentos | updated_at | Audit |
| assinantes | ativo, tipo_certificado, ordem_assinatura | Operational |
| institucoes | (30+ extra fields) | Tenant/SaaS management |
| documentos_digitais | (18 fields) | Digital document management (separate system) |
| documentos_estudante | (8 fields) | Student document archival |
| processos_emissao | (5 fields) | Batch process tracking |
| fluxo_assinaturas | hash_assinatura | Signature verification |
| filiacoes | ordem | Parent ordering |

---

## STRUCTURAL OBSERVATIONS

### 1. ID Generation Mismatch
- **XSD requires:** VDip{44}, Dip{44}, RDip{44}, ReqDip{44} (formatted hex strings)
- **DB stores:** UUID format
- **Action needed:** Conversion layer required when generating XML

### 2. Assinantes Structure
- **XSD:** Distinguishes emissora vs registradora context in two separate `<Assinantes>` blocks
- **DB:** Stored in single assinantes table + fluxo_assinaturas.papel indicator
- **Status:** Mappable but requires context awareness during XML generation

### 3. IES Emissora vs Registradora
- **XSD:** Distinct IesEmissora and IesRegistradora sections in DadosRegistro
- **DB:** FIC stores as diplomas columns (emissora_* and registradora_*) + foreign key to instituicoes
- **Status:** Flattened but recoverable; secondary lookup to instituicoes needed for full details

### 4. Filiação Structure
- **XSD:** Genitor with Nome + Sexo required; multiple allowed
- **DB:** filiacoes table with order field; properly structured
- **Status:** ✓ Complete match

### 5. Credenciamento/Reconhecimento/Renovação
- **XSD:** Separate optional sections with Tipo/Numero/Data/Veiculo/DataPublicacao
- **DB:** credenciamentos table with tipo filter + separates autorizacao vs reconhecimento vs renovacao columns in cursos
- **Status:** Partial mismatch - credenciamentos is for IES institutional level; course-level separated into cursos fields

### 6. Segurança (Código Validação)
- **XSD Diploma:** `{EMEC_emissora}.{EMEC_registradora}.{hex12+}`
- **XSD Histórico:** `{EMEC_emissora}.{hex12+}`
- **DB:** diplomas.codigo_validacao (single field, format not enforced)
- **Status:** Stored but format validation/generation not evident

### 7. Assinatura Digital (Signature Elements)
- **XSD:** Multiple ds:Signature blocks (emissora in DadosDiploma, registradora in DadosRegistro, external AD-RA in root)
- **DB:** xml_gerados.assinantes_xml (JSON?) + fluxo_assinaturas (tracking)
- **Status:** Minimal storage; actual signature content in xml_gerados or external

### 8. DocumentacaoComprobatoria
- **XSD:** Base64-encoded documents with tipo attribute (DocumentoIdentidadeDoAluno, etc.)
- **DB:** documentos_estudante with arquivo_pdfa_base64 + tipo field
- **Status:** ✓ Mappable; tipo field matches enum

---

## COVERAGE SUMMARY BY XML

| XML Document | Coverage | Critical Gaps |
|--------------|----------|---------------|
| **Diploma** | 85% | Missing HoraEmissaoHistorico, TermoResponsabilidade, address edge cases |
| **Histórico Escolar** | 92% | Missing HoraEmissaoHistorico, SituacaoDiscente enum validation |
| **Documentação Acadêmica** | 88% | Missing TermoResponsabilidade, some DocumentacaoComprobatoria types |
