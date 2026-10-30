import { NOMBRE_EQUIPO_DEMO, type Audiencia } from "@/lib/constantes"

export type Rol = "estudiante" | "instructor"

export type SesionUsuario = {
  id: string
  email: string
  nombre: string
  rol: Rol
  equipoId: string | null
  equipoSlug: string | null
  equipoNombre: string | null
}

/** Con la voz apagada, un estudiante no recibe token. El instructor sí puede pedirlo. */
export function puedePedirTokenDeVoz(rol: Rol, vozHabilitada: boolean): boolean {
  if (rol === "instructor") return true
  return vozHabilitada
}

/** El caso de audiencia instructor no se muestra ni se abre para un estudiante. */
export function puedeVerCaso(rol: Rol, audiencia: Audiencia): boolean {
  return audiencia === "curso" || rol === "instructor"
}

export function puedeIniciarConversacion(usuario: SesionUsuario | null, audiencia: Audiencia): 401 | 403 | null {
  if (!usuario) return 401
  if (!puedeVerCaso(usuario.rol, audiencia)) return 403
  if (audiencia === "curso" && (!usuario.equipoId || !usuario.equipoNombre)) return 403
  return null
}

export type DestinoConversacion =
  | { tipo: "demo"; equipoNombre: string }
  | { tipo: "propio"; equipoId: string; equipoNombre: string }

/** Seguros Pampa no usa el equipo del instructor: así no entra al historial de los estudiantes. */
export function destinoDeConversacion(
  usuario: SesionUsuario | null,
  audiencia: Audiencia,
): DestinoConversacion | 401 | 403 {
  const codigo = puedeIniciarConversacion(usuario, audiencia)
  if (codigo !== null) return codigo
  if (!usuario) return 401
  if (audiencia === "instructor") return { tipo: "demo", equipoNombre: NOMBRE_EQUIPO_DEMO }
  if (!usuario.equipoId || !usuario.equipoNombre) return 403
  return { tipo: "propio", equipoId: usuario.equipoId, equipoNombre: usuario.equipoNombre }
}

export function puedeLeerConversacion(usuario: SesionUsuario, equipoId: string): boolean {
  if (usuario.rol === "instructor") return true
  return usuario.equipoId !== null && usuario.equipoId === equipoId
}

/** El id de ElevenLabs solo se guarda si esa cuenta lo atribuye a este usuario y a este agente. */
export function duenoCoincide(
  dueno: { userId: string | null; agentId: string | null },
  usuarioId: string,
  agentId: string,
): boolean {
  return dueno.userId === usuarioId && dueno.agentId === agentId
}

/** 404 tanto si no existe como si el equipo no es el suyo, para no revelar el id. */
export function puedeVerConversacion(
  usuario: SesionUsuario | null,
  conversacion: { equipoId: string } | null,
): boolean {
  if (!usuario || !conversacion) return false
  return puedeLeerConversacion(usuario, conversacion.equipoId)
}
