import { publicarEstudiante } from "@/servicios/rutas-instructor"

export function POST(request: Request): Promise<Response> {
  return publicarEstudiante(request)
}
