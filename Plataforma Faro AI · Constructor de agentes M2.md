# Plataforma Faro AI · Constructor de agentes M2

Especificación de lo que se suma a la plataforma Faro AI para M2: un constructor donde cada equipo configura el agente de su POC, lo conecta con su backend y lo prueba. Es la fuente para construirlo con el IDE agéntico en el repositorio `faro-ai-platform`. Solo para instructores y para quien construya la plataforma.

Versión del 31/10/2026. Lo marcado como **propuesta** está pendiente de validar con Daniel.

## 1\. Para qué y para cuándo

En M2 cada equipo construye un POC de Energía del Litoral: un backend que consulta los datos de muestra del kit y un agente conversacional que responde el estado del corte y el tiempo estimado por dirección. La consigna pide que esa capa conversacional se configure **en la plataforma Faro AI**, que corre sobre ElevenLabs.

Los estudiantes no tienen cuenta propia de ElevenLabs: todo pasa por la cuenta de Henry. El constructor es la forma de darles lo que necesitan sin darles la clave.

| Cuándo | Qué tiene que estar listo |
| :---- | :---- |
| Clase 1 de M2 | El equipo puede crear su agente, configurarlo y conversar con él |
| Clase 2 de M2 | El agente llama a una tool hacia el backend del equipo. La consigna de esa clase es “capa conversacional en la plataforma Faro AI, con una tool hacia el backend” |
| Clase 3 de M2 | Simulaciones para la suite de evals y demo interna |
| Demo day | El instructor abre el agente de cada equipo desde su panel |

## 2\. Decisiones

- **El flujo es el que mostró Chino:** nuevo agente → caso de uso → configurar → guardar → abrir sala.  
- **Alcance reducido:** el equipo elige entre 4 voces y 3 modelos, nada más. El resto de la configuración de ElevenLabs no se expone.  
- **Un agente por equipo.** Se crea en ElevenLabs con la clave de Henry, desde el backend de la plataforma. Cada vez que el equipo guarda, la plataforma actualiza ese mismo agente y guarda una versión de la configuración.  
- **El equipo no ve nada de los interlocutores.** El constructor no muestra ni copia la configuración de Laura, Rubén, Sofía o Andrés.  
- **Sin base de conocimiento.** El agente obtiene los datos solo a través de la tool hacia el backend del equipo. Así el equipo tiene que construir la integración, que es lo que se evalúa.  
- **Texto por defecto.** La voz es un opcional de la consigna y tiene tope (sección 7).

## 3\. Lo que ve el equipo

1. **Mi agente.** Si el equipo todavía no tiene agente, un botón “Crear agente”. Si ya lo tiene, su configuración actual, quién la guardó por última vez y cuándo.  
2. **Caso de uso.** Un solo caso disponible, Energía del Litoral. El paso existe para respetar el flujo de Chino y para sumar casos después.  
3. **Configurar.** El formulario de la sección 4\. Cualquier integrante del equipo puede editarlo.  
4. **Guardar.** Valida, actualiza el agente en ElevenLabs y guarda la versión. Si ElevenLabs rechaza algo, el equipo ve el motivo en español y nada se pierde.  
5. **Abrir sala.** Una conversación de prueba con su propio agente, igual que con los interlocutores: texto, y voz solo si el instructor la habilitó para ese equipo. Cada prueba queda en el historial del equipo con su transcripción y la versión de la configuración que usó.  
6. **Versiones.** La lista de configuraciones guardadas, con autor y fecha, y la opción de volver a una anterior. Sirve para el registro de decisiones del equipo.

## 4\. Qué configura el equipo

