import type { Rol } from "@/lib/autorizacion"
import { salir } from "@/acciones/sesion"
import Link from "next/link"

export function Navegacion({ rol, equipo }: { rol: Rol; equipo: string | null }): React.ReactElement {
  return (
    <header className="bg-navy text-cream">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
        <Link href="/interlocutores" className="font-bold no-underline">
          Faro AI
        </Link>
        <nav aria-label="Principal" className="flex flex-wrap gap-4">
          <Link href="/interlocutores">Interlocutores</Link>
          <Link href="/historial">Historial</Link>
          <span>
            Demos
            <span className="sr-only">, disponible en un módulo posterior</span>
          </span>
          {rol === "instructor" ? <Link href="/instructor">Instructor</Link> : null}
        </nav>
        <p className="m-0 ml-auto">{equipo ? `Equipo ${equipo}` : "Sin equipo"}</p>
        <form action={salir}>
          <button type="submit">Salir</button>
        </form>
      </div>
    </header>
  )
}
