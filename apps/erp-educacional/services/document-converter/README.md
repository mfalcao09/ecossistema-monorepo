# DocumentConverter — Microserviço PDF/A

Microserviço de conversão de documentos para PDF/A (ISO 19005-2) para o sistema de Diploma Digital da FIC.

Converte JPG, PNG, TIFF e PDF para PDF/A-2B usando Ghostscript, e valida a conformidade com veraPDF.

---

## Por que um microserviço separado?

Ghostscript e veraPDF são ferramentas de linha de comando que precisam estar instaladas no sistema operacional. A Vercel (onde roda o Next.js) usa ambiente serverless que não suporta instalação de binários. Por isso, esse serviço roda em um container Docker separado.

---

## Endpoints

### `GET /health`
Verifica se o serviço está rodando.

**Resposta:**
```json
{ "status": "ok", "service": "document-converter", "version": "1.0.0" }
```

---

### `POST /convert`
Converte um arquivo para PDF/A via upload multipart.

**Headers:**
```
x-api-key: sua-chave-secreta
Content-Type: multipart/form-data
```

**Body:**
- `file`: arquivo (PDF, JPG, PNG, TIFF) — máximo 20MB

**Resposta:**
```json
{
  "success": true,
  "pdfaBase64": "JVBERi0xLjcK...",
  "validation": {
    "isCompliant": true,
    "profile": "PDF_A_2B",
    "warnings": [],
    "errors": []
  },
  "metadata": {
    "originalName": "rg.jpg",
    "originalSize": 245123,
    "pdfaSize": 189432,
    "processingMs": 1240
  }
}
```

---

### `POST /extrair-documentos` (Sprint 2)

Extração assíncrona de dados acadêmicos via Gemini 2.5 Flash. Responde **202 Accepted** imediatamente e processa em background. Ao final, envia **PUT** para o `callback_url` com o shared secret no header `x-extracao-callback-secret`.

Fluxo fire-and-forget foi escolhido para contornar o timeout de 60s do Vercel Pro — a extração pode levar até ~180s para múltiplos arquivos.

**Headers:**
- `x-api-key: <CONVERTER_API_KEY>`

**Body:**
```json
{
  "sessao_id": "uuid",
  "arquivos": [
    {
      "storage_path": "processos/xxx/rg.jpg",
      "nome_original": "rg.jpg",
      "mime_type": "image/jpeg",
      "tamanho_bytes": 245123,
      "signed_url": "https://<supabase>/storage/v1/object/sign/..."
    }
  ],
  "callback_url": "https://gestao.ficcassilandia.com.br/api/extracao/sessoes/xxx/callback",
  "gemini_api_key": "AIza..."
}
```

**Resposta imediata (202):**
```json
{ "accepted": true, "sessao_id": "uuid", "total_arquivos": 3 }
```

**Callback (PUT callback_url):**
- Header `x-extracao-callback-secret: <EXTRACAO_CALLBACK_SECRET>`
- Body: `{ sessao_id, dados_extraidos, arquivos_processados, processing_ms, erro? }`
- Retry: até 3 tentativas com backoff exponencial (2s → 4s → 8s)

---

### `POST /convert-base64`
Converte um arquivo já em Base64.

**Headers:**
```
x-api-key: sua-chave-secreta
Content-Type: application/json
```

**Body:**
```json
{
  "base64": "JVBERi0xLjcK...",
  "filename": "rg.pdf",
  "mimetype": "application/pdf"
}
```

---

## Variáveis de Ambiente

| Variável | Obrigatório | Padrão | Descrição |
|----------|------------|--------|-----------|
| `PORT` | Não | `3100` | Porta do servidor |
| `CONVERTER_API_KEY` | Sim (produção) | — | Chave de autenticação entre serviços (header `x-api-key`) |
| `EXTRACAO_CALLBACK_SECRET` | Sim para `/extrair-documentos` | — | Shared secret para assinar o header do callback PUT ao Next.js |
| `LOG_LEVEL` | Não | `info` | Nível de log (debug/info/warn/error) |
| `VERAPDF_PATH` | Não | `/opt/verapdf/.../verapdf` | Caminho do executável veraPDF |

---

## Rodando localmente (sem Docker)

Requisitos: Ghostscript, Java (JRE), veraPDF instalados no sistema.

```bash
# Instalar dependências Node
npm install

# Configurar variáveis
cp .env.example .env
# Editar .env com seus valores

# Iniciar
npm start

# Testar
curl http://localhost:3100/health
```

---

## Rodando com Docker (recomendado)

```bash
# Build da imagem
docker build -t document-converter .

# Rodar o container
docker run -d \
  --name document-converter \
  -p 3100:3100 \
  -e CONVERTER_API_KEY=sua-chave-secreta \
  document-converter

# Verificar logs
docker logs -f document-converter

# Testar
curl http://localhost:3100/health
```

---

## Deploy no Railway (produção)

O arquivo `railway.toml` já está configurado para deploy automático via Docker.

### Passo a passo:

1. Acesse [railway.app](https://railway.app) e faça login com o GitHub

2. Clique em **New Project → Deploy from GitHub repo**

3. Selecione o repositório `diploma-digital`

4. Clique em **Configure → Root Directory** e defina: `services/document-converter`

5. O Railway detecta o `Dockerfile` automaticamente

6. Adicione as variáveis de ambiente:
   - `CONVERTER_API_KEY` = (gere uma chave segura: `openssl rand -hex 32`)
   - `PORT` = `3100`

7. Aguarde o deploy (5–10 minutos — Ghostscript e veraPDF são grandes)

8. Anote a URL gerada (ex: `https://document-converter-xxx.up.railway.app`)

9. Adicione essa URL ao projeto Next.js na Vercel:
   - Vá em Vercel → diploma-digital → Settings → Environment Variables
   - Adicione: `DOCUMENT_CONVERTER_URL` = URL do Railway
   - Adicione: `CONVERTER_API_KEY` = a mesma chave do Railway

10. Teste em produção:
```bash
curl https://document-converter-xxx.up.railway.app/health
```

---

## Como o Next.js usa este serviço

O fluxo completo quando a secretaria faz upload de um documento:

```
Secretária faz upload no browser
    → Next.js recebe via /api/converter/pdfa
    → Next.js chama este microserviço (POST /convert)
    → Ghostscript converte para PDF/A-2B
    → veraPDF valida conformidade
    → PDF/A em Base64 retorna para o Next.js
    → Next.js salva no Supabase Storage
    → Next.js salva o Base64 na tabela documentos_estudante
    → Pronto para embutir no XML DocumentacaoAcademicaRegistro
```

---

## Estrutura do projeto

```
services/document-converter/
├── Dockerfile              # Container com Ghostscript + Java + veraPDF
├── railway.toml            # Configuração de deploy no Railway
├── package.json
├── .env.example            # Template de variáveis de ambiente
├── .dockerignore
├── icc/
│   └── README.md           # Instruções do perfil ICC (fallback)
└── src/
    ├── server.js           # Servidor Express com os endpoints
    ├── converter.js        # Lógica de conversão (Ghostscript)
    ├── validator.js        # Validação veraPDF
    └── logger.js           # Winston logger
```
