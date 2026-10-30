import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

describe("repositorio", () => {
  it("deja fuera del versionado los insumos de la sesión", () => {
    const ignore = fs.readFileSync(path.join(process.cwd(), ".gitignore"), "utf8")
    for (const archivo of [
      "faro-ai-platform-m1.md",
      "contexto-agentes-para-plataforma.md",
      "00-LEEME.md",
      "01-prompt-inicial.md",
      "imprevistos.yaml",
      "AGENTS.md",
    ]) {
      expect(ignore).toContain(archivo)
    }
  })
})
