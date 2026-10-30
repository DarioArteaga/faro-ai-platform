import fs from "node:fs"
import path from "node:path"

import { parse } from "yaml"
import { z } from "zod"

import { AGENTES_IMPREVISTO, MODULOS } from "@/lib/constantes"

const claveImprevisto = /^[a-z][a-z0-9_]*$/
const slugInterlocutor = /^[a-z0-9_]+$/
const idAgente = /^agent_[a-z0-9]+$/

const imprevistoSchema = z
  .object({
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

export function leerImprevistos(): CatalogoImprevistos {
  const crudo = z.record(z.string(), imprevistoSchema).parse(leerYaml("imprevistos.yaml"))
  const orden = Object.keys(crudo)
  const invalidas = orden.filter((clave) => !claveImprevisto.test(clave))
  if (invalidas.length > 0) {
    throw new Error(`claves de imprevisto inválidas: ${invalidas.join(", ")}`)
  }
  return { orden, porClave: crudo }
}

export function leerCasos(): Caso[] {
  const archivo = z.object({ casos: z.array(casoSchema).min(1) }).strict().parse(leerYaml("casos.yaml"))
  return archivo.casos
}

export function casoActivo(): Caso {
  const activos = leerCasos().filter((caso) => caso.activo)
  if (activos.length !== 1) {
    throw new Error("Tiene que haber un solo caso activo.")
  }
  const caso = activos[0]
  if (!caso) throw new Error("Tiene que haber un solo caso activo.")
  return caso
}

export function interlocutorPorSlug(slug: string): Interlocutor | null {
  return casoActivo().interlocutores.find((item) => item.slug === slug) ?? null
}

export function leerEquiposPlanB(): EquipoPlanB[] {
  return equiposPlanBSchema.parse(leerYaml("plan-b-equipos.yaml")).equipos
}
