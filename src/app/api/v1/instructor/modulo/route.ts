import { actualizarModulo } from "@/servicios/rutas-instructor"

export function PATCH(request: Request): Promise<Response> {
  return actualizarModulo(request)
}
