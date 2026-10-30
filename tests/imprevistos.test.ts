import { describe, expect, it } from "vitest"

import { leerImprevistos } from "@/lib/catalogo"
import { clavesDelCaso, clavesEnviables, exigirClaveDelModulo, textoImprevistos } from "@/lib/imprevistos"
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
      "sp_m1_hogar",
      "sp_m2_campos_crm",
      "sp_m2_fraude",
      "sp_m3_campos_obligatorios",
      "sp_m3_fotos",
      "sp_m4_costo_demora",
    ])
    expect(catalogo.porClave.m1_facturacion?.caso).toBe("energia_del_litoral")
    expect(catalogo.porClave.sp_m1_hogar?.caso).toBe("seguros_pampa")
  })

  it("no mezcla las claves de un caso con las del otro", () => {
    const activas = ["m1_facturacion", "sp_m1_hogar", "no_existe"]
    expect(clavesDelCaso(activas, catalogo.orden, catalogo.porClave, "seguros_pampa")).toEqual(["sp_m1_hogar"])
    expect(clavesDelCaso(activas, catalogo.orden, catalogo.porClave, "energia_del_litoral")).toEqual(["m1_facturacion"])
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
