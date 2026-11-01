import { z } from "zod"

import { leerCuerpo, manejar } from "@/lib/http"
import { restaurarVersion } from "@/servicios/agentes"
import { exigirUsuario } from "@/servicios/sesion"

const esquema = z.object({ version_id: z.string().uuid() }).strict()

export async function POST(request: Request): Promise<Response> {
  return manejar(async () => {
    const usuario = await exigirUsuario()
    const datos = esquema.parse(await leerCuerpo(request))
    return restaurarVersion(usuario, datos.version_id)
  })
}
