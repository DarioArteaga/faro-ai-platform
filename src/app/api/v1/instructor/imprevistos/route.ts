import { publicarImprevisto } from "@/servicios/rutas-instructor"

export function POST(request: Request): Promise<Response> {
  return publicarImprevisto(request)
}
