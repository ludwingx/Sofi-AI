import { getTelegramUpdates, sendTelegramMessage, sendTelegramChatAction, getMe } from './telegram';
import { generateText } from 'ai';
import { models, modelNames } from './ai';
import { getSofiTools } from './tools';
import { SOFI_SYSTEM_PROMPT } from './prompts';
import { prisma } from './prisma';

declare global {
  var __sofi_telegram_poller_active: boolean | undefined;
}

interface PendingChatBuffer {
  userId: string;
  userName: string;
  userRole: string;
  chatId: number;
  senderId: string;
  texts: string[];
  timer: NodeJS.Timeout;
}

const activeChatBuffers = new Map<number, PendingChatBuffer>();

async function processBufferedMessages(chatId: number) {
  const buffer = activeChatBuffers.get(chatId);
  if (!buffer) return;
  activeChatBuffers.delete(chatId);

  const startTime = Date.now();
  const combinedText = buffer.texts.filter(Boolean).join('\n');
  if (!combinedText) return;

  try {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📩 [TELEGRAM BATCH] Mensaje(s) Agrupados (${buffer.texts.length} recibidos)`);
    console.log(`👤 Usuario: ${buffer.userName} (Telegram ID: ${buffer.senderId} | Chat ID: ${chatId})`);
    console.log(`💬 Contenido Consolidado:\n"${combinedText}"`);
    console.log(`🤖 Modelo en Proceso: ${modelNames.primary} (B.ai / Cuota 0)`);
    console.log(`⚙️  Orquestando Tools y Memoria...`);

    // 1. Guardar mensaje consolidado en base de datos
    await prisma.chatMessage.create({
      data: {
        userId: buffer.userId,
        channel: 'TELEGRAM',
        role: 'user',
        content: combinedText,
      },
    });

    await sendTelegramChatAction(chatId, 'typing');

    // 2. Cargar historial del usuario
    const recentMessages = await prisma.chatMessage.findMany({
      where: { userId: buffer.userId },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });
    recentMessages.reverse();

    const conversationHistory = recentMessages
      .map((m) => `${m.role === 'user' ? buffer.userName : 'Sofi'}: ${m.content}`)
      .join('\n');

    const promptWithHistory = conversationHistory
      ? `Historial reciente:\n${conversationHistory}\n\nNuevo mensaje de ${buffer.userName}:\n${combinedText}`
      : combinedText;

    // 3. Invocación de tools scoped por userId
    const tools = getSofiTools(buffer.userId);

    const { text, steps } = await generateText({
      model: models.primary,
      system: `${SOFI_SYSTEM_PROMPT}\nEstás interactuando con ${buffer.userName} (Rol: ${buffer.userRole}). Responde de forma concisa, fresca y natural como en un chat real de Telegram (máximo 1-2 párrafos cortos).`,
      prompt: promptWithHistory,
      tools,
      maxSteps: 5,
    });

    const durationMs = Date.now() - startTime;
    const responseText = text || '🌸 Listo bb, lo tengo registrado.';

    console.log(`\n🌸 [Sofi Response] (en ${(durationMs / 1000).toFixed(2)}s | Pasos: ${steps?.length || 1})`);
    console.log(`💬 Respuesta a ${buffer.userName}: "${responseText}"`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // 4. Guardar respuesta y enviar a Telegram
    await prisma.chatMessage.create({
      data: {
        userId: buffer.userId,
        channel: 'TELEGRAM',
        role: 'assistant',
        content: responseText,
      },
    });

    await sendTelegramMessage(chatId, responseText);
  } catch (err) {
    console.error('❌ Error al procesar buffer de Telegram:', err);
  }
}

export async function startTelegramBackgroundPoller() {
  if (globalThis.__sofi_telegram_poller_active) {
    return; // Ya está corriendo en este proceso
  }
  globalThis.__sofi_telegram_poller_active = true;

  console.log('🌸 [Sofi AI] Inicializando escucha automática de Telegram en segundo plano...');

  try {
    const me = await getMe();
    if (!me.ok) {
      console.warn('⚠️ No se pudo conectar con Telegram:', me);
      return;
    }
    console.log(`🌸 [Sofi AI] Conectada con Telegram Bot @${me.result.username}. ¡Listo para recibir mensajes con buffer inteligente!`);
  } catch (err) {
    console.warn('⚠️ Error al iniciar Telegram Poller:', err);
    return;
  }

  let offset = 0;

  // Ciclo asíncrono no bloqueante
  (async () => {
    while (true) {
      try {
        const updates = await getTelegramUpdates(offset, 20, 25);
        if (updates.ok && updates.result && updates.result.length > 0) {
          for (const update of updates.result) {
            offset = update.update_id + 1;
            const message = update.message;
            if (!message) continue;

            const chatId = message.chat.id;
            const senderId = message.from?.id?.toString();
            const senderName = message.from?.first_name || 'Ludwing';
            const userText = message.text || message.caption || '';

            if (!senderId) continue;

            // 1. Consulta dinámica en Base de Datos
            let user = await prisma.user.findUnique({
              where: { telegramId: senderId, isActive: true },
            });

            // Auto-vinculación si es el usuario permitido
            if (!user) {
              const allowedId = process.env.TELEGRAM_ALLOWED_USER_ID;
              const isAllowed = allowedId && senderId === allowedId;

              const existingAdmin = await prisma.user.findFirst({
                where: { role: 'ADMIN', isActive: true },
              });

              if (existingAdmin && (isAllowed || !allowedId)) {
                user = await prisma.user.update({
                  where: { id: existingAdmin.id },
                  data: { telegramId: senderId, name: senderName || existingAdmin.name },
                });
                console.log(`🔗 Telegram ID ${senderId} vinculado exitosamente con Admin: ${user.name}`);
              } else if (isAllowed || (await prisma.user.count()) === 0) {
                user = await prisma.user.create({
                  data: {
                    name: senderName || 'Ludwing Armijo',
                    telegramId: senderId,
                    role: 'ADMIN',
                    isActive: true,
                  },
                });
                console.log(`🎉 Primer usuario Admin auto-registrado en DB: ${user.name} (Telegram ID: ${senderId})`);
              } else {
                console.log(`🔒 Drop silencioso: Mensaje de ID no autorizado/pausado (${senderId} - ${senderName})`);
                continue;
              }
            }

            if (!userText && !message.voice && !message.photo) {
              continue;
            }

            // Indicar "escribiendo..." de inmediato para dar feedback en Telegram
            await sendTelegramChatAction(chatId, 'typing').catch(() => {});

            // 2. Manejo de Buffer de Espera Inteligente (Debounce de 3.5 segundos)
            const existingBuffer = activeChatBuffers.get(chatId);
            if (existingBuffer) {
              clearTimeout(existingBuffer.timer);
              if (userText) existingBuffer.texts.push(userText);
              existingBuffer.timer = setTimeout(() => processBufferedMessages(chatId), 3500);
              console.log(`⏳ [Buffer] Mensaje adicional agregado al buffer de ${user.name}. Esperando a que termine de escribir...`);
            } else {
              const newTimer = setTimeout(() => processBufferedMessages(chatId), 3500);
              activeChatBuffers.set(chatId, {
                userId: user.id,
                userName: user.name,
                userRole: user.role,
                chatId,
                senderId,
                texts: userText ? [userText] : ['(Contenido multimedia recibido)'],
                timer: newTimer,
              });
              console.log(`⏳ [Buffer] Iniciada ventana de espera (3.5s) para ${user.name}...`);
            }
          }
        }
      } catch (err) {
        console.error('❌ Error en loop de Telegram poller:', err);
        await new Promise((r) => setTimeout(r, 4000));
      }
    }
  })();
}


