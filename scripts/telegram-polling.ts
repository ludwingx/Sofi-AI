import { getTelegramUpdates, sendTelegramMessage, sendTelegramChatAction, getMe } from '../lib/telegram';
import { generateText } from 'ai';
import { models } from '../lib/ai';
import { getSofiTools } from '../lib/tools';
import { SOFI_SYSTEM_PROMPT } from '../lib/prompts';
import { prisma } from '../lib/prisma';
import * as dotenv from 'dotenv';
dotenv.config();

async function startPolling() {
  console.log('🌸 Iniciando servicio local de Sofi AI (Telegram Multi-Tenant Long Polling)...');

  try {
    const me = await getMe();
    if (!me.ok) {
      console.error('❌ Error conectando con Telegram:', me);
      return;
    }
    console.log(`✅ Conectado exitosamente con @${me.result.username} (${me.result.first_name})`);
    console.log('🚀 Esperando mensajes en Telegram (Whitelist dinámica activa en BD)...\n');
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

          // Auto-registro inicial si no hay usuarios
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
              console.log(`🔒 Drop silencioso: Mensaje de ID no autorizado/pausado (${senderId} - ${senderName})`);
              continue;
            }
          }

          console.log(`📩 [${user.name} | ${user.role}] "${userText}"`);

          if (!userText && !message.voice && !message.photo) continue;

          // 2. Guardar mensaje entrante
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

          // 3. Cargar historial del usuario
          const recentMessages = await prisma.chatMessage.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            take: 6,
          });
          recentMessages.reverse();

          const conversationHistory = recentMessages
            .map((m) => `${m.role === 'user' ? user?.name : 'Sofi'}: ${m.content}`)
            .join('\n');

          const promptWithHistory = conversationHistory
            ? `Historial reciente:\n${conversationHistory}\n\nNuevo mensaje de ${user.name}:\n${userText || '(Envió contenido multimedia)'}`
            : userText;

          // 4. Invocación de tools scoped por userId
          const tools = getSofiTools(user.id);

          const { text } = await generateText({
            model: models.primary,
            system: `${SOFI_SYSTEM_PROMPT}\nEstás interactuando con ${user.name} (Rol: ${user.role}).`,
            prompt: promptWithHistory,
            tools,
            maxSteps: 5,
          });

          const responseText = text || '🌸 Listo bb, lo tengo registrado.';
          console.log(`🌸 Respuesta para ${user.name}: "${responseText}"\n`);

          // 5. Guardar respuesta y enviar
          await prisma.chatMessage.create({
            data: {
              userId: user.id,
              channel: 'TELEGRAM',
              role: 'assistant',
              content: responseText,
            },
          });

          await sendTelegramMessage(chatId, responseText);
        }
      }
    } catch (err) {
      console.error('Error en ciclo de polling:', err);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

startPolling();
