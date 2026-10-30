import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import {
  activarAccion,
  bajaEquipoAccion,
  bajaEstudianteAccion,
  cambiarModuloAccion,
  cambiarVozAccion,
  crearEquipoAccion,
  crearEstudianteAccion,
  editarEstudianteAccion,
  renombrarEquipoAccion,
} from "@/acciones/instructor"
import { MODULOS, NOMBRE_EQUIPO_DEMO, SLUG_EQUIPO_DEMO } from "@/lib/constantes"
import { formatoFecha } from "@/lib/fecha"
import { leerPaginacion } from "@/lib/paginacion"
import { listarTodas } from "@/servicios/conversaciones"
import { datosPanel } from "@/servicios/instructor"
import { exigirUsuario } from "@/servicios/sesion"

export const metadata: Metadata = { title: "Panel del instructor" }

const avisos: Record<string, string> = {
  activado: "Imprevisto activado.",
  "ya-estaba": "Ese imprevisto ya estaba activo.",
  "sin-equipos": "No hay equipos para activar.",
  guardado: "Cambios guardados.",
  baja: "La baja quedó registrada.",
  duplicado: "Ya existe un registro con ese dato.",
  error: "No se pudo completar el cambio.",
}

export default async function Instructor({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string; page?: string; page_size?: string }>
}): Promise<React.ReactElement> {
  const usuario = await exigirUsuario()
  if (usuario.rol !== "instructor") notFound()
  const parametros = await searchParams
  const consulta = new URLSearchParams()
  if (parametros.page) consulta.set("page", parametros.page)
  if (parametros.page_size) consulta.set("page_size", parametros.page_size)
  const pagina = leerPaginacion(consulta)
  const [panel, transcripciones] = await Promise.all([datosPanel(), listarTodas(pagina.page, pagina.page_size)])
  const aviso = parametros.aviso ? avisos[parametros.aviso] : null
  return (
    <main id="contenido">
      <h1>Panel del instructor</h1>
      {aviso ? <p className="aviso">{aviso}</p> : null}

      <section>
        <h2>Módulo actual</h2>
        <p>Aplica a las conversaciones nuevas de toda la cohorte.</p>
        <form action={cambiarModuloAccion}>
          <label htmlFor="modulo">
            Módulo
            <select id="modulo" name="modulo" defaultValue={panel.modulo}>
              {MODULOS.map((modulo) => (
                <option key={modulo} value={modulo}>
                  {modulo}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Guardar módulo</button>
        </form>
      </section>

      <section>
        <h2>Voz</h2>
        <p>
          Una conversación corta de texto gastó unos 120 créditos. La de voz gastó 1374 créditos en 63 segundos. Si la
          enciendes, cualquier estudiante de la cohorte puede usarla.
        </p>
        <form action={cambiarVozAccion}>
          <label htmlFor="voz-habilitada" className="inline-flex items-center gap-2">
            <input
              id="voz-habilitada"
              type="checkbox"
              name="voz_habilitada"
              value="si"
              defaultChecked={panel.voz_habilitada}
            />
            Habilitar la voz
          </label>
          <button type="submit">Guardar voz</button>
        </form>
      </section>

      {panel.imprevistos.map((grupo) => (
        <section key={grupo.caso}>
          <h2>Imprevistos de {grupo.nombre}</h2>
          <p>Módulo {panel.modulo}.</p>
          {grupo.claves.length === 0 ? <p>Este módulo no tiene imprevistos en este caso.</p> : null}
          {grupo.claves.map((item) => (
            <article key={item.clave} className="tarjeta">
              <h3>{item.clave}</h3>
              <p>{item.sostiene}</p>
              <p>{item.equipos.length > 0 ? `Activo en: ${item.equipos.join(", ")}` : "Todavía no está activo."}</p>
              <form action={activarAccion}>
                <input type="hidden" name="clave" value={item.clave} />
                {grupo.audiencia === "instructor" ? (
                  <>
                    <input type="hidden" name="equipo_slug" value={SLUG_EQUIPO_DEMO} />
                    <p>Se activa en {NOMBRE_EQUIPO_DEMO}.</p>
                  </>
                ) : (
                  <label htmlFor={`equipo-${item.clave}`}>
                    Activar para
                    <select id={`equipo-${item.clave}`} name="equipo_slug" defaultValue="todos">
                      <option value="todos">Todos los equipos</option>
                      {panel.equipos.map((equipo) => (
                        <option key={equipo.slug} value={equipo.slug}>
                          {equipo.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button type="submit">Activar</button>
              </form>
            </article>
          ))}
        </section>
      ))}

      <section>
        <h2>Cobertura</h2>
        {panel.cobertura.length === 0 ? <p>Todavía no hay equipos.</p> : null}
        {panel.cobertura.length > 0 ? (
          <table>
            <caption>Conversaciones por equipo e interlocutor</caption>
            <thead>
              <tr>
                <th scope="col">Equipo</th>
                {panel.cobertura[0]?.interlocutores.map((interlocutor) => (
                  <th key={interlocutor.slug} scope="col">
                    {interlocutor.nombre}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {panel.cobertura.map((equipo) => (
                <tr key={equipo.slug}>
                  <th scope="row">{equipo.nombre}</th>
                  {equipo.interlocutores.map((interlocutor) => (
                    <td key={interlocutor.slug}>
                      {interlocutor.cantidad}
                      {interlocutor.conductores.length > 0 ? `. ${interlocutor.conductores.join(", ")}` : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section>
        <h2>Transcripciones</h2>
        {transcripciones.items.length === 0 ? <p>Todavía no hay conversaciones.</p> : null}
        {transcripciones.items.length > 0 ? (
          <table>
            <caption>Cualquier conversación de la cohorte</caption>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Equipo</th>
                <th scope="col">Interlocutor</th>
                <th scope="col">Quién la condujo</th>
                <th scope="col">Leer</th>
              </tr>
            </thead>
            <tbody>
              {transcripciones.items.map((item) => (
                <tr key={item.id}>
                  <td>{formatoFecha(new Date(item.iniciada_at))}</td>
                  <td>{item.equipo_nombre}</td>
                  <td>{item.agente_nombre}</td>
                  <td>{item.conductor}</td>
                  <td>
                    <Link href={`/historial/${item.id}`}>Abrir</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        <nav aria-label="Páginas de transcripciones">
          {transcripciones.page > 1 ? <Link href={`/instructor?page=${transcripciones.page - 1}`}>Anterior</Link> : null}{" "}
          {transcripciones.total_pages > transcripciones.page ? (
            <Link href={`/instructor?page=${transcripciones.page + 1}`}>Siguiente</Link>
          ) : null}
        </nav>
      </section>

      <section>
        <h2>Equipos y estudiantes</h2>
        <form action={crearEquipoAccion}>
          <label htmlFor="nuevo-equipo">
            Nombre del equipo
            <input id="nuevo-equipo" name="nombre" required maxLength={80} />
          </label>
          <button type="submit">Crear equipo</button>
        </form>
        <form action={crearEstudianteAccion}>
          <label htmlFor="est-nombre">
            Nombre del estudiante
            <input id="est-nombre" name="nombre" required maxLength={120} />
          </label>
          <label htmlFor="est-email">
            Correo de Google
            <input id="est-email" name="email" type="email" required maxLength={254} autoComplete="off" />
          </label>
          <label htmlFor="est-equipo">
            Equipo
            <select id="est-equipo" name="equipo_slug" required>
              {panel.equipos.map((equipo) => (
                <option key={equipo.slug} value={equipo.slug}>
                  {equipo.nombre}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Agregar estudiante</button>
        </form>
        {panel.equipos.map((equipo) => (
          <article key={equipo.slug} className="tarjeta">
            <h3>{equipo.nombre}</h3>
            <form action={renombrarEquipoAccion}>
              <input type="hidden" name="slug" value={equipo.slug} />
              <label htmlFor={`nombre-${equipo.slug}`}>
                Nombre visible
                <input id={`nombre-${equipo.slug}`} name="nombre" defaultValue={equipo.nombre} required maxLength={80} />
              </label>
              <button type="submit">Guardar nombre</button>
            </form>
            <form action={bajaEquipoAccion}>
              <input type="hidden" name="slug" value={equipo.slug} />
              <label htmlFor={`baja-${equipo.slug}`} className="inline-flex items-center gap-2">
                <input id={`baja-${equipo.slug}`} type="checkbox" name="confirmo" value="si" />
                Confirmo la baja del equipo
              </label>
              <button type="submit">Dar de baja el equipo</button>
            </form>
            {equipo.estudiantes.length === 0 ? <p>Sin estudiantes.</p> : null}
            {equipo.estudiantes.map((estudiante) => (
              <form key={estudiante.id} action={editarEstudianteAccion} className="mt-4">
                <input type="hidden" name="id" value={estudiante.id} />
                <label htmlFor={`nom-${estudiante.id}`}>
                  Nombre
                  <input id={`nom-${estudiante.id}`} name="nombre" defaultValue={estudiante.nombre} required maxLength={120} />
                </label>
                <label htmlFor={`mail-${estudiante.id}`}>
                  Correo
                  <input id={`mail-${estudiante.id}`} name="email" type="email" defaultValue={estudiante.email} required />
                </label>
                <label htmlFor={`eq-${estudiante.id}`}>
                  Equipo
                  <select id={`eq-${estudiante.id}`} name="equipo_slug" defaultValue={equipo.slug}>
                    {panel.equipos.map((opcion) => (
                      <option key={opcion.slug} value={opcion.slug}>
                        {opcion.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit">Guardar estudiante</button>
              </form>
            ))}
            {equipo.estudiantes.map((estudiante) => (
              <form key={`${estudiante.id}-baja`} action={bajaEstudianteAccion}>
                <input type="hidden" name="id" value={estudiante.id} />
                <label htmlFor={`baja-est-${estudiante.id}`} className="inline-flex items-center gap-2">
                  <input id={`baja-est-${estudiante.id}`} type="checkbox" name="confirmo" value="si" />
                  Confirmo la baja de {estudiante.nombre}
                </label>
                <button type="submit">Dar de baja</button>
              </form>
            ))}
          </article>
        ))}
      </section>
    </main>
  )
}
