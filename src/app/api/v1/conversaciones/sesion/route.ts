import { z } from "zod"

import { leerCuerpo, manejar } from "@/lib/http"
import { iniciarSesion } from "@/servicios/conversaciones"
import { exigirUsuario } from "@/servicios/sesion"

const esquema = z
  .object({
    agente_slug: z.string().min(1).max(80),
    modo: z.enum(["texto", "voz"]),
  })
  .strict()

export async function POST(request: Request): Promise<Response> {
  return manejar(async () => {
    const usuario = await exigirUsuario()
    const datos = esquema.parse(await leerCuerpo(request))
    return iniciarSesion(usuario, { agenteSlug: datos.agente_slug, modo: datos.modo })
  })
}
