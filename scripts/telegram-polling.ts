import 'dotenv/config';
import { getTelegramUpdates, sendTelegramChatAction, getMe } from '../lib/telegram';
import { prisma } from '../lib/prisma';
import { processUserBuffer } from '../lib/bufferProcessor';

const activeTimers: Record<string, NodeJS.Timeout> = {};

async function startPolling() {
  console.log('🌸 Iniciando servicio local de Sofi AI (Telegram Long Polling con Buffer 2 Min)...');

  try {
    const me = await getMe();
    if (!me.ok) {
      console.error('❌ Error conectando con Telegram:', me);
      return;
    }
    console.log(`✅ Conectado exitosamente con @${me.result.username} (${me.result.first_name})`);
    console.log('🚀 Buffer de 2 minutos activo. Sofi responderá tras 2 min de silencio.\n');
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

          // 2. Guardar mensaje entrante en BD
          if (userText) {
            await prisma.chatMessage.create({
              data: {
                userId: user.id,
                channel: 'TELEGRAM',
                role: 'user',
                content: userText,
              },
            });
          }

          await sendTelegramChatAction(chatId, 'typing');

          // 3. Reiniciar el temporizador del Buffer de 2 minutos (120 segundos)
          if (activeTimers[user.id]) {
            clearTimeout(activeTimers[user.id]);
          }

          const userId = user.id;
          const userName = user.name;
          console.log(`⏱️ [Buffer Activo] Acumulando para ${userName}. Disparará tras 2 minutos de silencio...`);

          activeTimers[userId] = setTimeout(async () => {
            delete activeTimers[userId];
            console.log(`⏰ [Buffer 2 min cumplido] Disparando respuesta para ${userName}...`);
            await processUserBuffer(userId, { force: true });
          }, 120_000); // 2 minutos exactos
        }
      }
    } catch (err) {
      console.error('Error en ciclo de polling:', err);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

startPolling();
