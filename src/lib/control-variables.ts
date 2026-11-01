import type { VariablesConversacion } from "@/lib/variables"

export type ControlVariables = "pendiente" | "coincide" | "alterada"

export type InicioRecibido = {
  dynamicVariables: unknown
  override: unknown
  extraBody: unknown
}

export type ResultadoControl = {
  control: ControlVariables
  claves: string | null
}

const ESPERADAS = ["equipo", "imprevistos_activos", "modulo", "resumen_previo"] as const
const TOPE_CLAVES = 200

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
}

function hoja(ruta: string): string {
  const partes = ruta.split(".")
  return partes[partes.length - 1] ?? ruta
}

/** Un text_only ausente no se marca. Uno presente tiene que coincidir con el modo. */
function textOnlyLegitimo(modo: "texto" | "voz", valor: unknown): boolean {
  if (modo === "texto") return valor === true
  return valor === false
}

function recorrerOverride(nodo: unknown, ruta: string, modo: "texto" | "voz", claves: string[]): void {
  if (nodo == null) return
  if (Array.isArray(nodo)) {
    if (nodo.length > 0) claves.push(ruta ? hoja(ruta) : "conversation_config_override")
    return
  }
  if (!esRegistro(nodo)) {
    if (!ruta) {
      claves.push("conversation_config_override")
      return
    }
    if (ruta === "conversation.text_only") {
      if (!textOnlyLegitimo(modo, nodo)) claves.push("text_only")
      return
    }
    claves.push(hoja(ruta))
    return
  }
  const entradas = Object.entries(nodo).filter(([, valor]) => valor != null)
  if (entradas.length === 0) return
  for (const [clave, valor] of entradas) {
    recorrerOverride(valor, ruta ? `${ruta}.${clave}` : clave, modo, claves)
  }
}

function tieneCuerpo(valor: unknown): boolean {
  if (valor == null) return false
  if (Array.isArray(valor)) return valor.length > 0
  if (esRegistro(valor)) return Object.values(valor).some((item) => item != null)
  return true
}

function clavesOverride(inicio: InicioRecibido, modo: "texto" | "voz"): string[] {
  const claves: string[] = []
  if (tieneCuerpo(inicio.extraBody)) claves.push("custom_llm_extra_body")
  recorrerOverride(inicio.override, "", modo, claves)
  return claves
}

function clavesVariables(
  emitidas: VariablesConversacion,
  recibidas: unknown,
): { pendiente: boolean; claves: string[] } {
  if (recibidas == null) return { pendiente: true, claves: [] }
  if (!esRegistro(recibidas)) return { pendiente: false, claves: ["dynamic_variables"] }
  const propias = Object.keys(recibidas).filter((clave) => !clave.startsWith("system__"))
  if (propias.length === 0) return { pendiente: true, claves: [] }
  const claves: string[] = []
  for (const clave of ESPERADAS) {
    if (recibidas[clave] !== emitidas[clave]) claves.push(clave)
  }
  for (const clave of propias) {
    if (!(ESPERADAS as readonly string[]).includes(clave)) claves.push(clave)
  }
  return { pendiente: false, claves }
}

function lista(claves: string[]): string | null {
  const unicas = [...new Set(claves)].sort()
  if (unicas.length === 0) return null
  const texto = unicas.join(", ")
  if (texto.length <= TOPE_CLAVES) return texto
  const cortado = texto.slice(0, TOPE_CLAVES)
  const coma = cortado.lastIndexOf(",")
  return (coma > 0 ? cortado.slice(0, coma) : cortado).trim()
}

/** Compara lo emitido con el inicio que guardó ElevenLabs. No incluye los valores recibidos. */
export function controlarVariables(
  emitidas: VariablesConversacion,
  modo: "texto" | "voz",
  inicio: InicioRecibido | null,
): ResultadoControl {
  if (!inicio) return { control: "pendiente", claves: null }
  const deOverride = clavesOverride(inicio, modo)
  const deVariables = clavesVariables(emitidas, inicio.dynamicVariables)
  if (deVariables.pendiente && deOverride.length === 0) return { control: "pendiente", claves: null }
  const claves = lista([...deOverride, ...deVariables.claves])
  if (!claves) return { control: "coincide", claves: null }
  return { control: "alterada", claves }
}

export function textoControl(control: string, claves?: string | null): string {
  if (control === "pendiente") return "Sin comprobar"
  if (control === "coincide") return "En orden"
  if (control === "alterada") return claves ? `Alterada: ${claves}` : "Alterada"
  return ""
}
