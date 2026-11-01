import { z } from "zod"

import type { InicioRecibido } from "@/lib/control-variables"
import { idsDeInterlocutores } from "@/lib/catalogo"
import { detalleSeguro, enmascararCuerpoTool } from "@/lib/enmascarar"
import { ErrorHttp } from "@/lib/errores"
import { log } from "@/lib/log"
import { validarIdConversacion } from "@/lib/validar"

const BASE = "https://api.elevenlabs.io"

export type MensajeVisible =
  | { rol: "estudiante" | "interlocutor"; texto: string }
  | { rol: "tool"; nombre: string; pedido: string; respuesta: string; error: boolean }

async function pedir(ruta: string, etiqueta: string, timeoutMs: number): Promise<Response> {
  const clave = process.env.ELEVENLABS_API_KEY
  if (!clave) throw new ErrorHttp(503, "Falta la configuración del interlocutor.")
  try {
    return await fetch(`${BASE}${ruta}`, {
      headers: { "xi-api-key": clave },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    log.error({ etiqueta, detalle: detalleSeguro(error) }, "no se pudo contactar a elevenlabs")
    throw new ErrorHttp(502, "No se pudo hablar con el interlocutor.")
  }
}

async function leerJson(respuesta: Response, etiqueta: string): Promise<unknown> {
  if (!respuesta.ok) {
    await respuesta.body?.cancel()
    log.error({ etiqueta, status: respuesta.status }, "elevenlabs rechazo el pedido")
    throw new ErrorHttp(502, "No se pudo hablar con el interlocutor.")
  }
  try {
    return (await respuesta.json()) as unknown
  } catch (error) {
    log.error({ etiqueta, detalle: detalleSeguro(error) }, "respuesta ilegible de elevenlabs")
    throw new ErrorHttp(502, "No se pudo hablar con el interlocutor.")
  }
}

export async function pedirUrlFirmada(agentId: string): Promise<string> {
  const respuesta = await pedir(
    `/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
    "signed-url",
    15000,
  )
  const json = await leerJson(respuesta, "signed-url")
  const parsed = z.object({ signed_url: z.string().min(20) }).safeParse(json)
  if (!parsed.success) throw new ErrorHttp(502, "No se pudo hablar con el interlocutor.")
  return parsed.data.signed_url
}

export async function pedirToken(agentId: string): Promise<string> {
  const respuesta = await pedir(
    `/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
    "token",
    15000,
  )
  const json = await leerJson(respuesta, "token")
  const parsed = z.object({ token: z.string().min(8) }).safeParse(json)
  if (!parsed.success) throw new ErrorHttp(502, "No se pudo hablar con el interlocutor.")
  return parsed.data.token
}

async function pedirOpcional(ruta: string, etiqueta: string): Promise<unknown | null> {
  const clave = process.env.ELEVENLABS_API_KEY
  if (!clave) return null
  try {
    const respuesta = await fetch(`${BASE}${ruta}`, {
      headers: { "xi-api-key": clave },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(4000),
    })
    if (respuesta.status === 404) {
      await respuesta.body?.cancel()
      return null
    }
    if (!respuesta.ok) {
      await respuesta.body?.cancel()
      log.warn({ etiqueta, status: respuesta.status }, "elevenlabs no devolvio el dato")
      return null
    }
    return (await respuesta.json()) as unknown
  } catch (error) {
    log.warn({ etiqueta, detalle: detalleSeguro(error) }, "no se pudo leer el dato de elevenlabs")
    return null
  }
}

export async function pedirResumen(conversationId: string): Promise<string | null> {
  const id = validarIdConversacion(conversationId)
  const directo = await pedirOpcional(`/v1/convai/conversations/${id}/summary`, "summary")
  const primero = z
    .object({ transcript_summary: z.string().nullable().optional() })
    .safeParse(directo).data?.transcript_summary?.trim()
  if (primero) return primero
  const completo = await pedirOpcional(`/v1/convai/conversations/${id}`, "summary-analysis")
  const segundo = z
    .object({
      analysis: z.object({ transcript_summary: z.string().nullable().optional() }).optional(),
    })
    .safeParse(completo).data?.analysis?.transcript_summary?.trim()
  return segundo || null
}

const fichaSchema = z.object({
  agent_id: z.string().nullable().optional(),
  user_id: z.string().nullable().optional(),
  conversation_initiation_client_data: z
    .object({ user_id: z.string().nullable().optional() })
    .nullable()
    .optional(),
  transcript: z
    .array(
      z.object({
        role: z.string(),
        message: z.string().nullable().optional(),
        tool_calls: z.array(z.unknown()).nullable().optional(),
        tool_results: z.array(z.unknown()).nullable().optional(),
      }),
    )
    .nullable()
    .optional(),
})

export type DuenoConversacion = { userId: string | null; agentId: string | null }

export type FichaConversacion = {
  dueno: DuenoConversacion
  mensajes: MensajeVisible[]
  inicio: InicioRecibido | null
  duracionSegundos: number | null
}

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
}

/** El bloque de inicio, si ElevenLabs ya lo guardó. No valida los valores. */
export function inicioDesde(json: unknown): InicioRecibido | null {
  if (!esRegistro(json)) return null
  const bloque = json.conversation_initiation_client_data
  if (!esRegistro(bloque)) return null
  return {
    dynamicVariables: Object.prototype.hasOwnProperty.call(bloque, "dynamic_variables")
      ? bloque.dynamic_variables
      : undefined,
    override: bloque.conversation_config_override,
    extraBody: bloque.custom_llm_extra_body,
  }
}

function textoDueno(valor: string | null | undefined): string | null {
  const limpio = valor?.trim()
  return limpio ? limpio : null
}

/** Dueño que ElevenLabs declara. Si las dos fuentes discrepan, no hay dueño. */
export function duenoDesdePayload(json: unknown): DuenoConversacion {
  const parsed = fichaSchema.safeParse(json)
  if (!parsed.success) return { userId: null, agentId: null }
  const directo = textoDueno(parsed.data.user_id)
  const anidado = textoDueno(parsed.data.conversation_initiation_client_data?.user_id)
  const userId = directo && anidado && directo !== anidado ? null : directo || anidado
  return { userId, agentId: textoDueno(parsed.data.agent_id) }
}

function duracionDesde(json: unknown): number | null {
  if (!json || typeof json !== "object") return null
  const metadata = (json as { metadata?: unknown }).metadata
  if (!metadata || typeof metadata !== "object") return null
  const segundos = (metadata as { call_duration_secs?: unknown }).call_duration_secs
  if (typeof segundos !== "number" || segundos < 0 || segundos >= 86_400) return null
  return Math.round(segundos)
}

function textoDe(valor: unknown): string {
  return typeof valor === "string" ? valor : ""
}

function lineasDeTool(llamadas: unknown, resultados: unknown): MensajeVisible[] {
  const lineas: MensajeVisible[] = []
  if (Array.isArray(llamadas)) {
    for (const item of llamadas) {
      if (!item || typeof item !== "object") continue
      const fila = item as { tool_name?: unknown; params_as_json?: unknown }
      if (typeof fila.tool_name !== "string" || !fila.tool_name.trim()) continue
      lineas.push({
        rol: "tool",
        nombre: fila.tool_name.trim().slice(0, 80),
        pedido: enmascararCuerpoTool(textoDe(fila.params_as_json)),
        respuesta: "",
        error: false,
      })
    }
  }
  if (Array.isArray(resultados)) {
    for (const item of resultados) {
      if (!item || typeof item !== "object") continue
      const fila = item as { tool_name?: unknown; result_value?: unknown; is_error?: unknown }
      if (typeof fila.tool_name !== "string" || !fila.tool_name.trim()) continue
      lineas.push({
        rol: "tool",
        nombre: fila.tool_name.trim().slice(0, 80),
        pedido: "",
        respuesta: enmascararCuerpoTool(textoDe(fila.result_value)),
        error: fila.is_error === true,
      })
    }
  }
  return lineas
}

export function fichaDesde(json: unknown): FichaConversacion {
  const parsed = fichaSchema.safeParse(json)
  const mensajes: MensajeVisible[] = []
  for (const item of parsed.success ? parsed.data.transcript ?? [] : []) {
    const texto = item.message?.trim()
    if (texto && item.role === "user") mensajes.push({ rol: "estudiante", texto })
    else if (texto && item.role === "agent") mensajes.push({ rol: "interlocutor", texto })
    mensajes.push(...lineasDeTool(item.tool_calls, item.tool_results))
  }
  return { dueno: duenoDesdePayload(json), mensajes, inicio: inicioDesde(json), duracionSegundos: duracionDesde(json) }
}

export function exigirAgenteDeEquipo(agentId: string): void {
  if (idsDeInterlocutores().includes(agentId)) {
    log.error("escritura bloqueada: el id pertenece a un interlocutor")
    throw new ErrorHttp(500, "No se pudo guardar el agente.")
  }
}

async function enviar(
  metodo: "POST" | "PATCH" | "DELETE",
  ruta: string,
  etiqueta: string,
  cuerpo?: unknown,
): Promise<unknown> {
  const clave = process.env.ELEVENLABS_API_KEY
  if (!clave) throw new ErrorHttp(503, "Falta la configuración del interlocutor.")
  let respuesta: Response
  try {
    respuesta = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers: {
        "xi-api-key": clave,
        ...(cuerpo === undefined ? {} : { "content-type": "application/json" }),
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    })
  } catch (error) {
    log.error({ etiqueta, detalle: detalleSeguro(error) }, "no se pudo contactar a elevenlabs")
    throw new ErrorHttp(502, "No se pudo hablar con el interlocutor.")
  }
  if (respuesta.status === 404) {
    await respuesta.body?.cancel()
    throw new ErrorHttp(404, "No se encontró ese recurso.")
  }
  if (respuesta.status === 422) {
    await respuesta.body?.cancel()
    log.error({ etiqueta, status: respuesta.status }, "elevenlabs rechazo la configuracion")
    throw new ErrorHttp(422, "ElevenLabs no aceptó la configuración.")
  }
  if (!respuesta.ok) {
    await respuesta.body?.cancel()
    log.error({ etiqueta, status: respuesta.status }, "elevenlabs rechazo el pedido")
    throw new ErrorHttp(502, "No se pudo hablar con el interlocutor.")
  }
  if (respuesta.status === 204) return null
  const tipo = respuesta.headers.get("content-type") ?? ""
  if (!tipo.includes("json")) return null
  return leerJson(respuesta, etiqueta)
}

