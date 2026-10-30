import fs from "node:fs"
import path from "node:path"

import { casoActivo, leerEquiposPlanB, type Caso, type EquipoPlanB } from "@/lib/catalogo"
import { renderIndice, renderMapa, renderPaginaEquipo, renderPaginaInterlocutor } from "@/lib/plan-b/html"

export function escribirSitio(
  destino: string,
  origen: string,
  equipos: readonly EquipoPlanB[],
  caso: Caso,
): void {
  const carpetaEquipos = path.join(destino, "equipos")
  fs.mkdirSync(carpetaEquipos, { recursive: true })
  fs.writeFileSync(path.join(destino, "index.html"), renderIndice(equipos, origen), "utf8")
  fs.writeFileSync(path.join(destino, "sitemap.xml"), renderMapa(origen, equipos, caso.interlocutores), "utf8")
  const slugs = new Set(equipos.map((equipo) => equipo.slug))
  for (const entrada of fs.readdirSync(carpetaEquipos, { withFileTypes: true })) {
    const slug = entrada.name.endsWith(".html") ? entrada.name.slice(0, -".html".length) : entrada.name
    if (!slugs.has(slug)) fs.rmSync(path.join(carpetaEquipos, entrada.name), { recursive: true, force: true })
  }
  const paginas = new Set(caso.interlocutores.map((interlocutor) => `${interlocutor.slug}.html`))
  for (const equipo of equipos) {
    fs.writeFileSync(
      path.join(carpetaEquipos, `${equipo.slug}.html`),
      renderPaginaEquipo(equipo, caso.interlocutores, origen),
      "utf8",
    )
    const carpeta = path.join(carpetaEquipos, equipo.slug)
    fs.mkdirSync(carpeta, { recursive: true })
    for (const archivo of fs.readdirSync(carpeta)) {
      if (archivo.endsWith(".html") && !paginas.has(archivo)) fs.unlinkSync(path.join(carpeta, archivo))
    }
    for (const interlocutor of caso.interlocutores) {
      fs.writeFileSync(
        path.join(carpeta, `${interlocutor.slug}.html`),
        renderPaginaInterlocutor(equipo, interlocutor, origen),
        "utf8",
      )
    }
  }
}

export function generarSitioEstatico(destino = path.join(process.cwd(), "plan-b")): void {
  const origen = process.env.PLAN_B_ORIGIN ?? "http://127.0.0.1:8080"
  escribirSitio(destino, origen, leerEquiposPlanB(), casoActivo())
}
