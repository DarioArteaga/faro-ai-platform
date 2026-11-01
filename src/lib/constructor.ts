import fs from "node:fs"
import path from "node:path"

import { parse } from "yaml"
import { z } from "zod"

import { ErrorHttp } from "@/lib/errores"

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const identificador = z.string().regex(/^[A-Za-z0-9._-]+$/)

const archivoSchema = z
  .object({
    caso_slug: slug,
    prefijo_nombre: z.string().min(1).max(20),
    tts_model_id: identificador,
    encabezado_secreto: z.string().regex(/^[a-z0-9-]+$/),
    idioma: z.literal("es"),
    prompt_max: z.number().int().min(100).max(20_000),
    nombre_max: z.number().int().min(1).max(120),
    primer_mensaje_max: z.number().int().min(0).max(2_000),
    herramientas_max: z.number().int().min(1).max(2),
    parametros_max: z.number().int().min(0).max(20),
    simulacion_turnos_max: z.number().int().min(1).max(20),
    modelo_simulacion: identificador,
    topes: z
      .object({
        conversaciones_texto: z.number().int().min(1).max(10_000),
        simulaciones: z.number().int().min(1).max(1_000),
        minutos_voz: z.number().int().min(1).max(600),
      })
      .strict(),
    voces: z
      .array(
        z
          .object({
            slug,
            nombre: z.string().min(1).max(40),
            detalle: z.string().min(1).max(120),
            voice_id: z.string().min(1).max(80),
          })
          .strict(),
      )
      .length(4),
    modelos: z
      .array(
        z
          .object({
            slug,
            nombre: z.string().min(1).max(60),
            llm: identificador,
          })
          .strict(),
      )
      .length(3),
  })
  .strict()

export type CatalogoConstructor = z.infer<typeof archivoSchema>
export type VozConstructor = CatalogoConstructor["voces"][number]
export type ModeloConstructor = CatalogoConstructor["modelos"][number]

export type ParametroTool = {
  nombre: string
  tipo: "string" | "number" | "boolean"
  descripcion: string
  ejemplo: string
}

export type ToolEntrada = {
  url: string
  metodo: "GET" | "POST"
  descripcion: string
  parametros: ParametroTool[]
  secreto?: string
}

export type ConfigEntrada = {
  nombre: string
  prompt: string
  primerMensaje: string
  voz: VozConstructor
  modelo: ModeloConstructor
  tool: ToolEntrada | null
}

export type SnapshotAgente = {
  nombre: string
  prompt: string
  primer_mensaje: string
  voz_slug: string
  modelo_slug: string
  tool: {
    url: string
    metodo: "GET" | "POST"
    descripcion: string
    parametros: ParametroTool[]
    tiene_secreto: boolean
  } | null
}

const MARCA_VOZ = "REEMPLAZAR"

export function leerConstructor(): CatalogoConstructor {
  const ruta = path.join(process.cwd(), "config", "constructor.yaml")
  const archivo = archivoSchema.parse(parse(fs.readFileSync(ruta, "utf8")))
  const voces = new Set<string>()
  const modelos = new Set<string>()
  for (const voz of archivo.voces) {
    if (voces.has(voz.slug)) throw new Error(`voz repetida: ${voz.slug}`)
    voces.add(voz.slug)
  }
  for (const modelo of archivo.modelos) {
    if (modelos.has(modelo.slug)) throw new Error(`modelo repetido: ${modelo.slug}`)
    modelos.add(modelo.slug)
  }
  if (!archivo.modelos.some((item) => item.llm === archivo.modelo_simulacion)) {
    throw new Error("el modelo de simulación no está en la lista")
  }
  return archivo
}

export function vozUtilizable(voiceId: string): boolean {
  const limpio = voiceId.trim()
  return limpio.length > 0 && !limpio.includes(MARCA_VOZ)
}

export function opcionesPublicas(catalogo: CatalogoConstructor): {
  voces: { slug: string; nombre: string; detalle: string }[]
  modelos: { slug: string; nombre: string }[]
} {
  return {
    voces: catalogo.voces.map((voz) => ({ slug: voz.slug, nombre: voz.nombre, detalle: voz.detalle })),
    modelos: catalogo.modelos.map((modelo) => ({ slug: modelo.slug, nombre: modelo.nombre })),
  }
}

export function nombreEnEleven(prefijo: string, nombre: string): string {
  const limpio = nombre.trim()
  if (limpio.startsWith(prefijo)) return limpio.slice(0, 120)
  return `${prefijo}${limpio}`.slice(0, 120)
}

function esquemaParametro(maxEjemplo: number) {
  return z
    .object({
      nombre: z.string().regex(/^[a-z][a-z0-9_]*$/).max(40),
      tipo: z.enum(["string", "number", "boolean"]),
      descripcion: z.string().trim().min(1).max(300),
      ejemplo: z.string().max(maxEjemplo),
    })
    .strict()
}

