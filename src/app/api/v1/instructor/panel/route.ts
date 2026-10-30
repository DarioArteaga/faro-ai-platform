import { panel } from "@/servicios/rutas-instructor"

export function GET(): Promise<Response> {
  return panel()
}
