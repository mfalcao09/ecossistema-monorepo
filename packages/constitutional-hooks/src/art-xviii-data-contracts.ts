/**
 * Art. XVIII — Data Contracts Versionados (PreToolUse)
 *
 * Se a tool tem `input_schema` (JSON Schema) registrado, valida o input
 * antes de executar. Invalido → bloqueia com mensagem clara indicando
 * versão e erro.
 *
 * Validador: ajv (draft 2020-12 + formats).
 */

import Ajv, { type ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import type { PreToolUseHook, ToolSchemaRegistry } from "./types.js";

export interface ArtXVIIIConfig {
  registry?: ToolSchemaRegistry;
  /** Se true e tool não tem schema registrado, BLOQUEIA (fail-closed). Default false. */
  requireSchema?: boolean;
}

export function createArtXVIIIHook(config: ArtXVIIIConfig = {}): PreToolUseHook {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  // Cache de schemas compilados por tool_name — evita recompilar a cada chamada.
  const compiled = new Map<string, ReturnType<typeof ajv.compile>>();

  function validate(tool_name: string, schema: object, input: unknown): ErrorObject[] | null {
    let fn = compiled.get(tool_name);
    if (!fn) {
      fn = ajv.compile(schema);
      compiled.set(tool_name, fn);
    }
    const ok = fn(input);
    return ok ? null : (fn.errors ?? []);
  }

  return async (ctx) => {
    const registry = config.registry;
    if (!registry) return { decision: "allow" };

    const schema = registry.getSchema(ctx.tool_name);
    if (!schema) {
      if (config.requireSchema) {
        return {
          decision: "block",
          reason: `Art. XVIII: Tool "${ctx.tool_name}" sem schema registrado (requireSchema=true)`,
        };
      }
      return { decision: "allow" };
    }

    const errors = validate(ctx.tool_name, schema, ctx.tool_input);
    if (!errors) return { decision: "allow" };

    const version = registry.getVersion(ctx.tool_name) ?? "unversioned";
    const summary = errors
      .slice(0, 3)
      .map((e) => `${e.instancePath || "/"} ${e.message}`)
      .join("; ");
    return {
      decision: "block",
      reason: `Art. XVIII: Input não conforma schema ${version} da tool ${ctx.tool_name}: ${summary}`,
    };
  };
}

/**
 * Export default sem registry — retorna allow até um registry ser plugado.
 * Use `createArtXVIIIHook({ registry })` em produção.
 */
export const artXVIIIDataContracts: PreToolUseHook = createArtXVIIIHook();
