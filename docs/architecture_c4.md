# Arquitectura C4

Fuente de verdad de la estructura. Niveles 1, 2 y 3. El nivel 3 entra porque la aplicación tiene más de un módulo con lógica propia.

## 1. Contexto

```mermaid
C4Context
title Contexto de Faro AI
Person(estudiante, "Estudiante", "Conversa con los interlocutores, arma el agente de su equipo y consulta el historial")
Person(instructor, "Instructor", "Cambia el modulo, activa imprevistos, revisa agentes y transcripciones")
System(faro, "Faro AI", "Front del curso para conversar, construir el agente del equipo y operar el modulo")
System_Ext(google, "Google", "Identidad de las cuentas")
System_Ext(eleven, "ElevenLabs Agents", "Ejecuta los interlocutores y el agente de cada equipo")
Rel(estudiante, faro, "Usa", "HTTPS")
Rel(instructor, faro, "Administra", "HTTPS")
Rel(faro, google, "Valida la cuenta", "OAuth 2.0")
Rel(faro, eleven, "Inicia conversaciones, crea y actualiza el agente del equipo", "HTTPS")
```

| Elemento | Responsabilidad |
| --- | --- |
| Estudiante | Entra con su cuenta, conversa, configura el agente de su equipo y lee el historial |
| Instructor | Define el módulo, activa imprevistos, carga equipos, revisa los agentes de los equipos y lee cualquier transcripción |
| Faro AI | Marca, acceso, variables de cada conversación, constructor y panel |
| Google | Prueba la identidad. No guarda equipos ni conversaciones |
| ElevenLabs Agents | Corre los interlocutores publicados y el agente que cada equipo guarda desde esta aplicación. Los ocho interlocutores siguen definidos en el kit |

## 2. Contenedores

```mermaid
C4Container
title Contenedores de Faro AI
Person(estudiante, "Estudiante", "Conversa y configura el agente de su equipo")
Person(instructor, "Instructor", "Opera el modulo, los imprevistos y los agentes")
Container_Boundary(faro, "Faro AI") {
  Container(planb, "Plan B", "HTML estatico", "Indice por equipo y una pagina por interlocutor, con un solo widget")
  Container(app, "Aplicacion", "Next.js", "Interfaz y API en el mismo proceso")
  ContainerDb(datos, "Postgres", "PostgreSQL 16", "Equipos, estudiantes, conversaciones, agentes y resumenes")
}
System_Ext(google, "Google", "Identidad")
System_Ext(eleven, "ElevenLabs Agents", "Interlocutores y agentes de equipo")
Rel(estudiante, planb, "Usa el respaldo", "HTTPS")
Rel(estudiante, app, "Entra, conversa y configura", "HTTPS")
Rel(instructor, app, "Administra", "HTTPS")
Rel(planb, eleven, "Abre el widget", "HTTPS")
Rel(app, google, "Valida la cuenta", "OAuth 2.0")
Rel(app, datos, "Lee y escribe", "SQL")
Rel(app, eleven, "Pide credencial, crea y actualiza el agente del equipo", "HTTPS")
```

| Contenedor | Tecnología | Responsabilidad |
| --- | --- | --- |
| Plan B | HTML estático | Respaldo sin cuentas ni historial. Una página por interlocutor, con variables fijas |
| Aplicación | Next.js | Login, interlocutores, constructor, conversación, historial y panel |
| Postgres | PostgreSQL 16 | Estado del curso y las versiones del agente de cada equipo. En local, Docker. Gestionado solo cuando se apruebe el despliegue |
| Google | OAuth 2.0 | Identidad |
| ElevenLabs Agents | HTTPS | Conversación, transcripción, resumen, y el agente que guarda cada equipo |

## 3. Componentes de la aplicación

```mermaid
C4Component
title Componentes de la aplicacion
Container_Boundary(app, "Aplicacion") {
  Component(interfaz, "Interfaz", "React", "Pantallas del estudiante y del instructor")
  Component(sesion, "Sesion", "Auth.js", "Google, cookie y lista de acceso")
  Component(catalogo, "Catalogo", "YAML", "Casos e imprevistos")
  Component(conversaciones, "Conversaciones", "Route handlers", "Credencial, variables, transcripcion y resumen")
  Component(constructor, "Constructor", "Route handlers", "Agente del equipo, versiones, tool y simulacion")
  Component(panel, "Panel", "Route handlers", "Modulo, voz, activaciones, cobertura, equipos y agentes")
}
Rel(interfaz, sesion, "Exige sesion")
Rel(interfaz, conversaciones, "Inicia y consulta")
Rel(interfaz, constructor, "Configura el agente")
Rel(interfaz, panel, "Administra")
Rel(conversaciones, catalogo, "Arma las variables")
Rel(constructor, catalogo, "Lee voces y modelos")
Rel(panel, catalogo, "Lista las claves")
Rel(conversaciones, constructor, "Abre la sala del agente")
Rel(conversaciones, sesion, "Comprueba equipo y audiencia")
Rel(constructor, sesion, "Limita el agente al equipo")
Rel(panel, sesion, "Exige rol instructor")
```

| Componente | Responsabilidad |
| --- | --- |
| Interfaz | Tarjetas del caso de curso y, para el instructor, las de Seguros Pampa. Constructor del agente, conversación en texto y en voz cuando corresponde, historial y formularios del instructor |
| Sesión | Login con Google y rechazo de correos que no están en la lista |
| Catálogo | Lee `config/casos.yaml` y `config/imprevistos.yaml`. Separa el caso de curso del caso del instructor |
| Conversaciones | Pide la credencial, guarda el id, compara las variables que ElevenLabs registró con las emitidas y lee transcripción y resumen. Niega Seguros Pampa a un estudiante y archiva esas conversaciones en el equipo de demo. La sala del agente del equipo usa el mismo control |
| Constructor | Crea y actualiza un agente por equipo, guarda versiones, la tool y las simulaciones. No escribe los ocho interlocutores |
| Panel | Cambia el módulo y la voz de la cohorte, activa claves de cada caso, muestra cobertura, el control de variables, administra equipos y archiva agentes |
