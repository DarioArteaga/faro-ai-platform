import type { CatalogoConstructor, ConfigEntrada, ParametroTool } from "@/lib/constructor"
import { ejemploDeParametro, nombreEnEleven } from "@/lib/constructor"
import { EQUIPO_SIN_NOMBRE, MODULO_DEFAULT, NINGUNO } from "@/lib/constantes"

type Propiedad = { type: "string" | "number" | "boolean"; description: string }

function esquemaParametros(parametros: ParametroTool[]): {
  type: "object"
  properties: Record<string, Propiedad>
  required: string[]
} {
  const properties: Record<string, Propiedad> = {}
  for (const parametro of parametros) {
    properties[parametro.nombre] = { type: parametro.tipo, description: parametro.descripcion }
  }
  return { type: "object", properties, required: parametros.map((parametro) => parametro.nombre) }
}

export function cuerpoDeAgente(
  catalogo: CatalogoConstructor,
  entrada: ConfigEntrada,
  toolIds: string[],
): Record<string, unknown> {
  return {
    name: nombreEnEleven(catalogo.prefijo_nombre, entrada.nombre),
    conversation_config: {
      agent: {
        language: catalogo.idioma,
        first_message: entrada.primerMensaje,
        dynamic_variables: {
          dynamic_variable_placeholders: {
            modulo: MODULO_DEFAULT,
            equipo: EQUIPO_SIN_NOMBRE,
            imprevistos_activos: NINGUNO,
            resumen_previo: NINGUNO,
          },
        },
        prompt: {
          prompt: entrada.prompt,
          llm: entrada.modelo.llm,
          tool_ids: toolIds,
        },
      },
      tts: {
        model_id: catalogo.tts_model_id,
        voice_id: entrada.voz.voice_id,
      },
    },
    platform_settings: {
      auth: { enable_auth: true },
      overrides: {
        enable_conversation_initiation_client_data_from_webhook: false,
        conversation_config_override: {
          tts: { voice_id: false },
          conversation: { text_only: true },
          agent: { prompt: { prompt: false, llm: false } },
        },
      },
    },
  }
}

export function cuerpoDeTool(
  catalogo: CatalogoConstructor,
  nombre: string,
  entrada: ConfigEntrada,
  secretId: string,
): Record<string, unknown> {
  if (!entrada.tool) throw new Error("la tool no está definida")
  const esquema = esquemaParametros(entrada.tool.parametros)
  const api: Record<string, unknown> = {
    url: entrada.tool.url,
    method: entrada.tool.metodo,
    request_headers: { [catalogo.encabezado_secreto]: { secret_id: secretId } },
  }
  if (entrada.tool.metodo === "GET") {
    api.query_params_schema = { properties: esquema.properties, required: esquema.required }
  } else {
    api.request_body_schema = esquema
  }
  return {
    tool_config: {
      type: "webhook",
      name: nombre,
      description: entrada.tool.descripcion,
      api_schema: api,
    },
  }
}

export function valoresDePrueba(parametros: ParametroTool[]): Record<string, string | number | boolean> {
  const valores: Record<string, string | number | boolean> = {}
  for (const parametro of parametros) valores[parametro.nombre] = ejemploDeParametro(parametro)
  return valores
}
