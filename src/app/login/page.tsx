import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { signIn } from "@/auth"
import { usuarioDeLaSesion } from "@/servicios/sesion"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acceso de estudiantes e instructores a Faro AI con cuenta de Google.",
  // ponytail: alternates.canonical cuando exista el dominio público
  openGraph: {
    title: "Entrar a Faro AI",
    description: "Acceso de estudiantes e instructores a Faro AI con cuenta de Google.",
    images: ["/logo.svg"],
    locale: "es_MX",
    type: "website",
  },
}

const mensajes: Record<string, string> = {
  AccessDenied: "Esa cuenta no está en la lista del curso.",
  Configuration: "Falta configuración de acceso en el servidor.",
  OAuthSignin: "Google no pudo completar el ingreso.",
  OAuthCallback: "Google no pudo completar el ingreso.",
  Default: "No se pudo entrar. Intenta de nuevo.",
}

const requeridas = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "AUTH_SECRET", "DATABASE_URL"]

async function entrar(): Promise<void> {
  "use server"
  await signIn("google", { redirectTo: "/interlocutores" })
}

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}): Promise<React.ReactElement> {
  const usuario = await usuarioDeLaSesion().catch(() => null)
  if (usuario) redirect("/interlocutores")
  const parametros = await searchParams
  const faltan = requeridas.filter((nombre) => !process.env[nombre])
  const aviso = parametros.error ? (mensajes[parametros.error] ?? mensajes.Default) : null
  const datos = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Faro AI",
    description: "Empresa ficticia. Plataforma para conversar con los interlocutores del curso.",
  }
  return (
    <main id="contenido" className="mx-auto flex min-h-screen max-w-lg flex-col justify-center p-6">
      <section className="acceso w-full bg-navy p-8 text-cream">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="" width={40} height={40} />
          <h1 className="m-0">Faro AI</h1>
        </div>
        <p>Entra con la cuenta de Google del curso. Si tu correo no está en la lista, el instructor tiene que agregarte.</p>
        {aviso ? <p className="aviso text-ink">{aviso}</p> : null}
        {faltan.length > 0 ? (
          <>
            <p>Falta configurar:</p>
            <ul>
              {faltan.map((nombre) => (
                <li key={nombre}>
                  <code>{nombre}</code>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <form action={entrar}>
            <button type="submit">Entrar con Google</button>
          </form>
        )}
        <p className="text-sm">Faro AI es una empresa ficticia.</p>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datos) }} />
    </main>
  )
}
