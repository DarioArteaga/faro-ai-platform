import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { casoActivo, leerImprevistos } from "@/lib/catalogo"
import { escribirSitio } from "@/lib/plan-b/generar"
import { renderIndice, renderPaginaEquipo, renderPaginaInterlocutor } from "@/lib/plan-b/html"

const SCRIPT_AUSENTE = "convai-widget-embed"

const IDS = [
  "agent_1601m5z3e58tfmav6hacn6d60tc7",
  "agent_7801m5z7vge6emwtjza7vqh8r5qe",
  "agent_1301m5z8zb6afmq9wg0n0qrcj79g",
  "agent_3701m5zcsvefeb5s6s66s6ffd6er",
]

describe("plan B", () => {
  const caso = casoActivo()

  it("el índice del equipo enlaza a los cuatro interlocutores y no embebe widgets", () => {
    const html = renderPaginaEquipo({ slug: "equipo-prueba", nombre: "Equipo <Prueba>" }, caso.interlocutores, "http://127.0.0.1:8080")
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1)
    expect(html).toContain("Equipo &lt;Prueba&gt;")
    expect(html.match(/<elevenlabs-convai/g)).toBeNull()
    expect(html).not.toContain("agent_")
    expect(html).not.toContain(SCRIPT_AUSENTE)
    for (const interlocutor of caso.interlocutores) {
      expect(html).toContain(`/equipos/equipo-prueba/${interlocutor.slug}.html`)
      expect(html).toContain(interlocutor.nombre)
    }
  })

  it("cada interlocutor publica un solo widget, con las cuatro variables y sin el texto de los imprevistos", () => {
    const equipo = { slug: "equipo-prueba", nombre: "Equipo <Prueba>" }
    const paginas = caso.interlocutores.map((interlocutor) => renderPaginaInterlocutor(equipo, interlocutor, "http://127.0.0.1:8080"))
    expect(caso.interlocutores.map((item) => item.agent_id)).toEqual(IDS)
    for (const [indice, html] of paginas.entries()) {
      expect(html.match(/<h1[\s>]/g)).toHaveLength(1)
      expect(html.match(/<elevenlabs-convai/g)).toHaveLength(1)
      expect(html.match(/convai-widget-embed/g)).toHaveLength(1)
      expect(html).toContain("Equipo &lt;Prueba&gt;")
      expect(html).toContain("&quot;modulo&quot;:&quot;M1&quot;")
      expect(html).toContain("&quot;equipo&quot;:&quot;Equipo &lt;Prueba&gt;&quot;")
      expect(html).toContain("&quot;imprevistos_activos&quot;:&quot;ninguno&quot;")
      expect(html).toContain("&quot;resumen_previo&quot;:&quot;ninguno&quot;")
      expect(html).toContain(IDS[indice])
      for (const otro of IDS) {
        if (otro !== IDS[indice]) expect(html).not.toContain(otro)
      }
      for (const item of Object.values(leerImprevistos().porClave)) {
        expect(html).not.toContain(item.sostiene)
      }
      expect(html).not.toContain("faro-ai-platform-m1")
      expect(html).not.toContain("contexto-agentes-para-plataforma")
    }
  })

  it("el índice vacío no embebe agentes", () => {
    const html = renderIndice([], "http://127.0.0.1:8080")
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1)
    expect(html).not.toContain("elevenlabs-convai")
    expect(html).not.toContain("agent_")
  })

  it("escribe el índice del equipo, una página por interlocutor y borra lo que sobra", () => {
    const destino = fs.mkdtempSync(path.join(os.tmpdir(), "faro-plan-b-"))
    fs.mkdirSync(path.join(destino, "equipos", "viejo"), { recursive: true })
    fs.mkdirSync(path.join(destino, "equipos", "norte"), { recursive: true })
    fs.writeFileSync(path.join(destino, "equipos", "viejo.html"), "<p>viejo</p>")
    fs.writeFileSync(path.join(destino, "equipos", "norte", "sobra.html"), "<p>sobra</p>")
    escribirSitio(destino, "http://127.0.0.1:8080", [{ slug: "norte", nombre: "Norte" }], caso)
    expect(fs.existsSync(path.join(destino, "equipos", "norte.html"))).toBe(true)
    expect(fs.existsSync(path.join(destino, "equipos", "viejo.html"))).toBe(false)
    expect(fs.existsSync(path.join(destino, "equipos", "viejo"))).toBe(false)
    expect(fs.existsSync(path.join(destino, "equipos", "norte", "sobra.html"))).toBe(false)
    const mapa = fs.readFileSync(path.join(destino, "sitemap.xml"), "utf8")
    for (const interlocutor of caso.interlocutores) {
      const ruta = path.join(destino, "equipos", "norte", `${interlocutor.slug}.html`)
      const html = fs.readFileSync(ruta, "utf8")
      expect(html.match(/<elevenlabs-convai/g)).toHaveLength(1)
      expect(mapa).toContain(`/equipos/norte/${interlocutor.slug}.html`)
    }
  })
})
