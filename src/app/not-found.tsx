import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = { title: "Página no encontrada" }

export default function NoEncontrada(): React.ReactElement {
  return (
    <main id="contenido" className="mx-auto max-w-xl p-6">
      <h1>No encontramos esa página</h1>
      <p>
        <Link href="/interlocutores">Volver al inicio</Link>
      </p>
    </main>
  )
}
