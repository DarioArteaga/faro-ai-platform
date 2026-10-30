import { Prisma } from "@prisma/client"

import {
  duenoCoincide,
  puedeIniciarConversacion,
  puedePedirTokenDeVoz,
  puedeVerConversacion,
  type SesionUsuario,
} from "@/lib/autorizacion"
import { casoActivo, interlocutorPorSlug, leerImprevistos } from "@/lib/catalogo"
import { db, registrarFalloDeDatos } from "@/lib/db"
import { detalleSeguro } from "@/lib/enmascarar"
import { ErrorHttp } from "@/lib/errores"
import { pedirResumen, pedirToken, pedirUrlFirmada, traerConversacion, type FichaConversacion, type MensajeVisible } from "@/lib/elevenlabs"
import { clavesEnviables } from "@/lib/imprevistos"
import { log } from "@/lib/log"
import { permitir } from "@/lib/limite"
import { metaPagina, type MetaPagina } from "@/lib/paginacion"
import { validarIdConversacion } from "@/lib/validar"
import { armarVariables, type VariablesConversacion } from "@/lib/variables"
import { obtenerModulo, obtenerVozHabilitada } from "@/servicios/cohorte"

type Modo = "texto" | "voz"

type Pendiente = {
  vence: number
  modo: Modo
  variables: VariablesConversacion
}

const pendientes = new Map<string, Pendiente>()
const VIGENCIA_MS = 15 * 60 * 1000

export type ItemConversacion = {
  id: string
  iniciada_at: string
  agente_slug: string
  agente_nombre: string
  conductor: string
  modo: string
  modulo: string
  equipo_slug?: string
  equipo_nombre?: string
}

export type ListaConversaciones = MetaPagina & { items: ItemConversacion[] }

export type Transcripcion = ItemConversacion & {
  equipo: string
  mensajes: MensajeVisible[]
}

function llave(usuarioId: string, agenteSlug: string): string {
  return `${usuarioId}:${agenteSlug}`
}

function nombreAgente(slug: string): string {
  return casoActivo().interlocutores.find((item) => item.slug === slug)?.nombre ?? slug
}

function exigirEquipo(usuario: SesionUsuario): { equipoId: string; equipoNombre: string } {
  const codigo = puedeIniciarConversacion(usuario)
  if (codigo === 401) throw new ErrorHttp(401, "Tienes que entrar para continuar.")
  if (codigo === 403 || !usuario.equipoId || !usuario.equipoNombre) {
    throw new ErrorHttp(403, "Tu cuenta no tiene equipo.")
  }
  return { equipoId: usuario.equipoId, equipoNombre: usuario.equipoNombre }
}

async function intentarResumen(equipoId: string, agenteSlug: string): Promise<void> {
  try {
    const ya = await db().resumenConversacion.findUnique({
      where: { equipoId_agenteSlug: { equipoId, agenteSlug } },
    })
    if (ya?.texto.trim()) return
    const ultima = await db().conversacion.findFirst({
      where: { equipoId, agenteSlug },
      orderBy: { iniciadaAt: "desc" },
    })
    if (!ultima) return
    const texto = await pedirResumen(ultima.id)
    if (!texto) return
    await db().resumenConversacion.upsert({
      where: { equipoId_agenteSlug: { equipoId, agenteSlug } },
      create: { equipoId, agenteSlug, texto, conversationId: ultima.id },
      update: { texto, conversationId: ultima.id },
    })
  } catch (error) {
    log.warn({ detalle: detalleSeguro(error) }, "el resumen previo no estaba listo")
  }
}

async function variablesPara(usuario: SesionUsuario, agenteSlug: string): Promise<VariablesConversacion> {
  const equipo = exigirEquipo(usuario)
  await intentarResumen(equipo.equipoId, agenteSlug)
  const [modulo, activas, resumen] = await Promise.all([
    obtenerModulo(),
    db().activacionImprevisto.findMany({ where: { equipoId: equipo.equipoId }, select: { clave: true } }),
    db().resumenConversacion.findUnique({
      where: { equipoId_agenteSlug: { equipoId: equipo.equipoId, agenteSlug } },
    }),
  ])
  const catalogo = leerImprevistos()
  return armarVariables({
    modulo,
    equipo: equipo.equipoNombre,
    claves: clavesEnviables(
      activas.map((fila) => fila.clave),
      catalogo.orden,
    ),
    resumen: resumen?.texto,
  })
}

