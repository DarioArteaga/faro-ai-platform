import { randomBytes } from "node:crypto"

import { Prisma } from "@prisma/client"

import { cifrarSecreto, descifrarSecreto } from "@/lib/cifrado-secreto"
import { cuerpoDeAgente, cuerpoDeTool, valoresDePrueba } from "@/lib/cuerpo-agente"
import { casoActivo, idsDeInterlocutores } from "@/lib/catalogo"
import {
  bloqueoDeTope,
  entradaDesdeSnapshot,
  leerConstructor,
  opcionesPublicas,
  snapshotDe,
  validarConfiguracion,
  type CatalogoConstructor,
  type ConfigEntrada,
  type ParametroTool,
  type SnapshotAgente,
} from "@/lib/constructor"
import { SLUG_AGENTE_EQUIPO, SLUG_EQUIPO_DEMO } from "@/lib/constantes"
import { db, registrarFalloDeDatos } from "@/lib/db"
import { detalleSeguro, ocultarSecreto } from "@/lib/enmascarar"
import {
  actualizarAgenteEleven,
  actualizarToolEleven,
  borrarAgenteEleven,
  borrarSecretoEleven,
  correrSimulacionEleven,
  crearAgenteEleven,
  crearSecretoEleven,
  crearSimulacionEleven,
  crearToolEleven,
} from "@/lib/elevenlabs"
import { ErrorHttp } from "@/lib/errores"
import { clavesDelCaso } from "@/lib/imprevistos"
import { leerImprevistos } from "@/lib/catalogo"
import { log } from "@/lib/log"
import { permitir } from "@/lib/limite"
import { metaPagina, type MetaPagina } from "@/lib/paginacion"
import { comprobarUrlPublica } from "@/lib/url-publica"
import { armarVariables, type VariablesConversacion } from "@/lib/variables"
import type { SesionUsuario } from "@/lib/autorizacion"
import { obtenerModulo } from "@/servicios/cohorte"

type Tope = {
  conversacionesTexto: number
  simulaciones: number
  minutosVoz: number
  vozHabilitada: boolean
}

type Uso = { texto: number; simulaciones: number; segundosVoz: number }

function parametrosDesde(valor: Prisma.JsonValue | null): ParametroTool[] {
  if (!Array.isArray(valor)) return []
  const lista: ParametroTool[] = []
  for (const item of valor) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const fila = item as Record<string, unknown>
    if (fila.tipo !== "string" && fila.tipo !== "number" && fila.tipo !== "boolean") continue
    if (typeof fila.nombre !== "string" || typeof fila.descripcion !== "string" || typeof fila.ejemplo !== "string") continue
    lista.push({ nombre: fila.nombre, tipo: fila.tipo, descripcion: fila.descripcion, ejemplo: fila.ejemplo })
  }
  return lista
}

function nombreTool(equipoSlug: string): string {
  return `consultar_${equipoSlug.replace(/-/g, "_")}`.slice(0, 48)
}

async function usoDe(equipoId: string, agenteId: string): Promise<Uso> {
  const [texto, simulaciones, voz] = await Promise.all([
    db().conversacion.count({ where: { equipoId, agenteSlug: SLUG_AGENTE_EQUIPO, modo: "texto" } }),
    db().simulacion.count({ where: { agenteId } }),
    db().conversacion.aggregate({
      where: { equipoId, agenteSlug: SLUG_AGENTE_EQUIPO, modo: "voz" },
      _sum: { duracionSegundos: true },
    }),
  ])
  return { texto, simulaciones, segundosVoz: voz._sum.duracionSegundos ?? 0 }
}

async function equipoPropio(usuario: SesionUsuario): Promise<{ id: string; slug: string; nombre: string }> {
  if (!usuario.equipoId || !usuario.equipoSlug || !usuario.equipoNombre) {
    throw new ErrorHttp(403, "Tu cuenta no tiene equipo.")
  }
  return { id: usuario.equipoId, slug: usuario.equipoSlug, nombre: usuario.equipoNombre }
}

