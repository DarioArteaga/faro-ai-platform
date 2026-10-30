import { describe, expect, it } from "vitest"

import { ErrorHttp } from "@/lib/errores"
import { leerPaginacion, metaPagina } from "@/lib/paginacion"
import { slugificar } from "@/lib/slug"
import { enmascarar } from "@/lib/enmascarar"

describe("paginación y slug", () => {
  it("usa defaults y rechaza un tamaño excesivo", () => {
    expect(leerPaginacion(new URLSearchParams())).toEqual({ page: 1, page_size: 20 })
    expect(leerPaginacion(new URLSearchParams("page=2&page_size=10"))).toEqual({ page: 2, page_size: 10 })
    expect(() => leerPaginacion(new URLSearchParams("page_size=500"))).toThrow(ErrorHttp)
    expect(metaPagina(45, 2, 20)).toEqual({ total: 45, page: 2, page_size: 20, total_pages: 3 })
    expect(metaPagina(0, 1, 20).total_pages).toBe(0)
  })

  it("forma el slug sin acentos", () => {
    expect(slugificar("Equipo Norte")).toBe("equipo-norte")
    expect(slugificar("Energía del Litoral")).toBe("energia-del-litoral")
    expect(() => slugificar("***")).toThrow(ErrorHttp)
  })

  it("enmascara una URI con credenciales", () => {
    expect(enmascarar("fallo en postgresql://faro:faro@localhost:5432/faro")).toBe("fallo en postgresql://***")
  })
})
