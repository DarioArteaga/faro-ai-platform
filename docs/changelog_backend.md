# Cambios del backend

- [2026-10-29] [FEAT] La cohorte tiene el interruptor `voz_habilitada`, apagado por defecto. Un estudiante no recibe token de voz mientras esté apagado.
  Archivos modificados: prisma/schema.prisma, prisma/migrations/20261030031000_voz_habilitada/migration.sql, prisma/migrations/20261030031000_voz_habilitada/down.sql, docs/schema.dbml, docs/architecture_decisions.md, docs/architecture_c4.md, src/lib/autorizacion.ts, src/servicios/cohorte.ts, src/servicios/conversaciones.ts, src/servicios/instructor.ts, src/servicios/rutas-instructor.ts, src/app/api/v1/instructor/voz/route.ts, tests/autorizacion.test.ts

- [2026-10-29] [DOCS] ADR-006 registra que el kit ya publica `enable_auth` en verdadero, y el README usa `prisma migrate deploy`.
  Archivos modificados: docs/architecture_decisions.md, README.md

- [2026-10-29] [FIX] Un cierre atrasado no reemplaza el resumen de una conversación posterior del mismo equipo y agente.
  Archivos modificados: src/servicios/conversaciones.ts, docs/architecture_decisions.md

- [2026-10-29] [SEC] Una conversación solo se registra, se lee y alimenta el resumen si ElevenLabs la atribuye a ese usuario y a ese agente, y si el registro nace de una sesión vigente.
  Archivos modificados: src/lib/autorizacion.ts, src/lib/elevenlabs.ts, src/servicios/conversaciones.ts, tests/autorizacion.test.ts, tests/repositorio.test.ts, docs/architecture_decisions.md, .gitignore

- [2026-10-29] [DOCS] ADR-005 deja para antes de M2 la evaluación del webhook de inicio, y ADR-006 fija que el plan B público es solo de emergencia.
  Archivos modificados: docs/architecture_decisions.md, docs/architecture_c4.md

- [2026-10-29] [FEAT] Sesión con Google, Postgres, credencial de un solo uso para ElevenLabs, registro de conversaciones, resumen previo y panel del instructor.
  Archivos modificados: src/auth.ts, src/app/api/auth/[...nextauth]/route.ts, src/app/api/v1/conversaciones/route.ts, src/app/api/v1/conversaciones/sesion/route.ts, src/app/api/v1/conversaciones/[id]/route.ts, src/app/api/v1/conversaciones/[id]/cerrar/route.ts, src/app/api/v1/instructor/panel/route.ts, src/app/api/v1/instructor/modulo/route.ts, src/app/api/v1/instructor/imprevistos/route.ts, src/app/api/v1/instructor/conversaciones/route.ts, src/app/api/v1/instructor/equipos/route.ts, src/app/api/v1/instructor/equipos/[slug]/route.ts, src/app/api/v1/instructor/estudiantes/route.ts, src/app/api/v1/instructor/estudiantes/[id]/route.ts, src/servicios/acceso.ts, src/servicios/sesion.ts, src/servicios/cohorte.ts, src/servicios/conversaciones.ts, src/servicios/instructor.ts, src/servicios/rutas-instructor.ts, src/lib/autorizacion.ts, src/lib/catalogo.ts, src/lib/constantes.ts, src/lib/db.ts, src/lib/elevenlabs.ts, src/lib/enmascarar.ts, src/lib/errores.ts, src/lib/fecha.ts, src/lib/http.ts, src/lib/imprevistos.ts, src/lib/limite.ts, src/lib/log.ts, src/lib/paginacion.ts, src/lib/slug.ts, src/lib/validar.ts, src/lib/variables.ts, config/casos.yaml, config/imprevistos.yaml, config/plan-b-equipos.yaml, prisma/schema.prisma, prisma/migrations/migration_lock.toml, prisma/migrations/20261029190000_init/migration.sql, prisma/migrations/20261029190000_init/down.sql, docker-compose.yml, .env.example, tests/autorizacion.test.ts, tests/imprevistos.test.ts, tests/plan-b.test.ts, tests/repositorio.test.ts, tests/utilidades.test.ts, tests/variables.test.ts