export async function crearAgenteEleven(cuerpo: unknown): Promise<string> {
  const json = await enviar("POST", "/v1/convai/agents/create", "crear-agente", cuerpo)
  const parsed = z.object({ agent_id: z.string().min(8) }).safeParse(json)
  if (!parsed.success) throw new ErrorHttp(502, "No se pudo hablar con el interlocutor.")
  exigirAgenteDeEquipo(parsed.data.agent_id)
  return parsed.data.agent_id
}

export async function actualizarAgenteEleven(agentId: string, cuerpo: unknown): Promise<void> {
  exigirAgenteDeEquipo(agentId)
  await enviar("PATCH", `/v1/convai/agents/${encodeURIComponent(agentId)}`, "actualizar-agente", cuerpo)
}

export async function borrarAgenteEleven(agentId: string): Promise<void> {
  exigirAgenteDeEquipo(agentId)
  await enviar("DELETE", `/v1/convai/agents/${encodeURIComponent(agentId)}`, "borrar-agente")
}

export async function crearToolEleven(cuerpo: unknown): Promise<string> {
  const json = await enviar("POST", "/v1/convai/tools", "crear-tool", cuerpo)
  const parsed = z.object({ id: z.string().min(4) }).safeParse(json)
  if (!parsed.success) throw new ErrorHttp(502, "No se pudo hablar con el interlocutor.")
  return parsed.data.id
}

