import { z } from "zod"

import { detalleSeguro } from "@/lib/enmascarar"
import { ErrorHttp } from "@/lib/errores"
import { log } from "@/lib/log"
import { validarIdConversacion } from "@/lib/validar"

const BASE = "https://api.elevenlabs.io"

export type MensajeVisible = {
  rol: "estudiante" | "interlocutor"
  texto: string
}

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
      }),
    )
    .nullable()
    .optional(),
})

export type DuenoConversacion = { userId: string | null; agentId: string | null }

export type FichaConversacion = { dueno: DuenoConversacion; mensajes: MensajeVisible[] }

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

export function fichaDesde(json: unknown): FichaConversacion {
  const parsed = fichaSchema.safeParse(json)
  const mensajes: MensajeVisible[] = []
  for (const item of parsed.success ? parsed.data.transcript ?? [] : []) {
    const texto = item.message?.trim()
    if (!texto) continue
    if (item.role === "user") mensajes.push({ rol: "estudiante", texto })
    else if (item.role === "agent") mensajes.push({ rol: "interlocutor", texto })
  }
  return { dueno: duenoDesdePayload(json), mensajes }
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
