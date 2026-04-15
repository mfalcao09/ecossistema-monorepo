# Contexto Regulatório — Diploma Digital

## Legislação

### Portaria MEC nº 554/2019
- Marco regulatório original
- Formato: XML
- Assinatura: XAdES com ICP-Brasil A3+
- Mecanismos de acesso: código de validação + QR Code
- URL HTTPS obrigatória para armazenamento

### Instrução Normativa SESU/MEC nº 1/2020
- Detalhou requisitos técnicos
- Definiu schemas XML (XSD)
- Orientou a aplicação dos arquivos XML

### Instrução Normativa SESU/MEC nº 2/2021
- Atualizou sintaxe XML e anexos técnicos

### Portaria MEC nº 70/2025
- Ampliou obrigatoriedade para pós-graduação stricto sensu
- Incluiu residências em saúde
- Atualizou prazos
- XSD vigente: v1.06

## Prazos
| Data | Obrigatoriedade |
|------|----------------|
| 01/07/2025 | Graduação — TODAS as IES do Sistema Federal |
| 02/01/2026 | Pós-graduação stricto sensu + Residência em Saúde |

## Sanções
- Decreto 9.235/2017
- Notificações até suspensão de processos seletivos e atos autorizativos

## Requisitos Técnicos Obrigatórios
1. **3 XMLs:** DocAcadêmica, Histórico, Diploma
2. **XSD v1.06** (schemas do MEC)
3. **Assinatura XAdES** com ICP-Brasil A3+
4. **Carimbo de tempo** (TSA credenciada)
5. **RVDD** (PDF visual com código + QR)
6. **URL HTTPS** para repositório público
7. **Preservação mínima:** 10 anos
8. **Garantias:** autenticidade, integridade, irretratabilidade, disponibilidade, rastreabilidade, privacidade, interoperabilidade

## Ordem de Assinatura (obrigatória)
1. Representantes da IES → e-CPF (A3) → nó DadosDiploma
2. IES Emissora → e-CNPJ → nó DadosDiploma
3. IES Emissora → e-CNPJ Arquivamento (AD-RA) → nó raiz DocumentacaoAcademicaRegistro

## Fontes Oficiais
- Portal MEC: https://portal.mec.gov.br/diplomadigital/
- Schemas XSD: disponíveis no portal do MEC
- RNP Diploma Digital: https://ajuda.rnp.br/diplomas-digitais
