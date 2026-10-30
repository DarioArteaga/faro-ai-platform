import pino from "pino"

import { enmascarar } from "@/lib/enmascarar"

export const log = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "signed_url",
      "token",
      "password",
      "*.signed_url",
      "*.token",
    ],
    censor: "***",
  },
  formatters: {
    log(objeto: Record<string, unknown>) {
      const limpio: Record<string, unknown> = {}
      for (const [clave, valor] of Object.entries(objeto)) {
        limpio[clave] = typeof valor === "string" ? enmascarar(valor) : valor
      }
      return limpio
    },
  },
})
