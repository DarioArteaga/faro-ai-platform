import { Prisma } from "@prisma/client"

import { casoActivo, leerImprevistos } from "@/lib/catalogo"
import type { Modulo } from "@/lib/constantes"
import { db, registrarFalloDeDatos } from "@/lib/db"
import { ErrorHttp } from "@/lib/errores"
import { exigirClaveDelModulo } from "@/lib/imprevistos"
import { slugificar } from "@/lib/slug"
import { correoNormalizado, textoCorto } from "@/lib/validar"
import type { SesionUsuario } from "@/lib/autorizacion"
import { obtenerModulo } from "@/servicios/cohorte"

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

export async function activarImprevisto(
  usuario: SesionUsuario,
  clave: string,
  equipoSlug: string,
): Promise<Aviso> {
  const catalogo = leerImprevistos()
  const modulo = await obtenerModulo()
  exigirClaveDelModulo(clave, modulo, catalogo.porClave)
  const equipos =
    equipoSlug === "todos"
      ? await db().equipo.findMany({ where: { deletedAt: null } })
      : await db().equipo.findMany({ where: { slug: equipoSlug, deletedAt: null } })
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
  const visible = textoCorto(nombre, 80)
  const equipo = await db().equipo.findFirst({ where: { slug, deletedAt: null } })
  if (!equipo) throw new ErrorHttp(404, "No encontramos ese equipo.")
  await db().equipo.update({ where: { id: equipo.id }, data: { nombre: visible } })
  return "guardado"
}

export async function darDeBajaEquipo(slug: string): Promise<Aviso> {
  const equipo = await db().equipo.findFirst({ where: { slug, deletedAt: null } })
  if (!equipo) throw new ErrorHttp(404, "No encontramos ese equipo.")
  await db().equipo.update({ where: { id: equipo.id }, data: { deletedAt: new Date() } })
  return "baja"
}

async function equipoVigente(slug: string): Promise<{ id: string }> {
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
  imprevistos: { clave: string; modulo: string; sostiene: string; equipos: string[] }[]
  equipos: EquipoPanel[]
  cobertura: { slug: string; nombre: string; interlocutores: FilaCobertura[] }[]
}> {
  const modulo = await obtenerModulo()
  const catalogo = leerImprevistos()
  const interlocutores = casoActivo().interlocutores
  const equipos = await db().equipo.findMany({
    where: { deletedAt: null },
    orderBy: { nombre: "asc" },
    include: {
      usuarios: { where: { deletedAt: null, rol: "estudiante" }, orderBy: { nombre: "asc" } },
      activaciones: true,
    },
  })
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
    imprevistos: catalogo.orden
      .filter((clave) => catalogo.porClave[clave]?.modulo === modulo)
      .map((clave) => {
        const item = catalogo.porClave[clave]
        return {
          clave,
          modulo: item?.modulo ?? modulo,
          sostiene: item?.sostiene ?? "",
          equipos: equipos.filter((equipo) => equipo.activaciones.some((activa) => activa.clave === clave)).map((equipo) => equipo.nombre),
        }
      }),
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
