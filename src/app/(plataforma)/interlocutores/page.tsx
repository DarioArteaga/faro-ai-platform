import type { Metadata } from "next"
import Link from "next/link"

import { casosVisibles } from "@/lib/catalogo"
import { usuarioDeLaSesion } from "@/servicios/sesion"

export const metadata: Metadata = {
  title: "Interlocutores",
  robots: { index: false, follow: false },
}

export default async function Interlocutores(): Promise<React.ReactElement> {
  const usuario = await usuarioDeLaSesion()
  const casos = casosVisibles(usuario?.rol ?? "estudiante")
  return (
    <main id="contenido">
      <h1>Interlocutores</h1>
      <p>
        {usuario?.equipoNombre
          ? `Equipo ${usuario.equipoNombre}. Elige con quién quieres conversar.`
          : usuario?.rol === "instructor"
            ? "Tu cuenta no tiene equipo. Energía del Litoral espera uno. Seguros Pampa se abre como Demo del instructor."
            : "Tu cuenta no tiene equipo, así que todavía no puedes iniciar una conversación."}
      </p>
      {casos.map((caso) => (
        <section key={caso.slug}>
          <h2>{caso.nombre}</h2>
          {caso.audiencia === "instructor" ? (
            <p>Estas conversaciones quedan en Demo del instructor y no entran al historial de los equipos.</p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            {caso.interlocutores.map((interlocutor) => {
              const conEquipo = Boolean(usuario?.equipoId)
              const demoInstructor = usuario?.rol === "instructor" && caso.audiencia === "instructor"
              return (
                <article key={interlocutor.slug} className="tarjeta">
                  <h3 className="mt-0">{interlocutor.nombre}</h3>
                  <p>{interlocutor.quien}</p>
                  <p>Qué le importa: {interlocutor.importa}</p>
                  {conEquipo || demoInstructor ? (
                    <Link className="boton inline-block no-underline" href={`/conversacion/${interlocutor.slug}`}>
                      Conversar
                    </Link>
                  ) : null}
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </main>
  )
}
