import { describe, expect, it } from "vitest"

import { armarVariables } from "@/lib/variables"

describe("variables de conversación", () => {
  it("siempre manda las cuatro, con default si falta el dato", () => {
    expect(
      armarVariables({ modulo: "M2", equipo: "Norte", claves: ["m1_facturacion"], resumen: "Hicieron tres preguntas." }),
    ).toEqual({
      modulo: "M2",
      equipo: "Norte",
      imprevistos_activos: "m1_facturacion",
      resumen_previo: "Hicieron tres preguntas.",
    })
    expect(armarVariables({ modulo: " ", equipo: "", claves: [], resumen: "  " })).toEqual({
      modulo: "M1",
      equipo: "sin nombre",
      imprevistos_activos: "ninguno",
      resumen_previo: "ninguno",
    })
  })
})
