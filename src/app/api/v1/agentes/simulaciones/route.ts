import { z } from "zod"

import { detalleSeguro } from "@/lib/enmascarar"
import { ErrorHttp } from "@/lib/errores"
import { jsonError, leerCuerpo, manejar } from "@/lib/http"
import { log } from "@/lib/log"
import { correrSimulacionDeEquipo, exportarSimulaciones } from "@/servicios/agentes"
import { exigirUsuario } from "@/servicios/sesion"

export const maxDuration = 180

const esquema = z
  .object({
    escenario: z.string(),
    criterio: z.string(),
  })
  .strict()

export async function GET(): Promise<Response> {
  try {
    const usuario = await exigirUsuario()
    const datos = await exportarSimulaciones(usuario)
    return new Response(JSON.stringify(datos, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": 'attachment; filename="simulaciones.json"',
      },
    })
  } catch (error) {
    if (error instanceof ErrorHttp) return jsonError(error.message, error.status)
    log.error({ detalle: detalleSeguro(error) }, "error de api")
    return jsonError("No se pudo completar la solicitud.", 500)
  }
}

export async function POST(request: Request): Promise<Response> {
  return manejar(async () => {
    const usuario = await exigirUsuario()
    const datos = esquema.parse(await leerCuerpo(request))
    return correrSimulacionDeEquipo(usuario, datos)
  })
}
