# Arquitectura C4

Fuente de verdad de la estructura. Niveles 1, 2 y 3. El nivel 3 entra porque la aplicación tiene más de un módulo con lógica propia.

## 1. Contexto

```mermaid
C4Context
title Contexto de Faro AI
Person(estudiante, "Estudiante", "Conversa con los interlocutores de su equipo y consulta el historial")
Person(instructor, "Instructor", "Cambia el modulo, activa imprevistos y revisa cobertura y transcripciones")
System(faro, "Faro AI", "Front del curso para conversar con los interlocutores y operar el modulo")
System_Ext(google, "Google", "Identidad de las cuentas")
System_Ext(eleven, "ElevenLabs Agents", "Ejecuta los cuatro interlocutores ya publicados")
Rel(estudiante, faro, "Usa", "HTTPS")
Rel(instructor, faro, "Administra", "HTTPS")
Rel(faro, google, "Valida la cuenta", "OAuth 2.0")
Rel(faro, eleven, "Inicia conversaciones y lee transcripciones", "HTTPS")
```

| Elemento | Responsabilidad |
| --- | --- |
| Estudiante | Entra con su cuenta, conversa y lee el historial de su equipo |
| Instructor | Define el módulo, activa imprevistos, carga equipos y lee cualquier transcripción |
| Faro AI | Marca, acceso, variables de cada conversación y panel |
| Google | Prueba la identidad. No guarda equipos ni conversaciones |
| ElevenLabs Agents | Corre los interlocutores. La configuración de los agentes vive en el kit, no aquí |

## 2. Contenedores

```mermaid
C4Container
title Contenedores de Faro AI
Person(estudiante, "Estudiante", "Conversa con los interlocutores de su equipo")
Person(instructor, "Instructor", "Opera el modulo y los imprevistos")
Container_Boundary(faro, "Faro AI") {
  Container(planb, "Plan B", "HTML estatico", "Indice por equipo y una pagina por interlocutor, con un solo widget")
  Container(app, "Aplicacion", "Next.js", "Interfaz y API en el mismo proceso")
  ContainerDb(datos, "Postgres", "PostgreSQL 16", "Equipos, estudiantes, conversaciones, activaciones y resumenes")
}
System_Ext(google, "Google", "Identidad")
System_Ext(eleven, "ElevenLabs Agents", "Interlocutores publicados")
Rel(estudiante, planb, "Usa el respaldo", "HTTPS")
Rel(estudiante, app, "Entra y conversa", "HTTPS")
Rel(instructor, app, "Administra", "HTTPS")
Rel(planb, eleven, "Abre el widget", "HTTPS")
Rel(app, google, "Valida la cuenta", "OAuth 2.0")
Rel(app, datos, "Lee y escribe", "SQL")
Rel(app, eleven, "Pide credencial y lee transcripciones", "HTTPS")
```

| Contenedor | Tecnología | Responsabilidad |
| --- | --- | --- |
| Plan B | HTML estático | Respaldo sin cuentas ni historial. Una página por interlocutor, con variables fijas |
| Aplicación | Next.js | Login, interlocutores, conversación, historial y panel |
| Postgres | PostgreSQL 16 | Estado del curso. En local, Docker. Gestionado solo cuando se apruebe el despliegue |
| Google | OAuth 2.0 | Identidad |
| ElevenLabs Agents | HTTPS | Conversación, transcripción y resumen |

## 3. Componentes de la aplicación

```mermaid
C4Component
title Componentes de la aplicacion
Container_Boundary(app, "Aplicacion") {
  Component(interfaz, "Interfaz", "React", "Pantallas del estudiante y del instructor")
  Component(sesion, "Sesion", "Auth.js", "Google, cookie y lista de acceso")
  Component(catalogo, "Catalogo", "YAML", "Caso activo e imprevistos")
  Component(conversaciones, "Conversaciones", "Route handlers", "Credencial, variables, transcripcion y resumen")
  Component(panel, "Panel", "Route handlers", "Modulo, voz, activaciones, cobertura y equipos")
}
Rel(interfaz, sesion, "Exige sesion")
Rel(interfaz, conversaciones, "Inicia y consulta")
Rel(interfaz, panel, "Administra")
Rel(conversaciones, catalogo, "Arma las variables")
Rel(panel, catalogo, "Lista las claves")
Rel(conversaciones, sesion, "Comprueba equipo")
Rel(panel, sesion, "Exige rol instructor")
```

| Componente | Responsabilidad |
| --- | --- |
| Interfaz | Tarjetas, conversación en texto y en voz si la cohorte la habilita, historial y formularios del instructor |
| Sesión | Login con Google y rechazo de correos que no están en la lista |
| Catálogo | Lee `config/casos.yaml` y `config/imprevistos.yaml` |
| Conversaciones | Pide la credencial, guarda el id y lee transcripción y resumen |
| Panel | Cambia el módulo y la voz de la cohorte, activa claves, muestra cobertura y administra equipos |
