import { bajaEquipo, editarEquipo } from "@/servicios/rutas-instructor"

export function PATCH(request: Request, contexto: { params: Promise<{ slug: string }> }): Promise<Response> {
  return contexto.params.then(({ slug }) => editarEquipo(slug, request))
}

export function DELETE(_request: Request, contexto: { params: Promise<{ slug: string }> }): Promise<Response> {
  return contexto.params.then(({ slug }) => bajaEquipo(slug))
}
