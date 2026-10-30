import { describe, expect, it } from "vitest"

import { casoActivo, casosVisibles, interlocutorPorSlug } from "@/lib/catalogo"
import { NOMBRE_EQUIPO_DEMO } from "@/lib/constantes"

const IDS_PAMPA = [
  ["sp_cliente_negocio", "agent_2601m66rfk9gea7vy4mc61krrf35"],
  ["sp_cliente_it", "agent_9701m66rk40yfbn9prbkx0vsjr5d"],
  ["sp_account_executive", "agent_5201m66rk5x2ehjs4tnwkjcgrhy3"],
  ["sp_producto_gtm", "agent_4401m66rk7nse59vctrn8b2999ry"],
] as const

describe("casos", () => {
  it("deja Seguros Pampa fuera de la vista del estudiante y del plan B", () => {
    expect(casosVisibles("estudiante").map((caso) => caso.slug)).toEqual(["energia-del-litoral"])
    expect(casosVisibles("instructor").map((caso) => caso.slug)).toEqual(["energia-del-litoral", "seguros-pampa"])
    expect(casoActivo().slug).toBe("energia-del-litoral")
    expect(casoActivo().audiencia).toBe("curso")
  })

  it("publica los cuatro agentes de Seguros Pampa solo para el instructor", () => {
    const pampa = casosVisibles("instructor").find((caso) => caso.slug === "seguros-pampa")
    expect(pampa?.audiencia).toBe("instructor")
    expect(pampa?.caso).toBe("seguros_pampa")
    expect(pampa?.interlocutores.map((item) => [item.slug, item.agent_id])).toEqual([...IDS_PAMPA])
    expect(pampa?.interlocutores[0]?.quien).toContain("Martín Quiroga")
    expect(pampa?.interlocutores[0]?.quien).toContain("Paula Herrera")
    expect(pampa?.interlocutores[0]?.quien).toContain("Gerencia de Finanzas")
    const hallado = interlocutorPorSlug("sp_cliente_negocio")
    expect(hallado?.caso.audiencia).toBe("instructor")
    expect(interlocutorPorSlug("cliente_negocio")?.caso.audiencia).toBe("curso")
  })

  it("nombra la demo del instructor cuando no hay equipo", () => {
    expect(NOMBRE_EQUIPO_DEMO).toBe("Demo del instructor")
  })
})