export async function actualizarToolEleven(toolId: string, cuerpo: unknown): Promise<void> {
  await enviar("PATCH", `/v1/convai/tools/${encodeURIComponent(toolId)}`, "actualizar-tool", cuerpo)
}

export async function crearSecretoEleven(nombre: string, valor: string): Promise<string> {
  const json = await enviar("POST", "/v1/convai/secrets", "crear-secreto", { type: "new", name: nombre, value: valor })
  const parsed = z.object({ secret_id: z.string().min(4) }).safeParse(json)
  if (!parsed.success) throw new ErrorHttp(502, "No se pudo hablar con el interlocutor.")
  return parsed.data.secret_id
}

export async function borrarSecretoEleven(secretId: string): Promise<void> {
  await enviar("DELETE", `/v1/convai/secrets/${encodeURIComponent(secretId)}`, "borrar-secreto")
}

const corridaSchema = z.object({
  test_runs: z
    .array(
      z.object({
        status: z.enum(["pending", "passed", "failed", "cancelled"]),
        credits_used: z.number().nullable().optional(),
        condition_result: z
          .object({
            result: z.string().optional(),
            rationale: z
              .object({
                summary: z.string().optional(),
                messages: z.array(z.string()).optional(),
              })
              .nullable()
              .optional(),
          })
          .nullable()
          .optional(),
        agent_responses: z
          .array(
            z.object({
              role: z.string(),
              message: z.string().nullable().optional(),
              tool_calls: z.array(z.unknown()).nullable().optional(),
              tool_results: z.array(z.unknown()).nullable().optional(),
            }),
          )
          .nullable()
          .optional(),
      }),
    )
    .optional(),
})

export type ResultadoSimulacion = {
  resultado: "paso" | "no_paso" | "error"
  razon: string
  transcripcion: string
  creditos: number | null
}

function estadoDeCorrida(json: unknown): "pending" | "passed" | "failed" | "cancelled" | null {
  return corridaSchema.safeParse(json).data?.test_runs?.[0]?.status ?? null
}

