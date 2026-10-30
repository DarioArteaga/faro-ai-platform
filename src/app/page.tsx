import { redirect } from "next/navigation"

import { usuarioDeLaSesion } from "@/servicios/sesion"

export const dynamic = "force-dynamic"

export default async function Inicio(): Promise<never> {
  const usuario = await usuarioDeLaSesion()
  redirect(usuario ? "/interlocutores" : "/login")
}
