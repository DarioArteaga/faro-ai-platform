import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { ConversacionCliente } from "@/componentes/conversacion-cliente"
import { interlocutorPorSlug } from "@/lib/catalogo"
import { obtenerVozHabilitada } from "@/servicios/cohorte"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const interlocutor = interlocutorPorSlug(slug)
  return {
    title: interlocutor?.nombre ?? "Conversación",
    robots: { index: false, follow: false },
  }
}

export default async function Conversacion({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<React.ReactElement> {
  const { slug } = await params
  const interlocutor = interlocutorPorSlug(slug)
  if (!interlocutor) notFound()
  const vozHabilitada = await obtenerVozHabilitada()
  return (
    <main id="contenido">
      <p>
        <Link href="/interlocutores">Volver a interlocutores</Link>
      </p>
      <h1>{interlocutor.nombre}</h1>
      <p>{interlocutor.quien}</p>
      <ConversacionCliente slug={interlocutor.slug} nombre={interlocutor.nombre} vozHabilitada={vozHabilitada} />
    </main>
  )
}