| Campo | Detalle |
| :---- | :---- |
| Nombre del agente | Texto corto. Es lo que se ve en la sala |
| Prompt de sistema | Texto libre. Aquí el equipo escribe el rol, las reglas y los guardrails. **Propuesta:** máximo 8.000 caracteres |
| Primer mensaje | Lo que dice el agente al abrir la conversación |
| Voz | Una de las 4 de la sección 5 |
| Modelo | Uno de los 3 de la sección 5 |
| Tool hacia el backend | URL, método, descripción, parámetros y un secreto. Detalle en la sección 6 |
| Idioma | Fijo en español, no editable |

Los guardrails son parte de lo que se evalúa, así que la plataforma no agrega reglas propias al prompt del equipo.

## 5\. Voces y modelos (propuesta)

Es la propuesta que se le envió a Daniel el 30/10. Falta su confirmación.

**Voces.** Cuatro voces de la biblioteca de ElevenLabs en español latinoamericano neutro, dos femeninas y dos masculinas, de estilo conversacional (no de narración):

| Voz | Por qué |
| :---- | :---- |
| Mariana | Femenina, conversacional |
| Adela | Femenina, pensada para asistentes y call centers, que es justo el caso |
| Abel | Masculina, conversacional |
| Alberto | Masculina, conversacional |

Son candidatas: Darío las escucha antes de fijarlas y le pasa muestras a Daniel. Sus identificadores van en un archivo de configuración, no en el código, igual que los agentes.

**Modelos.** Tres modelos que muestran el trade-off entre costo, velocidad y calidad, para que el equipo pueda comparar y justificar su elección:

| Modelo | Por qué |
| :---- | :---- |
| Gemini 3.5 Flash | Rápido y barato. Es el que usan los agentes de los interlocutores |
| GPT-5.4 Mini | Otro proveedor, para comparar |
| Claude Sonnet 4.6 | Más capaz, pero más caro y más lento |

Los precios se confirman antes de habilitarlos. La lista de modelos de ElevenLabs cambia seguido: el IDE verifica con la API de ElevenLabs que los tres sigan disponibles y toma de ahí sus identificadores exactos. Si alguno ya no está, propone un reemplazo del mismo proveedor y lo registra en un ADR.

## 6\. Tool hacia el backend

Es la pieza central de M2: el agente consulta el backend del equipo, y el backend consulta los datos del kit.

- **Una tool por agente en M2.** **Propuesta:** hasta dos, por si el equipo separa “buscar suministro por dirección” de “consultar estado”.  
- **El equipo define** la URL, el método (GET o POST), una descripción que el modelo usa para decidir cuándo llamarla y los parámetros con su tipo y descripción.  
- **La URL tiene que ser pública y con HTTPS**, porque la llama ElevenLabs, no la plataforma. El equipo puede desplegar su backend o usar un túnel; la plataforma lo explica en una línea de ayuda.  
- **Secreto del equipo.** El equipo escribe un valor secreto que ElevenLabs envía en un encabezado en cada llamada, para que su backend rechace a cualquier otro. La plataforma lo guarda como secreto en ElevenLabs y no lo vuelve a mostrar; el equipo puede reemplazarlo. El IDE verifica en la documentación vigente cómo se guardan los secretos de las tools.  
- **Botón “Probar la tool”.** La plataforma llama una vez a la URL con parámetros de ejemplo y muestra el código de respuesta y los primeros caracteres del cuerpo. Sirve para separar “mi backend no responde” de “mi agente no llama a la tool”.

## 7\. Pruebas, simulaciones y topes

La clase 3 pide una suite de al menos 10 conversaciones simuladas. ElevenLabs tiene simulaciones de conversación: un usuario simulado con un escenario, y un criterio de éxito que evalúa otro modelo. El equipo no puede usarlas directo porque no tiene la clave, así que la plataforma las expone.

- **Simulación.** El equipo escribe un escenario (“un vecino a oscuras que solo sabe su dirección”) y un criterio de éxito (“informa el estado o dice que no hay tiempo estimado; nunca inventa una hora”). La plataforma corre la simulación contra el agente del equipo y guarda el resultado: pasó o no pasó, la razón y la transcripción.  
- **Exportar.** El equipo descarga sus escenarios y resultados en un archivo, para guardarlos en la carpeta `/evals` de su repositorio.

