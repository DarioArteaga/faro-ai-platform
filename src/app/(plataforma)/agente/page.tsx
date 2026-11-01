import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { FormularioAgente } from "@/componentes/formulario-agente"
import { ErrorHttp } from "@/lib/errores"
import { formatoFecha } from "@/lib/fecha"
import { leerPaginacion } from "@/lib/paginacion"
import { vistaDelEquipo } from "@/servicios/agentes"
import { usuarioDeLaSesion } from "@/servicios/sesion"

export const metadata: Metadata = {
  title: "Mi agente",
  robots: { index: false, follow: false },
}

export default async function Agente({
  searchParams,
}: {
  searchParams: Promise<{ versiones_page?: string; equipo?: string }>
}): Promise<React.ReactElement> {
  const usuario = await usuarioDeLaSesion()
  if (!usuario) redirect("/login")
  const parametros = await searchParams
  const consulta = new URLSearchParams()
  if (parametros.versiones_page) consulta.set("page", parametros.versiones_page)
  const pagina = leerPaginacion(consulta)
  const equipo = parametros.equipo ?? null
  const soloLectura = Boolean(equipo && equipo !== usuario.equipoSlug)
  let vista
  try {
    vista = await vistaDelEquipo(usuario, pagina.page, pagina.page_size, soloLectura ? equipo : null)
  } catch (error) {
    if (error instanceof ErrorHttp && error.status === 404) notFound()
    throw error
  }
  const consultaEquipo = soloLectura && equipo ? `&equipo=${equipo}` : ""
  return (
    <main id="contenido">
      <h1>Mi agente</h1>
      {!usuario.equipoId && !soloLectura ? (
        <p>
          {usuario.rol === "instructor"
            ? "Tu cuenta no tiene equipo. Los agentes de los equipos se ven en el panel del instructor."
            : "Tu cuenta no tiene equipo, así que todavía no puedes crear un agente."}
        </p>
      ) : (
        <>
          {soloLectura && !vista.agente ? (
            <p>Este equipo todavía no tiene agente.</p>
          ) : (
            <FormularioAgente
              key={vista.agente?.actualizado_at ?? "nuevo"}
              vista={vista}
              soloLectura={soloLectura}
              equipoSlug={soloLectura ? equipo : null}
            />
          )}
          {vista.agente && !soloLectura ? (
            <p>
              <a className="boton inline-block no-underline" href="/api/v1/agentes/simulaciones">
                Descargar JSON
              </a>
            </p>
          ) : null}
          {vista.agente && vista.simulaciones.length > 0 ? (
            <section>
              <h2>Simulaciones</h2>
              <table>
                <caption>Simulaciones de este agente</caption>
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Versión</th>
                    <th scope="col">Resultado</th>
                    <th scope="col">Razón</th>
                  </tr>
                </thead>
                <tbody>
                  {vista.simulaciones.map((fila) => (
                    <tr key={fila.id}>
                      <td>{formatoFecha(new Date(fila.creada_at))}</td>
                      <td>{fila.version}</td>
                      <td>{fila.resultado === "paso" ? "Pasó" : fila.resultado === "no_paso" ? "No pasó" : "Error"}</td>
                      <td>{fila.razon}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
          <nav aria-label="Páginas de versiones">
            {vista.meta_versiones.page > 1 ? (
              <Link href={`/agente?versiones_page=${vista.meta_versiones.page - 1}${consultaEquipo}`}>Anterior</Link>
            ) : null}{" "}
            {vista.meta_versiones.total_pages > vista.meta_versiones.page ? (
              <Link href={`/agente?versiones_page=${vista.meta_versiones.page + 1}${consultaEquipo}`}>Siguiente</Link>
            ) : null}
          </nav>
        </>
      )}
    </main>
  )
}
