import { z } from "zod"

import { leerCuerpo, manejar } from "@/lib/http"
import { leerPaginacion } from "@/lib/paginacion"
import { listarDelEquipo, registrarConversacion } from "@/servicios/conversaciones"
import { exigirUsuario } from "@/servicios/sesion"

const esquema = z
  .object({
    conversation_id: z.string(),
    agente_slug: z.string().min(1).max(80),
    modo: z.enum(["texto", "voz"]),
  })
  .strict()

export async function GET(request: Request): Promise<Response> {
  return manejar(async () => {
    const usuario = await exigirUsuario()
    const pagina = leerPaginacion(new URL(request.url).searchParams)
    return listarDelEquipo(usuario, pagina.page, pagina.page_size)
  })
}

export async function POST(request: Request): Promise<Response> {
  return manejar(async () => {
    const usuario = await exigirUsuario()
    const datos = esquema.parse(await leerCuerpo(request))
    return registrarConversacion(usuario, {
      conversationId: datos.conversation_id,
      agenteSlug: datos.agente_slug,
      modo: datos.modo,
    })
  })
}
