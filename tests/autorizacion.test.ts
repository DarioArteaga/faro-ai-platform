import { describe, expect, it } from "vitest"

import {
  destinoDeConversacion,
  duenoCoincide,
  puedeIniciarConversacion,
  puedePedirTokenDeVoz,
  puedeVerCaso,
  puedeVerConversacion,
  type SesionUsuario,
} from "@/lib/autorizacion"
import { NOMBRE_EQUIPO_DEMO } from "@/lib/constantes"
import { duenoDesdePayload, fichaDesde } from "@/lib/elevenlabs"

const estudiante: SesionUsuario = {
  id: "u1",
  email: "ana@ejemplo.test",
  nombre: "Ana",
  rol: "estudiante",
  equipoId: "eq-a",
  equipoSlug: "equipo-a",
  equipoNombre: "Equipo A",
}

describe("autorización", () => {
  it("niega el token de voz a un estudiante mientras el interruptor está apagado", () => {
    expect(puedePedirTokenDeVoz("estudiante", false)).toBe(false)
    expect(puedePedirTokenDeVoz("estudiante", true)).toBe(true)
    expect(puedePedirTokenDeVoz("instructor", false)).toBe(true)
    expect(puedePedirTokenDeVoz("instructor", true)).toBe(true)
  })
  it("niega la credencial sin sesión y sin equipo", () => {
    expect(puedeIniciarConversacion(null, "curso")).toBe(401)
    expect(puedeIniciarConversacion({ ...estudiante, equipoId: null, equipoNombre: null }, "curso")).toBe(403)
    expect(puedeIniciarConversacion(estudiante, "curso")).toBeNull()
  })

  it("guarda Seguros Pampa en la demo aunque el instructor tenga equipo", () => {
    const instructor = { ...estudiante, rol: "instructor" as const }
    const destino = destinoDeConversacion(instructor, "instructor")
    expect(destino).toEqual({ tipo: "demo", equipoNombre: NOMBRE_EQUIPO_DEMO })
    expect(destino).not.toMatchObject({ equipoId: instructor.equipoId })
    expect(destinoDeConversacion({ ...instructor, equipoId: null, equipoNombre: null }, "instructor")).toEqual({
      tipo: "demo",
      equipoNombre: NOMBRE_EQUIPO_DEMO,
    })
    expect(destinoDeConversacion(instructor, "curso")).toEqual({
      tipo: "propio",
      equipoId: instructor.equipoId,
      equipoNombre: instructor.equipoNombre,
    })
  })

  it("reserva Seguros Pampa al instructor, aunque no tenga equipo", () => {
    const instructor = { ...estudiante, rol: "instructor" as const, equipoId: null, equipoNombre: null }
    expect(puedeVerCaso("estudiante", "instructor")).toBe(false)
    expect(puedeVerCaso("instructor", "instructor")).toBe(true)
    expect(puedeVerCaso("estudiante", "curso")).toBe(true)
    expect(puedeIniciarConversacion(estudiante, "instructor")).toBe(403)
    expect(puedeIniciarConversacion(instructor, "instructor")).toBeNull()
    expect(puedeIniciarConversacion(instructor, "curso")).toBe(403)
  })

  it("no revela una conversación de otro equipo", () => {
    expect(puedeVerConversacion(null, { equipoId: "eq-a" })).toBe(false)
    expect(puedeVerConversacion(estudiante, null)).toBe(false)
    expect(puedeVerConversacion(estudiante, { equipoId: "eq-b" })).toBe(false)
    expect(puedeVerConversacion(estudiante, { equipoId: "eq-a" })).toBe(true)
    expect(
      puedeVerConversacion({ ...estudiante, rol: "instructor", equipoId: null, equipoNombre: null }, { equipoId: "eq-b" }),
    ).toBe(true)
  })

  it("solo acepta la conversación si el usuario y el agente coinciden", () => {
    expect(duenoCoincide({ userId: "u1", agentId: "agent-a" }, "u1", "agent-a")).toBe(true)
    expect(duenoCoincide({ userId: "u2", agentId: "agent-a" }, "u1", "agent-a")).toBe(false)
    expect(duenoCoincide({ userId: "u1", agentId: "agent-b" }, "u1", "agent-a")).toBe(false)
    expect(duenoCoincide({ userId: null, agentId: "agent-a" }, "u1", "agent-a")).toBe(false)
    const ajeno = duenoDesdePayload({
      user_id: "u2",
      agent_id: "agent-a",
      conversation_initiation_client_data: { user_id: "u2" },
    })
    expect(duenoCoincide(ajeno, "u1", "agent-a")).toBe(false)
    const discrepante = duenoDesdePayload({
      user_id: "u1",
      agent_id: "agent-a",
      conversation_initiation_client_data: { user_id: "u2" },
    })
    expect(discrepante.userId).toBeNull()
    const ficha = fichaDesde({
      user_id: "u1",
      agent_id: "agent-a",
      transcript: [
        { role: "user", message: "hola" },
        { role: "agent", message: "buenas" },
        { role: "tool", message: "no se muestra" },
      ],
    })
    expect(ficha.mensajes).toEqual([
      { rol: "estudiante", texto: "hola" },
      { rol: "interlocutor", texto: "buenas" },
    ])
    const conTool = fichaDesde({
      transcript: [
        { role: "agent", message: "voy a consultar" },
        {
          role: "agent",
          tool_calls: [{ tool_name: "consultar", params_as_json: "{\"direccion\":\"centro\"}" }],
        },
        {
          role: "agent",
          tool_results: [{ tool_name: "consultar", is_error: false, result_value: "{\"ok\":true}" }],
        },
      ],
    })
    expect(conTool.mensajes.filter((item) => item.rol === "tool")).toHaveLength(2)
  })
})
