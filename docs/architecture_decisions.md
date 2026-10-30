# Decisiones de arquitectura

Registro del porqué. Prevalece `AGENTS.md`. Lo marcado aquí es lo que quedó aprobado para el alcance M1.

## ADR-001 · Una sola aplicación Next.js

La plataforma es un wrapper: marca, acceso y flujo propios, y ElevenLabs ejecuta a los interlocutores. La interfaz y la API salen del mismo proceso Next.js (App Router, TypeScript strict). Cada frontera valida con Zod. Los logs del servidor van con pino.

El plan B no usa ese runtime. Es HTML estático para tener un respaldo aunque la aplicación no esté lista.

Se reutiliza la forma de `bartolo-pos` (Next.js, Zod, pino, Tailwind, Prisma, Postgres), no su dominio. No hay un front previo con el SDK web de ElevenLabs que se pueda copiar. `sofia-poc-cobranza` arma variables para llamadas salientes de telefonía, y ese camino no sirve aquí.

Licencias fijadas al instalar: Next, React, Zod, pino, Tailwind, Vitest, tsx y `@elevenlabs/react` en MIT. `next-auth` y `yaml` en ISC. Prisma y TypeScript en Apache 2.0. Ninguna es GPL, AGPL ni SSPL.

## ADR-002 · Google con Auth.js

El proveedor de identidad es Google. La lista de quién entra es regla de este sistema: el instructor carga nombre, correo y equipo, y una cuenta que no está en la lista no entra. Los correos de `INSTRUCTOR_EMAILS` entran como instructor aunque todavía no haya filas de estudiantes.

La sesión la firma Auth.js en una cookie `HttpOnly` con `SameSite=Lax`. `Secure` queda activo fuera de local, que es el comportamiento por defecto cuando la URL es HTTPS. El rol y el equipo se vuelven a leer en la base en cada pedido. La cookie no autoriza sola.

Se usa `next-auth` 5.0.0-beta.32 (ISC). La línea estable 4.24 no cubre el proxy de Next 16, y la documentación vigente de Auth.js ya describe la v5. Ruta de mejora: pasar a la v5 estable cuando deje el beta. No se suma otro SaaS de autenticación: igual haría falta la tabla de estudiantes y la comprobación de equipo en el servidor.

## ADR-003 · Postgres para equipos y conversaciones

Hace falta guardar equipos, estudiantes, el módulo de la cohorte, las activaciones, el identificador de cada conversación y el resumen por equipo y agente. No hace falta un motor propio.

En local corre Postgres 16 en Docker. La imagen oficial usa la licencia PostgreSQL, permisiva. No es autohospedaje de un software con licencia viral. Cuando se apruebe el despliegue, el mismo esquema apunta a un Postgres gestionado. Hasta entonces no se abre cuenta de nube.

Prisma 6, como en `bartolo-pos`, porque ya sabemos operarlo. Prisma no genera la migración hacia atrás: cada carpeta de `prisma/migrations` lleva un `down.sql` escrito a mano.

Identificadores: el equipo se expone por `slug`, el usuario por UUID y la conversación por el id que devuelve ElevenLabs. Las bajas de equipo y de estudiante marcan `deleted_at`. Las claves foráneas usan `ON DELETE RESTRICT` y `ON UPDATE RESTRICT`. El esquema vive en `docs/schema.dbml`.

## ADR-004 · Imprevistos leídos del YAML

`config/imprevistos.yaml` es la copia de configuración del kit. Las claves no se escriben en el código. El servidor valida caso, agente, módulo y texto, y exige claves con la forma `[a-z][a-z0-9_]*`. Desde el ADR-009 cada clave declara su caso.

A ElevenLabs se le envía un solo texto: las claves activas de ese equipo y de ese caso, en el orden del archivo, unidas por `; `. Si no hay ninguna, el valor es `ninguno`. Una clave guardada que ya no está en el catálogo no se envía y no bloquea la conversación. Activar una clave desconocida, o de otro módulo que el actual, sí falla. Las de un caso no viajan al otro.

El panel le muestra al instructor la clave, el módulo y el texto `sostiene`. Ese texto no sale en las pantallas del estudiante ni en el plan B.

## ADR-005 · Credencial de un solo uso y cuatro variables

Los agentes no se modifican desde este repositorio. La aplicación tampoco usa el widget: el widget exige agentes sin autenticación.

