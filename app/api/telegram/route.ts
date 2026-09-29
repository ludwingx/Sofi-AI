import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMe, getTelegramWebhookInfo, setTelegramWebhook } from '@/lib/telegram';
import { processUserBuffer } from '@/lib/bufferProcessor';
import {
  pushMessageToRedisBuffer,
  tryAcquireWaiterLock,
  waitForSilenceAndBreak,
  getAndClearRedisBuffer,
  tryAcquireBufferProcessingLock,
  clearRedisBufferAndLock,
  DEBOUNCE_SILENCE_SECONDS,
  MAX_BUFFER_WAIT_SECONDS,
} from '@/lib/redisBuffer';

export const maxDuration = 60; // Permitir hasta 60s en Vercel para espera de silencio + generación de IA

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

    // 3. Guardar el mensaje individual en PostgreSQL
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

    // 4. Encolar en el buffer de Redis y actualizar el timestamp de actividad del usuario
    const queueSize = await pushMessageToRedisBuffer(
      user.id,
      chatId,
      currentMsg?.id || String(Date.now()),
      userText
    );

    console.log(`📥 [REDIS BUFFER] Mensaje de ${user.name} (#${queueSize} en cola): "${userText}"`);

    // 5. Concurrencia atómica: Solo la primera petición adquiere el rol de Waiter
    // IMPORTANTE: NO enviamos "typing" aquí. Mientras se acumula en el buffer, el bot no debe mostrar "escribiendo..."
    const isWaiter = await tryAcquireWaiterLock(user.id);

    if (!isWaiter) {
      // Ya hay otra petición activa esperando el silencio de este usuario.
      // Este mensaje ya quedó en Redis y PostgreSQL. Respondemos 200 OK inmediatamente para evitar timeouts.
      console.log(`⏳ [REDIS BUFFER] Ráfaga para ${user.name}: Mensaje guardado en cola. Delegado al bucle de espera activo.`);
      return NextResponse.json({ ok: true, buffered: true, waiting: true, queueSize });
    }

    try {
      // 6. Bucle de espera de silencio (Debounce dinámico de 5 segundos)
      // Si llegan más mensajes durante este tiempo, el timer se renueva en Redis
      console.log(`⏱️ [REDIS BUFFER] Bucle de espera iniciado para ${user.name}. Esperando ${DEBOUNCE_SILENCE_SECONDS}s de silencio...`);
      await waitForSilenceAndBreak(user.id, DEBOUNCE_SILENCE_SECONDS, MAX_BUFFER_WAIT_SECONDS);
      console.log(`🚀 [REDIS BUFFER TRIGGER] Silencio alcanzado. Bucle de espera roto. Disparando agente para ${user.name}...`);

      // 7. Extraer atómicamente todos los mensajes acumulados en Redis
      const bufferedItems = await getAndClearRedisBuffer(user.id);
      const combinedText =
        bufferedItems.length > 0
          ? bufferedItems.map((item) => item.text).filter(Boolean).join('\n')
          : userText;

      console.log(`📦 [REDIS BUFFER BATCH] Total mensajes agrupados: ${bufferedItems.length || 1}`);

      // 8. Asegurar lock de procesamiento
      await tryAcquireBufferProcessingLock(user.id);

      // 9. Disparar al Agente para procesar la respuesta unificada
      // Nota: processUserBuffer activa el indicador "typing" en Telegram de forma controlada mientras la IA genera la respuesta
      const result = await processUserBuffer(user.id, {
        force: true,
        combinedText,
        chatId,
      });

      return NextResponse.json({ ok: true, result });
    } finally {
      // Liberar cualquier lock residual en Redis
      await clearRedisBufferAndLock(user.id);
    }
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`\n❌ [TELEGRAM Error] tras ${(durationMs / 1000).toFixed(2)}s:`, error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
