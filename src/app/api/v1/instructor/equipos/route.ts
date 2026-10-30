import { manejar } from "@/lib/http"
import { datosPanel } from "@/servicios/instructor"
import { exigirInstructor } from "@/servicios/sesion"
import { publicarEquipo } from "@/servicios/rutas-instructor"

export function GET(): Promise<Response> {
  return manejar(async () => {
    await exigirInstructor()
    const datos = await datosPanel()
    return { equipos: datos.equipos }
  })
}

export function POST(request: Request): Promise<Response> {
  return publicarEquipo(request)
}
