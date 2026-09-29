import { prisma } from '@/lib/prisma';
import { generateResilientText, modelNames } from '@/lib/ai';
import { getSofiTools } from '@/lib/tools';
import { SOFI_SYSTEM_PROMPT } from '@/lib/prompts';
import { sendTelegramMessage, sendTelegramChatAction } from '@/lib/telegram';

export const BUFFER_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutos (para cron de respaldo)

export interface ProcessUserBufferOptions {
  force?: boolean;
  combinedText?: string;
  chatId?: number;
}

export async function processUserBuffer(userId: string, options: ProcessUserBufferOptions = {}) {
  const { force = false, combinedText, chatId } = options;
  const startTime = Date.now();

  const user = await prisma.user.findUnique({
    where: { id: userId, isActive: true },
  });

  if (!user) {
    return { processed: false, reason: 'User not found or inactive' };
  }

  const targetChatId = chatId || (user.telegramId ? Number(user.telegramId) : null);

  // 1. Obtener último mensaje del usuario y último mensaje del asistente
  const lastUserMsg = await prisma.chatMessage.findFirst({
    where: { userId: user.id, role: 'user' },
    orderBy: { createdAt: 'desc' },
  });

  if (!lastUserMsg && !combinedText) {
    return { processed: false, reason: 'No user messages found' };
  }

  const lastAssistantMsg = await prisma.chatMessage.findFirst({
    where: { userId: user.id, role: 'assistant' },
    orderBy: { createdAt: 'desc' },
  });

  // Si no se proporcionó texto explícito de buffer y el asistente ya respondió, nada pendiente
  if (
    !combinedText &&
    lastAssistantMsg &&
    lastUserMsg &&
    new Date(lastAssistantMsg.createdAt) >= new Date(lastUserMsg.createdAt)
  ) {
    return { processed: false, reason: 'Already responded' };
  }

  // 2. Si no es forzado y no viene texto del buffer, verificar timeout de cron de respaldo
  if (!force && !combinedText && lastUserMsg) {
    const elapsedMs = Date.now() - new Date(lastUserMsg.createdAt).getTime();
    if (elapsedMs < BUFFER_TIMEOUT_MS) {
      const remainingSeconds = Math.ceil((BUFFER_TIMEOUT_MS - elapsedMs) / 1000);
      return {
        processed: false,
        reason: `Buffer active. Waiting ${remainingSeconds}s more of silence.`,
        remainingSeconds,
      };
    }
  }

  // 3. Determinar el texto consolidado del usuario
  let textToProcess = combinedText;
  if (!textToProcess) {
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

    textToProcess = pendingUserMessages
      .map((m) => m.content)
      .filter(Boolean)
      .join('\n');
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🚀 [DISPARANDO AGENTE SOFI TRAS SILENCIO DE BUFFER]`);
  console.log(`👤 Usuario: ${user.name} (Telegram ID: ${user.telegramId || targetChatId})`);
  console.log(`💬 Contenido Consolidado:\n"${textToProcess}"`);
  console.log(`🤖 Modelo: ${modelNames.primary}`);

  // Iniciar indicador de "escribiendo..." en Telegram ahora que el agente SÍ fue disparado
  let typingInterval: NodeJS.Timeout | null = null;
  if (targetChatId) {
    await sendTelegramChatAction(targetChatId, 'typing').catch(() => {});
    typingInterval = setInterval(() => {
      sendTelegramChatAction(targetChatId, 'typing').catch(() => {});
    }, 4000);
  }

  try {
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
      ? `Historial reciente:\n${conversationHistory}\n\nMensaje(s) de ${user.name}:\n${textToProcess}`
      : textToProcess;

    // 5. Ejecutar IA con herramientas
    const tools = getSofiTools(user.id);
    const { text, steps, modelUsed } = await generateResilientText({
      system: `${SOFI_SYSTEM_PROMPT}\nEstás respondiendo a los mensajes de ${user.name} (Rol: ${user.role}). Si recibes varias preguntas o comentarios juntos, responde a todos ellos de forma natural, fresca y unificada en un mensaje coherente de Telegram (máximo 1-2 párrafos cortos).`,
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
        channel: lastUserMsg?.channel || 'TELEGRAM',
        role: 'assistant',
        content: responseText,
      },
    });

    // 7. Enviar por Telegram
    if (targetChatId && lastUserMsg?.channel !== 'WEB') {
      try {
        await sendTelegramMessage(targetChatId, responseText);
      } catch (err) {
        console.error('❌ Error sending Telegram message from buffer processor:', err);
      }
    }

    return {
      processed: true,
      response: responseText,
      channel: lastUserMsg?.channel || 'TELEGRAM',
      id: savedResponse.id,
    };
  } finally {
    if (typingInterval) {
      clearInterval(typingInterval);
    }
  }
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
