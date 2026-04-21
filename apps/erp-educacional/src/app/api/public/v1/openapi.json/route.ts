/**
 * GET /api/public/v1/openapi.json
 *
 * Spec OpenAPI 3.1 da API pública (público, sem auth — só descreve).
 */

import { NextResponse } from "next/server";

const spec = {
  openapi: "3.1.0",
  info: {
    title: "Atendimento FIC — API Pública",
    version: "1.0.0",
    description:
      "API REST pública do módulo Atendimento. Autenticação via header `Authorization: Bearer sk_live_...` (ou `api-key: sk_live_...`). Scopes emitidos por chave.",
  },
  servers: [
    { url: "https://gestao.ficcassilandia.com.br/api/public/v1" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "sk_live_<hex>" },
      apiKeyHeader: { type: "apiKey", in: "header", name: "api-key" },
    },
  },
  security: [{ bearerAuth: [] }, { apiKeyHeader: [] }],
  paths: {
    "/messages": {
      post: {
        summary: "Envia mensagem ativa",
        "x-scope": "messages:send",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["to"],
                properties: {
                  to: { type: "string", description: "Telefone E.164 sem +. Ex: 5567991234567" },
                  text: { type: "string" },
                  template_id: { type: "string" },
                  inbox_id: { type: "string", format: "uuid" },
                  template_vars: { type: "object" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Mensagem enfileirada (status=pending)" },
          "400": { description: "Body inválido" },
          "401": { description: "Unauthorized" },
          "403": { description: "Missing scope messages:send" },
        },
      },
    },
    "/dashboard": {
      get: {
        summary: "Métricas consolidadas (10 KPIs)",
        "x-scope": "dashboard:read",
        responses: { "200": { description: "KPIs do dia" } },
      },
    },
    "/contacts": {
      get: { summary: "Lista contatos", "x-scope": "contacts:read" },
      post: { summary: "Cria contato", "x-scope": "contacts:write" },
    },
    "/deals": {
      get: { summary: "Lista deals", "x-scope": "deals:read" },
      post: { summary: "Cria deal", "x-scope": "deals:write" },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}
