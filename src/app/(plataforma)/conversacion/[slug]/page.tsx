import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { ConversacionCliente } from "@/componentes/conversacion-cliente"
import { puedeVerCaso } from "@/lib/autorizacion"
import { casoActivo, interlocutorPorSlug } from "@/lib/catalogo"
import { SLUG_AGENTE_EQUIPO } from "@/lib/constantes"
import { ErrorHttp } from "@/lib/errores"
import { agenteParaSala } from "@/servicios/agentes"
import { obtenerVozHabilitada } from "@/servicios/cohorte"
import { usuarioDeLaSesion } from "@/servicios/sesion"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  if (slug === SLUG_AGENTE_EQUIPO) {
    return { title: "Mi agente", robots: { index: false, follow: false } }
  }
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
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ equipo?: string }>
}): Promise<React.ReactElement> {
  const { slug } = await params
  const usuario = await usuarioDeLaSesion()
  if (slug === SLUG_AGENTE_EQUIPO) {
    if (!usuario) notFound()
    const equipo = (await searchParams).equipo
    const equipoSlug = usuario.rol === "instructor" ? equipo ?? null : null
    let sala: Awaited<ReturnType<typeof agenteParaSala>> | null = null
    let fallo = ""
    try {
      sala = await agenteParaSala(usuario, equipoSlug)
    } catch (error) {
      if (error instanceof ErrorHttp && error.status === 404) notFound()
      fallo = error instanceof ErrorHttp ? error.message : "No se pudo abrir la sala."
    }
    if (!sala) {
      return (
        <main id="contenido">
          <p>
            <Link className="boton inline-block no-underline" href="/agente">
              Volver a mi agente
            </Link>
          </p>
          <h1>Mi agente</h1>
          <p className="aviso">{fallo}</p>
        </main>
      )
    }
    return (
      <main id="contenido">
        <p>
          <Link className="boton inline-block no-underline" href={equipoSlug ? `/agente?equipo=${equipoSlug}` : "/agente"}>
            Volver a mi agente
          </Link>
        </p>
        <p>{casoActivo().nombre}</p>
        <h1>{sala.nombre}</h1>
        <ConversacionCliente
          slug={SLUG_AGENTE_EQUIPO}
          nombre={sala.nombre}
          vozHabilitada={sala.vozHabilitada}
          equipoSlug={equipoSlug ?? undefined}
        />
      </main>
    )
  }
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
