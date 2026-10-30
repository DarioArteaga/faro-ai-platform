import { actualizarEstudiante, bajaEstudiante } from "@/servicios/rutas-instructor"

export function PATCH(request: Request, contexto: { params: Promise<{ id: string }> }): Promise<Response> {
  return contexto.params.then(({ id }) => actualizarEstudiante(id, request))
}

export function DELETE(_request: Request, contexto: { params: Promise<{ id: string }> }): Promise<Response> {
  return contexto.params.then(({ id }) => bajaEstudiante(id))
}
