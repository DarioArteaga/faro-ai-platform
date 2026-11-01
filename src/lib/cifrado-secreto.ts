import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto"

import { ErrorHttp } from "@/lib/errores"

function llave(): Buffer {
  const cruda = process.env.TOOL_SECRET_KEY?.trim()
  if (!cruda || cruda.length < 16) {
    throw new ErrorHttp(503, "Falta la clave para guardar el secreto de la tool.")
  }
  return scryptSync(cruda, "faro-tool-v1", 32)
}

/** AES-256-GCM. El texto no incluye el secreto en claro. */
export function cifrarSecreto(valor: string): string {
  const iv = randomBytes(12)
  const cifrador = createCipheriv("aes-256-gcm", llave(), iv)
  const cifrado = Buffer.concat([cifrador.update(valor, "utf8"), cifrador.final()])
  const tag = cifrador.getAuthTag()
  return `v1.${Buffer.concat([iv, tag, cifrado]).toString("base64url")}`
}

export function descifrarSecreto(guardado: string): string {
  if (!guardado.startsWith("v1.")) throw new ErrorHttp(500, "No se pudo leer el secreto guardado.")
  const datos = Buffer.from(guardado.slice(3), "base64url")
  if (datos.length < 29) throw new ErrorHttp(500, "No se pudo leer el secreto guardado.")
  const iv = datos.subarray(0, 12)
  const tag = datos.subarray(12, 28)
  const cifrado = datos.subarray(28)
  const descifrador = createDecipheriv("aes-256-gcm", llave(), iv)
  descifrador.setAuthTag(tag)
  try {
    return Buffer.concat([descifrador.update(cifrado), descifrador.final()]).toString("utf8")
  } catch {
    throw new ErrorHttp(500, "No se pudo leer el secreto guardado.")
  }
}