async function publicarTool(
  catalogo: CatalogoConstructor,
  equipoSlug: string,
  entrada: ConfigEntrada,
  previo: { toolId: string | null; secretId: string | null },
): Promise<{ toolId: string | null; secretId: string | null }> {
  if (!entrada.tool) return { toolId: null, secretId: previo.secretId }
  await comprobarUrlPublica(entrada.tool.url)
  let secretId = previo.secretId
  let secretoNuevo: string | null = null
  if (entrada.tool.secreto) {
    secretoNuevo = await crearSecretoEleven(
      `m2_${equipoSlug.replace(/-/g, "_")}_${randomBytes(4).toString("hex")}`.slice(0, 64),
      entrada.tool.secreto,
    )
    secretId = secretoNuevo
  }
  if (!secretId) throw new ErrorHttp(400, "Escribe el secreto de la tool.")
  const cuerpo = cuerpoDeTool(catalogo, nombreTool(equipoSlug), entrada, secretId)
  const toolId = previo.toolId
    ? previo.toolId
    : await crearToolEleven(cuerpo)
  if (previo.toolId) await actualizarToolEleven(previo.toolId, cuerpo)
  if (secretoNuevo && previo.secretId && previo.secretId !== secretoNuevo) {
    try {
      await borrarSecretoEleven(previo.secretId)
    } catch (error) {
      log.warn({ detalle: detalleSeguro(error) }, "no se pudo retirar el secreto anterior")
    }
  }
  return { toolId, secretId }
}

function cifradoDeTool(entrada: ConfigEntrada, previo: string | null, secretId: string | null): string | null {
  if (entrada.tool?.secreto) return cifrarSecreto(entrada.tool.secreto)
  if (!entrada.tool && !secretId) return null
  return previo
}

