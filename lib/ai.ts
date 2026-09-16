import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

const apiKey = process.env.BAI_API_KEY || process.env.DEEPSEEK_API_KEY || '';
const baseURL = process.env.BAI_BASE_URL || 'https://api.b.ai/v1';

export const baiProvider = createOpenAI({
  apiKey,
  baseURL,
  compatibility: 'compatible',
});

// Proveedor Google opcional si se provee clave en variables de entorno
const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || '';
export const googleProvider = googleApiKey
  ? createGoogleGenerativeAI({ apiKey: googleApiKey })
  : null;

// Nombres de modelos para trazabilidad en logs y orquestación
export const modelNames = {
  primary: process.env.AI_PRIMARY_MODEL || 'qwen3.8-flash',
  fallback: process.env.AI_FALLBACK_MODEL || 'mimo-v2.5',
  vision: process.env.AI_VISION_MODEL || 'qwen3.8-flash',
  deepReasoning: process.env.AI_REASONING_MODEL || 'qwen3.8-flash',
  sonnet: 'claude-sonnet-5',
  glmFlash: 'glm-5.3-flash',
  qwenFlash: 'qwen3.8-flash',
};

// Modelos disponibles
export const models = {
  // Modelo principal conversacional (Coste 0 / Ultra rápido)
  primary: baiProvider(modelNames.primary),
  
  // Modelo de respaldo gratuito si el primario falla o agota saldo
  fallback: baiProvider(modelNames.fallback),
  
  // Modelo con visión multimodal
  vision: baiProvider(modelNames.vision),
  
  // Modelo de razonamiento
  deepReasoning: baiProvider(modelNames.deepReasoning),
  
  // Alternativas
  sonnet: baiProvider(modelNames.sonnet),
  glmFlash: baiProvider(modelNames.glmFlash),
  qwenFlash: baiProvider(modelNames.qwenFlash),
};

export type ResilientGenerateTextParams = Omit<Parameters<typeof generateText>[0], 'model'> & {
  model?: Parameters<typeof generateText>[0]['model'];
  allowGracefulFailure?: boolean;
};

/**
 * Invoca el modelo primario con tolerancia a fallos.
 * Si el modelo primario arroja error de cuota/saldo o conectividad,
 * automáticamente ejecuta el fallback (mimo-v2.5 u otro configurado).
 * Si todos fallan y allowGracefulFailure es true, devuelve una respuesta
 * amigable informando la falta de saldo sin lanzar un error 500 fatal.
 */
export async function generateResilientText(params: ResilientGenerateTextParams) {
  const { model, allowGracefulFailure = true, ...restParams } = params;

  // Lista de modelos ordenados por prioridad de intento
  const candidates: Array<{ name: string; getModel: () => any }> = [];

  if (model) {
    candidates.push({ name: 'custom-model', getModel: () => model });
  }

  candidates.push({ name: modelNames.primary, getModel: () => models.primary });
  candidates.push({ name: modelNames.fallback, getModel: () => models.fallback });

  if (googleProvider) {
    candidates.push({
      name: 'gemini-2.0-flash',
      getModel: () => googleProvider('gemini-2.0-flash'),
    });
  }

  let lastError: any = null;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      const activeModel = candidate.getModel();
      const result = await generateText({
        model: activeModel,
        ...restParams,
      });

      return {
        ...result,
        modelUsed: candidate.name,
        failedGracefully: false,
      };
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);

      console.warn(
        `⚠️ [AI Resilient Warning] Falló el modelo "${candidate.name}" (intento ${i + 1}/${candidates.length}): ${errMsg}`
      );

      // Si aún quedan candidatos por intentar, continuar
      if (i < candidates.length - 1) {
        console.log(`🔄 [AI Fallback] Conmutando automáticamente al siguiente modelo: "${candidates[i + 1].name}"...`);
        continue;
      }
    }
  }

  console.error('❌ [AI Fatal] Todos los modelos configurados fallaron:', lastError);

  if (allowGracefulFailure) {
    return {
      text: '🌸 Oye mi rey, parece que nos quedamos sin saldo en el proveedor de IA (balance: 0 en B.ai). Porfa recargá la cuenta o revisá las variables de entorno para que pueda responderte.',
      steps: [],
      modelUsed: 'none',
      failedGracefully: true,
      error: lastError,
      warnings: [],
      toolCalls: [],
      toolResults: [],
      finishReason: 'error' as const,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      response: { id: 'fallback-error', timestamp: new Date(), modelId: 'none', messages: [] },
    };
  }

  throw lastError;
}


