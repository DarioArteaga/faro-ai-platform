import { auth } from "@/auth"
import type { SesionUsuario } from "@/lib/autorizacion"
import { db } from "@/lib/db"
import { ErrorHttp } from "@/lib/errores"

export async function buscarUsuarioActivo(email: string): Promise<SesionUsuario | null> {
  const fila = await db().usuario.findUnique({
    where: { email: email.toLowerCase() },
    include: { equipo: true },
  })
  if (!fila || fila.deletedAt) return null
  if (fila.rol !== "estudiante" && fila.rol !== "instructor") return null
  const equipoVigente = fila.equipo && !fila.equipo.deletedAt ? fila.equipo : null
  return {
    id: fila.id,
    email: fila.email,
    nombre: fila.nombre,
    rol: fila.rol,
    equipoId: equipoVigente?.id ?? null,
    equipoSlug: equipoVigente?.slug ?? null,
    equipoNombre: equipoVigente?.nombre ?? null,
  }
}

export async function usuarioDeLaSesion(): Promise<SesionUsuario | null> {
  const sesion = await auth()
  const email = sesion?.user?.email
  if (!email) return null
  return buscarUsuarioActivo(email)
}

export async function exigirUsuario(): Promise<SesionUsuario> {
  const usuario = await usuarioDeLaSesion()
  if (!usuario) throw new ErrorHttp(401, "Tienes que entrar para continuar.")
  return usuario
}

export async function exigirInstructor(): Promise<SesionUsuario> {
  const usuario = await exigirUsuario()
  if (usuario.rol !== "instructor") throw new ErrorHttp(403, "Esta sección es del instructor.")
  return usuario
}
