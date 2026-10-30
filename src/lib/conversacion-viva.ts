export type LineaVisible = { rol: string; texto: string }

/** Milisegundos desde el corte. La pausa entre intentos es la diferencia. */
export const ESPERAS_RESUMEN_MS = [0, 5_000, 12_000, 25_000] as const

/** Conserva el arreglo si no hay nada nuevo. No repite la última línea idéntica. */
export function anexarLinea(previas: LineaVisible[], linea: LineaVisible): LineaVisible[] {
  const texto = linea.texto.trim()
  if (!texto) return previas
  const ultima = previas[previas.length - 1]
  if (ultima && ultima.rol === linea.rol && ultima.texto === texto) return previas
  return [...previas, { rol: linea.rol, texto }]
}

/** null: no hay otro intento. El número es cuánto esperar hasta el siguiente. */
export function pausaSiguiente(indice: number, guardado: boolean): number | null {
  if (guardado) return null
  const actual = ESPERAS_RESUMEN_MS[indice]
  const siguiente = ESPERAS_RESUMEN_MS[indice + 1]
  if (actual === undefined || siguiente === undefined) return null
  return siguiente - actual
}