async function guardarVersion(
  agenteId: string,
  usuarioId: string,
  snapshot: SnapshotAgente,
  origenNumero: number | null,
  tool: { toolId: string | null; secretId: string | null; cifrado: string | null; entrada: ConfigEntrada },
): Promise<string> {
  return db().$transaction(async (tx) => {
    const ultima = await tx.versionAgente.aggregate({ where: { agenteId }, _max: { numero: true } })
    const numero = (ultima._max.numero ?? 0) + 1
    const version = await tx.versionAgente.create({
      data: {
        agenteId,
        numero,
        usuarioId,
        origenNumero,
        snapshot: snapshot as Prisma.InputJsonValue,
      },
    })
    await tx.agenteEquipo.update({
      where: { id: agenteId },
      data: {
        nombre: tool.entrada.nombre,
        prompt: tool.entrada.prompt,
        primerMensaje: tool.entrada.primerMensaje,
        vozSlug: tool.entrada.voz.slug,
        modeloSlug: tool.entrada.modelo.slug,
        toolId: tool.toolId,
        secretId: tool.secretId,
        toolSecretoCifrado: tool.cifrado,
        toolUrl: tool.entrada.tool?.url ?? null,
        toolMetodo: tool.entrada.tool?.metodo ?? null,
        toolDescripcion: tool.entrada.tool?.descripcion ?? null,
        toolParametros: tool.entrada.tool ? (tool.entrada.tool.parametros as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    })
    return version.id
  })
}

export async function crearAgenteDeEquipo(usuario: SesionUsuario, entrada: unknown): Promise<{ id: string }> {
  const equipo = await equipoPropio(usuario)
  if (!permitir(`crear-agente:${equipo.id}`, 5, 60 * 60 * 1000)) {
    throw new ErrorHttp(429, "Demasiados intentos. Espera un momento.")
  }
  const existente = await db().agenteEquipo.findUnique({ where: { equipoId: equipo.id } })
  if (existente && !existente.deletedAt) throw new ErrorHttp(409, "Este equipo ya tiene un agente.")
  const catalogo = leerConstructor()
  const config = validarConfiguracion(catalogo, entrada)
  const cifrado = cifradoDeTool(config, null, null)
  const publicado = await publicarTool(catalogo, equipo.slug, config, { toolId: null, secretId: null })
  const cuerpo = cuerpoDeAgente(catalogo, config, publicado.toolId ? [publicado.toolId] : [])
  const agentId = await crearAgenteEleven(cuerpo)
  if (idsDeInterlocutores().includes(agentId)) {
    throw new ErrorHttp(500, "No se pudo guardar el agente.")
  }
  const snapshot = snapshotDe(config, Boolean(publicado.secretId))
  try {
    const fila = await db().$transaction(async (tx) => {
      const agente = await tx.agenteEquipo.create({
        data: {
          equipoId: equipo.id,
          agentId,
          nombre: config.nombre,
          prompt: config.prompt,
          primerMensaje: config.primerMensaje,
          vozSlug: config.voz.slug,
          modeloSlug: config.modelo.slug,
          toolId: publicado.toolId,
          secretId: publicado.secretId,
          toolSecretoCifrado: cifrado,
          toolUrl: config.tool?.url ?? null,
          toolMetodo: config.tool?.metodo ?? null,
          toolDescripcion: config.tool?.descripcion ?? null,
          toolParametros: config.tool ? (config.tool.parametros as Prisma.InputJsonValue) : Prisma.DbNull,
        },
      })
      await tx.versionAgente.create({
        data: { agenteId: agente.id, numero: 1, usuarioId: usuario.id, snapshot: snapshot as Prisma.InputJsonValue },
      })
      await tx.topeEquipo.upsert({
        where: { equipoId: equipo.id },
        create: {
          equipoId: equipo.id,
          conversacionesTexto: catalogo.topes.conversaciones_texto,
          simulaciones: catalogo.topes.simulaciones,
          minutosVoz: catalogo.topes.minutos_voz,
        },
        update: {},
      })
      return agente
    })
    return { id: fila.id }
  } catch (error) {
    try {
      await borrarAgenteEleven(agentId)
    } catch (borrado) {
      log.error({ detalle: detalleSeguro(borrado) }, "quedo un agente de equipo sin fila")
    }
    registrarFalloDeDatos(error, "crear-agente-equipo")
    throw new ErrorHttp(500, "No se pudo guardar el agente.")
  }
}

export async function guardarAgenteDeEquipo(usuario: SesionUsuario, entrada: unknown): Promise<{ id: string }> {
  const equipo = await equipoPropio(usuario)
  const agente = await db().agenteEquipo.findUnique({ where: { equipoId: equipo.id } })
  if (!agente || agente.deletedAt) throw new ErrorHttp(404, "Este equipo todavía no tiene agente.")
  if (agente.archivadoAt) throw new ErrorHttp(409, "Este agente está archivado.")
  const catalogo = leerConstructor()
  const config = validarConfiguracion(catalogo, entrada)
  const cifrado = cifradoDeTool(config, agente.toolSecretoCifrado, agente.secretId)
  const publicado = await publicarTool(catalogo, equipo.slug, config, {
    toolId: agente.toolId,
    secretId: agente.secretId,
  })
  await actualizarAgenteEleven(
    agente.agentId,
    cuerpoDeAgente(catalogo, config, publicado.toolId ? [publicado.toolId] : []),
  )
  try {
    await guardarVersion(agente.id, usuario.id, snapshotDe(config, Boolean(publicado.secretId)), null, {
      toolId: publicado.toolId,
      secretId: publicado.secretId,
      cifrado,
      entrada: config,
    })
  } catch (error) {
    registrarFalloDeDatos(error, "guardar-agente-equipo")
    throw new ErrorHttp(500, "No se pudo guardar el agente.")
  }
  return { id: agente.id }
}

export async function restaurarVersion(usuario: SesionUsuario, versionId: string): Promise<{ id: string }> {
  const equipo = await equipoPropio(usuario)
  const version = await db().versionAgente.findUnique({
    where: { id: versionId },
    include: { agente: true },
  })
  if (!version || version.agente.equipoId !== equipo.id || version.agente.deletedAt) {
    throw new ErrorHttp(404, "No encontramos esa versión.")
  }
  if (version.agente.archivadoAt) throw new ErrorHttp(409, "Este agente está archivado.")
  const catalogo = leerConstructor()
  const config = entradaDesdeSnapshot(catalogo, version.snapshot)
  const cifrado = cifradoDeTool(config, version.agente.toolSecretoCifrado, version.agente.secretId)
  const publicado = await publicarTool(catalogo, equipo.slug, config, {
    toolId: version.agente.toolId,
    secretId: version.agente.secretId,
  })
  await actualizarAgenteEleven(
    version.agente.agentId,
    cuerpoDeAgente(catalogo, config, publicado.toolId ? [publicado.toolId] : []),
  )
  try {
    await guardarVersion(version.agente.id, usuario.id, snapshotDe(config, Boolean(publicado.secretId)), version.numero, {
      toolId: publicado.toolId,
      secretId: publicado.secretId,
      cifrado,
      entrada: config,
    })
  } catch (error) {
    registrarFalloDeDatos(error, "restaurar-version")
    throw new ErrorHttp(500, "No se pudo guardar el agente.")
  }
  return { id: version.agente.id }
}

export type VistaAgente = {
  caso: string
  voces: { slug: string; nombre: string; detalle: string }[]
  modelos: { slug: string; nombre: string }[]
  limites: { prompt: number; nombre: number; primer_mensaje: number; parametros: number }
  agente: null | {
    id: string
    nombre: string
    prompt: string
    primer_mensaje: string
    voz_slug: string
    modelo_slug: string
    archivado: boolean
    actualizado_at: string
    tool: null | (NonNullable<SnapshotAgente["tool"]> & { secreto_en_servidor: boolean })
    versiones: { id: string; numero: number; autor: string; guardado_at: string; origen_numero: number | null }[]
    topes: Tope
    uso: Uso
  }
  simulaciones: {
    id: string
    escenario: string
    criterio: string
    resultado: string
    razon: string
    creada_at: string
    version: number
  }[]
  meta_versiones: MetaPagina
}

export async function vistaDelEquipo(
  usuario: SesionUsuario,
  page: number,
  pageSize: number,
  equipoSlug: string | null,
): Promise<VistaAgente> {
  const catalogo = leerConstructor()
  const opciones = opcionesPublicas(catalogo)
  const caso = casoActivo()
  const limites = {
    prompt: catalogo.prompt_max,
    nombre: catalogo.nombre_max,
    primer_mensaje: catalogo.primer_mensaje_max,
    parametros: catalogo.parametros_max,
  }
  let equipoId = usuario.equipoId
  if (equipoSlug && equipoSlug !== usuario.equipoSlug) {
    if (usuario.rol !== "instructor") throw new ErrorHttp(404, "No encontramos ese agente.")
    const equipo = await db().equipo.findFirst({ where: { slug: equipoSlug, deletedAt: null } })
    if (!equipo || equipo.slug === SLUG_EQUIPO_DEMO) throw new ErrorHttp(404, "No encontramos ese agente.")
    equipoId = equipo.id
  }
  if (!equipoId) {
    return {
      caso: caso.nombre,
      ...opciones,
      limites,
      agente: null,
      simulaciones: [],
      meta_versiones: metaPagina(0, page, pageSize),
    }
  }
  const agente = await db().agenteEquipo.findUnique({ where: { equipoId } })
  if (!agente || agente.deletedAt) {
    return {
      caso: caso.nombre,
      ...opciones,
      limites,
      agente: null,
      simulaciones: [],
      meta_versiones: metaPagina(0, page, pageSize),
    }
  }
  const donde = { agenteId: agente.id }
  const [total, versiones, simulaciones, tope, uso] = await Promise.all([
    db().versionAgente.count({ where: donde }),
    db().versionAgente.findMany({
      where: donde,
      orderBy: { numero: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { usuario: { select: { nombre: true } } },
    }),
    db().simulacion.findMany({
      where: donde,
      orderBy: { creadaAt: "desc" },
      take: 20,
      include: { version: { select: { numero: true } } },
    }),
    db().topeEquipo.findUnique({ where: { equipoId } }),
    usoDe(equipoId, agente.id),
  ])
  const tool = agente.toolUrl
    ? {
        url: agente.toolUrl,
        metodo: agente.toolMetodo === "GET" ? "GET" as const : "POST" as const,
        descripcion: agente.toolDescripcion ?? "",
        parametros: parametrosDesde(agente.toolParametros),
        tiene_secreto: Boolean(agente.secretId),
        secreto_en_servidor: Boolean(agente.toolSecretoCifrado),
      }
    : null
  return {
    caso: caso.nombre,
    ...opciones,
    limites,
    agente: {
      id: agente.id,
      nombre: agente.nombre,
      prompt: agente.prompt,
      primer_mensaje: agente.primerMensaje,
      voz_slug: agente.vozSlug,
      modelo_slug: agente.modeloSlug,
      archivado: Boolean(agente.archivadoAt),
      actualizado_at: agente.updatedAt.toISOString(),
      tool,
      versiones: versiones.map((fila) => ({
        id: fila.id,
        numero: fila.numero,
        autor: fila.usuario.nombre,
        guardado_at: fila.guardadoAt.toISOString(),
        origen_numero: fila.origenNumero,
      })),
      topes: {
        conversacionesTexto: tope?.conversacionesTexto ?? catalogo.topes.conversaciones_texto,
        simulaciones: tope?.simulaciones ?? catalogo.topes.simulaciones,
        minutosVoz: tope?.minutosVoz ?? catalogo.topes.minutos_voz,
        vozHabilitada: tope?.vozHabilitada ?? false,
      },
      uso,
    },
    simulaciones: simulaciones.map((fila) => ({
      id: fila.id,
      escenario: fila.escenario,
      criterio: fila.criterio,
      resultado: fila.resultado,
      razon: fila.razon,
      creada_at: fila.creadaAt.toISOString(),
      version: fila.version.numero,
    })),
    meta_versiones: metaPagina(total, page, pageSize),
  }
}

export async function agenteParaSala(
  usuario: SesionUsuario,
  equipoSlug: string | null,
): Promise<{
  equipoId: string
  equipoNombre: string
  agentId: string
  versionId: string
  nombre: string
  vozHabilitada: boolean
  topes: Tope
  uso: Uso
}> {
  let equipoId = usuario.equipoId
  if (usuario.rol === "instructor" && equipoSlug) {
    const equipo = await db().equipo.findFirst({ where: { slug: equipoSlug, deletedAt: null } })
    if (!equipo) throw new ErrorHttp(404, "No encontramos ese equipo.")
    equipoId = equipo.id
  }
  if (!equipoId) throw new ErrorHttp(403, "Tu cuenta no tiene equipo.")
  const agente = await db().agenteEquipo.findUnique({
    where: { equipoId },
    include: { equipo: true, versiones: { orderBy: { numero: "desc" }, take: 1 } },
  })
  if (!agente || agente.deletedAt || agente.equipo.deletedAt) throw new ErrorHttp(404, "Este equipo todavía no tiene agente.")
  if (agente.archivadoAt) throw new ErrorHttp(409, "Este agente está archivado.")
  const version = agente.versiones[0]
  if (!version) throw new ErrorHttp(404, "Este equipo todavía no tiene agente.")
  if (usuario.rol === "estudiante" && usuario.equipoId !== agente.equipoId) {
    throw new ErrorHttp(404, "Este equipo todavía no tiene agente.")
  }
  const [tope, uso] = await Promise.all([
    db().topeEquipo.findUnique({ where: { equipoId } }),
    usoDe(equipoId, agente.id),
  ])
  const catalogo = leerConstructor()
  return {
    equipoId,
    equipoNombre: agente.equipo.nombre,
    agentId: agente.agentId,
    versionId: version.id,
    nombre: agente.nombre,
    vozHabilitada: tope?.vozHabilitada ?? false,
    topes: {
      conversacionesTexto: tope?.conversacionesTexto ?? catalogo.topes.conversaciones_texto,
      simulaciones: tope?.simulaciones ?? catalogo.topes.simulaciones,
      minutosVoz: tope?.minutosVoz ?? catalogo.topes.minutos_voz,
      vozHabilitada: tope?.vozHabilitada ?? false,
    },
    uso,
  }
}

export function mensajeDeTope(modo: "texto" | "voz", sala: { topes: Tope; uso: Uso }): string | null {
  return bloqueoDeTope(modo, sala.uso, sala.topes)
}

export async function variablesDeSala(equipoId: string, equipoNombre: string): Promise<VariablesConversacion> {
  const caso = casoActivo()
  const [modulo, activas, resumen] = await Promise.all([
    obtenerModulo(),
    db().activacionImprevisto.findMany({ where: { equipoId }, select: { clave: true } }),
    db().resumenConversacion.findUnique({
      where: { equipoId_agenteSlug: { equipoId, agenteSlug: SLUG_AGENTE_EQUIPO } },
    }),
  ])
  const catalogo = leerImprevistos()
  return armarVariables({
    modulo,
    equipo: equipoNombre,
    claves: clavesDelCaso(
      activas.map((fila) => fila.clave),
      catalogo.orden,
      catalogo.porClave,
      caso.caso,
    ),
    resumen: resumen?.texto,
  })
}

export async function probarTool(usuario: SesionUsuario, entrada: unknown): Promise<{ status: number; cuerpo: string; aviso: string }> {
  const equipo = await equipoPropio(usuario)
  if (!permitir(`probar-tool:${usuario.id}`, 10, 10 * 60 * 1000)) {
    throw new ErrorHttp(429, "Demasiadas pruebas. Espera un momento.")
  }
  const catalogo = leerConstructor()
  const config = validarConfiguracion(catalogo, entrada)
  if (!config.tool) throw new ErrorHttp(400, "Falta la tool.")
  const url = await comprobarUrlPublica(config.tool.url)
  const agente = await db().agenteEquipo.findUnique({ where: { equipoId: equipo.id } })
  let secreto = config.tool.secreto
  let aviso = "La prueba salió sin secreto."
  if (secreto) {
    aviso = "La prueba envió el secreto que escribiste. Para dejarlo cifrado, guárdalo con el agente."
  } else if (agente?.toolSecretoCifrado) {
    try {
      secreto = descifrarSecreto(agente.toolSecretoCifrado)
      aviso = "La prueba envió el secreto guardado. No salió al navegador."
    } catch (error) {
      log.warn({ detalle: detalleSeguro(error) }, "no se pudo leer el secreto de la tool")
      secreto = undefined
      aviso = "No se pudo leer el secreto guardado. Escríbelo otra vez."
    }
  } else if (agente?.secretId) {
    aviso = "La prueba salió sin el secreto. Escríbelo otra vez para guardarlo cifrado."
  }
  const valores = valoresDePrueba(config.tool.parametros)
  if (config.tool.metodo === "GET") {
    for (const [clave, valor] of Object.entries(valores)) url.searchParams.set(clave, String(valor))
  }
  const encabezados: Record<string, string> = {}
  if (secreto) encabezados[catalogo.encabezado_secreto] = secreto
  if (config.tool.metodo === "POST") encabezados["content-type"] = "application/json"
  let respuesta: Response
  try {
    respuesta = await fetch(url, {
      method: config.tool.metodo,
      headers: encabezados,
      body: config.tool.metodo === "POST" ? JSON.stringify(valores) : undefined,
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    })
  } catch (error) {
    log.warn({ detalle: detalleSeguro(error) }, "la tool de prueba no respondio")
    throw new ErrorHttp(502, "La URL no respondió.")
  }
  const tipo = respuesta.headers.get("content-type") ?? ""
  let cuerpo = ""
  if (tipo.includes("json") || tipo.startsWith("text/")) {
    const texto = await respuesta.text()
    cuerpo = ocultarSecreto(texto, secreto, catalogo.encabezado_secreto)
  } else {
    await respuesta.body?.cancel()
    cuerpo = "Cuerpo no textual."
  }
  return { status: respuesta.status, cuerpo, aviso }
}

export async function correrSimulacionDeEquipo(
  usuario: SesionUsuario,
  entrada: { escenario: string; criterio: string },
): Promise<{ id: string; resultado: string; razon: string }> {
  const equipo = await equipoPropio(usuario)
  if (!permitir(`simulacion:${equipo.id}`, 10, 10 * 60 * 1000)) {
    throw new ErrorHttp(429, "Demasiadas simulaciones seguidas. Espera un momento.")
  }
  const escenario = entrada.escenario.trim()
  const criterio = entrada.criterio.trim()
  if (escenario.length < 1 || escenario.length > 2_000 || criterio.length < 1 || criterio.length > 2_000) {
    throw new ErrorHttp(400, "El escenario y el criterio tienen que tener entre 1 y 2000 caracteres.")
  }
  const agente = await db().agenteEquipo.findUnique({
    where: { equipoId: equipo.id },
    include: { versiones: { orderBy: { numero: "desc" }, take: 1 } },
  })
  if (!agente || agente.deletedAt) throw new ErrorHttp(404, "Este equipo todavía no tiene agente.")
  if (agente.archivadoAt) throw new ErrorHttp(409, "Este agente está archivado.")
  const version = agente.versiones[0]
  if (!version) throw new ErrorHttp(404, "Este equipo todavía no tiene agente.")
  const tope = await db().topeEquipo.findUnique({ where: { equipoId: equipo.id } })
  const catalogo = leerConstructor()
  const topes = {
    conversacionesTexto: tope?.conversacionesTexto ?? catalogo.topes.conversaciones_texto,
    simulaciones: tope?.simulaciones ?? catalogo.topes.simulaciones,
    minutosVoz: tope?.minutosVoz ?? catalogo.topes.minutos_voz,
  }
  const uso = await usoDe(equipo.id, agente.id)
  const bloqueo = bloqueoDeTope("simulacion", uso, topes)
  if (bloqueo) throw new ErrorHttp(403, bloqueo)
  const variables = await variablesDeSala(equipo.id, equipo.nombre)
  const testId = await crearSimulacionEleven({
    type: "simulation",
    name: `m2 ${equipo.slug}`.slice(0, 80),
    simulation_scenario: escenario,
    success_conditions: [criterio],
    simulation_max_turns: catalogo.simulacion_turnos_max,
    simulated_user_model: catalogo.modelo_simulacion,
    evaluation_model: catalogo.modelo_simulacion,
    dynamic_variables: variables,
  })
  const corrida = await correrSimulacionEleven(agente.agentId, testId)
  try {
    const fila = await db().simulacion.create({
      data: {
        agenteId: agente.id,
        versionId: version.id,
        usuarioId: usuario.id,
        escenario,
        criterio,
        resultado: corrida.resultado,
        razon: corrida.razon,
        transcripcion: corrida.transcripcion,
        creditos: corrida.creditos,
      },
    })
    return { id: fila.id, resultado: corrida.resultado, razon: corrida.razon }
  } catch (error) {
    registrarFalloDeDatos(error, "guardar-simulacion")
    throw new ErrorHttp(500, "La simulación corrió, pero no se pudo guardar.")
  }
}

export async function exportarSimulaciones(usuario: SesionUsuario): Promise<{
  equipo: string
  simulaciones: {
    escenario: string
    criterio: string
    resultado: string
    razon: string
    transcripcion: string
    version: number
    creada_at: string
  }[]
}> {
  const equipo = await equipoPropio(usuario)
  const agente = await db().agenteEquipo.findUnique({ where: { equipoId: equipo.id } })
  if (!agente || agente.deletedAt) throw new ErrorHttp(404, "Este equipo todavía no tiene agente.")
  const filas = await db().simulacion.findMany({
    where: { agenteId: agente.id },
    orderBy: { creadaAt: "asc" },
    take: 200,
    include: { version: { select: { numero: true } } },
  })
  return {
    equipo: equipo.nombre,
    simulaciones: filas.map((fila) => ({
      escenario: fila.escenario,
      criterio: fila.criterio,
      resultado: fila.resultado,
      razon: fila.razon,
      transcripcion: fila.transcripcion,
      version: fila.version.numero,
      creada_at: fila.creadaAt.toISOString(),
    })),
  }
}

export type FilaAgenteInstructor = {
  equipo_slug: string
  equipo_nombre: string
  nombre: string | null
  version: number | null
  modelo: string | null
  voz: string | null
  actualizado_at: string | null
  archivado: boolean
  uso: Uso
  topes: Tope
}

export async function listarAgentesInstructor(page: number, pageSize: number): Promise<MetaPagina & { items: FilaAgenteInstructor[] }> {
  const donde = { deletedAt: null, slug: { not: SLUG_EQUIPO_DEMO } }
  const catalogo = leerConstructor()
  const total = await db().equipo.count({ where: donde })
  const equipos = await db().equipo.findMany({
    where: donde,
    orderBy: { nombre: "asc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      agente: { include: { versiones: { orderBy: { numero: "desc" }, take: 1 } } },
      tope: true,
    },
  })
  const items: FilaAgenteInstructor[] = []
  for (const equipo of equipos) {
    const agente = equipo.agente && !equipo.agente.deletedAt ? equipo.agente : null
    const uso = agente ? await usoDe(equipo.id, agente.id) : { texto: 0, simulaciones: 0, segundosVoz: 0 }
    const voz = catalogo.voces.find((item) => item.slug === agente?.vozSlug)
    const modelo = catalogo.modelos.find((item) => item.slug === agente?.modeloSlug)
    items.push({
      equipo_slug: equipo.slug,
      equipo_nombre: equipo.nombre,
      nombre: agente?.nombre ?? null,
      version: agente?.versiones[0]?.numero ?? null,
      modelo: modelo?.nombre ?? null,
      voz: voz?.nombre ?? null,
      actualizado_at: agente?.updatedAt.toISOString() ?? null,
      archivado: Boolean(agente?.archivadoAt),
      uso,
      topes: {
        conversacionesTexto: equipo.tope?.conversacionesTexto ?? catalogo.topes.conversaciones_texto,
        simulaciones: equipo.tope?.simulaciones ?? catalogo.topes.simulaciones,
        minutosVoz: equipo.tope?.minutosVoz ?? catalogo.topes.minutos_voz,
        vozHabilitada: equipo.tope?.vozHabilitada ?? false,
      },
    })
  }
  return { items, ...metaPagina(total, page, pageSize) }
}

const topeSchema = {
  maxTexto: 10_000,
  maxSims: 1_000,
  maxMinutos: 600,
}

export async function guardarTopesDeEquipo(
  equipoSlug: string,
  entrada: { conversacionesTexto: number; simulaciones: number; minutosVoz: number; vozHabilitada: boolean },
): Promise<void> {
  if (
    !Number.isInteger(entrada.conversacionesTexto) ||
    entrada.conversacionesTexto < 1 ||
    entrada.conversacionesTexto > topeSchema.maxTexto ||
    !Number.isInteger(entrada.simulaciones) ||
    entrada.simulaciones < 1 ||
    entrada.simulaciones > topeSchema.maxSims ||
    !Number.isInteger(entrada.minutosVoz) ||
    entrada.minutosVoz < 1 ||
    entrada.minutosVoz > topeSchema.maxMinutos
  ) {
    throw new ErrorHttp(400, "Esos topes no son válidos.")
  }
  const equipo = await db().equipo.findFirst({ where: { slug: equipoSlug, deletedAt: null } })
  if (!equipo) throw new ErrorHttp(404, "No encontramos ese equipo.")
  await db().topeEquipo.upsert({
    where: { equipoId: equipo.id },
    create: {
      equipoId: equipo.id,
      conversacionesTexto: entrada.conversacionesTexto,
      simulaciones: entrada.simulaciones,
      minutosVoz: entrada.minutosVoz,
      vozHabilitada: entrada.vozHabilitada,
    },
    update: {
      conversacionesTexto: entrada.conversacionesTexto,
      simulaciones: entrada.simulaciones,
      minutosVoz: entrada.minutosVoz,
      vozHabilitada: entrada.vozHabilitada,
    },
  })
}

export async function archivarAgenteDeEquipo(equipoSlug: string): Promise<void> {
  const equipo = await db().equipo.findFirst({ where: { slug: equipoSlug, deletedAt: null }, include: { agente: true } })
  if (!equipo?.agente || equipo.agente.deletedAt) throw new ErrorHttp(404, "Ese equipo no tiene agente.")
  if (equipo.agente.archivadoAt) return
  try {
    await borrarAgenteEleven(equipo.agente.agentId)
  } catch (error) {
    if (!(error instanceof ErrorHttp) || error.status !== 404) throw error
  }
  await db().agenteEquipo.update({ where: { id: equipo.agente.id }, data: { archivadoAt: new Date() } })
}
