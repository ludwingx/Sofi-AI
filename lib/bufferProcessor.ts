import { prisma } from '@/lib/prisma';
import { generateResilientText, modelNames } from '@/lib/ai';
import { getSofiTools } from '@/lib/tools';
import { SOFI_SYSTEM_PROMPT } from '@/lib/prompts';
import { sendTelegramMessage } from '@/lib/telegram';

export const BUFFER_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutos (120,000 ms)

export async function processUserBuffer(userId: string, options: { force?: boolean } = {}) {
  const { force = false } = options;
  const startTime = Date.now();

  const user = await prisma.user.findUnique({
    where: { id: userId, isActive: true },
  });

  if (!user) {
    return { processed: false, reason: 'User not found or inactive' };
  }

  // 1. Obtener último mensaje del usuario y último mensaje del asistente
  const lastUserMsg = await prisma.chatMessage.findFirst({
    where: { userId: user.id, role: 'user' },
    orderBy: { createdAt: 'desc' },
  });

  if (!lastUserMsg) {
    return { processed: false, reason: 'No user messages found' };
  }

  const lastAssistantMsg = await prisma.chatMessage.findFirst({
    where: { userId: user.id, role: 'assistant' },
    orderBy: { createdAt: 'desc' },
  });

  // Si el asistente ya respondió después del último mensaje del usuario, no hay nada pendiente
  if (lastAssistantMsg && new Date(lastAssistantMsg.createdAt) >= new Date(lastUserMsg.createdAt)) {
    return { processed: false, reason: 'Already responded' };
  }

  // 2. Comprobar si ya pasaron 2 minutos completos desde el último mensaje del usuario
  const elapsedMs = Date.now() - new Date(lastUserMsg.createdAt).getTime();
  if (!force && elapsedMs < BUFFER_TIMEOUT_MS) {
    const remainingSeconds = Math.ceil((BUFFER_TIMEOUT_MS - elapsedMs) / 1000);
    return {
      processed: false,
      reason: `Buffer active. Waiting ${remainingSeconds}s more of silence.`,
      remainingSeconds,
    };
  }

  // 3. Recopilar TODOS los mensajes del usuario acumulados desde la última respuesta
  const pendingUserMessages = await prisma.chatMessage.findMany({
    where: {
      userId: user.id,
      role: 'user',
      ...(lastAssistantMsg ? { createdAt: { gt: lastAssistantMsg.createdAt } } : {}),
    },
    orderBy: { createdAt: 'asc' },
  });

  if (pendingUserMessages.length === 0) {
    return { processed: false, reason: 'No pending messages' };
  }

  const combinedUserText = pendingUserMessages
    .map((m) => m.content)
    .filter(Boolean)
    .join('\n');

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🚀 [DISPARANDO BUFFER 2 MINUTOS]`);
  console.log(`👤 Usuario: ${user.name} (Telegram ID: ${user.telegramId})`);
  console.log(`📦 Mensajes acumulados (${pendingUserMessages.length}):`);
  console.log(`"${combinedUserText}"`);
  console.log(`⏱️ Silencio transcurrido: ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(`🤖 Modelo: ${modelNames.primary}`);

  // 4. Cargar historial previo (anterior a esta ráfaga) para contexto
  const priorMessages = await prisma.chatMessage.findMany({
    where: {
      userId: user.id,
      ...(lastAssistantMsg ? { createdAt: { lte: lastAssistantMsg.createdAt } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 6,
  });
  priorMessages.reverse();

  const conversationHistory = priorMessages
    .map((m) => `${m.role === 'user' ? user.name : 'Sofi'}: ${m.content}`)
    .join('\n');

  const promptWithHistory = conversationHistory
    ? `Historial reciente:\n${conversationHistory}\n\nMensajes acumulados de ${user.name} tras 2 minutos de silencio:\n${combinedUserText}`
    : combinedUserText;

  // 5. Ejecutar IA con herramientas de forma tolerante a fallos
  const tools = getSofiTools(user.id);
  const { text, steps, modelUsed } = await generateResilientText({
    system: `${SOFI_SYSTEM_PROMPT}\nEstás respondiendo a los mensajes acumulados de ${user.name} (Rol: ${user.role}).`,
    prompt: promptWithHistory,
    tools,
    maxSteps: 5,
  });

  const durationMs = Date.now() - startTime;
  const responseText = text || '🌸 Listo mi rey, lo tengo todo registrado.';

  console.log(`🌸 [Sofi Response] en ${(durationMs / 1000).toFixed(2)}s | Modelo usado: ${modelUsed} | Pasos: ${steps?.length || 1}`);
  console.log(`💬 "${responseText}"`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // 6. Guardar respuesta unificada en DB
  const savedResponse = await prisma.chatMessage.create({
    data: {
      userId: user.id,
      channel: lastUserMsg.channel || 'TELEGRAM',
      role: 'assistant',
      content: responseText,
    },
  });

  // 7. Enviar por Telegram si el canal es Telegram
  if (user.telegramId && lastUserMsg.channel !== 'WEB') {
    try {
      await sendTelegramMessage(user.telegramId, responseText);
    } catch (err) {
      console.error('Error sending Telegram message from buffer processor:', err);
    }
  }

  return {
    processed: true,
    response: responseText,
    batchSize: pendingUserMessages.length,
    channel: lastUserMsg.channel,
    id: savedResponse.id,
  };
}

export async function processAllPendingBuffers() {
  const activeUsers = await prisma.user.findMany({
    where: { isActive: true },
  });

  const results = [];
  for (const user of activeUsers) {
    const res = await processUserBuffer(user.id);
    results.push({ userId: user.id, userName: user.name, ...res });
  }

  return results;
}
