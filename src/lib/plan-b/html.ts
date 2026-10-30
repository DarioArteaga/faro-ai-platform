import type { EquipoPlanB, Interlocutor } from "@/lib/catalogo"
import { NINGUNO } from "@/lib/constantes"

const SCRIPT_WIDGET = "https://unpkg.com/@elevenlabs/convai-widget-embed@0.22.2"

export function escapar(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function variablesDeEquipo(nombre: string): string {
  return escapar(
    JSON.stringify({
      modulo: "M1",
      equipo: nombre,
      imprevistos_activos: NINGUNO,
      resumen_previo: NINGUNO,
    }),
  )
}

const ESTILO = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #f4efe6;
  color: #14202b;
  font-family: "Segoe UI", "Helvetica Neue", sans-serif;
  line-height: 1.5;
}
a { color: inherit; }
a:hover { text-decoration-thickness: 2px; }
:focus-visible { outline: 3px solid #e6a23c; outline-offset: 2px; }
.marca {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #0b1f33;
  color: #f4efe6;
  padding: 1rem 1.5rem;
}
.marca p { margin: 0; font-weight: 700; }
.contenido { max-width: 64rem; margin: 0 auto; padding: 1.5rem; }
h1 { font-size: 2rem; line-height: 1.2; margin: 0 0 0.5rem; }
.tarjeta {
  background: #fffdf8;
  border: 1px solid #0b1f33;
  border-top: 4px solid #e6a23c;
  padding: 1rem 1.25rem;
  margin: 1rem 0;
}
h2 { font-size: 1.25rem; margin: 0 0 0.35rem; }
.meta { margin: 0.25rem 0; }
.pie { margin-top: 2rem; font-size: 0.9rem; }
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
`

const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 64 64" aria-hidden="true">
  <rect width="64" height="64" rx="12" fill="#0B1F33"/>
  <path d="M32 8 L40 26 H24 Z" fill="#E6A23C"/>
  <rect x="28" y="26" width="8" height="14" fill="#F4EFE6"/>
  <path d="M18 40 H46 L50 54 H14 Z" fill="#E6A23C"/>
  <rect x="30" y="54" width="4" height="6" fill="#F4EFE6"/>
</svg>`

function documento(opciones: {
  titulo: string
  descripcion: string
  canonicalPath: string
  origen: string
  cuerpo: string
  jsonLd: boolean
}): string {
  const titulo = escapar(opciones.titulo)
  const descripcion = escapar(opciones.descripcion)
  const imagen = `${opciones.origen}/logo.svg`
  const datos = opciones.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Faro AI",
        description: "Empresa ficticia. Plataforma para conversar con los interlocutores del curso.",
      })}</script>`
    : ""
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${titulo}</title>
  <meta name="description" content="${descripcion}">
  <meta property="og:title" content="${titulo}">
  <meta property="og:description" content="${descripcion}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="es_MX">
  <meta property="og:image" content="${escapar(imagen)}">
  <link rel="icon" href="/favicon.ico">
  <!-- ponytail: canonical cuando exista el dominio público. Hoy el sitio solo se sirve en local. -->
  <!-- ponytail: ajustar connect-src cuando se pruebe el widget contra ElevenLabs -->
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://unpkg.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.elevenlabs.io wss://api.elevenlabs.io https://*.elevenlabs.io wss://*.elevenlabs.io https://*.livekit.cloud wss://*.livekit.cloud; media-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'">
  <style>${ESTILO}</style>
  ${datos}
</head>
<body>
  <a class="sr-only" href="#contenido">Saltar al contenido</a>
  <header class="marca">
    ${LOGO}
    <p>Faro AI</p>
  </header>
  <main id="contenido" class="contenido">
    ${opciones.cuerpo}
    <p class="pie">Faro AI es una empresa ficticia.</p>
  </main>
</body>
</html>
`
}

export function renderIndice(equipos: readonly EquipoPlanB[], origen: string): string {
  const lista =
    equipos.length === 0
      ? "<p>Todavía no hay páginas de equipo. La lista vive en la configuración y el generador publica una página por cada fila.</p>"
      : `<ul>${equipos
          .map(
            (equipo) =>
              `<li><a href="/equipos/${escapar(equipo.slug)}.html">${escapar(equipo.nombre)}</a></li>`,
          )
          .join("")}</ul>`
  return documento({
    titulo: "Faro AI",
    descripcion: "Páginas de respaldo de Faro AI. Cada equipo tiene un índice y cada interlocutor, su página.",
    canonicalPath: "/",
    origen,
    jsonLd: true,
    cuerpo: `<h1>Faro AI</h1>
    <p>Respaldo estático. Cada equipo tiene un índice y cada interlocutor, su página.</p>
    ${lista}`,
  })
}

export function renderPaginaEquipo(
  equipo: EquipoPlanB,
  interlocutores: readonly Interlocutor[],
  origen: string,
): string {
  const tarjetas = interlocutores
    .map(
      (interlocutor) => `<article class="tarjeta">
      <h2><a href="/equipos/${escapar(equipo.slug)}/${escapar(interlocutor.slug)}.html">${escapar(interlocutor.nombre)}</a></h2>
      <p class="meta">${escapar(interlocutor.quien)}</p>
      <p class="meta">Qué le importa: ${escapar(interlocutor.importa)}</p>
    </article>`,
    )
    .join("\n")
  return documento({
    titulo: `${equipo.nombre} · Faro AI`,
    descripcion: `Índice del equipo ${equipo.nombre}. Cada interlocutor abre en su propia página.`,
    canonicalPath: `/equipos/${equipo.slug}.html`,
    origen,
    jsonLd: false,
    cuerpo: `<p><a href="/">Todos los equipos</a></p>
    <h1>${escapar(equipo.nombre)}</h1>
    <p>Módulo 1. Elige un interlocutor para empezar.</p>
    ${tarjetas}`,
  })
}

export function renderPaginaInterlocutor(equipo: EquipoPlanB, interlocutor: Interlocutor, origen: string): string {
  return documento({
    titulo: `${interlocutor.nombre} · ${equipo.nombre} · Faro AI`,
    descripcion: `Conversación de ${equipo.nombre} con ${interlocutor.nombre}.`,
    canonicalPath: `/equipos/${equipo.slug}/${interlocutor.slug}.html`,
    origen,
    jsonLd: false,
    cuerpo: `<p><a href="/equipos/${escapar(equipo.slug)}.html">Volver a ${escapar(equipo.nombre)}</a></p>
    <h1>${escapar(interlocutor.nombre)}</h1>
    <p class="meta">${escapar(interlocutor.quien)}</p>
    <p class="meta">Qué le importa: ${escapar(interlocutor.importa)}</p>
    <elevenlabs-convai agent-id="${escapar(interlocutor.agent_id)}" dynamic-variables="${variablesDeEquipo(equipo.nombre)}"></elevenlabs-convai>
    <script src="${SCRIPT_WIDGET}" async type="text/javascript"></script>`,
  })
}

export function renderMapa(origen: string, equipos: readonly EquipoPlanB[], interlocutores: readonly Interlocutor[]): string {
  const rutas = [
    "/",
    ...equipos.flatMap((equipo) => [
      `/equipos/${equipo.slug}.html`,
      ...interlocutores.map((interlocutor) => `/equipos/${equipo.slug}/${interlocutor.slug}.html`),
    ]),
  ]
  const urls = rutas
    .map((ruta) => `  <url><loc>${escapar(`${origen}${ruta}`)}</loc></url>`)
    .join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- ponytail: reemplazar el host cuando exista el dominio público -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}
