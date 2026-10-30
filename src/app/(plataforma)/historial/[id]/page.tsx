import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { formatoFecha } from "@/lib/fecha"
import { ErrorHttp } from "@/lib/errores"
import { leerTranscripcion, type Transcripcion } from "@/servicios/conversaciones"
import { exigirUsuario } from "@/servicios/sesion"

export const metadata: Metadata = {
  title: "Transcripción",
  robots: { index: false, follow: false },
}

export default async function PaginaTranscripcion({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<React.ReactElement> {
  const usuario = await exigirUsuario()
  const { id } = await params
  let datos: Transcripcion
  try {
    datos = await leerTranscripcion(usuario, id)
  } catch (error) {
    if (error instanceof ErrorHttp && (error.status === 404 || error.status === 400)) notFound()
    throw error
  }
  return (
    <main id="contenido">
      <p>
        <Link href="/historial">Volver al historial</Link>
      </p>
      <h1>{datos.agente_nombre}</h1>
      <p>
        {formatoFecha(new Date(datos.iniciada_at))}. La condujo {datos.conductor}. Equipo {datos.equipo}. Modo {datos.modo}. Módulo {datos.modulo}.
      </p>
      {datos.mensajes.length === 0 ? <p>Esta conversación no tiene mensajes todavía.</p> : null}
      <ol>
        {datos.mensajes.map((mensaje, indice) => (
          <li key={`${indice}-${mensaje.rol}`}>
            <strong>{mensaje.rol === "estudiante" ? datos.conductor : datos.agente_nombre}: </strong>
            {mensaje.texto}
          </li>
        ))}
      </ol>
    </main>
  )
}
