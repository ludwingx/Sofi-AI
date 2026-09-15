import { createOpenAI } from '@ai-sdk/openai';

const apiKey = process.env.BAI_API_KEY || process.env.DEEPSEEK_API_KEY || '';
const baseURL = process.env.BAI_BASE_URL || 'https://api.b.ai/v1';

export const baiProvider = createOpenAI({
  apiKey,
  baseURL,
  compatibility: 'compatible',
});

// Nombres de modelos para trazabilidad en logs y orquestación
export const modelNames = {
  primary: 'qwen3.8-flash',
  vision: 'deepseek-v4-flash-vision-exp',
  deepReasoning: 'deepseek-v4-pro',
  sonnet: 'claude-sonnet-5',
  glmFlash: 'glm-5.3-flash',
  qwenFlash: 'qwen3.8-flash',
};

// Modelos disponibles en B.ai
export const models = {
  // Modelo principal conversacional (Coste 0 / Ultra rápido)
  primary: baiProvider(modelNames.primary),
  
  // Modelo con visión multimodal para fotos de despensa/outfits/recibos (Coste 0)
  vision: baiProvider(modelNames.vision),
  
  // Modelo de alto razonamiento para análisis complejos
  deepReasoning: baiProvider(modelNames.deepReasoning),
  
  // Alternativas premium disponibles en tu cuenta B.ai
  sonnet: baiProvider(modelNames.sonnet),
  glmFlash: baiProvider(modelNames.glmFlash),
  qwenFlash: baiProvider(modelNames.qwenFlash),
};


