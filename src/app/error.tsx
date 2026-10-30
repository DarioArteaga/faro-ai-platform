"use client"

export default function ErrorPagina({ reset }: { error: Error; reset: () => void }): React.ReactElement {
  return (
    <main id="contenido" className="mx-auto max-w-xl p-6">
      <h1>Algo salió mal</h1>
      <p>No pudimos completar la página. Vuelve a intentar.</p>
      <button type="button" onClick={() => reset()}>
        Reintentar
      </button>
    </main>
  )
}
