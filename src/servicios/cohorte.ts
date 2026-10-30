import { ID_COHORTE, MODULOS, type Modulo } from "@/lib/constantes"
import { db } from "@/lib/db"
import { ErrorHttp } from "@/lib/errores"

export function esModulo(valor: string): valor is Modulo {
  return (MODULOS as readonly string[]).includes(valor)
}

export async function obtenerModulo(): Promise<Modulo> {
  const fila = await db().cohorte.upsert({
    where: { id: ID_COHORTE },
    create: { id: ID_COHORTE, modulo: "M1" },
    update: {},
  })
  return esModulo(fila.modulo) ? fila.modulo : "M1"
}

export async function cambiarModulo(modulo: string): Promise<void> {
  if (!esModulo(modulo)) throw new ErrorHttp(400, "El módulo no es válido.")
  await db().cohorte.upsert({
    where: { id: ID_COHORTE },
    create: { id: ID_COHORTE, modulo },
    update: { modulo },
  })
}

export async function obtenerVozHabilitada(): Promise<boolean> {
  const fila = await db().cohorte.upsert({
    where: { id: ID_COHORTE },
    create: { id: ID_COHORTE, modulo: "M1", vozHabilitada: false },
    update: {},
  })
  return fila.vozHabilitada
}

export async function cambiarVozHabilitada(vozHabilitada: boolean): Promise<void> {
  await db().cohorte.upsert({
    where: { id: ID_COHORTE },
    create: { id: ID_COHORTE, modulo: "M1", vozHabilitada },
    update: { vozHabilitada },
  })
}
