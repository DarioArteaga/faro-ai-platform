import { manejar } from "@/lib/http"
import { leerTranscripcion } from "@/servicios/conversaciones"
import { exigirUsuario } from "@/servicios/sesion"

export async function GET(_request: Request, contexto: { params: Promise<{ id: string }> }): Promise<Response> {
  return manejar(async () => {
    const { id } = await contexto.params
    return leerTranscripcion(await exigirUsuario(), id)
  })
}
