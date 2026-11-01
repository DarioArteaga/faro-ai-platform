import { Prisma } from "@prisma/client"

import {
  destinoDeConversacion,
  duenoCoincide,
  puedeIniciarConversacion,
  puedePedirTokenDeVoz,
  puedeVerConversacion,
  type SesionUsuario,
} from "@/lib/autorizacion"
import { interlocutorPorSlug, leerImprevistos, type Caso, type Interlocutor } from "@/lib/catalogo"
import { controlarVariables, type InicioRecibido } from "@/lib/control-variables"
import { db, registrarFalloDeDatos } from "@/lib/db"
import { detalleSeguro } from "@/lib/enmascarar"
import { ErrorHttp } from "@/lib/errores"
import { pedirResumen, pedirToken, pedirUrlFirmada, traerConversacion, type FichaConversacion, type MensajeVisible } from "@/lib/elevenlabs"
import { SLUG_AGENTE_EQUIPO } from "@/lib/constantes"
import { clavesDelCaso } from "@/lib/imprevistos"
import { log } from "@/lib/log"
import { permitir } from "@/lib/limite"
import { metaPagina, type MetaPagina } from "@/lib/paginacion"
import { validarIdConversacion } from "@/lib/validar"
import { armarVariables, type VariablesConversacion } from "@/lib/variables"
import { agenteParaSala, mensajeDeTope, variablesDeSala } from "@/servicios/agentes"
import { obtenerModulo, obtenerVozHabilitada } from "@/servicios/cohorte"
import { asegurarEquipoDemo } from "@/servicios/instructor"

type Modo = "texto" | "voz"

type Pendiente = {
  vence: number
  modo: Modo
  variables: VariablesConversacion
  agenteEquipo?: { versionId: string; agentId: string; equipoId: string }
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
  control_variables?: string
  claves_alteradas?: string | null
  version_numero?: number | null
}

export type ListaConversaciones = MetaPagina & { items: ItemConversacion[] }

export type Transcripcion = ItemConversacion & {
  equipo: string
  mensajes: MensajeVisible[]
}

function llave(usuarioId: string, agenteSlug: string, equipoId?: string): string {
  return equipoId ? `${usuarioId}:${agenteSlug}:${equipoId}` : `${usuarioId}:${agenteSlug}`
}

function nombreVisible(slug: string, nombreDelEquipo: string | null | undefined): string {
  if (slug === SLUG_AGENTE_EQUIPO && nombreDelEquipo) return nombreDelEquipo
  return nombreAgente(slug)
}

function nombreAgente(slug: string): string {
  const hallado = interlocutorPorSlug(slug)
  if (!hallado) return slug
  if (hallado.caso.audiencia === "instructor") return `${hallado.interlocutor.nombre} · ${hallado.caso.nombre}`
  return hallado.interlocutor.nombre
}

function agentIdDeFila(fila: {
  agenteSlug: string
  versionAgente: { agente: { agentId: string } } | null
}): string {
  if (fila.agenteSlug === SLUG_AGENTE_EQUIPO) {
    const agentId = fila.versionAgente?.agente.agentId
    if (!agentId) throw new ErrorHttp(404, "No encontramos esa conversación.")
    return agentId
  }
  const hallado = interlocutorPorSlug(fila.agenteSlug)
  if (!hallado) throw new ErrorHttp(404, "No encontramos esa conversación.")
  return hallado.interlocutor.agent_id
}

function exigirCasoActivo(slug: string): { caso: Caso; interlocutor: Interlocutor } {
  const hallado = interlocutorPorSlug(slug)
  if (!hallado || !hallado.caso.activo) throw new ErrorHttp(404, "No encontramos ese interlocutor.")
  return hallado
}

