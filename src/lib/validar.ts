import { z } from "zod"

import { ErrorHttp } from "@/lib/errores"

export function textoCorto(valor: string, maximo: number): string {
  const limpio = valor.trim()
  if (limpio.length < 1 || limpio.length > maximo) {
    throw new ErrorHttp(400, "El texto no es válido.")
  }
  return limpio
}

const idConversacion = /^[A-Za-z0-9_-]{8,128}$/

export function validarIdConversacion(valor: string): string {
  if (!idConversacion.test(valor)) {
    throw new ErrorHttp(400, "El identificador de la conversación no es válido.")
  }
  return valor
}

export function correoNormalizado(valor: string): string {
  const limpio = valor.trim().toLowerCase()
  if (limpio.length > 254 || !z.email().safeParse(limpio).success) {
    throw new ErrorHttp(400, "El correo no es válido.")
  }
  return limpio
}
