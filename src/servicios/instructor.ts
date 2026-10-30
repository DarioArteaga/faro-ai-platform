import { Prisma } from "@prisma/client"

import { casoActivo, casosVisibles, leerCasos, leerImprevistos } from "@/lib/catalogo"
import { NOMBRE_EQUIPO_DEMO, SLUG_EQUIPO_DEMO, type Audiencia, type Modulo } from "@/lib/constantes"
import { db, registrarFalloDeDatos } from "@/lib/db"
import { ErrorHttp } from "@/lib/errores"
import { exigirClaveDelModulo } from "@/lib/imprevistos"
import { slugificar } from "@/lib/slug"
import { correoNormalizado, textoCorto } from "@/lib/validar"
import type { SesionUsuario } from "@/lib/autorizacion"
import { obtenerModulo, obtenerVozHabilitada } from "@/servicios/cohorte"

export type Aviso =
  | "activado"
  | "ya-estaba"
  | "sin-equipos"
  | "guardado"
  | "baja"
  | "duplicado"

export type FilaCobertura = {
  slug: string
  nombre: string
  cantidad: number
  conductores: string[]
}

export type EquipoPanel = {
  slug: string
  nombre: string
  estudiantes: { id: string; nombre: string; email: string }[]
}

export async function asegurarEquipoDemo(): Promise<{ id: string }> {
  const datos = { nombre: NOMBRE_EQUIPO_DEMO, deletedAt: null }
  const existente = await db().equipo.findUnique({ where: { slug: SLUG_EQUIPO_DEMO } })
  if (existente) {
    if (existente.deletedAt || existente.nombre !== NOMBRE_EQUIPO_DEMO) {
      return db().equipo.update({ where: { id: existente.id }, data: datos })
    }
    return existente
  }
  try {
    return await db().equipo.create({ data: { slug: SLUG_EQUIPO_DEMO, nombre: NOMBRE_EQUIPO_DEMO } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const fila = await db().equipo.findUnique({ where: { slug: SLUG_EQUIPO_DEMO } })
      if (fila) return fila
    }
    registrarFalloDeDatos(error, "equipo-demo")
    throw new ErrorHttp(500, "No se pudo preparar la demo del instructor.")
  }
}

export async function activarImprevisto(
  usuario: SesionUsuario,
  clave: string,
  equipoSlug: string,
): Promise<Aviso> {
  const catalogo = leerImprevistos()
  const modulo = await obtenerModulo()
  exigirClaveDelModulo(clave, modulo, catalogo.porClave)
  if (equipoSlug === SLUG_EQUIPO_DEMO) {
    const item = catalogo.porClave[clave]
    const caso = leerCasos().find((entrada) => entrada.caso === item?.caso)
    if (caso?.audiencia !== "instructor") {
      throw new ErrorHttp(400, "Esa clave no corresponde a la demo del instructor.")
    }
    const equipo = await asegurarEquipoDemo()
    try {
      await db().activacionImprevisto.create({
        data: { equipoId: equipo.id, clave, usuarioId: usuario.id },
      })
      return "activado"
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "ya-estaba"
      registrarFalloDeDatos(error, "activar-imprevisto")
      throw new ErrorHttp(500, "No se pudo activar el imprevisto.")
    }
  }
  const equipos =
    equipoSlug === "todos"
      ? await db().equipo.findMany({ where: { deletedAt: null, slug: { not: SLUG_EQUIPO_DEMO } } })
      : await db().equipo.findMany({ where: { slug: equipoSlug, deletedAt: null, NOT: { slug: SLUG_EQUIPO_DEMO } } })
  if (equipos.length === 0) return "sin-equipos"
  let nuevos = 0
  for (const equipo of equipos) {
    try {
      await db().activacionImprevisto.create({
        data: { equipoId: equipo.id, clave, usuarioId: usuario.id },
      })
      nuevos += 1
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue
      registrarFalloDeDatos(error, "activar-imprevisto")
      throw new ErrorHttp(500, "No se pudo activar el imprevisto.")
    }
  }
  return nuevos > 0 ? "activado" : "ya-estaba"
}

export async function crearEquipo(nombre: string): Promise<Aviso> {
  const visible = textoCorto(nombre, 80)
  const slug = slugificar(visible)
  if (slug === SLUG_EQUIPO_DEMO) throw new ErrorHttp(400, "Ese nombre está reservado.")
  const existe = await db().equipo.findUnique({ where: { slug } })
  if (existe && !existe.deletedAt) return "duplicado"
  if (existe) {
    await db().equipo.update({ where: { id: existe.id }, data: { nombre: visible, deletedAt: null } })
    return "guardado"
  }
  await db().equipo.create({ data: { slug, nombre: visible } })
  return "guardado"
}

export async function renombrarEquipo(slug: string, nombre: string): Promise<Aviso> {
  if (slug === SLUG_EQUIPO_DEMO) throw new ErrorHttp(404, "No encontramos ese equipo.")
  const visible = textoCorto(nombre, 80)
  const equipo = await db().equipo.findFirst({ where: { slug, deletedAt: null } })
  if (!equipo) throw new ErrorHttp(404, "No encontramos ese equipo.")
  await db().equipo.update({ where: { id: equipo.id }, data: { nombre: visible } })
  return "guardado"
}

export async function darDeBajaEquipo(slug: string): Promise<Aviso> {
  if (slug === SLUG_EQUIPO_DEMO) throw new ErrorHttp(404, "No encontramos ese equipo.")
  const equipo = await db().equipo.findFirst({ where: { slug, deletedAt: null } })
  if (!equipo) throw new ErrorHttp(404, "No encontramos ese equipo.")
  await db().equipo.update({ where: { id: equipo.id }, data: { deletedAt: new Date() } })
  return "baja"
}

async function equipoVigente(slug: string): Promise<{ id: string }> {
  if (slug === SLUG_EQUIPO_DEMO) throw new ErrorHttp(404, "No encontramos ese equipo.")
  const equipo = await db().equipo.findFirst({ where: { slug, deletedAt: null } })
  if (!equipo) throw new ErrorHttp(404, "No encontramos ese equipo.")
  return equipo
}

export async function crearEstudiante(entrada: { nombre: string; email: string; equipoSlug: string }): Promise<Aviso> {
  const nombre = textoCorto(entrada.nombre, 120)
  const email = correoNormalizado(entrada.email)
  const equipo = await equipoVigente(entrada.equipoSlug)
  const existe = await db().usuario.findUnique({ where: { email } })
  if (existe && !existe.deletedAt) return "duplicado"
  if (existe) {
    await db().usuario.update({
      where: { id: existe.id },
      data: { nombre, email, rol: "estudiante", equipoId: equipo.id, deletedAt: null },
    })
    return "guardado"
  }
  await db().usuario.create({
    data: { nombre, email, rol: "estudiante", equipoId: equipo.id },
  })
  return "guardado"
}

export async function editarEstudiante(
  id: string,
  entrada: { nombre: string; email: string; equipoSlug: string },
): Promise<Aviso> {
  const nombre = textoCorto(entrada.nombre, 120)
  const email = correoNormalizado(entrada.email)
  const equipo = await equipoVigente(entrada.equipoSlug)
  const actual = await db().usuario.findFirst({ where: { id, deletedAt: null, rol: "estudiante" } })
  if (!actual) throw new ErrorHttp(404, "No encontramos a ese estudiante.")
  const otro = await db().usuario.findUnique({ where: { email } })
  if (otro && otro.id !== actual.id && !otro.deletedAt) return "duplicado"
  await db().usuario.update({
    where: { id: actual.id },
    data: { nombre, email, equipoId: equipo.id },
  })
  return "guardado"
}

export async function darDeBajaEstudiante(id: string): Promise<Aviso> {
  const actual = await db().usuario.findFirst({ where: { id, deletedAt: null, rol: "estudiante" } })
  if (!actual) throw new ErrorHttp(404, "No encontramos a ese estudiante.")
  await db().usuario.update({ where: { id: actual.id }, data: { deletedAt: new Date() } })
  return "baja"
}

export async function datosPanel(): Promise<{
  modulo: Modulo
  voz_habilitada: boolean
  imprevistos: {
    caso: string
    nombre: string
    audiencia: Audiencia
    claves: { clave: string; modulo: string; sostiene: string; equipos: string[] }[]
  }[]
  equipos: EquipoPanel[]
  cobertura: { slug: string; nombre: string; interlocutores: FilaCobertura[] }[]
}> {
  const [modulo, vozHabilitada] = await Promise.all([obtenerModulo(), obtenerVozHabilitada()])
  const catalogo = leerImprevistos()
  const interlocutores = casoActivo().interlocutores
  const vigentes = await db().equipo.findMany({
    where: { deletedAt: null },
    orderBy: { nombre: "asc" },
    include: {
      usuarios: { where: { deletedAt: null, rol: "estudiante" }, orderBy: { nombre: "asc" } },
      activaciones: true,
    },
  })
  const equipos = vigentes.filter((equipo) => equipo.slug !== SLUG_EQUIPO_DEMO)
  const conversaciones = await db().conversacion.findMany({
    where: { equipo: { deletedAt: null } },
    select: {
      agenteSlug: true,
      usuario: { select: { nombre: true } },
      equipo: { select: { slug: true } },
    },
  })
  return {
    modulo,
    voz_habilitada: vozHabilitada,
    imprevistos: casosVisibles("instructor").map((caso) => ({
      caso: caso.caso,
      nombre: caso.nombre,
      audiencia: caso.audiencia,
      claves: catalogo.orden
        .filter((clave) => catalogo.porClave[clave]?.caso === caso.caso && catalogo.porClave[clave]?.modulo === modulo)
        .map((clave) => {
          const item = catalogo.porClave[clave]
          return {
            clave,
            modulo: item?.modulo ?? modulo,
            sostiene: item?.sostiene ?? "",
            equipos: vigentes
              .filter((equipo) => equipo.activaciones.some((activa) => activa.clave === clave))
              .map((equipo) => equipo.nombre),
          }
        }),
    })),
    equipos: equipos.map((equipo) => ({
      slug: equipo.slug,
      nombre: equipo.nombre,
      estudiantes: equipo.usuarios.map((usuario) => ({
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
      })),
    })),
    cobertura: equipos.map((equipo) => ({
      slug: equipo.slug,
      nombre: equipo.nombre,
      interlocutores: interlocutores.map((interlocutor) => {
        const filas = conversaciones.filter(
          (fila) => fila.equipo.slug === equipo.slug && fila.agenteSlug === interlocutor.slug,
        )
        return {
          slug: interlocutor.slug,
          nombre: interlocutor.nombre,
          cantidad: filas.length,
          conductores: [...new Set(filas.map((fila) => fila.usuario.nombre))],
        }
      }),
    })),
  }
}
