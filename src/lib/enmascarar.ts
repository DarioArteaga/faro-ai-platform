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
