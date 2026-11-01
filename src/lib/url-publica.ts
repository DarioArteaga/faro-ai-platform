import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

import { ErrorHttp } from "@/lib/errores"

export type ResolverDns = (host: string) => Promise<string[]>

function ipv4Privada(ip: string): boolean {
  const partes = ip.split(".").map((parte) => Number(parte))
  if (partes.length !== 4 || partes.some((parte) => !Number.isInteger(parte) || parte < 0 || parte > 255)) return true
  const a = partes[0] ?? 0
  const b = partes[1] ?? 0
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a >= 224) return true
  return false
}

function ipv6Privada(ip: string): boolean {
  const normal = ip.toLowerCase()
  if (normal === "::" || normal === "::1") return true
  if (normal.startsWith("fe80:") || normal.startsWith("fc") || normal.startsWith("fd")) return true
  const mapeada = normal.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapeada?.[1]) return ipv4Privada(mapeada[1])
  return false
}

export function ipPrivada(ip: string): boolean {
  const version = isIP(ip)
  if (version === 4) return ipv4Privada(ip)
  if (version === 6) return ipv6Privada(ip)
  return true
}

function hostBloqueado(host: string): boolean {
  const nombre = host.toLowerCase().replace(/\.+$/, "")
  if (nombre === "localhost" || nombre.endsWith(".localhost") || nombre.endsWith(".local")) return true
  if (nombre === "metadata.google.internal" || nombre.endsWith(".internal")) return true
  return false
}

async function resolverReal(host: string): Promise<string[]> {
  const registros = await lookup(host, { all: true, verbatim: true })
  return registros.map((registro) => registro.address)
}

export async function comprobarUrlPublica(valor: string, resolver: ResolverDns = resolverReal): Promise<URL> {
  let url: URL
  try {
    url = new URL(valor)
  } catch {
    throw new ErrorHttp(400, "La URL de la tool no es válida.")
  }
  if (url.protocol !== "https:") throw new ErrorHttp(400, "La URL de la tool tiene que ser HTTPS.")
  if (url.username || url.password) throw new ErrorHttp(400, "La URL de la tool no puede llevar usuario ni contraseña.")
  if (hostBloqueado(url.hostname)) throw new ErrorHttp(400, "La URL de la tool tiene que ser pública.")
  const literal = url.hostname.replace(/^\[|\]$/g, "")
  if (isIP(literal)) {
    if (ipPrivada(literal)) throw new ErrorHttp(400, "La URL de la tool tiene que ser pública.")
    return url
  }
  let direcciones: string[]
  try {
    direcciones = await resolver(url.hostname)
  } catch {
    throw new ErrorHttp(400, "No se pudo resolver la URL de la tool.")
  }
  if (direcciones.length === 0 || direcciones.some((direccion) => ipPrivada(direccion))) {
    throw new ErrorHttp(400, "La URL de la tool tiene que ser pública.")
  }
  return url
}
