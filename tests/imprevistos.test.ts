import { describe, expect, it } from "vitest"

import { leerImprevistos } from "@/lib/catalogo"
import { clavesEnviables, exigirClaveDelModulo, textoImprevistos } from "@/lib/imprevistos"
import { ErrorHttp } from "@/lib/errores"

describe("imprevistos", () => {
  const catalogo = leerImprevistos()

  it("exige las claves del kit, en el orden del archivo", () => {
    expect(catalogo.orden).toEqual([
      "m1_facturacion",
      "m2_consulta_por_direccion",
      "m2_demo_interna",
      "m2_comunicacion_institucional",
      "m3_limite_tormenta",
      "m3_auditoria",
      "m4_ahorro",
    ])
  })

  it("arma el texto con separador o ninguno", () => {
    expect(textoImprevistos([])).toBe("ninguno")
    expect(textoImprevistos(["m1_facturacion"])).toBe("m1_facturacion")
    const activas = clavesEnviables(["m4_ahorro", "m1_facturacion", "no_existe"], catalogo.orden)
    expect(textoImprevistos(activas)).toBe("m1_facturacion; m4_ahorro")
  })

  it("rechaza activar una clave de otro módulo o desconocida", () => {
    expect(() => exigirClaveDelModulo("m1_facturacion", "M1", catalogo.porClave)).not.toThrow()
    expect(() => exigirClaveDelModulo("m2_demo_interna", "M1", catalogo.porClave)).toThrow(ErrorHttp)
    expect(() => exigirClaveDelModulo("inventada", "M1", catalogo.porClave)).toThrow(ErrorHttp)
  })
})
