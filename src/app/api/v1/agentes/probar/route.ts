import { leerCuerpo, manejar } from "@/lib/http"
import { probarTool } from "@/servicios/agentes"
import { exigirUsuario } from "@/servicios/sesion"

export async function POST(request: Request): Promise<Response> {
  return manejar(async () => {
    const usuario = await exigirUsuario()
    return probarTool(usuario, await leerCuerpo(request))
  })
}
