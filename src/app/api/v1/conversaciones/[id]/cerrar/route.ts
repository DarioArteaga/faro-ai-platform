import { manejar } from "@/lib/http"
import { cerrarConversacion } from "@/servicios/conversaciones"
import { exigirUsuario } from "@/servicios/sesion"

export async function POST(_request: Request, contexto: { params: Promise<{ id: string }> }): Promise<Response> {
  return manejar(async () => {
    const { id } = await contexto.params
    return cerrarConversacion(await exigirUsuario(), id)
  })
}
