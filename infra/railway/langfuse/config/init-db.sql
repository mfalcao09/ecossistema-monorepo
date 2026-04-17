-- Init do Postgres Langfuse
-- Langfuse roda suas próprias migrations via Prisma no boot do `web`.
-- Prisma P3005 aborta se o schema `public` tiver QUALQUER objeto pré-existente,
-- então este init não pode criar tabelas. Extensions são ok.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
