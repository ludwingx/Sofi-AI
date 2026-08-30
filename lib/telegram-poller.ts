import { getTelegramUpdates, sendTelegramMessage, sendTelegramChatAction, getMe } from './telegram';
import { generateText } from 'ai';
import { models, modelNames } from './ai';
import { getSofiTools } from './tools';
import { SOFI_SYSTEM_PROMPT } from './prompts';
import { prisma } from './prisma';

declare global {
  var __sofi_telegram_poller_active: boolean | undefined;
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
    console.log(`🌸 [Sofi AI] Conectada con Telegram Bot @${me.result.username}. ¡Listo para recibir mensajes!`);
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

            // Si no está registrado por telegramId, verificar si coincide con TELEGRAM_ALLOWED_USER_ID o si es el primer Admin
            if (!user) {
              const allowedId = process.env.TELEGRAM_ALLOWED_USER_ID;
              const isAllowed = allowedId && senderId === allowedId;

              // Buscar si ya existe un admin en la DB para vincularle este Telegram ID
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

            const startTime = Date.now();

            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`📩 [TELEGRAM] Mensaje Recibido`);
            console.log(`👤 Usuario: ${user.name} (Telegram ID: ${senderId} | Chat ID: ${chatId})`);
            console.log(`💬 Mensaje: "${userText || '(Multimedia / Audio / Foto)'}"`);
            console.log(`🤖 Modelo en Proceso: ${modelNames.primary} (B.ai / Cuota 0)`);
            console.log(`⚙️  Orquestando Tools y Memoria...`);

            if (!userText && !message.voice && !message.photo) {
              console.log(`⚠️  Mensaje vacío sin texto ni multimedia. Omitiendo.`);
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
              continue;
            }

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

            const { text, steps } = await generateText({
              model: models.primary,
              system: `${SOFI_SYSTEM_PROMPT}\nEstás interactuando con ${user.name} (Rol: ${user.role}).`,
              prompt: promptWithHistory,
              tools,
              maxSteps: 5,
            });

            const durationMs = Date.now() - startTime;
            const responseText = text || '🌸 Listo bb, lo tengo registrado.';

            console.log(`\n🌸 [Sofi Response] (en ${(durationMs / 1000).toFixed(2)}s | Pasos: ${steps?.length || 1})`);
            console.log(`💬 Respuesta a ${user.name}: "${responseText}"`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

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
        console.error('❌ Error en loop de Telegram poller:', err);
        await new Promise((r) => setTimeout(r, 4000));
      }
    }
  })();
}

