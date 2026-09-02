import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTelegramChatAction, getMe, getTelegramWebhookInfo, setTelegramWebhook } from '@/lib/telegram';

// ⚠️ DISEÑO CLAVE: Este webhook SOLO guarda mensajes y retorna 200 de inmediato.
// En Vercel serverless, setTimeout no crea buffers reales porque cada webhook
// es una función completamente independiente y paralela. El buffer de silencio
// de 2 minutos lo maneja el cron /api/cron/process-buffer.

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
      status: webhookInfo.result?.url ? 'WEBHOOK_ACTIVE' : 'NO_WEBHOOK_SET (Requires long-polling or setUrl param)',
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    // 1. Verificación de seguridad de cabecera Secret Token si está configurada
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
        console.log(`🎉 Primer usuario Admin auto-registrado: ${user.name} (Telegram ID: ${senderId})`);
      } else {
        console.warn(`🔒 Drop silencioso: Mensaje bloqueado de usuario no registrado/pausado (ID: ${senderId}, Nombre: ${senderName})`);
        return NextResponse.json({ ok: true });
      }
    }

    const userText = message.text || message.caption || '';

    if (!userText && !message.voice && !message.photo) {
      return NextResponse.json({ ok: true });
    }

    // 3. Guardar el mensaje en BD y retornar 200 INMEDIATAMENTE
    // El buffer de 2 minutos lo gestiona el cron /api/cron/process-buffer.
    // No se usa setTimeout aquí porque en Vercel cada webhook es una función
    // serverless paralela e independiente — un sleep no crea buffer real.
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

    // Enviar "escribiendo..." para que el usuario sepa que Sofi recibió su mensaje
    await sendTelegramChatAction(chatId, 'typing');

    console.log(`📥 [TELEGRAM WEBHOOK] Guardado y encolado para buffer 2min: "${userText}" — Usuario: ${user.name} (Chat: ${chatId})`);

    // Retornar 200 al instante. El cron process-buffer disparará la respuesta
    // después de 2 minutos de silencio del usuario.
    return NextResponse.json({ ok: true, queued: true });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`\n❌ [TELEGRAM Error] tras ${(durationMs / 1000).toFixed(2)}s:`, error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

