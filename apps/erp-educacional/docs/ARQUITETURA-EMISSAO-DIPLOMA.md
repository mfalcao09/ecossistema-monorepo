# Arquitetura — Pipeline de Emissão de Diploma Digital

> **Versão:** 1.0
> **Data:** 2026-03-26
> **XSD:** v1.05
> **IES Emissora:** FIC (código MEC 1606)
> **IES Registradora:** Dinâmica (historicamente UFMS/694 — NUNCA presumir)

---

## 1. Princípios Fundamentais

1. **REGRA MÁXIMA:** Dados exibidos vêm SEMPRE do XML. O banco é alimentado pelo XML, nunca por presunções.
2. **FIC é APENAS emissora.** A registradora pode mudar e seu dado vem do diploma registrado.
3. **IA-Native:** IA integrada em toda experiência do usuário (assistente, auto-preenchimento, validação).
4. **Sistema próprio, do zero.** Nenhum sistema externo está sendo copiado.

---

## 2. Stack Definida

| Componente | Tecnologia | Justificativa |
|---|---|---|
| **Backend API** | Next.js API Routes (Node.js/TS) | Já definido no projeto; full-stack com frontend |
| **Módulo Cripto/XML** | Python (`lxml` + `signxml`) | Melhor lib para C14N, XAdES e validação XSD |
| **Banco de Dados** | PostgreSQL (Supabase) | Já estruturado com 70+ tabelas |
| **Storage** | Supabase Storage | S3-compatible, já em uso para XMLs legados |
| **Comunicação assíncrona** | Supabase Realtime + tabela de status | Volume da FIC não justifica RabbitMQ/SQS |
| **Frontend** | Next.js / React | Definido no projeto |
| **Hospedagem** | Vercel (frontend) + Supabase (backend/DB) | Definido no projeto |

### Decisões de descarte

| Descartado | Motivo |
|---|---|
| Microsserviços separados | Volume da FIC não justifica; módulo isolado basta |
| RabbitMQ / SQS | Supabase Realtime resolve para o volume atual |
| AWS S3 separado | Supabase Storage já é S3-compatible |
| C# / .NET / Java | Fora do radar de stack do projeto |
| NestJS | Next.js API Routes resolve; menor overhead |

---

## 3. State Machine — Status do Diploma

### 3.1 Fluxo Principal (Happy Path)

```
rascunho
  → validando_dados
  → preenchido
  → gerando_xml
  → xml_gerado
  → validando_xsd          ← "Pulo do gato": validar antes de enviar
  → aguardando_assinatura_emissora
  → em_assinatura           ← loop: cada autoridade assina
  → aplicando_carimbo_tempo ← ACT homologada ICP-Brasil
  → assinado
  → pronto_para_registro
  → enviado_registradora
  → aguardando_registro
  → registrado              ← XML final recebido da registradora
  → gerando_rvdd            ← PDF com QR Code
  → rvdd_gerado
  → publicado               ← disponível ao diplomado
```

### 3.2 Fluxos de Erro/Rejeição

```
gerando_xml          → erro (falha na geração)
validando_xsd        → erro (XML inválido contra XSD)
aplicando_carimbo    → erro (falha na ACT)
gerando_rvdd         → erro (falha no PDF)
aguardando_registro  → rejeitado_registradora (glosa)

erro                 → rascunho (corrigir e reiniciar)
erro                 → gerando_xml (retentar)
erro                 → validando_xsd (retentar)
rejeitado            → rascunho (corrigir após glosa)
validando_dados      → rascunho (dados incompletos)
```

### 3.3 Regras

- Toda transição é **validada** pela função `transicionar_status_diploma()`
- Transições de retorno (rejeição, erro) **exigem motivo obrigatório**
- Toda transição gera **log imutável** em `diploma_status_log`
- O log registra: quem executou, quando, motivo, dados extras (JSON)

---

## 4. Os 3 XMLs Obrigatórios

### 4.1 Responsabilidade da IES Emissora (FIC — Fases 1 a 3)

| XML | Elemento Raiz | Gerado por |
|---|---|---|
| **Histórico Escolar** | `<DocumentoHistoricoEscolarFinal>` | SaaS da FIC |
| **Documentação Acadêmica** | `<DocumentacaoAcademicaRegistro>` | SaaS da FIC (nó `<DadosDiploma>` + privados; nó `<DadosRegistro>` vazio) |
| **Currículo Escolar** | `<CurriculoEscolar>` | SaaS da FIC |

### 4.2 Responsabilidade da IES Registradora (Fases 4 a 5)

| XML | Elemento Raiz | Gerado por |
|---|---|---|
| **Diploma Digital** | `<Diploma>` | Sistema da Registradora (dados públicos) |
| **Documentação Acadêmica (finalizada)** | `<DocumentacaoAcademicaRegistro>` | Registradora preenche `<DadosRegistro>` e assina |

---

