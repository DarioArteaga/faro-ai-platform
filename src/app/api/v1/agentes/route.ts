import { leerCuerpo, manejar } from "@/lib/http"
import { crearAgenteDeEquipo, guardarAgenteDeEquipo } from "@/servicios/agentes"
import { exigirUsuario } from "@/servicios/sesion"

export async function POST(request: Request): Promise<Response> {
  return manejar(async () => {
    const usuario = await exigirUsuario()
    return crearAgenteDeEquipo(usuario, await leerCuerpo(request))
  })
}

export async function PATCH(request: Request): Promise<Response> {
  return manejar(async () => {
    const usuario = await exigirUsuario()
    return guardarAgenteDeEquipo(usuario, await leerCuerpo(request))
  })
}
