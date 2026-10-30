import type { Metadata } from "next"
import Link from "next/link"

import { casoActivo } from "@/lib/catalogo"
import { usuarioDeLaSesion } from "@/servicios/sesion"

export const metadata: Metadata = {
  title: "Interlocutores",
  robots: { index: false, follow: false },
}

export default async function Interlocutores(): Promise<React.ReactElement> {
  const usuario = await usuarioDeLaSesion()
  const caso = casoActivo()
  return (
    <main id="contenido">
      <h1>Interlocutores</h1>
      {usuario?.equipoNombre ? (
        <p>Equipo {usuario.equipoNombre}. Elige con quién quieres conversar.</p>
      ) : (
        <p>Tu cuenta no tiene equipo, así que todavía no puedes iniciar una conversación.</p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {caso.interlocutores.map((interlocutor) => (
          <article key={interlocutor.slug} className="tarjeta">
            <h2 className="mt-0">{interlocutor.nombre}</h2>
            <p>{interlocutor.quien}</p>
            <p>Qué le importa: {interlocutor.importa}</p>
            {usuario?.equipoId ? (
              <Link className="boton inline-block no-underline" href={`/conversacion/${interlocutor.slug}`}>
                Conversar
              </Link>
            ) : null}
          </article>
        ))}
      </div>
    </main>
  )
}