export function resultadoDesdeCorrida(json: unknown): ResultadoSimulacion {
  const corrida = corridaSchema.safeParse(json).data?.test_runs?.[0]
  if (!corrida) {
    return { resultado: "error", razon: "La simulación no devolvió un resultado.", transcripcion: "", creditos: null }
  }
  const resultado = corrida.status === "passed" ? "paso" : corrida.status === "failed" ? "no_paso" : "error"
  const resumen = corrida.condition_result?.rationale?.summary?.trim()
  const mensajes = (corrida.condition_result?.rationale?.messages ?? []).map((item) => item.trim()).filter(Boolean)
  const explicacion = [resumen, ...mensajes].filter(Boolean).join(" ").slice(0, 2_000)
  const razon =
    explicacion ||
    (corrida.status === "pending"
      ? "La simulación no terminó a tiempo."
      : corrida.status === "cancelled"
        ? "La simulación se canceló."
        : "Sin explicación del evaluador.")
  const lineas = (corrida.agent_responses ?? []).flatMap((item) => {
    const texto = item.message?.trim()
    const rol = item.role === "user" ? "Usuario" : item.role === "agent" ? "Agente" : ""
    const habladas = texto && rol ? [`${rol}: ${texto}`] : []
    const tools = lineasDeTool(item.tool_calls, item.tool_results).map((linea) => {
      if (linea.rol !== "tool") return ""
      if (linea.pedido) return `Tool ${linea.nombre}: pidió ${linea.pedido}`
      return `Tool ${linea.nombre}: ${linea.error ? "error" : "respondió"} ${linea.respuesta}`
    })
    return [...habladas, ...tools.filter(Boolean)]
  })
  const creditos = typeof corrida.credits_used === "number" && corrida.credits_used >= 0 ? Math.round(corrida.credits_used) : null
  return { resultado, razon, transcripcion: lineas.join("\n").slice(0, 20_000), creditos }
}

/** `run-tests` responde enseguida con `pending`. La lectura posterior no vuelve a lanzar la corrida. */
export async function corridaTerminada(
  inicial: unknown,
  leer: (id: string) => Promise<unknown | null>,
  opciones?: {
    topeMs?: number
    pausaMs?: number
    ahora?: () => number
    pausa?: (ms: number) => Promise<void>
  },
): Promise<unknown> {
  const estado = estadoDeCorrida(inicial)
  if (estado && estado !== "pending") return inicial
  const id = z.object({ id: z.string().min(4) }).safeParse(inicial).data?.id
  if (!id) return inicial
  const tope = opciones?.topeMs ?? 120_000
  const pausaMs = opciones?.pausaMs ?? 2_000
  const ahora = opciones?.ahora ?? Date.now
  const pausa = opciones?.pausa ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const limite = ahora() + tope
  let ultimo = inicial
  while (ahora() < limite) {
    await pausa(pausaMs)
    const siguiente = await leer(id)
    if (!siguiente) continue
    ultimo = siguiente
    const actual = estadoDeCorrida(ultimo)
    if (actual && actual !== "pending") return ultimo
  }
  return ultimo
}

export async function crearSimulacionEleven(cuerpo: unknown): Promise<string> {
  const json = await enviar("POST", "/v1/convai/agent-testing/create", "crear-simulacion", cuerpo)
  const parsed = z.object({ id: z.string().min(4) }).safeParse(json)
  if (!parsed.success) throw new ErrorHttp(502, "No se pudo hablar con el interlocutor.")
  return parsed.data.id
}

async function leerInvocacion(id: string): Promise<unknown | null> {
  try {
    const respuesta = await pedir(
      `/v1/convai/test-invocations/${encodeURIComponent(id)}`,
      "leer-simulacion",
      15000,
    )
    if (!respuesta.ok) {
      await respuesta.body?.cancel()
      log.warn({ status: respuesta.status }, "no se pudo leer la simulacion")
      return null
    }
    return (await respuesta.json()) as unknown
  } catch (error) {
    log.warn({ detalle: detalleSeguro(error) }, "no se pudo leer la simulacion")
    return null
  }
}

export async function correrSimulacionEleven(agentId: string, testId: string): Promise<ResultadoSimulacion> {
  exigirAgenteDeEquipo(agentId)
  const json = await enviar("POST", `/v1/convai/agents/${encodeURIComponent(agentId)}/run-tests`, "correr-simulacion", {
    tests: [{ test_id: testId }],
  })
  // ponytail: el tope de espera puede vivir en constructor.yaml
  const final = await corridaTerminada(json, leerInvocacion)
  return resultadoDesdeCorrida(final)
}

/** null si ElevenLabs responde 404. No incluye la URL ni el cuerpo en el log. */
export async function traerConversacion(conversationId: string): Promise<FichaConversacion | null> {
  const id = validarIdConversacion(conversationId)
  const respuesta = await pedir(`/v1/convai/conversations/${id}`, "conversacion", 15000)
  if (respuesta.status === 404) {
    await respuesta.body?.cancel()
    return null
  }
  return fichaDesde(await leerJson(respuesta, "conversacion"))
}
