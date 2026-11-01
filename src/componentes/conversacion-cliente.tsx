"use client"

import { ConversationProvider, useConversation } from "@elevenlabs/react"
import type { MessagePayload } from "@elevenlabs/client"
import { useRef, useState } from "react"
import { z } from "zod"

import { anexarLinea, pausaSiguiente } from "@/lib/conversacion-viva"
import { enmascararCuerpoTool } from "@/lib/enmascarar"
import { logCliente } from "@/lib/log-cliente"

const respuestaSesion = z.object({
  modo: z.enum(["texto", "voz"]),
  signed_url: z.string().optional(),
  token: z.string().optional(),
  usuario_id: z.string(),
  variables: z.object({
    modulo: z.string(),
    equipo: z.string(),
    imprevistos_activos: z.string(),
    resumen_previo: z.string(),
  }),
})

const respuestaError = z.object({ detail: z.string() })
const respuestaCierre = z.object({ guardado: z.boolean() })

type Modo = "texto" | "voz"

async function detalleDe(respuesta: Response): Promise<string> {
  const json: unknown = await respuesta.json().catch(() => null)
  const parsed = respuestaError.safeParse(json)
  return parsed.success ? parsed.data.detail : "No se pudo completar la conversación."
}

function Panel({
  slug,
  nombre,
  modo,
  vozHabilitada,
  equipoSlug,
  onModo,
}: {
  slug: string
  nombre: string
  modo: Modo
  vozHabilitada: boolean
  equipoSlug?: string
  onModo: (modo: Modo) => void
}): React.ReactElement {
  const idRef = useRef("")
  const [lineas, setLineas] = useState<{ rol: string; texto: string }[]>([])
  const [borrador, setBorrador] = useState("")
  const [error, setError] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const conversacion = useConversation({
    textOnly: modo === "texto",
    onConnect: ({ conversationId }) => {
      idRef.current = conversationId
      void fetch("/api/v1/conversaciones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          agente_slug: slug,
          modo,
          ...(equipoSlug ? { equipo_slug: equipoSlug } : {}),
        }),
      }).then((respuesta) => {
        if (!respuesta.ok) setError("La conversación empezó, pero no se pudo guardar en el historial.")
      })
    },
    onDisconnect: () => {
      const id = idRef.current
      if (!id) return
      const intentar = (indice: number): void => {
        void fetch(`/api/v1/conversaciones/${id}/cerrar`, { method: "POST" })
          .then(async (respuesta) => {
            const json: unknown = await respuesta.json().catch(() => null)
            return respuestaCierre.safeParse(json).data?.guardado ?? false
          })
          .then((guardado) => {
            const pausa = pausaSiguiente(indice, guardado)
            if (pausa !== null) {
              window.setTimeout(() => intentar(indice + 1), pausa)
              return
            }
            if (!guardado) setError("La conversación quedó guardada. El resumen todavía no está listo.")
          })
          .catch(() => {
            const pausa = pausaSiguiente(indice, false)
            if (pausa !== null) window.setTimeout(() => intentar(indice + 1), pausa)
            else setError("La conversación quedó guardada. El resumen todavía no está listo.")
          })
      }
      intentar(0)
    },
    onMessage: (mensaje: MessagePayload) => {
      setLineas((previas) =>
        anexarLinea(previas, {
          rol: mensaje.role === "user" ? "Tú" : nombre,
          texto: mensaje.message,
        }),
      )
    },
    onAgentToolRequest: (pedido) => {
      setLineas((previas) => anexarLinea(previas, { rol: "Tool", texto: `${pedido.tool_name}: el agente la llamó.` }))
    },
    onAgentToolResponse: (respuesta) => {
      const cuerpo = "full_tool_result" in respuesta && typeof respuesta.full_tool_result === "string" ? respuesta.full_tool_result : ""
      const visible = cuerpo ? enmascararCuerpoTool(cuerpo) : ""
      const texto = visible
        ? `${respuesta.tool_name}: ${respuesta.is_error ? "error" : "respondió"} ${visible}`
        : `${respuesta.tool_name}: ${respuesta.is_error ? "error" : "respondió"}.`
      setLineas((previas) => anexarLinea(previas, { rol: "Tool", texto }))
    },
    onError: (mensaje) => {
      logCliente("error", "fallo de conversacion", { detalle: mensaje.slice(0, 180) })
      setError("No se pudo mantener la conversación.")
    },
  })

  async function empezar(): Promise<void> {
    setError("")
    setOcupado(true)
    try {
      const respuesta = await fetch("/api/v1/conversaciones/sesion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agente_slug: slug,
          modo,
          ...(equipoSlug ? { equipo_slug: equipoSlug } : {}),
        }),
      })
      if (!respuesta.ok) {
        setError(await detalleDe(respuesta))
        return
      }
      const sesion = respuestaSesion.parse(await respuesta.json())
      if (modo === "texto") {
        if (!sesion.signed_url) throw new Error("sin credencial")
        conversacion.startSession({
          signedUrl: sesion.signed_url,
          dynamicVariables: sesion.variables,
          textOnly: true,
          connectionType: "websocket",
          userId: sesion.usuario_id,
        })
      } else {
        if (!sesion.token) throw new Error("sin credencial")
        conversacion.startSession({
          conversationToken: sesion.token,
          dynamicVariables: sesion.variables,
          textOnly: false,
          connectionType: "webrtc",
          userId: sesion.usuario_id,
        })
      }
    } catch (error) {
      logCliente("error", "no se pudo iniciar")
      setError(error instanceof z.ZodError ? "La respuesta del servidor no es válida." : "No se pudo iniciar la conversación.")
    } finally {
      setOcupado(false)
    }
  }

  const conectada = conversacion.status === "connected" || conversacion.status === "connecting"
  const estado =
    conversacion.status === "connected"
      ? "En conversación"
      : conversacion.status === "connecting"
        ? "Conectando"
        : conversacion.status === "error"
          ? "Error de conexión"
          : "Lista para empezar"

  return (
    <section>
      <p aria-live="polite">{estado}</p>
      {error ? <p className="aviso">{error}</p> : null}
      {vozHabilitada ? (
        <fieldset disabled={conectada} className="border-0 p-0">
          <legend>Modo</legend>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="modo" checked={modo === "texto"} onChange={() => onModo("texto")} />
            Texto
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="modo" checked={modo === "voz"} onChange={() => onModo("voz")} />
            Voz
          </label>
        </fieldset>
      ) : (
        <p>Esta conversación es por texto.</p>
      )}
      {vozHabilitada ? <p>Para cambiar de modo, termina esta conversación y empieza otra.</p> : null}
      {conversacion.status === "disconnected" || conversacion.status === "error" ? (
        <button type="button" onClick={() => void empezar()} disabled={ocupado}>
          Empezar
        </button>
      ) : (
        <button type="button" onClick={() => conversacion.endSession()}>
          Terminar
        </button>
      )}
      {modo === "texto" && conversacion.status === "connected" ? (
        <form
          className="mt-4"
          onSubmit={(evento) => {
            evento.preventDefault()
            const texto = borrador.trim()
            if (!texto) return
            setLineas((previas) => anexarLinea(previas, { rol: "Tú", texto }))
            conversacion.sendUserMessage(texto)
            setBorrador("")
          }}
        >
          <label htmlFor="mensaje">Mensaje</label>
          <input id="mensaje" value={borrador} onChange={(evento) => setBorrador(evento.target.value)} />
          <button type="submit">Enviar</button>
        </form>
      ) : null}
      <h2>Transcripción</h2>
      {lineas.length === 0 ? <p>Todavía no hay mensajes.</p> : null}
      <ol aria-live="polite">
        {lineas.map((linea, indice) => (
          <li key={`${indice}-${linea.rol}`}>
            <strong>{linea.rol}: </strong>
            {linea.texto}
          </li>
        ))}
      </ol>
    </section>
  )
}

export function ConversacionCliente({
  slug,
  nombre,
  vozHabilitada,
  equipoSlug,
}: {
  slug: string
  nombre: string
  vozHabilitada: boolean
  equipoSlug?: string
}): React.ReactElement {
  const [modo, setModo] = useState<Modo>("texto")
  const modoEfectivo: Modo = vozHabilitada ? modo : "texto"
  return (
    <ConversationProvider textOnly={modoEfectivo === "texto"}>
      <Panel
        slug={slug}
        nombre={nombre}
        modo={modoEfectivo}
        vozHabilitada={vozHabilitada}
        equipoSlug={equipoSlug}
        onModo={setModo}
      />
    </ConversationProvider>
  )
}
