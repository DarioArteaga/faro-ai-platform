/** Quita credenciales y URIs de un mensaje antes de escribirlo en el log. */
export function detalleSeguro(error: unknown): string {
  const mensaje = error instanceof Error ? error.message : "error desconocido"
  return enmascarar(mensaje)
}

export function enmascarar(texto: string): string {
  return texto
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://***")
    .replace(/xi-api-key[=:\s]+\S+/gi, "xi-api-key=***")
    .replace(/bearer\s+\S+/gi, "bearer ***")
    .replace(/signed_url["']?\s*[:=]\s*["']?\S+/gi, "signed_url=***")
}

function escapar(valor: string): string {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function ocultarClaves(valor: unknown, encabezado: string, profundidad: number): unknown {
  if (profundidad > 8) return valor
  if (Array.isArray(valor)) return valor.map((item) => ocultarClaves(item, encabezado, profundidad + 1))
  if (!valor || typeof valor !== "object") return valor
  const salida: Record<string, unknown> = {}
  for (const [clave, item] of Object.entries(valor)) {
    const normal = clave.toLowerCase()
    salida[clave] =
      normal === encabezado || normal === "authorization" || normal === "xi-api-key"
        ? "***"
        : ocultarClaves(item, encabezado, profundidad + 1)
  }
  return salida
}

/** Quita el secreto de una respuesta de tool antes de mostrarla o guardarla. */
export function enmascararCuerpoTool(texto: string, encabezado = "x-faro-tool-secret"): string {
  const recorte = texto.slice(0, 4_000)
  const normal = encabezado.toLowerCase()
  try {
    return JSON.stringify(ocultarClaves(JSON.parse(recorte) as unknown, normal, 0)).slice(0, 2_000)
  } catch {
    const patron = new RegExp(`(${escapar(encabezado)}["']?\\s*[:=]\\s*["']?)[^"'\\s,}&]+`, "gi")
    return recorte.replace(patron, "$1***").slice(0, 2_000)
  }
}

export function ocultarSecreto(texto: string, secreto: string | undefined, encabezado: string): string {
  const limpio = enmascararCuerpoTool(texto, encabezado)
  if (!secreto || secreto.length < 8) return limpio
  return limpio.split(secreto).join("***")
}
