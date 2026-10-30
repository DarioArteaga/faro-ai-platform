import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { ConversacionCliente } from "@/componentes/conversacion-cliente"
import { puedeVerCaso } from "@/lib/autorizacion"
import { interlocutorPorSlug } from "@/lib/catalogo"
import { obtenerVozHabilitada } from "@/servicios/cohorte"
import { usuarioDeLaSesion } from "@/servicios/sesion"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const usuario = await usuarioDeLaSesion()
  const hallado = interlocutorPorSlug(slug)
  if (!usuario || !hallado || !hallado.caso.activo || !puedeVerCaso(usuario.rol, hallado.caso.audiencia)) {
    return { title: "Conversación", robots: { index: false, follow: false } }
  }
  const titulo =
    hallado.caso.audiencia === "instructor"
      ? `${hallado.interlocutor.nombre} · ${hallado.caso.nombre}`
      : hallado.interlocutor.nombre
  return {
    title: titulo,
    robots: { index: false, follow: false },
  }
}

export default async function Conversacion({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<React.ReactElement> {
  const { slug } = await params
  const usuario = await usuarioDeLaSesion()
  const hallado = interlocutorPorSlug(slug)
  if (!usuario || !hallado || !hallado.caso.activo || !puedeVerCaso(usuario.rol, hallado.caso.audiencia)) {
    notFound()
  }
  const vozHabilitada = await obtenerVozHabilitada()
  const nombre =
    hallado.caso.audiencia === "instructor"
      ? `${hallado.interlocutor.nombre} · ${hallado.caso.nombre}`
      : hallado.interlocutor.nombre
  return (
    <main id="contenido">
      <p>
        <Link href="/interlocutores">Volver a interlocutores</Link>
      </p>
      <p>{hallado.caso.nombre}</p>
      <h1>{hallado.interlocutor.nombre}</h1>
      <p>{hallado.interlocutor.quien}</p>
      <ConversacionCliente slug={hallado.interlocutor.slug} nombre={nombre} vozHabilitada={vozHabilitada} />
    </main>
  )
}
