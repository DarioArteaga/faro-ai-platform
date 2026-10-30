import type { Metadata } from "next"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"

import { Navegacion } from "@/componentes/navegacion"
import { usuarioDeLaSesion } from "@/servicios/sesion"

export const dynamic = "force-dynamic"

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function PlataformaLayout({ children }: { children: ReactNode }): Promise<React.ReactElement> {
  const usuario = await usuarioDeLaSesion()
  if (!usuario) redirect("/login")
  return (
    <>
      <Navegacion rol={usuario.rol} equipo={usuario.equipoNombre} />
      <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
    </>
  )
}
