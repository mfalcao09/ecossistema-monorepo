import type { MemoryLogger } from "../types.js";

export const consoleLogger: MemoryLogger = {
  warn(msg, meta) {
    // eslint-disable-next-line no-console
    console.warn(msg, meta ?? "");
  },
  error(msg, meta) {
    // eslint-disable-next-line no-console
    console.error(msg, meta ?? "");
  },
  debug(msg, meta) {
    if (process.env.MEMORY_DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.debug(msg, meta ?? "");
    }
  },
};
