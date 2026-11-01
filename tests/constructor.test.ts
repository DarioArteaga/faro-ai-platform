import { describe, expect, it } from "vitest"

import { leerCasos } from "@/lib/catalogo"
import {
  bloqueoDeTope,
  entradaDesdeSnapshot,
  leerConstructor,
  nombreEnEleven,
  snapshotDe,
  validarConfiguracion,
  vozUtilizable,
} from "@/lib/constructor"
import { cuerpoDeAgente, cuerpoDeTool } from "@/lib/cuerpo-agente"
import { cifrarSecreto, descifrarSecreto } from "@/lib/cifrado-secreto"
import { enmascararCuerpoTool } from "@/lib/enmascarar"
import { corridaTerminada, exigirAgenteDeEquipo, resultadoDesdeCorrida } from "@/lib/elevenlabs"
import { ErrorHttp } from "@/lib/errores"
import { comprobarUrlPublica, ipPrivada } from "@/lib/url-publica"

function catalogoDePrueba() {
  const catalogo = leerConstructor()
  return {
    ...catalogo,
    voces: catalogo.voces.map((voz, indice) => (indice === 0 ? { ...voz, voice_id: "voz-de-prueba" } : voz)),
  }
}

const entrada = {
  nombre: "Caja",
  prompt: "Responde en español.",
  primer_mensaje: "Hola.",
  voz_slug: "juan-carlos",
  modelo_slug: "gpt-5-4-mini",
  tool: null,
}

