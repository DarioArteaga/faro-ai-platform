import fs from "node:fs"
import path from "node:path"

import { parse } from "yaml"
import { z } from "zod"

import { AGENTES_IMPREVISTO, AUDIENCIAS, MODULOS } from "@/lib/constantes"

const claveImprevisto = /^[a-z][a-z0-9_]*$/
const slugInterlocutor = /^[a-z0-9_]+$/
const idAgente = /^agent_[a-z0-9]+$/

const imprevistoSchema = z
  .object({
    caso: z.string().regex(/^[a-z0-9_]+$/),
    agente: z.enum(AGENTES_IMPREVISTO),
    modulo: z.enum(MODULOS),
    sostiene: z.string().min(1),
  })
  .strict()

const interlocutorSchema = z
  .object({
    slug: z.string().regex(slugInterlocutor),
    nombre: z.string().min(1),
    quien: z.string().min(1),
    importa: z.string().min(1),
    agent_id: z.string().regex(idAgente),
  })
  .strict()

const casoSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    nombre: z.string().min(1),
    activo: z.boolean(),
    audiencia: z.enum(AUDIENCIAS),
    caso: z.string().regex(/^[a-z0-9_]+$/),
    interlocutores: z.array(interlocutorSchema).length(4),
  })
  .strict()

const equiposPlanBSchema = z
  .object({
    equipos: z.array(
      z
        .object({
          slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
          nombre: z.string().min(1),
        })
        .strict(),
    ),
  })
  .strict()

export type Imprevisto = z.infer<typeof imprevistoSchema>
export type Interlocutor = z.infer<typeof interlocutorSchema>
export type Caso = z.infer<typeof casoSchema>
export type EquipoPlanB = { slug: string; nombre: string }

export type CatalogoImprevistos = {
  orden: string[]
  porClave: Record<string, Imprevisto>
}

function leerYaml(nombre: string): unknown {
  const ruta = path.join(process.cwd(), "config", nombre)
  return parse(fs.readFileSync(ruta, "utf8"))
}

export function leerCasos(): Caso[] {
  const archivo = z.object({ casos: z.array(casoSchema).min(1) }).strict().parse(leerYaml("casos.yaml"))
  const slugs = new Set<string>()
  const claves = new Set<string>()
  const interlocutores = new Set<string>()
  for (const caso of archivo.casos) {
    if (slugs.has(caso.slug) || claves.has(caso.caso)) {
      throw new Error(`caso repetido: ${caso.slug}`)
    }
    slugs.add(caso.slug)
    claves.add(caso.caso)
    for (const interlocutor of caso.interlocutores) {
      if (interlocutores.has(interlocutor.slug)) {
        throw new Error(`slug de interlocutor repetido: ${interlocutor.slug}`)
      }
      interlocutores.add(interlocutor.slug)
    }
  }
  return archivo.casos
}

export function leerImprevistos(): CatalogoImprevistos {
  const crudo = z.record(z.string(), imprevistoSchema).parse(leerYaml("imprevistos.yaml"))
  const orden = Object.keys(crudo)
  const invalidas = orden.filter((clave) => !claveImprevisto.test(clave))
  if (invalidas.length > 0) {
    throw new Error(`claves de imprevisto inválidas: ${invalidas.join(", ")}`)
  }
  const clavesCaso = new Set(leerCasos().map((caso) => caso.caso))
  const ajenos = orden.filter((clave) => !clavesCaso.has(crudo[clave]?.caso ?? ""))
  if (ajenos.length > 0) {
    throw new Error(`imprevistos de un caso desconocido: ${ajenos.join(", ")}`)
  }
  return { orden, porClave: crudo }
}

export function casosVisibles(rol: "estudiante" | "instructor"): Caso[] {
  return leerCasos().filter((caso) => caso.activo && (caso.audiencia === "curso" || rol === "instructor"))
}

/** El plan B y la cobertura del curso usan solo el caso de audiencia curso. */
export function casoActivo(): Caso {
  const activos = leerCasos().filter((caso) => caso.activo && caso.audiencia === "curso")
  if (activos.length !== 1) {
    throw new Error("Tiene que haber un solo caso de curso activo.")
  }
  const caso = activos[0]
  if (!caso) throw new Error("Tiene que haber un solo caso de curso activo.")
  return caso
}

export function interlocutorPorSlug(slug: string): { caso: Caso; interlocutor: Interlocutor } | null {
  for (const caso of leerCasos()) {
    const interlocutor = caso.interlocutores.find((item) => item.slug === slug)
    if (interlocutor) return { caso, interlocutor }
  }
  return null
}

export function leerEquiposPlanB(): EquipoPlanB[] {
  return equiposPlanBSchema.parse(leerYaml("plan-b-equipos.yaml")).equipos
}
