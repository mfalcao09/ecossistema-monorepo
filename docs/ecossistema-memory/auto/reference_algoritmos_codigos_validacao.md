---
name: Algoritmos oficiais MEC para códigos de validação (Diploma, Histórico, Currículo)
description: Fórmulas SHA256 oficiais do Anexo III IN SESu 05/2020 para gerar TCodigoValidacao (3 partes), TCodigoValidacaoHistorico (2 partes) e código do currículo
type: reference
---

Fonte: Anexo III da IN SESu 05/2020 (páginas 89-92 do PDF `in-05-versao-completa-anexos-i-ii-e-iii-v1.05.pdf`). Confirmado também na Nota Técnica 13/2019/DIFES/SESU section 7.6.1.8.

Regra geral para todos: SHA256, primeiros 12 caracteres mínimo (a-f, 0-9), todos os componentes convertidos para string UTF-8, concatenação SEM espaços entre os campos.

## 1. Código de Validação do DIPLOMA (TCodigoValidacao — 3 partes)

Estrutura visual: `CodIesEmissora . CodIesRegistradora . CodLocalizacaoDiploma`
Pattern XSD: `\d{1,}\.\d{1,}\.[a-f0-9]{12,}`
Responsável pela geração: **IES Registradora** (item 1.5)

Fórmula padrão (com NumeroFolha + NumeroSequencia):
```
SHA256(CPF || CodigoCursoEMEC || IesEmissora_CNPJ || IesRegistradora_CNPJ || LivroRegistro || NumeroFolhaDoDiploma || NumeroSequenciaDoDiploma)
```

Variante (quando registradora usa NumeroRegistro):
```
SHA256(CPF || CodigoCursoEMEC || IesEmissora_CNPJ || IesRegistradora_CNPJ || LivroRegistro || NumeroRegistro)
```

Casos especiais:
- Registradora fora do sistema federal: LivroRegistro pode ser omitido (string vazia na concatenação)
- Curso sem código EMEC: usar NumeroProcesso de SemCodigoCursoEMEC no lugar de CodigoCursoEMEC

## 2. Código de Validação do HISTÓRICO (TCodigoValidacaoHistorico — 2 partes)

Estrutura visual: `CodIesEmissora . CodLocalizacaoHistorico`
Responsável pela geração: **IES Emissora** (item 2.6)

Fórmula:
```
SHA256(RA || CPF || CodigoCursoEMEC || IesEmissora_CNPJ || DataeHora)
```

- `RA` = Registro Acadêmico / Número de Matrícula do diplomado
- `DataeHora` = formato OBRIGATÓRIO `DDMMAAAAHHMM` (12 dígitos), composto a partir das tags `DataEmissaoHistorico` + `HoraEmissaoHistorico`
- Curso sem código EMEC: usar NumeroProcessoTramitacaoEMEC no lugar

## 3. Código de Validação do CURRÍCULO

Estrutura visual: `CodIes . CodLocalizacaoCurriculo`
Responsável: **IES Emissora**

Fórmula:
```
SHA256(Codigo || CodigoCursoEMEC || IesEmissora_CNPJ || DataCurriculo)
```

- `Codigo` = Código do Currículo
- `DataCurriculo` = formato `DDMMAAAA` (8 dígitos), valor da tag DataCurriculo

## Implicação para o motor XML v2 da FIC

A FIC, como **emissora**, é responsável por gerar:
- Código do Histórico (2 partes) — fórmula completa acima
- Código do Currículo (2 partes) — fórmula completa acima

A FIC NÃO gera o código do Diploma (3 partes) — isso é responsabilidade da Registradora (UFMS/694), que recebe o XML de Documentação Acadêmica e completa o ciclo.

## Achado #2 do bug review da Kauana — RESOLVIDO
O problema "codigo_validacao_historico" no XML gerado precisa ser substituído pela aplicação correta da fórmula `SHA256(RA||CPF||CodigoCursoEMEC||CNPJ_FIC||DDMMAAAAHHMM)[:12]`, prefixado pelo código e-MEC da FIC.
