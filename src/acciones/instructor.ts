"use server"

import { redirect } from "next/navigation"

import { registrarFalloDeDatos } from "@/lib/db"
import { ErrorHttp } from "@/lib/errores"
import { cambiarModulo } from "@/servicios/cohorte"
import {
  activarImprevisto,
  crearEquipo,
  crearEstudiante,
  darDeBajaEquipo,
  darDeBajaEstudiante,
  editarEstudiante,
  renombrarEquipo,
  type Aviso,
} from "@/servicios/instructor"
import { exigirInstructor } from "@/servicios/sesion"

function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo)
  return typeof valor === "string" ? valor : ""
}

async function correr(accion: () => Promise<Aviso>, contexto: string): Promise<void> {
  let aviso = "error"
  try {
    await exigirInstructor()
    aviso = await accion()
  } catch (error) {
    if (error instanceof ErrorHttp && error.status === 401) redirect("/login")
    if (!(error instanceof ErrorHttp)) registrarFalloDeDatos(error, contexto)
  }
  redirect(`/instructor?aviso=${aviso}`)
}

export async function cambiarModuloAccion(formData: FormData): Promise<void> {
  await correr(() => cambiarModulo(texto(formData, "modulo")).then(() => "guardado" as const), "modulo")
}

export async function activarAccion(formData: FormData): Promise<void> {
  await correr(
    async () => activarImprevisto(await exigirInstructor(), texto(formData, "clave"), texto(formData, "equipo_slug")),
    "activar",
  )
}

export async function crearEquipoAccion(formData: FormData): Promise<void> {
  await correr(() => crearEquipo(texto(formData, "nombre")), "crear-equipo")
}

export async function renombrarEquipoAccion(formData: FormData): Promise<void> {
  await correr(() => renombrarEquipo(texto(formData, "slug"), texto(formData, "nombre")), "renombrar-equipo")
}

export async function bajaEquipoAccion(formData: FormData): Promise<void> {
  await correr(async () => {
    if (formData.get("confirmo") !== "si") throw new ErrorHttp(400, "Falta la confirmación.")
    return darDeBajaEquipo(texto(formData, "slug"))
  }, "baja-equipo")
}

export async function crearEstudianteAccion(formData: FormData): Promise<void> {
  await correr(
    () =>
      crearEstudiante({
        nombre: texto(formData, "nombre"),
        email: texto(formData, "email"),
        equipoSlug: texto(formData, "equipo_slug"),
      }),
    "crear-estudiante",
  )
}

export async function editarEstudianteAccion(formData: FormData): Promise<void> {
  await correr(
    () =>
      editarEstudiante(texto(formData, "id"), {
        nombre: texto(formData, "nombre"),
        email: texto(formData, "email"),
        equipoSlug: texto(formData, "equipo_slug"),
      }),
    "editar-estudiante",
  )
}

export async function bajaEstudianteAccion(formData: FormData): Promise<void> {
  await correr(async () => {
    if (formData.get("confirmo") !== "si") throw new ErrorHttp(400, "Falta la confirmación.")
    return darDeBajaEstudiante(texto(formData, "id"))
  }, "baja-estudiante")
}
