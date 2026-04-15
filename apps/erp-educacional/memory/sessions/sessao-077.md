# Sessão 077 — Fix Pipeline Gerar XML (3 camadas)

**Data:** 2026-04-12
**Sprint:** S2/E2.1 (polish final)
**Commits:** `1e0d18a`, `7967593`, `67a7a61`, `956350e`, `89b61ea`
**Deploy Vercel:** READY (todas as 5 entregas)

---

## Contexto (continuação sessão anterior)

Continuação direta da sessão anterior — confirmação de deploy e resolução de erros em cascata ao clicar "Gerar XML".

---

## Entregas

### 1. Fix CSRF `salvarCurriculo` (commit `1e0d18a`)
- `fetch()` → `fetchSeguro()` + `body.error` → `body.erro || body.error`
- Corrigia erro 403 ao salvar código do currículo

### 2. Fix "Ver Processo" — rota errada (commit `7967593`)
- `/diploma/diplomas/${id}` → `/diploma/processos/${id}`
- Botão na tela de revisão agora vai pro pipeline correto

### 3. Fix "Gerar XML" silencioso — 3 causas (commit `67a7a61`)
- `isInitialLoad` ref → refresh de background não desmonta PainelAcoes
- `_executarGerarXml` inline → modal override não é destruído pelo `setLoading`
- `export const maxDuration = 60` → Vercel não mata função durante conversão PDF/A

### 4. Fix ImageMagick policy no Dockerfile Railway (commit `956350e`)
- O `sed` usava `|` como delimitador + `|` no conteúdo (`read|write`) → comando quebrava silenciosamente
- Novo approach: deletar linha restritiva + inserir policy correta antes de `</policymap>`
- Railway rebuild: 30s, confirmado via `/convert` endpoint

### 5. Fix BUCKET_ORIGEM errado (commit `89b61ea`) ← CAUSA RAIZ DEFINITIVA
- `converter-service.ts` usava `BUCKET_ORIGEM = 'documentos'`
- Arquivos de processo vivem em `processo-arquivos` (confirmado: HTTP 200 vs 404)
- Fix: `BUCKET_ORIGEM = 'processo-arquivos'`
- Pipeline testado end-to-end: 161KB JPG → PDF/A 237KB ✅

---

## Diagnóstico (como encontrar bugs em cascata)

```
Gerar XML → silencioso
  └─ Causa: React unmounting (isInitialLoad fix)
     └─ Erro visível: "Falha ao converter documentos PDF/A"
        └─ Causa 1: ImageMagick policy no Railway (Dockerfile fix)
           └─ Erro ainda persiste
              └─ Causa 2: BUCKET_ORIGEM = 'documentos' (404 no download)
                 └─ Fix definitivo: 'processo-arquivos'
```

---

## Estado do Sistema Pós-Sessão

- **Gerar XML:** pipeline end-to-end funcional pela 1ª vez
- **Comprobatórios:** 4 documentos convertidos na 1ª geração, cacheados em `documentos-pdfa` para reuso
- **Modal override:** abre e fecha corretamente sem perda de estado
- **Ver Processo:** rota correta
- **CSRF currículo:** fetchSeguro aplicado

---

## Próxima Sessão (078)

- Testar "Gerar XML" com override de carga horária → confirmar 2 XMLs gerados + validados XSD
- Epic 2.3: RVDD (Representação Visual do Diploma Digital — PDF visual)
- Ou Epic 2.2: BRy OAuth2 (depende de credenciais de homologação)
