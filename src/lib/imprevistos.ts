import { NINGUNO, SEPARADOR_IMPREVISTOS } from "@/lib/constantes"
import { ErrorHttp } from "@/lib/errores"

/** Claves activas que sí están en el catálogo, en el orden del archivo. */
export function clavesEnviables(activas: readonly string[], ordenCatalogo: readonly string[]): string[] {
  const pedidas = new Set(activas)
  return ordenCatalogo.filter((clave) => pedidas.has(clave))
}

/** Solo las claves activas del caso que se está conversando. */
export function clavesDelCaso(
  activas: readonly string[],
  ordenCatalogo: readonly string[],
  porClave: Record<string, { caso: string }>,
  caso: string,
): string[] {
  const pedidas = new Set(activas)
  return ordenCatalogo.filter((clave) => pedidas.has(clave) && porClave[clave]?.caso === caso)
}

export function textoImprevistos(claves: readonly string[]): string {
  if (claves.length === 0) return NINGUNO
  return claves.join(SEPARADOR_IMPREVISTOS)
}

export function exigirClaveDelModulo(
  clave: string,
  moduloCohorte: string,
  porClave: Record<string, { modulo: string }>,
): void {
  const item = porClave[clave]
  if (!item) {
    throw new ErrorHttp(400, "Esa clave no está en el catálogo.")
  }
  if (item.modulo !== moduloCohorte) {
    throw new ErrorHttp(400, "Esa clave no corresponde al módulo actual.")
  }
}
