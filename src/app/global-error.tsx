"use client"

export default function ErrorGlobal({ reset }: { error: Error; reset: () => void }): React.ReactElement {
  return (
    <html lang="es">
      <body>
        <main id="contenido">
          <h1>Algo salió mal</h1>
          <p>No pudimos abrir Faro AI. Vuelve a intentar.</p>
          <button type="button" onClick={() => reset()}>
            Reintentar
          </button>
        </main>
      </body>
    </html>
  )
}
