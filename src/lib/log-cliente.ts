type Nivel = "debug" | "info" | "warn" | "error"

/** Wrapper de consola para el navegador. Silencia debug en producción. */
export function logCliente(nivel: Nivel, mensaje: string, contexto?: Record<string, string>): void {
  if (nivel === "debug" && process.env.NODE_ENV === "production") return
  const linea = JSON.stringify({
    nivel,
    ts: new Date().toISOString(),
    mensaje,
    ...contexto,
  })
  if (nivel === "debug") console.debug(linea)
  else if (nivel === "info") console.info(linea)
  else if (nivel === "warn") console.warn(linea)
  else console.error(linea)
}
