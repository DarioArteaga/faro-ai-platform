import { EQUIPO_SIN_NOMBRE, MODULO_DEFAULT, NINGUNO } from "@/lib/constantes"
import { textoImprevistos } from "@/lib/imprevistos"

export type VariablesConversacion = {
  modulo: string
  equipo: string
  imprevistos_activos: string
  resumen_previo: string
}

export function armarVariables(entrada: {
  modulo: string | null | undefined
  equipo: string | null | undefined
  claves: readonly string[]
  resumen: string | null | undefined
}): VariablesConversacion {
  const modulo = entrada.modulo?.trim() || MODULO_DEFAULT
  const equipo = entrada.equipo?.trim() || EQUIPO_SIN_NOMBRE
  const resumen = entrada.resumen?.trim() || NINGUNO
  return {
    modulo,
    equipo,
    imprevistos_activos: textoImprevistos(entrada.claves),
    resumen_previo: resumen,
  }
}