export function validarConfiguracion(catalogo: CatalogoConstructor, entrada: unknown): ConfigEntrada {
  const toolSchema = z
    .object({
      url: z.string().trim().min(1).max(500),
      metodo: z.enum(["GET", "POST"]),
      descripcion: z.string().trim().min(1).max(1_000),
      parametros: z.array(esquemaParametro(200)).max(catalogo.parametros_max),
      secreto: z.string().min(8).max(200).optional(),
    })
    .strict()
  const esquema = z
    .object({
      nombre: z.string().trim().min(1).max(catalogo.nombre_max),
      prompt: z.string().trim().min(1).max(catalogo.prompt_max),
      primer_mensaje: z.string().max(catalogo.primer_mensaje_max),
      voz_slug: slug,
      modelo_slug: slug,
      tool: toolSchema.nullable().optional(),
    })
    .strict()
  const datos = esquema.parse(entrada)
  const voz = catalogo.voces.find((item) => item.slug === datos.voz_slug)
  const modelo = catalogo.modelos.find((item) => item.slug === datos.modelo_slug)
  if (!voz || !modelo) throw new ErrorHttp(400, "La voz o el modelo no están permitidos.")
  if (!vozUtilizable(voz.voice_id)) {
    throw new ErrorHttp(400, "Esa voz todavía no tiene identificador.")
  }
  const nombres = new Set<string>()
  for (const parametro of datos.tool?.parametros ?? []) {
    if (nombres.has(parametro.nombre)) throw new ErrorHttp(400, "Hay dos parámetros con el mismo nombre.")
    nombres.add(parametro.nombre)
  }
  if (datos.tool && catalogo.herramientas_max < 1) {
    throw new ErrorHttp(400, "Este módulo no admite tools.")
  }
  return {
    nombre: datos.nombre,
    prompt: datos.prompt,
    primerMensaje: datos.primer_mensaje,
    voz,
    modelo,
    tool: datos.tool ?? null,
  }
}

export function snapshotDe(entrada: ConfigEntrada, tieneSecreto: boolean): SnapshotAgente {
  return {
    nombre: entrada.nombre,
    prompt: entrada.prompt,
    primer_mensaje: entrada.primerMensaje,
    voz_slug: entrada.voz.slug,
    modelo_slug: entrada.modelo.slug,
    tool: entrada.tool
      ? {
          url: entrada.tool.url,
          metodo: entrada.tool.metodo,
          descripcion: entrada.tool.descripcion,
          parametros: entrada.tool.parametros,
          tiene_secreto: tieneSecreto || Boolean(entrada.tool.secreto),
        }
      : null,
  }
}

export function entradaDesdeSnapshot(catalogo: CatalogoConstructor, snapshot: unknown): ConfigEntrada {
  const esquema = z
    .object({
      nombre: z.string(),
      prompt: z.string(),
      primer_mensaje: z.string(),
      voz_slug: z.string(),
      modelo_slug: z.string(),
      tool: z
        .object({
          url: z.string(),
          metodo: z.enum(["GET", "POST"]),
          descripcion: z.string(),
          parametros: z.array(esquemaParametro(200)),
          tiene_secreto: z.boolean(),
        })
        .nullable(),
    })
    .strict()
  const datos = esquema.parse(snapshot)
  return validarConfiguracion(catalogo, {
    nombre: datos.nombre,
    prompt: datos.prompt,
    primer_mensaje: datos.primer_mensaje,
    voz_slug: datos.voz_slug,
    modelo_slug: datos.modelo_slug,
    tool: datos.tool
      ? {
          url: datos.tool.url,
          metodo: datos.tool.metodo,
          descripcion: datos.tool.descripcion,
          parametros: datos.tool.parametros,
        }
      : null,
  })
}

export function bloqueoDeTope(
  tipo: "texto" | "voz" | "simulacion",
  uso: { texto: number; simulaciones: number; segundosVoz: number },
  topes: { conversacionesTexto: number; simulaciones: number; minutosVoz: number },
): string | null {
  if (tipo === "texto" && uso.texto >= topes.conversacionesTexto) {
    return "Llegaron al tope de conversaciones de texto. Pidan al instructor que lo amplíe."
  }
  if (tipo === "simulacion" && uso.simulaciones >= topes.simulaciones) {
    return "Llegaron al tope de simulaciones. Pidan al instructor que lo amplíe."
  }
  if (tipo === "voz" && uso.segundosVoz >= topes.minutosVoz * 60) {
    return "Llegaron al tope de minutos de voz. Pidan al instructor que lo amplíe."
  }
  return null
}

export function ejemploDeParametro(parametro: ParametroTool): string | number | boolean {
  if (parametro.tipo === "number") {
    const numero = Number(parametro.ejemplo)
    return Number.isFinite(numero) ? numero : 0
  }
  if (parametro.tipo === "boolean") return parametro.ejemplo === "true"
  return parametro.ejemplo
}
