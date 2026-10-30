import { db } from "@/lib/db"
import { ErrorHttp } from "@/lib/errores"

export function correosInstructor(): string[] {
  return (process.env.INSTRUCTOR_EMAILS ?? "")
    .split(",")
    .map((correo) => correo.trim().toLowerCase())
    .filter((correo) => correo.includes("@"))
}

export async function estudiantePuedeEntrar(email: string): Promise<boolean> {
  const usuario = await db().usuario.findUnique({ where: { email } })
  return Boolean(usuario && !usuario.deletedAt && usuario.rol === "estudiante")
}

export async function asegurarInstructor(email: string, nombre: string): Promise<void> {
  const existente = await db().usuario.findUnique({ where: { email } })
  if (!existente) {
    await db().usuario.create({ data: { email, nombre, rol: "instructor" } })
    return
  }
  if (existente.rol === "instructor" && !existente.deletedAt) return
  await db().usuario.update({
    where: { email },
    data: { rol: "instructor", deletedAt: null },
  })
}

export async function exigirBaseConfigurada(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new ErrorHttp(503, "Falta la base de datos.")
  }
}
