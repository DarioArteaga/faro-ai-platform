import { describe, expect, it } from "vitest"

import { controlarVariables, textoControl } from "@/lib/control-variables"
import { fichaDesde, inicioDesde } from "@/lib/elevenlabs"
import type { VariablesConversacion } from "@/lib/variables"

const emitidas: VariablesConversacion = {
  modulo: "M1",
  equipo: "Norte",
  imprevistos_activos: "ninguno",
  resumen_previo: "ninguno",
}

function inicio(dynamicVariables: unknown, override?: unknown, extraBody?: unknown) {
  return { dynamicVariables, override, extraBody }
}

describe("control de variables", () => {
  it("coincide cuando las cuatro cadenas llegan iguales", () => {
    const recibido = inicio({ ...emitidas, system__agent_id: "agent-a" }, { agent: {}, conversation: { text_only: true } })
    expect(controlarVariables(emitidas, "texto", recibido)).toEqual({ control: "coincide", claves: null })
  })

  it("no marca un text_only ausente ni el de la voz en falso", () => {
    expect(controlarVariables(emitidas, "texto", inicio(emitidas)).control).toBe("coincide")
    expect(
      controlarVariables(emitidas, "voz", inicio(emitidas, { conversation: { text_only: false } })).control,
    ).toBe("coincide")
  })

  it("queda pendiente si el mapa todavía no vino", () => {
    expect(controlarVariables(emitidas, "texto", null)).toEqual({ control: "pendiente", claves: null })
    expect(controlarVariables(emitidas, "texto", inicio(undefined)).control).toBe("pendiente")
    expect(controlarVariables(emitidas, "texto", inicio({ system__conversation_id: "conv" })).control).toBe("pendiente")
  })

  it("marca el módulo cambiado y una clave de más, sin copiar el valor", () => {
    const resultado = controlarVariables(
      emitidas,
      "texto",
      inicio({ ...emitidas, modulo: "M4", pista: "el texto secreto del resumen" }),
    )
    expect(resultado.control).toBe("alterada")
    expect(resultado.claves).toBe("modulo, pista")
    expect(resultado.claves).not.toContain("secreto")
  })

  it("marca voz, modelo y prompt por el nombre del campo", () => {
    const resultado = controlarVariables(emitidas, "texto", inicio(emitidas, {
      agent: { prompt: { prompt: "instrucción ajena", llm: "otro-modelo" }, first_message: "hola" },
      tts: { voice_id: "voz-ajena" },
    }, { temperature: 0.2 }))
    expect(resultado.control).toBe("alterada")
    expect(resultado.claves).toBe("custom_llm_extra_body, first_message, llm, prompt, voice_id")
    expect(resultado.claves).not.toContain("instrucción")
    expect(resultado.claves).not.toContain("voz-ajena")
  })

  it("marca text_only cuando contradice el modo", () => {
    expect(
      controlarVariables(emitidas, "voz", inicio(emitidas, { conversation: { text_only: true } })).claves,
    ).toBe("text_only")
    expect(
      controlarVariables(emitidas, "texto", inicio(emitidas, { conversation: { text_only: false } })).claves,
    ).toBe("text_only")
  })

  it("un override alcanza para marcar aunque las variables todavía no estén", () => {
    const resultado = controlarVariables(emitidas, "texto", inicio(null, { tts: { voice_id: "otra" } }))
    expect(resultado).toEqual({ control: "alterada", claves: "voice_id" })
  })

  it("ignora un cuerpo extra vacío y recorta la lista a 200 caracteres", () => {
    expect(controlarVariables(emitidas, "texto", inicio(emitidas, undefined, {})).control).toBe("coincide")
    const largas = Object.fromEntries(Array.from({ length: 30 }, (_, indice) => [`clave_extra_${indice}_`.padEnd(20, "x"), "1"]))
    const resultado = controlarVariables(emitidas, "texto", inicio({ ...emitidas, ...largas }))
    expect(resultado.control).toBe("alterada")
    expect(resultado.claves?.length).toBeLessThanOrEqual(200)
  })

  it("traduce el estado para el panel y deja en blanco lo anterior", () => {
    expect(textoControl("anterior")).toBe("")
    expect(textoControl("pendiente")).toBe("Sin comprobar")
    expect(textoControl("coincide")).toBe("En orden")
    expect(textoControl("alterada", "modulo")).toBe("Alterada: modulo")
  })
})

describe("inicio de la ficha", () => {
  it("lee las variables sin perder la transcripción ni el dueño", () => {
    const json = {
      user_id: "u1",
      agent_id: "agent-a",
      transcript: [{ role: "user", message: "hola" }],
      conversation_initiation_client_data: {
        user_id: "u1",
        dynamic_variables: { modulo: "M4" },
        conversation_config_override: { tts: { voice_id: "otra" } },
      },
    }
    const ficha = fichaDesde(json)
    expect(ficha.dueno).toEqual({ userId: "u1", agentId: "agent-a" })
    expect(ficha.mensajes).toEqual([{ rol: "estudiante", texto: "hola" }])
    expect(ficha.inicio?.dynamicVariables).toEqual({ modulo: "M4" })
    expect(inicioDesde(json)?.override).toEqual({ tts: { voice_id: "otra" } })
  })

  it("no inventa un inicio si el bloque todavía no está", () => {
    expect(fichaDesde({ user_id: "u1", agent_id: "agent-a" }).inicio).toBeNull()
    expect(inicioDesde({ conversation_initiation_client_data: { user_id: "u1" } })?.dynamicVariables).toBeUndefined()
  })
})
