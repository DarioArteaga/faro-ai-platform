import { actualizarVoz } from "@/servicios/rutas-instructor"

export function PATCH(request: Request): Promise<Response> {
  return actualizarVoz(request)
}
