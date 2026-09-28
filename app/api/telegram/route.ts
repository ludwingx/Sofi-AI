import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTelegramChatAction, getMe, getTelegramWebhookInfo, setTelegramWebhook } from '@/lib/telegram';
import { processUserBuffer } from '@/lib/bufferProcessor';
import {
  pushMessageToRedisBuffer,
  tryAcquireBufferProcessingLock,
  clearRedisBufferAndLock,
  DEBOUNCE_SILENCE_SECONDS,
} from '@/lib/redisBuffer';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const setUrl = searchParams.get('setUrl');

    if (setUrl) {
      const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
      const targetUrl = setUrl.endsWith('/api/telegram') ? setUrl : `${setUrl.replace(/\/$/, '')}/api/telegram`;
      const result = await setTelegramWebhook(targetUrl, secret);
      return NextResponse.json({ action: 'setWebhook', targetUrl, result });
    }

    const me = await getMe();
    const webhookInfo = await getTelegramWebhookInfo();

    return NextResponse.json({
      bot: me,
      webhook: webhookInfo,
      status: webhookInfo.result?.url ? 'WEBHOOK_ACTIVE' : 'NO_WEBHOOK_SET',
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    // 1. Verificación de seguridad de cabecera Secret Token
    const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expectedSecret && secretHeader && secretHeader !== expectedSecret) {
      console.warn('⛔ Webhook request rejected: Invalid secret token.');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const message = body.message || body.edited_message;

    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const senderId = message.from?.id?.toString();
    const senderName = message.from?.first_name || 'Ludwing';

    if (!senderId) {
      return NextResponse.json({ ok: true });
    }

    // 2. Whitelist Dinámica en Base de Datos
    let user = await prisma.user.findUnique({
      where: { telegramId: senderId, isActive: true },
    });

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
        console.log(`🔗 Telegram ID ${senderId} vinculado con Admin: ${user.name}`);
      } else if (isAllowed || (await prisma.user.count()) === 0) {
        user = await prisma.user.create({
          data: {
            name: senderName || 'Ludwing Armijo',
            telegramId: senderId,
            role: 'ADMIN',
            isActive: true,
          },
        });
        console.log(`🎉 Primer usuario Admin auto-registrado: ${user.name}`);
      } else {
        console.warn(`🔒 Drop silencioso: Mensaje bloqueado de usuario no registrado (${senderId})`);
        return NextResponse.json({ ok: true });
      }
    }

    const userText = message.text || message.caption || '';
    if (!userText && !message.voice && !message.photo) {
      return NextResponse.json({ ok: true });
    }

    // 3. Guardar el mensaje en PostgreSQL
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

    // 4. Encolar en el buffer de Redis y actualizar el timestamp de actividad
    const queueSize = await pushMessageToRedisBuffer(
      user.id,
      chatId,
      currentMsg?.id || String(Date.now()),
      userText
    );

    // Feedback inmediato de "escribiendo..." en Telegram
    await sendTelegramChatAction(chatId, 'typing').catch(() => {});
    console.log(`📥 [REDIS BUFFER] Mensaje de ${user.name} (#${queueSize} en cola): "${userText}"`);

    // 5. Esperar la ventana de silencio (Debounce dinámico de 15 segundos)
    // Hacemos un bucle de comprobación rápida para ver si siguen llegando mensajes
    const waitLoopStart = Date.now();
    const waitDurationMs = DEBOUNCE_SILENCE_SECONDS * 1000;

    while (Date.now() - waitLoopStart < waitDurationMs) {
      await new Promise((r) => setTimeout(r, 2500));
      // Cada 2.5s refrescamos el typing si aún estamos en espera
      await sendTelegramChatAction(chatId, 'typing').catch(() => {});
    }

    // 6. Intentar adquirir el lock atómico en Redis
    // Si el usuario envió otro mensaje durante la espera, tryAcquireBufferProcessingLock devolverá false
    const canProcess = await tryAcquireBufferProcessingLock(user.id, DEBOUNCE_SILENCE_SECONDS);

    if (!canProcess) {
      console.log(`⏳ [REDIS BUFFER] Ráfaga continua detectada para ${user.name}. Delegando respuesta a la siguiente ráfaga.`);
      return NextResponse.json({ ok: true, buffered: true, waitingForSilence: true });
    }

    try {
      // 7. Procesar todos los mensajes acumulados juntos
      console.log(`🚀 [REDIS BUFFER TRIGGER] Silencio alcanzado. Procesando todos los mensajes acumulados de ${user.name}...`);
      await sendTelegramChatAction(chatId, 'typing').catch(() => {});
      const result = await processUserBuffer(user.id, { force: true });
      return NextResponse.json({ ok: true, result });
    } finally {
      // Liberar el lock y limpiar buffer en Redis
      await clearRedisBufferAndLock(user.id);
    }
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`\n❌ [TELEGRAM Error] tras ${(durationMs / 1000).toFixed(2)}s:`, error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
