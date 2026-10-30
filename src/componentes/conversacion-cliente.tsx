"use client"

import { ConversationProvider, useConversation } from "@elevenlabs/react"
import type { MessagePayload } from "@elevenlabs/client"
import { useRef, useState } from "react"
import { z } from "zod"

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

type Modo = "texto" | "voz"
type Linea = { rol: string; texto: string }

async function detalleDe(respuesta: Response): Promise<string> {
  const json: unknown = await respuesta.json().catch(() => null)
  const parsed = respuestaError.safeParse(json)
  return parsed.success ? parsed.data.detail : "No se pudo completar la conversación."
}

function Panel({
  slug,
  nombre,
  modo,
  onModo,
}: {
  slug: string
  nombre: string
  modo: Modo
  onModo: (modo: Modo) => void
}): React.ReactElement {
  const idRef = useRef("")
  const [lineas, setLineas] = useState<Linea[]>([])
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
        body: JSON.stringify({ conversation_id: conversationId, agente_slug: slug, modo }),
      }).then((respuesta) => {
        if (!respuesta.ok) setError("La conversación empezó, pero no se pudo guardar en el historial.")
      })
    },
    onDisconnect: () => {
      const id = idRef.current
      if (!id) return
      void fetch(`/api/v1/conversaciones/${id}/cerrar`, { method: "POST" })
      window.setTimeout(() => {
        void fetch(`/api/v1/conversaciones/${id}/cerrar`, { method: "POST" })
      }, 3000)
    },
    onMessage: (mensaje: MessagePayload) => {
      setLineas((previas) => [
        ...previas,
        { rol: mensaje.role === "user" ? "Tú" : nombre, texto: mensaje.message },
      ])
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
        body: JSON.stringify({ agente_slug: slug, modo }),
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
      <p>Para cambiar de modo, termina esta conversación y empieza otra.</p>
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

export function ConversacionCliente({ slug, nombre }: { slug: string; nombre: string }): React.ReactElement {
  const [modo, setModo] = useState<Modo>("texto")
  return (
    <ConversationProvider textOnly={modo === "texto"}>
      <Panel slug={slug} nombre={nombre} modo={modo} onModo={setModo} />
    </ConversationProvider>
  )
}
