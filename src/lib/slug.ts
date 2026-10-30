import { ErrorHttp } from "@/lib/errores"

export function slugificar(nombre: string): string {
  const base = nombre
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(base)) {
    throw new ErrorHttp(400, "El nombre no alcanza para formar un identificador.")
  }
  return base
}