La documentación vigente parte la credencial según el transporte. El texto usa WebSocket y `GET /v1/convai/conversation/get-signed-url`. La voz usa WebRTC y `GET /v1/convai/conversation/token`. El cliente abre la sesión con `startSession` y `dynamicVariables`. El modo texto del hook no pide micrófono. No se envían overrides de prompt, voz ni modelo.

Las cuatro variables viajan siempre: `modulo`, `equipo`, `imprevistos_activos`, `resumen_previo`. Un valor vacío usa el default del kit (`M1`, `sin nombre`, `ninguno`, `ninguno`). El servidor las calcula. El SDK las entrega desde el navegador, así que las claves activas y el resumen de ese equipo se ven en la sesión de quien conversa, y esa persona puede alterarlas antes de que salgan. Se acepta para M1. El catálogo completo y el texto que sostiene cada clave no salen del servidor.

Antes de M2 se evalúa fijar esas cuatro variables con el webhook de inicio de conversación. La documentación vigente de ElevenLabs dice que ese webhook corre en telefonía y mensajería entrante, y que no corre en el widget ni en el SDK. La evaluación tiene que confirmar si para entonces también cubre la URL firmada y el token de esta aplicación. Si no los cubre, el cambio de kit no cierra el hueco.

Si el webhook ya cubre esas sesiones, en `fde-engagement-kit` haría falta activar, en los cuatro agentes, la lectura de los datos de inicio desde un webhook. La URL y el secreto salen de entorno, no del repositorio. La respuesta debe incluir `dynamic_variables` con las cuatro claves ya definidas en el agente y no debe habilitar overrides de prompt, voz ni modelo. El endpoint que calcula los valores vive en esta aplicación.

Al empezar se guarda el id de ElevenLabs con el equipo, el estudiante, el agente, el módulo, el modo y el texto de imprevistos que se armó para esa sesión. Ese id solo se acepta si hay una sesión vigente para ese interlocutor y ese modo, y si ElevenLabs atribuye la conversación al mismo usuario (`user_id`) y al mismo agente (`agent_id`). Si no coinciden, o si ElevenLabs no tiene la conversación, la respuesta es 404. La misma comprobación corre al leer la transcripción y al guardar el resumen, para no archivarla ni usarla como `resumen_previo`. La transcripción se lee con ese id. La plataforma no la reconstruye. La URL firmada y el token no se escriben en los logs.

El resumen sale de `transcript_summary` en `GET /v1/convai/conversations/{id}/summary`, cuando la conversación ya cerró. ElevenLabs lo arma después de cortar, así que el cliente lo pide al cortar y, si todavía no está, otra vez a los 5, 12 y 25 segundos. Se detiene en cuanto queda guardado. Un cierre atrasado no reemplaza el resumen si ese equipo ya empezó una conversación posterior con el mismo agente. Si al cabo de esa espera sigue vacío o el pedido falla, la fila no se escribe. Al empezar otra con ese agente, si la fila sigue vacía, se intenta leer el resumen otra vez. Si tampoco está, `resumen_previo` sale como `ninguno`. No se agrega un generador propio.

## ADR-006 · Plan B local y despliegue diferido

El plan B es HTML estático generado desde `config/plan-b-equipos.yaml`. Hay un índice, una página por equipo con cuatro enlaces y una página por interlocutor con un solo widget. Cada widget lleva `modulo` `M1`, el nombre del equipo, `imprevistos_activos` `ninguno` y `resumen_previo` `ninguno`. La lista de equipos entra vacía a propósito: no se inventan nombres. El generador no publica páginas de equipo hasta que esa lista tenga filas.

En uso normal los agentes quedan protegidos con `enable_auth`. El kit ya lo publica así: el ADR-019 de `fde-engagement-kit` deja `plan_b_publico` en falso y los cuatro agentes salen con `auth.enable_auth: true`, sin allowlist. Solo funciona la aplicación, que pide URL firmada o token. El widget no conecta, porque exige agentes públicos. El plan B es de emergencia. Si la aplicación falla, el cambio se hace en ese kit: `plan_b_publico` pasa a verdadero, los cuatro agentes quedan públicos y el widget se limita al host de `plan_b_host`. En local ese host es `127.0.0.1:8080`. ElevenLabs trata la URL firmada y la allowlist como métodos excluyentes, así que no se combinan. Mientras esa emergencia está activa, la aplicación deja de poder abrir sesión. El dominio público sigue pendiente.

