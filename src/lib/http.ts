import { NextResponse } from "next/server"
import { ZodError } from "zod"

import { detalleSeguro } from "@/lib/enmascarar"
import { ErrorHttp } from "@/lib/errores"
import { log } from "@/lib/log"

export function jsonOk(datos: unknown, status = 200): NextResponse {
  return NextResponse.json(datos, { status })
}

export function jsonError(detalle: string, status: number): NextResponse {
  return NextResponse.json({ detail: detalle, status_code: status }, { status })
}

export async function leerCuerpo(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new ErrorHttp(400, "La solicitud no es válida.")
  }
}

export async function manejar(accion: () => Promise<unknown>): Promise<NextResponse> {
  try {
    return jsonOk(await accion())
  } catch (error) {
    if (error instanceof ErrorHttp) return jsonError(error.message, error.status)
    if (error instanceof ZodError) return jsonError("La solicitud no es válida.", 400)
    log.error({ detalle: detalleSeguro(error) }, "error de api")
    return jsonError("No se pudo completar la solicitud.", 500)
  }
}
