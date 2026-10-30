export const MODULOS = ["M1", "M2", "M3", "M4"] as const
export type Modulo = (typeof MODULOS)[number]

export const PAGE_SIZE_DEFAULT = 20
export const PAGE_SIZE_MAX = 50
export const SEPARADOR_IMPREVISTOS = "; "
export const NINGUNO = "ninguno"
export const EQUIPO_SIN_NOMBRE = "sin nombre"
export const MODULO_DEFAULT = "M1"
export const ID_COHORTE = "principal"

export const AGENTES_IMPREVISTO = [
  "cliente_negocio",
  "cliente_it",
  "account_executive",
  "producto_gtm",
] as const