Todo corre en local. No se despliega ni se abre cuenta de nube hasta que haya confirmación explícita. El dominio y la cuenta de Henry siguen pendientes.

Excepción, hasta que exista ese dominio: las páginas públicas no declaran `canonical`. Poner un host inventado sería peor que omitirlo. `sitemap.xml` del plan B usa `http://127.0.0.1:8080`, que es el servidor local documentado en el README. HSTS solo se envía si `HSTS=true`, para no forzar HTTPS en un `next start` local.

## ADR-007 · Marca propuesta

Faro AI es una empresa ficticia. La identidad de este entregable, para que se pueda ver y cambiar antes de usarla en clase:

- Faro geométrico en SVG, dibujado en el repositorio, sin copiar una marca existente.
- Azul noche `#0B1F33`, ámbar `#E6A23C`, crema `#F4EFE6`.
- Tipografía del sistema, para no sumar una fuente externa.

El favicon es un marcador de 16 píxeles con esos colores. Ruta de mejora: reemplazarlo cuando la marca quede aprobada.

Los insumos de la sesión (`faro-ai-platform-m1.md`, `contexto-agentes-para-plataforma.md`, `00-LEEME.md`, `01-prompt-inicial.md` y el `imprevistos.yaml` de la raíz) no se versionan. El `.gitignore` que los excluye quedó autorizado al aprobar el plan. `AGENTS.md` tampoco se versiona: queda solo en la máquina local, por decisión del 29 de octubre de 2026.

## ADR-008 · Voz apagada para estudiantes en M1

La prueba del 29 de octubre de 2026 midió el costo. Una conversación corta de texto gastó unos 120 créditos. La de voz, con Cliente Negocio, gastó 1374 créditos en 63 segundos: 1047 de la llamada y 327 del modelo. Para M1 la voz queda apagada para los estudiantes.

El interruptor es `voz_habilitada` en la fila única de la cohorte. El default es falso. Con falso, la pantalla de conversación solo ofrece texto. Si un estudiante pide modo voz, el servidor responde 403 y no pide el token a ElevenLabs. El instructor puede encenderlo desde el panel. El aviso del panel muestra esas dos mediciones y dice que, al encenderlo, la voz queda disponible para toda la cohorte.

Un instructor sigue pudiendo pedir el token aunque el interruptor esté apagado: el rechazo del servidor es para el rol estudiante. La pantalla tampoco le ofrece la voz mientras el interruptor está apagado.

## ADR-009 · Seguros Pampa solo para el instructor

Seguros Pampa convive con Energía del Litoral. Los cuatro agentes ya están publicados en el kit (su ADR-020), con `enable_auth` en verdadero. Este repositorio no los modifica. En `config/casos.yaml` el caso lleva `audiencia: instructor`. Energía del Litoral sigue en `audiencia: curso` y es el único que arma el plan B y la tabla de cobertura.

Un estudiante no ve las tarjetas de Seguros Pampa. Si pide credencial para uno de esos agentes, la respuesta es 403 y no se llama a ElevenLabs. Un slug que no existe, o un caso inactivo, sigue en 404. Los slugs de este caso llevan el prefijo `sp_`, como en el kit, para no pisar los de Energía del Litoral.

El instructor puede abrir esas conversaciones aunque su cuenta no tenga equipo. Aunque tenga uno, la fila se guarda en el equipo reservado `Demo del instructor`, slug `demo-del-instructor`. La variable `equipo`, los imprevistos y el resumen previo salen de ese equipo, no del equipo asignado. Por eso la conversación no aparece en el historial de los estudiantes. Ese equipo no entra al alta de estudiantes, ni a «todos los equipos», ni a la cobertura. En el panel, los imprevistos de Seguros Pampa se activan solo ahí. Energía del Litoral sigue usando el equipo de quien conversa.

`config/imprevistos.yaml` es la copia del kit, con el campo `caso`. El panel separa los imprevistos por caso. A la conversación solo se envían las claves activas de ese caso. Los marcadores `[[cifra:...]]` se muestran tal cual: las cifras viven en el kit y esta aplicación no las resuelve.

El kickoff de M1 es el martes 17 de noviembre de 2026. La clase 1 es el jueves 19 de noviembre de 2026.