Cada prueba gasta créditos de la cuenta de Henry, así que todo tiene tope por equipo. El instructor ve el consumo y puede ampliar el tope de un equipo.

| Qué | Tope por equipo en M2 (propuesta) |
| :---- | :---- |
| Conversaciones de prueba por texto | 200 |
| Simulaciones | 60 |
| Minutos de voz | 15, solo si el instructor habilita la voz para ese equipo |

Como referencia de M1: una conversación corta de texto gastó unos 120 créditos, y un minuto de voz, 1.374. El costo de una simulación todavía no está medido. **Propuesta:** el IDE mide el costo real de una conversación y de una simulación en la primera prueba y lo registra, para ajustar los topes antes de M2.

Al llegar al tope, el equipo ve un mensaje claro y la opción de pedir ampliación al instructor. Nunca se corta una conversación ya iniciada.

## 8\. Panel del instructor

Se suma una sección **Agentes de los equipos**:

| Función | Detalle |
| :---- | :---- |
| Lista | El agente de cada equipo, su versión actual, modelo, voz y última modificación |
| Ver y probar | El instructor abre la configuración de cualquier equipo y conversa con su agente. Es lo que usa en la demo interna y en el demo day |
| Consumo | Por equipo: conversaciones, simulaciones y minutos de voz usados frente al tope |
| Topes | Ampliar el tope de un equipo, o habilitar la voz para un equipo |
| Archivar | Al terminar la cohorte, borra los agentes de los equipos en ElevenLabs y conserva las configuraciones y transcripciones en la plataforma |

## 9\. Seguridad y datos

- La clave de ElevenLabs sigue solo en el backend. Todo lo que el equipo configura pasa por la plataforma.  
- Un equipo solo ve y edita su propio agente. El instructor ve todos.  
- La plataforma valida lo que manda a ElevenLabs: largos máximos, URL con HTTPS, voz y modelo dentro de las listas permitidas. Un equipo no puede elegir otra voz ni otro modelo editando la petición desde el navegador.  
- Los agentes de los equipos se crean con un prefijo en el nombre (**propuesta:** “M2 · Equipo …”), para distinguirlos en la cuenta de los ocho interlocutores, que no se tocan.

## 10\. Criterios de aceptación

1. Un estudiante crea el agente de su equipo, lo configura con una de las 4 voces y uno de los 3 modelos, lo guarda y conversa con él.  
2. Otro integrante del mismo equipo ve y edita el mismo agente; un estudiante de otro equipo no lo ve.  
3. Con una tool configurada hacia una URL pública de prueba, el agente la llama y usa la respuesta. “Probar la tool” muestra el código de respuesta.  
4. El secreto de la tool no vuelve a mostrarse en la plataforma ni aparece en el navegador.  
5. Una simulación devuelve pasó o no pasó, la razón y la transcripción, y se puede exportar.  
6. Al llegar a un tope, el equipo no puede iniciar otra prueba de ese tipo; el instructor amplía el tope y el equipo puede seguir.  
7. El instructor abre y prueba el agente de cualquier equipo desde su panel.  
8. Volver a una versión anterior deja el agente en ElevenLabs con esa configuración.  
9. Los ocho interlocutores no cambian en nada.

## 11\. Pendientes

- [ ] Confirmar con Daniel las 4 voces y los 3 modelos de la sección 5, propuestos el 30/10.  
- [ ] Darío escucha las cuatro voces candidatas y le pasa muestras a Daniel.  
- [ ] Confirmar el precio de los tres modelos antes de habilitarlos.  
- [ ] Confirmar los topes de la sección 7 con el costo real medido y con el plan de ElevenLabs que contrate Henry.  
- [ ] Confirmar con Daniel si la voz se ofrece a todos los equipos o solo a los que la piden como opcional.