export async function iniciarSesion(
  usuario: SesionUsuario,
  entrada: { agenteSlug: string; modo: Modo },
): Promise<{ modo: Modo; signed_url?: string; token?: string; variables: VariablesConversacion; usuario_id: string }> {
  exigirEquipo(usuario)
  if (!permitir(`sesion:${usuario.id}`, 20, 10 * 60 * 1000)) {
    throw new ErrorHttp(429, "Demasiadas conversaciones seguidas. Espera un momento.")
  }
  const interlocutor = interlocutorPorSlug(entrada.agenteSlug)
  if (!interlocutor) throw new ErrorHttp(404, "No encontramos ese interlocutor.")
  if (entrada.modo === "voz" && !puedePedirTokenDeVoz(usuario.rol, await obtenerVozHabilitada())) {
    throw new ErrorHttp(403, "La voz no está habilitada.")
  }
  const variables = await variablesPara(usuario, entrada.agenteSlug)
  const credencial =
    entrada.modo === "texto"
      ? { signed_url: await pedirUrlFirmada(interlocutor.agent_id) }
      : { token: await pedirToken(interlocutor.agent_id) }
  pendientes.set(llave(usuario.id, entrada.agenteSlug), {
    vence: Date.now() + VIGENCIA_MS,
    modo: entrada.modo,
    variables,
  })
  return { modo: entrada.modo, ...credencial, variables, usuario_id: usuario.id }
}

async function fichaPropia(
  conversationId: string,
  usuarioId: string,
  agentId: string,
  reintentar: boolean,
): Promise<FichaConversacion> {
  let ficha = await traerConversacion(conversationId)
  if (!ficha && reintentar) {
    await new Promise((resolver) => setTimeout(resolver, 1000))
    ficha = await traerConversacion(conversationId)
  }
  if (!ficha || !duenoCoincide(ficha.dueno, usuarioId, agentId)) {
    throw new ErrorHttp(404, "No encontramos esa conversación.")
  }
  return ficha
}

