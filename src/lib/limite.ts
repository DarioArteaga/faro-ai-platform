const reloj = new Map<string, number[]>()

/** Límite en memoria por clave. Sirve en un solo proceso. */
// ponytail: pasar a un límite compartido si la aplicación corre en más de una instancia
export function permitir(clave: string, limite: number, ventanaMs: number, ahora = Date.now()): boolean {
  const previos = (reloj.get(clave) ?? []).filter((marca) => ahora - marca < ventanaMs)
  if (previos.length >= limite) {
    reloj.set(clave, previos)
    return false
  }
  previos.push(ahora)
  reloj.set(clave, previos)
  return true
}

export function reiniciarLimites(): void {
  reloj.clear()
}
