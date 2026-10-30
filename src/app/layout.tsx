import type { Metadata } from "next"
import type { ReactNode } from "react"

import "./globals.css"

export const metadata: Metadata = {
  // ponytail: metadataBase con el dominio público cuando exista
  metadataBase: new URL("http://localhost:3000"),
  title: { default: "Faro AI", template: "%s · Faro AI" },
  description: "Plataforma de Faro AI para conversar con los interlocutores del curso.",
  icons: { icon: "/favicon.ico" },
}

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="es">
      <body>
        <a className="sr-only" href="#contenido">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  )
}
