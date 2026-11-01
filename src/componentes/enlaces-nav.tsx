"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import type { Rol } from "@/lib/autorizacion"

const destinos = [
  { href: "/interlocutores", texto: "Interlocutores" },
  { href: "/historial", texto: "Historial" },
  { href: "/agente", texto: "Mi agente" },
] as const

function vigente(ruta: string, href: string): boolean {
  return ruta === href || ruta.startsWith(`${href}/`)
}

export function EnlacesNav({ rol }: { rol: Rol }): React.ReactElement {
  const ruta = usePathname()
  const items = rol === "instructor" ? [...destinos, { href: "/instructor", texto: "Instructor" }] : [...destinos]
  return (
    <nav aria-label="Principal" className="flex flex-wrap items-center gap-2">
      {items.map((item) => {
        const activo = vigente(ruta, item.href)
        return (
          <Link key={item.href} href={item.href} className="chip" aria-current={activo ? "page" : undefined}>
            {item.texto}
          </Link>
        )
      })}
    </nav>
  )
}
