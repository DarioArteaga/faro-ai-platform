import { z } from "zod"

import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from "@/lib/constantes"
import { ErrorHttp } from "@/lib/errores"

export type MetaPagina = {
  total: number
  page: number
  page_size: number
  total_pages: number
}

function entero(valor: string | null, defecto: number, maximo: number): number {
  if (valor === null || valor.trim() === "") return defecto
  const parsed = z.number().int().min(1).max(maximo).safeParse(Number(valor))
  if (!parsed.success) {
    throw new ErrorHttp(400, "La paginación no es válida.")
  }
  return parsed.data
}

export function leerPaginacion(parametros: URLSearchParams): { page: number; page_size: number } {
  return {
    page: entero(parametros.get("page"), 1, 10_000),
    page_size: entero(parametros.get("page_size"), PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX),
  }
}

export function metaPagina(total: number, page: number, pageSize: number): MetaPagina {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize)
  return { total, page, page_size: pageSize, total_pages: totalPages }
}
