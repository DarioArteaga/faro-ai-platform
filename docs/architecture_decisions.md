# Decisiones de arquitectura

Registro del porqué. Prevalece `AGENTS.md`. Hasta el ADR-009 es el alcance M1. El ADR-010 cierra, antes de M2, el riesgo de que el navegador altere las variables de la conversación.

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

La evaluación prometida antes de M2 quedó cerrada en el ADR-010: el webhook no cubre estas sesiones, y el control pasa a ser la comparación de la ficha.

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

## ADR-010 · Variables de conversación comprobadas al leer la ficha

El 31 de octubre de 2026 se revisó la documentación vigente de ElevenLabs, sin abrir una conversación. El webhook de inicio sigue sin correr en el widget ni en el SDK. No cubre la URL firmada ni el token de esta aplicación. Esas dos credenciales tampoco aceptan las variables ni los overrides: solo identifican al agente y, si se piden, la rama, la versión o el entorno de secretos del workspace. Activar el webhook en el kit no cierra el hueco. Se descarta ese webhook, embeber las variables en la credencial, un modelo propio y una rama de agente por módulo. El plan B no cambia.

ElevenLabs sí rechaza un override de prompt, modelo o voz cuando ese permiso está apagado en el agente. Esos permisos nacen apagados. Esta aplicación no los enciende y no los manda. El constructor de agentes de M2, cuando se construya, escribe la voz y el modelo en el agente desde el servidor y deja apagados `prompt`, `llm` y `voice_id`. `text_only` puede quedar encendido solo porque el SDK lo usa para el modo: en texto es verdadero y en voz es falso o ausente. Un `text_only` ausente no se marca. Uno que contradice el modo, sí.

Al registrar la conversación, y otra vez al cerrar si la primera lectura todavía no trae el mapa, se compara lo emitido con `conversation_initiation_client_data`. Hacen falta las cuatro cadenas, iguales. Una clave de más, distinta de las `system__`, es alteración. Si el mapa no vino, el control queda `pendiente` y no se da por coincidente. Un override de voz, modelo, prompt, primer mensaje, idioma o cuerpo extra del modelo también es alteración. No se guarda el texto recibido ni se escribe en el log. La fila anterior a este control queda en `anterior` y el panel no la marca.

El panel del instructor muestra «Alterada», «Sin comprobar» o «En orden». El historial del estudiante no muestra el control. Si alguien usa la credencial y bloquea el registro, no hay fila: ese límite se acepta. No se reconcilia el listado de ElevenLabs.

El mismo día se leyeron los ocho agentes de `config/casos.yaml`, sin imprimir prompts ni la clave y sin abrir conversación. En los ocho, `prompt`, `llm` y `voice_id` están en falso, igual que el webhook de inicio. `text_only` está en verdadero: el SDK lo usa para el modo y se deja. No se modifica el kit desde este repositorio. Si `prompt`, `llm` o `voice_id` aparecieran encendidos, el cambio sería del kit.

## ADR-011 · Voces y modelos del constructor fuera del código

Las cuatro voces y los tres modelos viven en `config/constructor.yaml`. El 31 de octubre de 2026 el usuario reemplazó los identificadores de ejemplo por las voces del workspace: Juan Carlos, Cristina Campos, Martina y Omar. El cliente solo recibe slug y nombre. El servidor resuelve `llm` y `voice_id`. Un `voice_id` que contiene `REEMPLAZAR` se rechaza en español y no llama a ElevenLabs. Ahí también viven el tope de 8.000 caracteres del prompt, el prefijo `M2 · `, el modelo de voz `eleven_v4_turbo`, el encabezado `x-faro-tool-secret`, los topes 200, 60 y 15, y el máximo de una tool. Esos números son la propuesta de la spec del 31 de octubre de 2026, a la espera de Daniel. Se cambian en el archivo, no en el código.

El 31 de octubre de 2026, `GET /v1/convai/llm/list` confirmó los tres modelos en este workspace, sin deprecación: `gemini-3.5-flash`, `gpt-5.4-mini` y `claude-sonnet-4-6`. El calculador `POST /v1/convai/llm-usage/calculate`, con un prompt de 2.000 caracteres, cero páginas y sin RAG, respondió por minuto y por mensaje: Gemini 0,0206 y 0,0039; GPT-5.4 Mini 0,0094 y 0,0018; Claude Sonnet 4.6 0,0402 y 0,0076. El esquema no declara la moneda. La página de modelos habla de dólares. No son créditos y no se muestran en la pantalla. El mismo día se volvió a leer `GET /v1/convai/llm/list`. Los tres identificadores siguen en este workspace y sin deprecación, y son los que quedaron en la configuración: `gemini-3.5-flash`, `gpt-5.4-mini` y `claude-sonnet-4-6`. La pasada para medir créditos no creó el agente: el formulario llegó a Google y esa ventana no tenía sesión. El costo real sigue sin anotar.

