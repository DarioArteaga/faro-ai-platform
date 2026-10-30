import { PrismaClient } from "@prisma/client"

import { detalleSeguro } from "@/lib/enmascarar"
import { log } from "@/lib/log"

const globalPrisma = globalThis as unknown as { prisma?: PrismaClient }

export function db(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL ausente")
  }
  if (!globalPrisma.prisma) {
    globalPrisma.prisma = new PrismaClient({ log: [] })
  }
  return globalPrisma.prisma
}

export function registrarFalloDeDatos(error: unknown, contexto: string): void {
  log.error({ contexto, detalle: detalleSeguro(error) }, "fallo de base de datos")
  if (process.env.NODE_ENV !== "production" && error instanceof Error && error.stack) {
    log.debug({ stack: detalleSeguro(error.stack) }, "stack local")
  }
}
