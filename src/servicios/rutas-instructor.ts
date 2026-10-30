import { z } from "zod"

import { MODULOS } from "@/lib/constantes"
import { ErrorHttp } from "@/lib/errores"
import { leerCuerpo, manejar } from "@/lib/http"
import { leerPaginacion } from "@/lib/paginacion"
import { cambiarModulo } from "@/servicios/cohorte"
import { listarTodas } from "@/servicios/conversaciones"
import {
  activarImprevisto,
  crearEquipo,
  crearEstudiante,
  darDeBajaEquipo,
  darDeBajaEstudiante,
  editarEstudiante,
  renombrarEquipo,
  datosPanel,
} from "@/servicios/instructor"
import { exigirInstructor } from "@/servicios/sesion"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function exigirSlug(valor: string): string {
  if (!slug.test(valor)) throw new ErrorHttp(404, "No encontramos ese equipo.")
  return valor
}

export function exigirUuid(valor: string): string {
  if (!uuid.test(valor)) throw new ErrorHttp(404, "No encontramos a ese estudiante.")
  return valor
}

export async function panel(): Promise<Response> {
  return manejar(async () => {
    await exigirInstructor()
    return datosPanel()
  })
}

export async function actualizarModulo(request: Request): Promise<Response> {
  return manejar(async () => {
    await exigirInstructor()
    const datos = z.object({ modulo: z.enum(MODULOS) }).strict().parse(await leerCuerpo(request))
    await cambiarModulo(datos.modulo)
    return { modulo: datos.modulo }
  })
}

export async function publicarImprevisto(request: Request): Promise<Response> {
  return manejar(async () => {
    const usuario = await exigirInstructor()
    const datos = z
      .object({ clave: z.string().min(1).max(80), equipo_slug: z.string().min(1).max(80) })
      .strict()
      .parse(await leerCuerpo(request))
    return { aviso: await activarImprevisto(usuario, datos.clave, datos.equipo_slug) }
  })
}

export async function listarConversacionesInstructor(request: Request): Promise<Response> {
  return manejar(async () => {
    await exigirInstructor()
    const pagina = leerPaginacion(new URL(request.url).searchParams)
    return listarTodas(pagina.page, pagina.page_size)
  })
}

export async function publicarEquipo(request: Request): Promise<Response> {
  return manejar(async () => {
    await exigirInstructor()
    const datos = z.object({ nombre: z.string() }).strict().parse(await leerCuerpo(request))
    return { aviso: await crearEquipo(datos.nombre) }
  })
}

export async function editarEquipo(slugEquipo: string, request: Request): Promise<Response> {
  return manejar(async () => {
    await exigirInstructor()
    const datos = z.object({ nombre: z.string() }).strict().parse(await leerCuerpo(request))
    return { aviso: await renombrarEquipo(exigirSlug(slugEquipo), datos.nombre) }
  })
}

export async function bajaEquipo(slugEquipo: string): Promise<Response> {
  return manejar(async () => {
    await exigirInstructor()
    return { aviso: await darDeBajaEquipo(exigirSlug(slugEquipo)) }
  })
}

export async function publicarEstudiante(request: Request): Promise<Response> {
  return manejar(async () => {
    await exigirInstructor()
    const datos = z
      .object({ nombre: z.string(), email: z.string(), equipo_slug: z.string() })
      .strict()
      .parse(await leerCuerpo(request))
    return {
      aviso: await crearEstudiante({ nombre: datos.nombre, email: datos.email, equipoSlug: datos.equipo_slug }),
    }
  })
}

export async function actualizarEstudiante(id: string, request: Request): Promise<Response> {
  return manejar(async () => {
    await exigirInstructor()
    const datos = z
      .object({ nombre: z.string(), email: z.string(), equipo_slug: z.string() })
      .strict()
      .parse(await leerCuerpo(request))
    return {
      aviso: await editarEstudiante(exigirUuid(id), {
        nombre: datos.nombre,
        email: datos.email,
        equipoSlug: datos.equipo_slug,
      }),
    }
  })
}

export async function bajaEstudiante(id: string): Promise<Response> {
  return manejar(async () => {
    await exigirInstructor()
    return { aviso: await darDeBajaEstudiante(exigirUuid(id)) }
  })
}
