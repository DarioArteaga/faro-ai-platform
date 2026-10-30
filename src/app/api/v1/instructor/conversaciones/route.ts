import { listarConversacionesInstructor } from "@/servicios/rutas-instructor"

export function GET(request: Request): Promise<Response> {
  return listarConversacionesInstructor(request)
}
