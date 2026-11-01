import type { Rol } from "@/lib/autorizacion"
import { salir } from "@/acciones/sesion"
import { EnlacesNav } from "@/componentes/enlaces-nav"
import Link from "next/link"

function etiquetaEquipo(nombre: string | null): string {
  if (!nombre) return "Sin equipo"
  return /^equipo\b/i.test(nombre) ? nombre : `Equipo ${nombre}`
}

export function Navegacion({ rol, equipo }: { rol: Rol; equipo: string | null }): React.ReactElement {
  return (
    <header className="bg-navy text-cream">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
        <Link href="/interlocutores" className="mr-1 font-bold no-underline">
          Faro AI
        </Link>
        <EnlacesNav rol={rol} />
        <p className="chip chip-fijo m-0 ml-auto">{etiquetaEquipo(equipo)}</p>
        <form action={salir}>
          <button type="submit">Salir</button>
        </form>
      </div>
    </header>
  )
}