## ADR-012 · Un agente por equipo y versiones propias

Hay una fila por equipo. Cada guardado hace `PATCH` del mismo `agent_id` y agrega una versión inmutable en Postgres. Volver a una anterior copia esa configuración al agente, vuelve a hacer `PATCH` y suma una versión nueva que apunta al origen. El nombre en ElevenLabs es el prefijo más el nombre que eligió el equipo, sin repetir el prefijo si ya lo escribieron. Los ocho `agent_id` de `config/casos.yaml` no se leen para escribir. Si una escritura los recibiera, se rechaza y el identificador no entra al log.

La guía de ramas de ElevenLabs todavía dice que el versionado es optativo. La referencia de la API dice que `enable_versioning` está deprecado y se ignora, porque todos los agentes ya se versionan. Manda la referencia. Las ramas y el reparto de tráfico no entran en este alcance. La historia que ve el equipo es la de Postgres.

Nada se borra en cascada. Archivar, con confirmación en ese pedido, borra el agente en ElevenLabs y marca `archivado_at`. La configuración y las transcripciones se quedan. El equipo no crea otro agente después, porque `equipo_id` es único.

## ADR-013 · Contrato del agente de equipo con ElevenLabs

Al crear, el servidor fija idioma `es`, la voz, el modelo, el prompt del equipo y el primer mensaje. No agrega reglas al prompt. Deja `enable_auth` en verdadero, sin lista blanca. Apaga `prompt`, `llm` y `voice_id`. Deja `text_only` encendido. Declara los placeholders `modulo`, `equipo`, `imprevistos_activos` y `resumen_previo`. La sala reutiliza la credencial y el control del ADR-010. El slug de esas conversaciones es `agente-del-equipo`, así no entran a la cobertura de los interlocutores. La voz de la cohorte (ADR-008) no cambia. La voz de este agente es un interruptor por equipo, apagado por defecto, y aplica también al instructor.

La tool es una sola. La URL tiene que ser HTTPS pública: se rechaza usuario y contraseña en la URL, localhost, dominios internos y cualquier dirección privada, también después del DNS. La prueba no sigue redirecciones. El valor del secreto cruza el servidor hacia `POST /v1/convai/secrets`. La base guarda `secret_id`. El texto en claro de la prueba queda en el ADR-014.

`POST /v1/convai/agents/{agent_id}/simulate-conversation` quedó deprecado el 31 de octubre de 2026. La simulación usa `POST /v1/convai/agent-testing/create` con tipo `simulation` y después `POST /v1/convai/agents/{agent_id}/run-tests`. El usuario simulado y el evaluador salen de la config. El valor inicial es `gpt-5.4-mini`, el más barato de los tres, para no dejar el default `claude-sonnet-4-6`. El tope se revisa antes de llamar. Si ElevenLabs rechaza, la base no cambia.

El mismo día, la corrida de «M2 · Prueba» respondió en 549 ms con estado `pending`, sin razón ni transcripción. El servidor la guardó como error. `GET /v1/convai/test-invocations/{id}`, que no vuelve a lanzar la simulación, mostró después `passed`, 573 créditos, razón del evaluador y 17 turnos, incluido un llamado a la tool. Desde entonces el servidor espera esa lectura hasta `passed`, `failed` o `cancelled`, con un tope de 120 segundos. La frase que decía que la prueba sale sin el secreto guardado queda reemplazada por el ADR-014.

## ADR-014 · Secreto de la tool cifrado para la prueba

ElevenLabs guarda el secreto y solo devuelve `secret_id`. No se puede volver a leer. «Probar la tool» salía sin el encabezado cuando el campo venía vacío, así que un backend que exige el secreto rechazaba una tool bien configurada.

El valor se cifra con AES-256-GCM de `node:crypto`. La clave es `TOOL_SECRET_KEY`, derivada con scrypt y la sal fija `faro-tool-v1`, y vive solo en el servidor. El resultado queda en `agentes_equipo.tool_secreto_cifrado`. No entra al snapshot, ni a la respuesta de la API, ni al navegador, ni al log. Se descifra únicamente para armar el encabezado de esa prueba. Si la respuesta de la URL repite el secreto, se sustituye por `***` antes de mostrarla. La transcripción hace lo mismo con el encabezado `x-faro-tool-secret`.

Un secreto que ya estaba en ElevenLabs antes de esta columna no se puede recuperar. El equipo lo escribe otra vez. Si falta la clave, guardar un secreto nuevo falla antes de llamar a ElevenLabs.

