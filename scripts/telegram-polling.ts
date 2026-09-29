import 'dotenv/config';
import { getTelegramUpdates, getMe } from '../lib/telegram';
import { prisma } from '../lib/prisma';
import { processUserBuffer } from '../lib/bufferProcessor';
import {
  pushMessageToRedisBuffer,
  getAndClearRedisBuffer,
  clearRedisBufferAndLock,
  DEBOUNCE_SILENCE_SECONDS,
} from '../lib/redisBuffer';

const activeTimers: Record<string, NodeJS.Timeout> = {};

async function startPolling() {
  console.log('🌸 Iniciando servicio local de Sofi AI (Telegram Polling con Buffer Inteligente)...');

  try {
    const me = await getMe();
    if (!me.ok) {
      console.error('❌ Error conectando con Telegram:', me);
      return;
    }
    console.log(`✅ Conectado exitosamente con @${me.result.username} (${me.result.first_name})`);
    console.log(`🚀 Buffer inteligente de ${DEBOUNCE_SILENCE_SECONDS}s de silencio activo. Sofi responderá agrupando tus mensajes.\n`);
  } catch (err) {
    console.error('❌ No se pudo conectar a Telegram. Verifica TELEGRAM_BOT_TOKEN en .env:', err);
    return;
  }

  let offset = 0;

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

          if (!user) {
            const userCount = await prisma.user.count();
            if (userCount === 0) {
              user = await prisma.user.create({
                data: {
                  name: senderName,
                  telegramId: senderId,
                  role: 'ADMIN',
                  isActive: true,
                },
              });
              console.log(`🎉 Primer usuario Admin auto-registrado en DB: ${senderName} (Telegram ID: ${senderId})`);
            } else {
              console.log(`🔒 Drop silencioso: Mensaje de ID no autorizado (${senderId} - ${senderName})`);
              continue;
            }
          }

          console.log(`📩 [${user.name}] "${userText}"`);

          if (!userText && !message.voice && !message.photo) continue;

          // 2. Guardar mensaje entrante individual en BD
          let currentMsg = null;
          if (userText) {
            currentMsg = await prisma.chatMessage.create({
              data: {
                userId: user.id,
                channel: 'TELEGRAM',
                role: 'user',
                content: userText,
              },
            });
          }

          // 3. Encolar en buffer de Redis (sin activar typing)
          await pushMessageToRedisBuffer(
            user.id,
            chatId,
            currentMsg?.id || String(Date.now()),
            userText
          );

          // 4. Reiniciar el temporizador del Buffer de silencio (5 segundos)
          if (activeTimers[user.id]) {
            clearTimeout(activeTimers[user.id]);
          }

          const userId = user.id;
          const userName = user.name;
          console.log(`⏱️ [Buffer Activo] Acumulando para ${userName}. Esperando ${DEBOUNCE_SILENCE_SECONDS}s de silencio...`);

          activeTimers[userId] = setTimeout(async () => {
            delete activeTimers[userId];
            console.log(`⏰ [Buffer cumplido] Silencio alcanzado para ${userName}. Disparando al agente...`);

            try {
              const bufferedItems = await getAndClearRedisBuffer(userId);
              const combinedText =
                bufferedItems.length > 0
                  ? bufferedItems.map((item) => item.text).filter(Boolean).join('\n')
                  : userText;

              await processUserBuffer(userId, {
                force: true,
                combinedText,
                chatId,
              });
            } finally {
              await clearRedisBufferAndLock(userId);
            }
          }, DEBOUNCE_SILENCE_SECONDS * 1000);
        }
      }
    } catch (err) {
      console.error('Error en ciclo de polling:', err);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

startPolling();
