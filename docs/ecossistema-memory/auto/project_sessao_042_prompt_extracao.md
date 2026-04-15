---
name: Sessão 042 — Prompt Gemini expandido + agregação disciplinas
description: Sessão 042 (10/04): prompt Gemini expandido para todos campos XSD + agregação com disciplinas/enade/genitores/comprobatórios
type: project
---

Sessão 042 (10/04/2026): fix do pipeline de extração — commit 9117ded.

**Causa raiz dos campos vazios:**
- Prompt Gemini pedia apenas 8 campos (nome, CPF, nascimento, nacionalidade, naturalidade, mãe, pai)
- Faltavam: rg, rg_orgao, rg_uf, sexo, email, telefone, genitores, disciplinas, enade, codigo_emec, titulo_conferido
- `maxOutputTokens: 4096` insuficiente para tabelas de disciplinas
- `agregarDados` só mergeava diplomado/curso/ies, ignorando disciplinas/enade

**Fix prompt (extractor.js):**
- Diplomado: +10 campos (rg, rg_orgao, rg_uf, sexo, email, telefone, nome_social, naturalidade campo único, genitores array)
- Curso: +codigo_emec, titulo_conferido, turno, forma_acesso
- Novas seções: enade (habilitado/condicao/ano), disciplinas (array com codigo/nome/CH/nota/situacao/docente/periodo)
- Dicas por tipo de documento (RG→extrair rg_orgao, Histórico→disciplinas)
- maxOutputTokens 4096→16384

**Fix agregação (server.js):**
- agregarDados agora mergeia 5 chaves: diplomado, curso, ies, enade, disciplinas
- Disciplinas: acumula de todos os docs, dedup por nome normalizado, enriquece campos faltantes
- Genitores: dedup por nome
- comprobatorios_detectados: lista tipos de docs identificados com confiança

**Pendência:** arquivos não aparecem na lista porque processo_id=null e processo_arquivos está vazio antes de criar processo. Isso é by design — os arquivos ficam no JSONB `arquivos` da sessão até criar o processo.

**Why:** Prompt insuficiente gerava campos vazios mesmo com documentos corretos enviados.
**How to apply:** Mudanças são no Railway (document-converter), não no frontend. Deploy automático via GitHub push.
