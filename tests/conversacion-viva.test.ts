import { describe, expect, it } from "vitest"

import { anexarLinea, pausaSiguiente, type LineaVisible } from "@/lib/conversacion-viva"

const previa: LineaVisible[] = [{ rol: "Cliente Negocio", texto: "Hola." }]

describe("líneas de la conversación en vivo", () => {
  it("agrega el mensaje del estudiante", () => {
    expect(anexarLinea(previa, { rol: "Tú", texto: "  Hola, prueba corta.  " })).toEqual([
      ...previa,
      { rol: "Tú", texto: "Hola, prueba corta." },
    ])
  })

  it("no agrega texto vacío ni repite la última línea igual", () => {
    expect(anexarLinea(previa, { rol: "Tú", texto: "   " })).toBe(previa)
    const conUsuario = anexarLinea(previa, { rol: "Tú", texto: "Gracias." })
    expect(anexarLinea(conUsuario, { rol: "Tú", texto: "Gracias." })).toBe(conUsuario)
    expect(anexarLinea(conUsuario, { rol: "Cliente Negocio", texto: "Gracias." })).toHaveLength(3)
  })
})

describe("reintento del resumen", () => {
  it("espera 5, 7 y 13 segundos y se detiene si ya quedó guardado", () => {
    expect(pausaSiguiente(0, false)).toBe(5_000)
    expect(pausaSiguiente(1, false)).toBe(7_000)
    expect(pausaSiguiente(2, false)).toBe(13_000)
    expect(pausaSiguiente(3, false)).toBeNull()
    expect(pausaSiguiente(0, true)).toBeNull()
    expect(pausaSiguiente(1, true)).toBeNull()
  })
})