## 5. Pipeline de Assinatura Digital

### 5.1 Ponto crítico: A3 assina no CLIENT, não no servidor

O certificado A3 (token USB/nuvem) **nunca** expõe a chave privada. O fluxo é:

1. Backend **prepara**: canonicaliza o nó XML (C14N) → gera hash SHA-256
2. Frontend **envia** o hash para o dispositivo criptográfico (via Web PKI / extensão)
3. Token A3 **devolve** a assinatura (hash encriptado com chave privada RSA)
4. Backend **recebe** a assinatura e monta o bloco `<ds:Signature>` no XML
5. Backend **solicita** carimbo do tempo à ACT (RFC 3161)
6. Backend **injeta** o carimbo em `<xades:SignatureTimeStamp>`

### 5.2 Ordem de assinatura na Emissora

1. Secretário Acadêmico (e-CPF A3)
2. Diretor (e-CPF A3)
3. IES Emissora (e-CNPJ) — pode ser A1 em cofre de chaves
4. Carimbo do tempo em cada assinatura

### 5.3 Tecnologias de assinatura no browser

Opções para interação com token A3 no frontend:
- **Lacuna Web PKI** (brasileiro, suporte ICP-Brasil nativo)
- **Web Crypto API** + extensão de bridge
- **Applet Java** (legado, evitar)

---

## 6. Funções de Banco já Implementadas

| Função | Descrição |
|---|---|
| `gerar_id_mec(uuid, prefixo)` | Converte UUID → ID formato MEC (VDip{44}, Dip{44}, etc.) |
| `gerar_ids_mec_diploma(uuid)` | Retorna JSONB com os 4 IDs MEC de um diploma |
| `gerar_codigo_validacao_diploma(emec, emec_reg)` | Gera código `{eMEC}.{eMEC_reg}.{hex16}` |
| `gerar_codigo_validacao_historico(emec)` | Gera código `{eMEC}.{hex16}` |
| `transicionar_status_diploma(...)` | Transição com validação + log de auditoria |
| `extract_livro_registro(uuid, path)` | Extrai dados de registro de XMLs legados |
| `extract_conceito_especifico(uuid, path)` | Extrai conceitos específicos de disciplinas |
| `extract_nota_ate_cem(uuid, path)` | Extrai notas em escala 0-100 |

---

## 7. Tabelas-Chave para Geração de XML

| Tabela | Papel |
|---|---|
| `diplomados` | Dados do aluno (nome, CPF, sexo, naturalidade, RG, nascimento) |
| `diplomas` | Dados do diploma (datas, títulos, códigos, status, registro) |
| `cursos` | Dados do curso (nome, código eMEC, modalidade, atos regulatórios) |
| `instituicoes` | Dados da IES (emissora, registradora, mantenedora) |
| `credenciamentos` | Atos de credenciamento/recredenciamento da IES |
| `diploma_disciplinas` | Disciplinas do histórico escolar |
| `diploma_atividades_complementares` | Atividades complementares |
| `diploma_estagios` | Estágios supervisionados |
| `diploma_enade` | Situação ENADE |
| `diploma_habilitacoes` | Habilitações do diploma |
| `filiacoes` | Filiação (genitores com nome + sexo) |
| `assinantes` | Autoridades assinantes (CPF, cargo) |
| `fluxo_assinaturas` | Rastreio de cada assinatura no pipeline |
| `xml_gerados` | XMLs gerados (conteúdo + hash + validação XSD) |
| `documentos_estudante` | Documentação comprobatória (base64) |
| `diploma_status_log` | Auditoria imutável de transições de estado |
| `diploma_transicoes_validas` | Mapa de transições permitidas |

---

## 8. Integrações Externas (pendente definição)

| Integração | Protocolo | Status |
|---|---|---|
| **IES Registradora (UFMS?)** | mTLS ou outro | **PENDENTE** — aguardando Marcelo informar como a UFMS recebe |
| **ACT (Carimbo do Tempo)** | RFC 3161 (HTTP POST) | **PENDENTE** — contratar ACT homologada ICP-Brasil |
| **Web PKI (assinatura A3)** | JavaScript SDK | **PENDENTE** — avaliar Lacuna Web PKI vs alternativas |
| **Cofre de chaves (e-CNPJ A1)** | Supabase Vault ou KMS | **PENDENTE** — definir quando tiver o certificado |

---

## 9. Próximos Passos

1. **Motor de Geração XML** — implementar em Python (`lxml`) a construção dos 3 XMLs a partir do banco
2. **Validador XSD** — implementar validação contra os XSDs oficiais do MEC v1.05
3. **Integração com Registradora** — definir protocolo com a UFMS
4. **Módulo de Assinatura** — implementar fluxo A3 no frontend + carimbo ACT
5. **Gerador de RVDD** — template PDF com QR Code
6. **Portal do Diplomado** — acesso ao diploma + verificação pública
