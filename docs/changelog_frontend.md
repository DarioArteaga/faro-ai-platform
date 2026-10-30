# Cambios del frontend

- [2026-10-29] [FEAT] Con la voz apagada, la conversación solo ofrece texto. El instructor la enciende desde el panel, con el aviso del costo.
  Archivos modificados: src/componentes/conversacion-cliente.tsx, src/app/(plataforma)/conversacion/[slug]/page.tsx, src/app/(plataforma)/instructor/page.tsx, src/acciones/instructor.ts

- [2026-10-29] [FIX] La transcripción en vivo muestra lo que escribe el estudiante, y el cierre reintenta el resumen hasta los 25 segundos.
  Archivos modificados: src/componentes/conversacion-cliente.tsx, src/lib/conversacion-viva.ts, tests/conversacion-viva.test.ts

- [2026-10-29] [FEAT] El plan B separa el índice de cada equipo y la página de cada interlocutor, con un solo widget por página.
  Archivos modificados: src/lib/plan-b/html.ts, src/lib/plan-b/generar.ts, tests/plan-b.test.ts, plan-b/index.html, plan-b/sitemap.xml, docs/architecture_c4.md, docs/architecture_decisions.md

- [2026-10-29] [FEAT] Plan B estático por equipo y la aplicación Next.js de M1: acceso con Google, interlocutores, conversación en texto o voz, historial y panel del instructor.
  Archivos modificados: plan-b/favicon.ico, plan-b/index.html, plan-b/llms.txt, plan-b/logo.svg, plan-b/robots.txt, plan-b/sitemap.xml, public/favicon.ico, public/llms.txt, public/logo.svg, public/robots.txt, public/sitemap.xml, scripts/build-plan-b.ts, src/lib/plan-b/generar.ts, src/lib/plan-b/html.ts, src/lib/log-cliente.ts, src/acciones/instructor.ts, src/acciones/sesion.ts, src/componentes/conversacion-cliente.tsx, src/componentes/navegacion.tsx, src/app/layout.tsx, src/app/page.tsx, src/app/globals.css, src/app/error.tsx, src/app/global-error.tsx, src/app/not-found.tsx, src/app/login/page.tsx, src/app/(plataforma)/layout.tsx, src/app/(plataforma)/interlocutores/page.tsx, src/app/(plataforma)/conversacion/[slug]/page.tsx, src/app/(plataforma)/historial/page.tsx, src/app/(plataforma)/historial/[id]/page.tsx, src/app/(plataforma)/instructor/page.tsx, next.config.ts, postcss.config.mjs, eslint.config.mjs, package.json, package-lock.json, tsconfig.json, vitest.config.mts
