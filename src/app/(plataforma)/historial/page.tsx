import type { Metadata } from "next"
import Link from "next/link"

import { formatoFecha } from "@/lib/fecha"
import { leerPaginacion } from "@/lib/paginacion"
import { listarDelEquipo } from "@/servicios/conversaciones"
import { exigirUsuario } from "@/servicios/sesion"

export const metadata: Metadata = {
  title: "Historial",
  robots: { index: false, follow: false },
}

export default async function Historial({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; page_size?: string }>
}): Promise<React.ReactElement> {
  const usuario = await exigirUsuario()
  const parametros = await searchParams
  const consulta = new URLSearchParams()
  if (parametros.page) consulta.set("page", parametros.page)
  if (parametros.page_size) consulta.set("page_size", parametros.page_size)
  const pagina = leerPaginacion(consulta)
  const lista = await listarDelEquipo(usuario, pagina.page, pagina.page_size)
  return (
    <main id="contenido">
      <h1>Historial del equipo</h1>
      {lista.items.length === 0 ? <p>Este equipo todavía no tiene conversaciones.</p> : null}
      {lista.items.length > 0 ? (
        <table>
          <caption>Conversaciones de {usuario.equipoNombre ?? "tu equipo"}</caption>
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Interlocutor</th>
              <th scope="col">Quién la condujo</th>
              <th scope="col">Modo</th>
              <th scope="col">Transcripción</th>
            </tr>
          </thead>
          <tbody>
            {lista.items.map((item) => (
              <tr key={item.id}>
                <td>{formatoFecha(new Date(item.iniciada_at))}</td>
                <td>{item.agente_nombre}</td>
                <td>{item.conductor}</td>
                <td>{item.modo}</td>
                <td>
                  <Link href={`/historial/${item.id}`}>Leer</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <nav aria-label="Páginas del historial">
        {lista.page > 1 ? <Link href={`/historial?page=${lista.page - 1}`}>Anterior</Link> : null}{" "}
        {lista.total_pages > lista.page ? <Link href={`/historial?page=${lista.page + 1}`}>Siguiente</Link> : null}
      </nav>
    </main>
  )
}