describe("constructor", () => {
  it("carga voces de ejemplo y el modelo barato de simulación", () => {
    const catalogo = leerConstructor()
    expect(catalogo.voces.map((voz) => voz.slug)).toEqual(["juan-carlos", "cristina-campos", "martina", "omar"])
    expect(catalogo.voces.every((voz) => vozUtilizable(voz.voice_id))).toBe(true)
    expect(catalogo.modelo_simulacion).toBe("gpt-5.4-mini")
    expect(catalogo.modelos.map((modelo) => modelo.llm)).toEqual([
      "gemini-3.5-flash",
      "gpt-5.4-mini",
      "claude-sonnet-4-6",
    ])
  })

  it("rechaza una voz sin identificador y no llama a un interlocutor", () => {
    const catalogo = leerConstructor()
    const roto = { ...catalogo, voces: catalogo.voces.map((voz) => ({ ...voz, voice_id: "REEMPLAZAR" })) }
    expect(() => validarConfiguracion(roto, entrada)).toThrow(ErrorHttp)
    const ids = leerCasos().flatMap((caso) => caso.interlocutores.map((interlocutor) => interlocutor.agent_id))
    expect(ids).toHaveLength(8)
    expect(() => exigirAgenteDeEquipo(ids[0] ?? "")).toThrow(ErrorHttp)
    const cuerpo = cuerpoDeAgente(catalogoDePrueba(), validarConfiguracion(catalogoDePrueba(), entrada), [])
    const serial = JSON.stringify(cuerpo)
    for (const id of ids) expect(serial.includes(id)).toBe(false)
    expect(serial.includes("voz-de-prueba")).toBe(true)
  })

  it("escribe voz y modelo en el agente y deja apagados los overrides del navegador", () => {
    const catalogo = catalogoDePrueba()
    const config = validarConfiguracion(catalogo, entrada)
    const cuerpo = cuerpoDeAgente(catalogo, config, ["tool-1"])
    expect(cuerpo.name).toBe("M2 · Caja")
    expect(nombreEnEleven("M2 · ", "M2 · Caja")).toBe("M2 · Caja")
    const conversacion = cuerpo.conversation_config as {
      agent: { prompt: { prompt: string; llm: string; tool_ids: string[] }; language: string }
      tts: { voice_id: string; model_id: string }
    }
    expect(conversacion.agent.prompt.prompt).toBe("Responde en español.")
    expect(conversacion.agent.prompt.llm).toBe("gpt-5.4-mini")
    expect(conversacion.agent.prompt.tool_ids).toEqual(["tool-1"])
    expect(conversacion.agent.language).toBe("es")
    expect(conversacion.tts.voice_id).toBe("voz-de-prueba")
    expect(conversacion.tts.model_id).toBe("eleven_v4_turbo")
    const plataforma = cuerpo.platform_settings as {
      auth: { enable_auth: boolean }
      overrides: {
        conversation_config_override: {
          tts: { voice_id: boolean }
          conversation: { text_only: boolean }
          agent: { prompt: { prompt: boolean; llm: boolean } }
        }
      }
    }
    expect(plataforma.auth.enable_auth).toBe(true)
    expect(plataforma.overrides.conversation_config_override.tts.voice_id).toBe(false)
    expect(plataforma.overrides.conversation_config_override.agent.prompt).toEqual({ prompt: false, llm: false })
    expect(plataforma.overrides.conversation_config_override.conversation.text_only).toBe(true)
  })

  it("guarda la tool sin el valor del secreto", () => {
    const catalogo = catalogoDePrueba()
    const config = validarConfiguracion(catalogo, {
      ...entrada,
      tool: {
        url: "https://equipo.ejemplo.com/consulta",
        metodo: "POST",
        descripcion: "Consulta un saldo",
        parametros: [{ nombre: "cuenta", tipo: "string", descripcion: "Cuenta", ejemplo: "1" }],
        secreto: "secreto-de-prueba",
      },
    })
    const foto = snapshotDe(config, true)
    expect(JSON.stringify(foto).includes("secreto-de-prueba")).toBe(false)
    expect(foto.tool?.tiene_secreto).toBe(true)
    const tool = cuerpoDeTool(catalogo, "consultar_equipo", config, "sec_1")
    const serial = JSON.stringify(tool)
    expect(serial.includes("secreto-de-prueba")).toBe(false)
    expect(serial.includes("sec_1")).toBe(true)
    const get = cuerpoDeTool(catalogo, "consultar_equipo", { ...config, tool: { ...config.tool!, metodo: "GET" } }, "sec_1")
    const consulta = (get.tool_config as { api_schema: { query_params_schema?: { type?: string } } }).api_schema
    expect(consulta.query_params_schema?.type).toBeUndefined()
    expect(entradaDesdeSnapshot(catalogo, foto).tool?.secreto).toBeUndefined()
  })

  it("traduce el resultado de una simulación y aplica los topes", () => {
    const paso = resultadoDesdeCorrida({
      test_runs: [
        {
          status: "passed",
          credits_used: 12,
          condition_result: { result: "success", rationale: { summary: "Cumplió.", messages: ["Bien"] } },
          agent_responses: [
            { role: "user", message: "Hola" },
            { role: "agent", message: "Buenas" },
          ],
        },
      ],
    })
    expect(paso.resultado).toBe("paso")
    expect(paso.razon).toContain("Cumplió.")
    expect(paso.transcripcion).toContain("Agente: Buenas")
    expect(resultadoDesdeCorrida({ test_runs: [{ status: "failed" }] }).resultado).toBe("no_paso")
    const pendiente = resultadoDesdeCorrida({ test_runs: [{ status: "pending" }] })
    expect(pendiente.resultado).toBe("error")
    expect(pendiente.razon).toContain("no terminó")
    const conTool = resultadoDesdeCorrida({
      test_runs: [
        {
          status: "passed",
          agent_responses: [
            {
              role: "agent",
              message: null,
              tool_calls: [{ tool_name: "consultar", params_as_json: "{\"direccion\":\"centro\"}" }],
              tool_results: [
                {
                  tool_name: "consultar",
                  is_error: false,
                  result_value: "{\"headers\":{\"X-Faro-Tool-Secret\":\"no-mostrar\"}}",
                },
              ],
            },
          ],
        },
      ],
    })
    expect(conTool.transcripcion).toContain("Tool consultar: pidió")
    expect(conTool.transcripcion).toContain("respondió")
    expect(conTool.transcripcion.includes("no-mostrar")).toBe(false)
    const topes = { conversacionesTexto: 1, simulaciones: 1, minutosVoz: 1 }
    expect(bloqueoDeTope("texto", { texto: 1, simulaciones: 0, segundosVoz: 0 }, topes)).toContain("texto")
    expect(bloqueoDeTope("simulacion", { texto: 0, simulaciones: 1, segundosVoz: 0 }, topes)).toContain("simulaciones")
    expect(bloqueoDeTope("voz", { texto: 0, simulaciones: 0, segundosVoz: 60 }, topes)).toContain("voz")
    expect(bloqueoDeTope("texto", { texto: 0, simulaciones: 0, segundosVoz: 0 }, topes)).toBeNull()
  })

  it("espera la corrida cuando la primera respuesta sigue pendiente", async () => {
    let reloj = 0
    const final = await corridaTerminada({ id: "inv_prueba", test_runs: [{ status: "pending" }] }, async () => {
      return {
        id: "inv_prueba",
        test_runs: [{ status: "passed", condition_result: { rationale: { summary: "Listo." } } }],
      }
    }, {
      topeMs: 5_000,
      pausaMs: 1_000,
      ahora: () => reloj,
      pausa: async (ms) => {
        reloj += ms
      },
    })
    expect(resultadoDesdeCorrida(final).resultado).toBe("paso")
    expect(resultadoDesdeCorrida(final).razon).toContain("Listo.")
  })

  it("cifra el secreto de la tool y oculta el encabezado", () => {
    const previo = process.env.TOOL_SECRET_KEY
    process.env.TOOL_SECRET_KEY = "clave-de-prueba-larga"
    try {
      const guardado = cifrarSecreto("secreto-de-prueba")
      expect(guardado.includes("secreto-de-prueba")).toBe(false)
      expect(descifrarSecreto(guardado)).toBe("secreto-de-prueba")
      const cuerpo = enmascararCuerpoTool("{\"headers\":{\"X-Faro-Tool-Secret\":\"secreto-de-prueba\"}}")
      expect(cuerpo.includes("secreto-de-prueba")).toBe(false)
    } finally {
      if (previo === undefined) delete process.env.TOOL_SECRET_KEY
      else process.env.TOOL_SECRET_KEY = previo
    }
  })

  it("solo acepta una URL HTTPS pública", async () => {
    expect(ipPrivada("10.0.0.1")).toBe(true)
    expect(ipPrivada("8.8.8.8")).toBe(false)
    await expect(comprobarUrlPublica("http://equipo.ejemplo.com")).rejects.toBeInstanceOf(ErrorHttp)
    await expect(comprobarUrlPublica("https://localhost/consulta")).rejects.toBeInstanceOf(ErrorHttp)
    await expect(comprobarUrlPublica("https://user:clave@equipo.ejemplo.com")).rejects.toBeInstanceOf(ErrorHttp)
    await expect(comprobarUrlPublica("https://192.168.0.8/consulta")).rejects.toBeInstanceOf(ErrorHttp)
    await expect(
      comprobarUrlPublica("https://equipo.ejemplo.com/consulta", async () => ["10.1.1.1"]),
    ).rejects.toBeInstanceOf(ErrorHttp)
    await expect(
      comprobarUrlPublica("https://equipo.ejemplo.com/consulta", async () => ["8.8.8.8", "127.0.0.1"]),
    ).rejects.toBeInstanceOf(ErrorHttp)
    const publica = await comprobarUrlPublica("https://equipo.ejemplo.com/consulta", async () => ["8.8.8.8"])
    expect(publica.protocol).toBe("https:")
  })
})