export async function registrarConversacion(
  usuario: SesionUsuario,
  entrada: { conversationId: string; agenteSlug: string; modo: Modo },
): Promise<{ id: string }> {
  const equipo = exigirEquipo(usuario)
  const id = validarIdConversacion(entrada.conversationId)
  const interlocutor = interlocutorPorSlug(entrada.agenteSlug)
  if (!interlocutor) throw new ErrorHttp(404, "No encontramos ese interlocutor.")
  const pendiente = pendientes.get(llave(usuario.id, entrada.agenteSlug))
  if (!pendiente || pendiente.vence <= Date.now() || pendiente.modo !== entrada.modo) {
    throw new ErrorHttp(404, "No encontramos esa conversación.")
  }
  const variables = pendiente.variables
  await fichaPropia(id, usuario.id, interlocutor.agent_id, true)
  try {
    await db().conversacion.create({
      data: {
        id,
        equipoId: equipo.equipoId,
        usuarioId: usuario.id,
        agenteSlug: entrada.agenteSlug,
        modulo: variables.modulo,
        imprevistosActivos: variables.imprevistos_activos,
        resumenPrevioEnviado: variables.resumen_previo,
        modo: entrada.modo,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ErrorHttp(409, "Esa conversación ya está registrada.")
    }
    registrarFalloDeDatos(error, "registrar-conversacion")
    throw new ErrorHttp(500, "No se pudo guardar la conversación.")
  }
  pendientes.delete(llave(usuario.id, entrada.agenteSlug))
  return { id }
}

export async function listarDelEquipo(usuario: SesionUsuario, page: number, pageSize: number): Promise<ListaConversaciones> {
  if (!usuario.equipoId) return { items: [], ...metaPagina(0, page, pageSize) }
  const where = { equipoId: usuario.equipoId }
  const total = await db().conversacion.count({ where })
  const filas = await db().conversacion.findMany({
    where,
    orderBy: { iniciadaAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: { usuario: { select: { nombre: true } } },
  })
  return {
    items: filas.map((fila) => ({
      id: fila.id,
      iniciada_at: fila.iniciadaAt.toISOString(),
      agente_slug: fila.agenteSlug,
      agente_nombre: nombreAgente(fila.agenteSlug),
      conductor: fila.usuario.nombre,
      modo: fila.modo,
      modulo: fila.modulo,
    })),
    ...metaPagina(total, page, pageSize),
  }
}

export async function listarTodas(page: number, pageSize: number): Promise<ListaConversaciones> {
  const where = { equipo: { deletedAt: null } }
  const total = await db().conversacion.count({ where })
  const filas = await db().conversacion.findMany({
    where,
    orderBy: { iniciadaAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      usuario: { select: { nombre: true } },
      equipo: { select: { slug: true, nombre: true } },
    },
  })
  return {
    items: filas.map((fila) => ({
      id: fila.id,
      iniciada_at: fila.iniciadaAt.toISOString(),
      agente_slug: fila.agenteSlug,
      agente_nombre: nombreAgente(fila.agenteSlug),
      conductor: fila.usuario.nombre,
      modo: fila.modo,
      modulo: fila.modulo,
      equipo_slug: fila.equipo.slug,
      equipo_nombre: fila.equipo.nombre,
    })),
    ...metaPagina(total, page, pageSize),
  }
}

export async function leerTranscripcion(usuario: SesionUsuario, conversationId: string): Promise<Transcripcion> {
  const id = validarIdConversacion(conversationId)
  if (!permitir(`lectura:${usuario.id}`, 60, 60_000)) {
    throw new ErrorHttp(429, "Demasiadas lecturas seguidas. Espera un momento.")
  }
  const fila = await db().conversacion.findUnique({
    where: { id },
    include: {
      usuario: { select: { nombre: true } },
      equipo: { select: { nombre: true } },
    },
  })
  if (!fila || !puedeVerConversacion(usuario, fila)) {
    throw new ErrorHttp(404, "No encontramos esa conversación.")
  }
  const interlocutor = interlocutorPorSlug(fila.agenteSlug)
  if (!interlocutor) throw new ErrorHttp(404, "No encontramos esa conversación.")
  const ficha = await fichaPropia(id, fila.usuarioId, interlocutor.agent_id, false)
  return {
    id: fila.id,
    iniciada_at: fila.iniciadaAt.toISOString(),
    agente_slug: fila.agenteSlug,
    agente_nombre: nombreAgente(fila.agenteSlug),
    conductor: fila.usuario.nombre,
    equipo: fila.equipo.nombre,
    modo: fila.modo,
    modulo: fila.modulo,
    mensajes: ficha.mensajes,
  }
}

export async function cerrarConversacion(usuario: SesionUsuario, conversationId: string): Promise<{ guardado: boolean }> {
  const id = validarIdConversacion(conversationId)
  const fila = await db().conversacion.findUnique({ where: { id } })
  if (!fila || !puedeVerConversacion(usuario, fila)) {
    throw new ErrorHttp(404, "No encontramos esa conversación.")
  }
  const interlocutor = interlocutorPorSlug(fila.agenteSlug)
  if (!interlocutor) throw new ErrorHttp(404, "No encontramos esa conversación.")
  const posterior = await db().conversacion.findFirst({
    where: {
      equipoId: fila.equipoId,
      agenteSlug: fila.agenteSlug,
      iniciadaAt: { gt: fila.iniciadaAt },
    },
    select: { id: true },
  })
  if (posterior) return { guardado: true }
  await fichaPropia(id, fila.usuarioId, interlocutor.agent_id, false)
  try {
    const texto = await pedirResumen(id)
    if (!texto) return { guardado: false }
    await db().resumenConversacion.upsert({
      where: { equipoId_agenteSlug: { equipoId: fila.equipoId, agenteSlug: fila.agenteSlug } },
      create: { equipoId: fila.equipoId, agenteSlug: fila.agenteSlug, texto, conversationId: id },
      update: { texto, conversationId: id },
    })
    return { guardado: true }
  } catch (error) {
    log.warn({ detalle: detalleSeguro(error) }, "no se guardo el resumen")
    return { guardado: false }
  }
}