async function exigirEquipo(
  usuario: SesionUsuario,
  caso: Caso,
): Promise<{ equipoId: string; equipoNombre: string }> {
  const destino = destinoDeConversacion(usuario, caso.audiencia)
  if (destino === 401) throw new ErrorHttp(401, "Tienes que entrar para continuar.")
  if (destino === 403) {
    throw new ErrorHttp(
      403,
      caso.audiencia === "instructor" ? "No puedes conversar con ese interlocutor." : "Tu cuenta no tiene equipo.",
    )
  }
  if (destino.tipo === "demo") {
    const demo = await asegurarEquipoDemo()
    return { equipoId: demo.id, equipoNombre: destino.equipoNombre }
  }
  return { equipoId: destino.equipoId, equipoNombre: destino.equipoNombre }
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

async function variablesPara(
  usuario: SesionUsuario,
  caso: Caso,
  agenteSlug: string,
): Promise<{ equipoId: string; variables: VariablesConversacion }> {
  const equipo = await exigirEquipo(usuario, caso)
  await intentarResumen(equipo.equipoId, agenteSlug)
  const [modulo, activas, resumen] = await Promise.all([
    obtenerModulo(),
    db().activacionImprevisto.findMany({ where: { equipoId: equipo.equipoId }, select: { clave: true } }),
    db().resumenConversacion.findUnique({
      where: { equipoId_agenteSlug: { equipoId: equipo.equipoId, agenteSlug } },
    }),
  ])
  const catalogo = leerImprevistos()
  return {
    equipoId: equipo.equipoId,
    variables: armarVariables({
      modulo,
      equipo: equipo.equipoNombre,
      claves: clavesDelCaso(
        activas.map((fila) => fila.clave),
        catalogo.orden,
        catalogo.porClave,
        caso.caso,
      ),
      resumen: resumen?.texto,
    }),
  }
}

function emitidasDeFila(fila: {
  modulo: string
  equipoEnviado: string | null
  imprevistosActivos: string
  resumenPrevioEnviado: string
  modo: string
}): { variables: VariablesConversacion; modo: Modo } {
  return {
    variables: {
      modulo: fila.modulo,
      equipo: fila.equipoEnviado ?? "",
      imprevistos_activos: fila.imprevistosActivos,
      resumen_previo: fila.resumenPrevioEnviado,
    },
    modo: fila.modo === "voz" ? "voz" : "texto",
  }
}

async function guardarControl(
  id: string,
  variables: VariablesConversacion,
  modo: Modo,
  inicio: InicioRecibido | null,
): Promise<void> {
  const resultado = controlarVariables(variables, modo, inicio)
  if (resultado.control === "pendiente") return
  try {
    await db().conversacion.update({
      where: { id },
      data: { controlVariables: resultado.control, clavesAlteradas: resultado.claves },
    })
  } catch (error) {
    log.warn({ detalle: detalleSeguro(error) }, "no se guardo el control de variables")
  }
}

async function iniciarSalaDeEquipo(
  usuario: SesionUsuario,
  entrada: { modo: Modo; equipoSlug?: string | null },
): Promise<{ modo: Modo; signed_url?: string; token?: string; variables: VariablesConversacion; usuario_id: string }> {
  if (!permitir(`sesion:${usuario.id}`, 20, 10 * 60 * 1000)) {
    throw new ErrorHttp(429, "Demasiadas conversaciones seguidas. Espera un momento.")
  }
  const sala = await agenteParaSala(usuario, entrada.equipoSlug ?? null)
  if (entrada.modo === "voz" && !sala.vozHabilitada) {
    throw new ErrorHttp(403, "La voz no está habilitada para este equipo.")
  }
  const bloqueo = mensajeDeTope(entrada.modo, sala)
  if (bloqueo) throw new ErrorHttp(403, bloqueo)
  await intentarResumen(sala.equipoId, SLUG_AGENTE_EQUIPO)
  const variables = await variablesDeSala(sala.equipoId, sala.equipoNombre)
  const credencial =
    entrada.modo === "texto"
      ? { signed_url: await pedirUrlFirmada(sala.agentId) }
      : { token: await pedirToken(sala.agentId) }
  pendientes.set(llave(usuario.id, SLUG_AGENTE_EQUIPO, sala.equipoId), {
    vence: Date.now() + VIGENCIA_MS,
    modo: entrada.modo,
    variables,
    agenteEquipo: { versionId: sala.versionId, agentId: sala.agentId, equipoId: sala.equipoId },
  })
  return { modo: entrada.modo, ...credencial, variables, usuario_id: usuario.id }
}

export async function iniciarSesion(
  usuario: SesionUsuario,
  entrada: { agenteSlug: string; modo: Modo; equipoSlug?: string | null },
): Promise<{ modo: Modo; signed_url?: string; token?: string; variables: VariablesConversacion; usuario_id: string }> {
  if (entrada.agenteSlug === SLUG_AGENTE_EQUIPO) return iniciarSalaDeEquipo(usuario, entrada)
  const { caso, interlocutor } = exigirCasoActivo(entrada.agenteSlug)
  const codigo = puedeIniciarConversacion(usuario, caso.audiencia)
  if (codigo === 403) {
    throw new ErrorHttp(
      403,
      caso.audiencia === "instructor" ? "No puedes conversar con ese interlocutor." : "Tu cuenta no tiene equipo.",
    )
  }
  if (!permitir(`sesion:${usuario.id}`, 20, 10 * 60 * 1000)) {
    throw new ErrorHttp(429, "Demasiadas conversaciones seguidas. Espera un momento.")
  }
  if (entrada.modo === "voz" && !puedePedirTokenDeVoz(usuario.rol, await obtenerVozHabilitada())) {
    throw new ErrorHttp(403, "La voz no está habilitada.")
  }
  const { variables } = await variablesPara(usuario, caso, entrada.agenteSlug)
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

async function registrarSalaDeEquipo(
  usuario: SesionUsuario,
  entrada: { conversationId: string; modo: Modo; equipoSlug?: string | null },
): Promise<{ id: string }> {
  const sala = await agenteParaSala(usuario, entrada.equipoSlug ?? null)
  const clave = llave(usuario.id, SLUG_AGENTE_EQUIPO, sala.equipoId)
  const pendiente = pendientes.get(clave)
  if (
    !pendiente ||
    pendiente.vence <= Date.now() ||
    pendiente.modo !== entrada.modo ||
    !pendiente.agenteEquipo ||
    pendiente.agenteEquipo.agentId !== sala.agentId
  ) {
    throw new ErrorHttp(404, "No encontramos esa conversación.")
  }
  const id = validarIdConversacion(entrada.conversationId)
  const ficha = await fichaPropia(id, usuario.id, sala.agentId, true)
  const control = controlarVariables(pendiente.variables, entrada.modo, ficha.inicio)
  try {
    await db().conversacion.create({
      data: {
        id,
        equipoId: sala.equipoId,
        usuarioId: usuario.id,
        agenteSlug: SLUG_AGENTE_EQUIPO,
        modulo: pendiente.variables.modulo,
        imprevistosActivos: pendiente.variables.imprevistos_activos,
        resumenPrevioEnviado: pendiente.variables.resumen_previo,
        modo: entrada.modo,
        equipoEnviado: pendiente.variables.equipo,
        controlVariables: control.control,
        clavesAlteradas: control.claves,
        versionAgenteId: pendiente.agenteEquipo.versionId,
        duracionSegundos: ficha.duracionSegundos,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ErrorHttp(409, "Esa conversación ya está registrada.")
    }
    registrarFalloDeDatos(error, "registrar-conversacion-equipo")
    throw new ErrorHttp(500, "No se pudo guardar la conversación.")
  }
  pendientes.delete(clave)
  return { id }
}

export async function registrarConversacion(
  usuario: SesionUsuario,
  entrada: { conversationId: string; agenteSlug: string; modo: Modo; equipoSlug?: string | null },
): Promise<{ id: string }> {
  if (entrada.agenteSlug === SLUG_AGENTE_EQUIPO) return registrarSalaDeEquipo(usuario, entrada)
  const { caso, interlocutor } = exigirCasoActivo(entrada.agenteSlug)
  const equipo = await exigirEquipo(usuario, caso)
  const id = validarIdConversacion(entrada.conversationId)
  const pendiente = pendientes.get(llave(usuario.id, entrada.agenteSlug))
  if (!pendiente || pendiente.vence <= Date.now() || pendiente.modo !== entrada.modo) {
    throw new ErrorHttp(404, "No encontramos esa conversación.")
  }
  const variables = pendiente.variables
  const ficha = await fichaPropia(id, usuario.id, interlocutor.agent_id, true)
  const control = controlarVariables(variables, entrada.modo, ficha.inicio)
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
        equipoEnviado: variables.equipo,
        controlVariables: control.control,
        clavesAlteradas: control.claves,
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
    include: {
      usuario: { select: { nombre: true } },
      versionAgente: { select: { numero: true, agente: { select: { nombre: true } } } },
    },
  })
  return {
    items: filas.map((fila) => ({
      id: fila.id,
      iniciada_at: fila.iniciadaAt.toISOString(),
      agente_slug: fila.agenteSlug,
      agente_nombre: nombreVisible(fila.agenteSlug, fila.versionAgente?.agente.nombre),
      conductor: fila.usuario.nombre,
      modo: fila.modo,
      modulo: fila.modulo,
      version_numero: fila.versionAgente?.numero ?? null,
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
      versionAgente: { select: { numero: true, agente: { select: { nombre: true } } } },
    },
  })
  return {
    items: filas.map((fila) => ({
      id: fila.id,
      iniciada_at: fila.iniciadaAt.toISOString(),
      agente_slug: fila.agenteSlug,
      agente_nombre: nombreVisible(fila.agenteSlug, fila.versionAgente?.agente.nombre),
      conductor: fila.usuario.nombre,
      modo: fila.modo,
      modulo: fila.modulo,
      equipo_slug: fila.equipo.slug,
      equipo_nombre: fila.equipo.nombre,
      control_variables: fila.controlVariables,
      claves_alteradas: fila.clavesAlteradas,
      version_numero: fila.versionAgente?.numero ?? null,
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
      versionAgente: { select: { numero: true, agente: { select: { nombre: true, agentId: true } } } },
    },
  })
  if (!fila || !puedeVerConversacion(usuario, fila)) {
    throw new ErrorHttp(404, "No encontramos esa conversación.")
  }
  const agentId = agentIdDeFila(fila)
  const ficha = await fichaPropia(id, fila.usuarioId, agentId, false)
  return {
    id: fila.id,
    iniciada_at: fila.iniciadaAt.toISOString(),
    agente_slug: fila.agenteSlug,
    agente_nombre: nombreVisible(fila.agenteSlug, fila.versionAgente?.agente.nombre),
    version_numero: fila.versionAgente?.numero ?? null,
    conductor: fila.usuario.nombre,
    equipo: fila.equipo.nombre,
    modo: fila.modo,
    modulo: fila.modulo,
    mensajes: ficha.mensajes,
  }
}

export async function cerrarConversacion(usuario: SesionUsuario, conversationId: string): Promise<{ guardado: boolean }> {
  const id = validarIdConversacion(conversationId)
  const fila = await db().conversacion.findUnique({
    where: { id },
    include: { versionAgente: { select: { agente: { select: { agentId: true } } } } },
  })
  if (!fila || !puedeVerConversacion(usuario, fila)) {
    throw new ErrorHttp(404, "No encontramos esa conversación.")
  }
  const agentId = agentIdDeFila(fila)
  const posterior = await db().conversacion.findFirst({
    where: {
      equipoId: fila.equipoId,
      agenteSlug: fila.agenteSlug,
      iniciadaAt: { gt: fila.iniciadaAt },
    },
    select: { id: true },
  })
  const debeLeerFicha = !posterior || fila.controlVariables === "pendiente"
  let ficha: FichaConversacion | null = null
  if (debeLeerFicha) {
    try {
      ficha = await fichaPropia(id, fila.usuarioId, agentId, false)
    } catch (error) {
      if (!posterior) throw error
      log.warn({ detalle: detalleSeguro(error) }, "no se pudo comprobar la conversacion")
    }
  }
  if (ficha && fila.controlVariables === "pendiente") {
    const emitidas = emitidasDeFila(fila)
    await guardarControl(id, emitidas.variables, emitidas.modo, ficha.inicio)
  }
  if (ficha?.duracionSegundos != null && ficha.duracionSegundos !== fila.duracionSegundos) {
    try {
      await db().conversacion.update({ where: { id }, data: { duracionSegundos: ficha.duracionSegundos } })
    } catch (error) {
      log.warn({ detalle: detalleSeguro(error) }, "no se guardo la duracion")
    }
  }
  if (posterior) return { guardado: true }
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
