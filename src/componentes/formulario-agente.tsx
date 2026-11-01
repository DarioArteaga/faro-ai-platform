"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { formatoFecha } from "@/lib/fecha"
import type { VistaAgente } from "@/servicios/agentes"

type Parametro = { nombre: string; tipo: "string" | "number" | "boolean"; descripcion: string; ejemplo: string }

type Props = {
  vista: VistaAgente
  soloLectura: boolean
  equipoSlug: string | null
}

async function detalleDe(respuesta: Response): Promise<string> {
  const json: unknown = await respuesta.json().catch(() => null)
  if (json && typeof json === "object" && "detail" in json && typeof json.detail === "string") return json.detail
  return "No se pudo completar la solicitud."
}

export function FormularioAgente({ vista, soloLectura, equipoSlug }: Props): React.ReactElement {
  const router = useRouter()
  const agente = vista.agente
  const [nombre, setNombre] = useState(agente?.nombre ?? "")
  const [prompt, setPrompt] = useState(agente?.prompt ?? "")
  const [primerMensaje, setPrimerMensaje] = useState(agente?.primer_mensaje ?? "")
  const [voz, setVoz] = useState(agente?.voz_slug ?? vista.voces[0]?.slug ?? "")
  const [modelo, setModelo] = useState(agente?.modelo_slug ?? vista.modelos[0]?.slug ?? "")
  const [conTool, setConTool] = useState(Boolean(agente?.tool))
  const [url, setUrl] = useState(agente?.tool?.url ?? "")
  const [metodo, setMetodo] = useState<"GET" | "POST">(agente?.tool?.metodo ?? "POST")
  const [descripcion, setDescripcion] = useState(agente?.tool?.descripcion ?? "")
  const [parametros, setParametros] = useState<Parametro[]>(agente?.tool?.parametros ?? [])
  const [secreto, setSecreto] = useState("")
  const [escenario, setEscenario] = useState("")
  const [criterio, setCriterio] = useState("")
  const [aviso, setAviso] = useState("")
  const [prueba, setPrueba] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const archivado = Boolean(agente?.archivado)
  const bloqueado = soloLectura || archivado

  function cuerpo(): Record<string, unknown> {
    return {
      nombre,
      prompt,
      primer_mensaje: primerMensaje,
      voz_slug: voz,
      modelo_slug: modelo,
      tool: conTool
        ? {
            url,
            metodo,
            descripcion,
            parametros,
            ...(secreto.trim() ? { secreto: secreto.trim() } : {}),
          }
        : null,
    }
  }

  async function enviar(ruta: string, metodoHttp: "POST" | "PATCH", datos: unknown): Promise<boolean> {
    setAviso("")
    setOcupado(true)
    try {
      const respuesta = await fetch(ruta, {
        method: metodoHttp,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(datos),
      })
      if (!respuesta.ok) {
        setAviso(await detalleDe(respuesta))
        return false
      }
      if (ruta.endsWith("/probar")) {
        const json: unknown = await respuesta.json()
        const fila = json && typeof json === "object" ? json : {}
        const status = "status" in fila ? String(fila.status) : ""
        const cuerpoTexto = "cuerpo" in fila && typeof fila.cuerpo === "string" ? fila.cuerpo : ""
        const nota = "aviso" in fila && typeof fila.aviso === "string" ? fila.aviso : ""
        setPrueba(`Código ${status}. ${nota} ${cuerpoTexto}`.trim())
        return true
      }
      if (ruta === "/api/v1/agentes") setSecreto("")
      router.refresh()
      return true
    } catch {
      setAviso("No se pudo completar la solicitud.")
      return false
    } finally {
      setOcupado(false)
    }
  }

  const sala = equipoSlug
    ? `/conversacion/agente-del-equipo?equipo=${equipoSlug}`
    : "/conversacion/agente-del-equipo"

  return (
    <div className="grid gap-6">
      {aviso ? <p className="aviso">{aviso}</p> : null}
      {archivado ? <p>Este agente está archivado. La configuración y las transcripciones se conservan.</p> : null}
      {agente ? (
        <p>
          Texto {agente.uso.texto} de {agente.topes.conversacionesTexto}. Simulaciones {agente.uso.simulaciones} de{" "}
          {agente.topes.simulaciones}. Voz {Math.floor(agente.uso.segundosVoz / 60)} de {agente.topes.minutosVoz} minutos.
          {agente.topes.vozHabilitada ? " La voz de este equipo está encendida." : " La voz de este equipo está apagada."}
        </p>
      ) : null}
      <form
        className="grid gap-4"
        onSubmit={(evento) => {
          evento.preventDefault()
          if (bloqueado) return
          void enviar(agente ? "/api/v1/agentes" : "/api/v1/agentes", agente ? "PATCH" : "POST", cuerpo())
        }}
      >
        <p>Caso de uso: {vista.caso}. El idioma queda en español.</p>
        <label htmlFor="nombre-agente">
          Nombre
          <input
            id="nombre-agente"
            value={nombre}
            maxLength={vista.limites.nombre}
            required
            disabled={bloqueado}
            onChange={(evento) => setNombre(evento.target.value)}
          />
        </label>
        <label htmlFor="prompt-agente">
          Prompt
          <textarea
            id="prompt-agente"
            value={prompt}
            maxLength={vista.limites.prompt}
            required
            rows={8}
            disabled={bloqueado}
            onChange={(evento) => setPrompt(evento.target.value)}
          />
        </label>
        <label htmlFor="primer-mensaje">
          Primer mensaje
          <textarea
            id="primer-mensaje"
            value={primerMensaje}
            maxLength={vista.limites.primer_mensaje}
            rows={3}
            disabled={bloqueado}
            onChange={(evento) => setPrimerMensaje(evento.target.value)}
          />
        </label>
        <label htmlFor="voz-agente">
          Voz
          <select id="voz-agente" value={voz} disabled={bloqueado} onChange={(evento) => setVoz(evento.target.value)}>
            {vista.voces.map((opcion) => (
              <option key={opcion.slug} value={opcion.slug}>
                {opcion.nombre}. {opcion.detalle}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="modelo-agente">
          Modelo
          <select
            id="modelo-agente"
            value={modelo}
            disabled={bloqueado}
            onChange={(evento) => setModelo(evento.target.value)}
          >
            {vista.modelos.map((opcion) => (
              <option key={opcion.slug} value={opcion.slug}>
                {opcion.nombre}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="grid gap-3 border-0 p-0" disabled={bloqueado}>
          <legend>Tool</legend>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={conTool} onChange={(evento) => setConTool(evento.target.checked)} />
            Este agente usa una tool
          </label>
          {conTool ? (
            <>
              <p>ElevenLabs exige una URL pública. Sirve un túnel o el despliegue del equipo.</p>
              <label htmlFor="tool-url">
                URL
                <input id="tool-url" value={url} maxLength={500} onChange={(evento) => setUrl(evento.target.value)} />
              </label>
              <label htmlFor="tool-metodo">
                Método
                <select
                  id="tool-metodo"
                  value={metodo}
                  onChange={(evento) => setMetodo(evento.target.value === "GET" ? "GET" : "POST")}
                >
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                </select>
              </label>
              <label htmlFor="tool-descripcion">
                Descripción
                <textarea
                  id="tool-descripcion"
                  value={descripcion}
                  maxLength={1000}
                  rows={3}
                  onChange={(evento) => setDescripcion(evento.target.value)}
                />
              </label>
              {parametros.map((parametro, indice) => (
                <div key={indice} className="grid gap-2">
                  <label htmlFor={`param-nombre-${indice}`}>
                    Nombre del parámetro
                    <input
                      id={`param-nombre-${indice}`}
                      value={parametro.nombre}
                      onChange={(evento) =>
                        setParametros((previos) =>
                          previos.map((fila, i) => (i === indice ? { ...fila, nombre: evento.target.value } : fila)),
                        )
                      }
                    />
                  </label>
                  <label htmlFor={`param-tipo-${indice}`}>
                    Tipo
                    <select
                      id={`param-tipo-${indice}`}
                      value={parametro.tipo}
                      onChange={(evento) =>
                        setParametros((previos) =>
                          previos.map((fila, i) =>
                            i === indice
                              ? { ...fila, tipo: evento.target.value === "number" || evento.target.value === "boolean" ? evento.target.value : "string" }
                              : fila,
                          ),
                        )
                      }
                    >
                      <option value="string">Texto</option>
                      <option value="number">Número</option>
                      <option value="boolean">Sí o no</option>
                    </select>
                  </label>
                  <label htmlFor={`param-desc-${indice}`}>
                    Descripción
                    <input
                      id={`param-desc-${indice}`}
                      value={parametro.descripcion}
                      onChange={(evento) =>
                        setParametros((previos) =>
                          previos.map((fila, i) => (i === indice ? { ...fila, descripcion: evento.target.value } : fila)),
                        )
                      }
                    />
                  </label>
                  <label htmlFor={`param-ejemplo-${indice}`}>
                    Ejemplo
                    <input
                      id={`param-ejemplo-${indice}`}
                      value={parametro.ejemplo}
                      onChange={(evento) =>
                        setParametros((previos) =>
                          previos.map((fila, i) => (i === indice ? { ...fila, ejemplo: evento.target.value } : fila)),
                        )
                      }
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setParametros((previos) => previos.filter((_, i) => i !== indice))}
                  >
                    Quitar parámetro
                  </button>
                </div>
              ))}
              {parametros.length < vista.limites.parametros ? (
                <button
                  type="button"
                  onClick={() =>
                    setParametros((previos) => [...previos, { nombre: "", tipo: "string", descripcion: "", ejemplo: "" }])
                  }
                >
                  Agregar parámetro
                </button>
              ) : null}
              <label htmlFor="tool-secreto">
                Secreto
                <input
                  id="tool-secreto"
                  type="password"
                  autoComplete="new-password"
                  value={secreto}
                  maxLength={200}
                  onChange={(evento) => setSecreto(evento.target.value)}
                />
              </label>
              <p>
                {agente?.tool?.secreto_en_servidor
                  ? "Hay un secreto cifrado en el servidor. La prueba lo usa y no se muestra. Si escribes otro, reemplaza al anterior."
                  : agente?.tool?.tiene_secreto
                    ? "ElevenLabs ya tiene un secreto, pero la prueba no puede reenviarlo. Escríbelo otra vez para guardarlo cifrado."
                    : "El secreto se guarda cifrado en el servidor y también se envía a ElevenLabs. No se muestra."}
              </p>
            </>
          ) : null}
        </fieldset>
        {bloqueado ? null : <button type="submit" disabled={ocupado}>{agente ? "Guardar" : "Crear agente"}</button>}
      </form>
      {agente && conTool && !bloqueado ? (
        <button type="button" disabled={ocupado} onClick={() => void enviar("/api/v1/agentes/probar", "POST", cuerpo())}>
          Probar la tool
        </button>
      ) : null}
      {prueba ? <p>{prueba}</p> : null}
      {agente && !archivado ? (
        <p>
          <a className="boton inline-block no-underline" href={sala}>
            Abrir sala
          </a>
        </p>
      ) : null}
      {agente ? (
        <section>
          <h2>Versiones</h2>
          {agente.versiones.length === 0 ? <p>Todavía no hay versiones.</p> : null}
          {agente.versiones.length > 0 ? (
            <table>
              <caption>Versiones guardadas</caption>
              <thead>
                <tr>
                  <th scope="col">Número</th>
                  <th scope="col">Autor</th>
                  <th scope="col">Fecha</th>
                  <th scope="col">Origen</th>
                  {bloqueado ? null : <th scope="col">Volver</th>}
                </tr>
              </thead>
              <tbody>
                {agente.versiones.map((version) => (
                  <tr key={version.id}>
                    <td>{version.numero}</td>
                    <td>{version.autor}</td>
                    <td>{formatoFecha(new Date(version.guardado_at))}</td>
                    <td>{version.origen_numero ? `Versión ${version.origen_numero}` : "Guardado"}</td>
                    {bloqueado ? null : (
                      <td>
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() =>
                            void enviar("/api/v1/agentes/restaurar", "POST", { version_id: version.id })
                          }
                        >
                          Usar esta versión
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}
      {agente && !bloqueado ? (
        <form
          className="grid gap-3"
          onSubmit={(evento) => {
            evento.preventDefault()
            void enviar("/api/v1/agentes/simulaciones", "POST", { escenario, criterio })
          }}
        >
          <h2>Simulación</h2>
          <label htmlFor="escenario">
            Escenario
            <textarea id="escenario" value={escenario} maxLength={2000} rows={3} onChange={(evento) => setEscenario(evento.target.value)} />
          </label>
          <label htmlFor="criterio">
            Criterio de éxito
            <textarea id="criterio" value={criterio} maxLength={2000} rows={3} onChange={(evento) => setCriterio(evento.target.value)} />
          </label>
          <button type="submit" disabled={ocupado}>
            Correr simulación
          </button>
        </form>
      ) : null}
    </div>
  )
}
