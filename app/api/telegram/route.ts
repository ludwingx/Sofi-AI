import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { models, modelNames } from '@/lib/ai';
import { getSofiTools } from '@/lib/tools';
import { SOFI_SYSTEM_PROMPT } from '@/lib/prompts';
import { prisma } from '@/lib/prisma';
import { sendTelegramMessage, sendTelegramChatAction, getMe, getTelegramWebhookInfo, setTelegramWebhook } from '@/lib/telegram';

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
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📩 [TELEGRAM WEBHOOK] Mensaje Recibido`);
    console.log(`👤 Usuario: ${user.name} (Telegram ID: ${senderId} | Chat ID: ${chatId})`);
    console.log(`💬 Mensaje: "${userText || '(Multimedia / Audio / Foto)'}"`);
    console.log(`🤖 Modelo en Proceso: ${modelNames.primary} (B.ai / Cuota 0)`);
    console.log(`⚙️  Orquestando Tools y Memoria...`);

    if (!userText && !message.voice && !message.photo) {
      console.log(`⚠️  Mensaje vacío sin texto ni multimedia. Omitiendo.`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      return NextResponse.json({ ok: true });
    }

    // 3. Registrar mensaje entrante en base de datos
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

    // 4. Enviar indicador de "escribiendo..." de inmediato para feedback visual
    await sendTelegramChatAction(chatId, 'typing');

    // 5. BUFFER / DEBOUNCE (2.5 segundos): Esperar por si el usuario está enviando mensajes continuos
    const BUFFER_WAIT_MS = 2500;
    await new Promise((resolve) => setTimeout(resolve, BUFFER_WAIT_MS));

    if (currentMsg) {
      // Verificar si llegó un mensaje posterior de este usuario durante el tiempo de espera
      const newerMessage = await prisma.chatMessage.findFirst({
        where: {
          userId: user.id,
          channel: 'TELEGRAM',
          role: 'user',
          OR: [
            { createdAt: { gt: currentMsg.createdAt } },
            { createdAt: currentMsg.createdAt, id: { gt: currentMsg.id } },
          ],
        },
      });

      if (newerMessage) {
        console.log(`⏳ [Buffer Debounce] Mensaje posterior detectado. Esperando al último mensaje para responder todo junto.`);
        return NextResponse.json({ ok: true, buffered: true });
      }
    }

    // 6. Obtener el último mensaje del asistente para consolidar TODOS los mensajes enviados por el usuario en esta ráfaga
    const lastAssistantMsg = await prisma.chatMessage.findFirst({
      where: { userId: user.id, channel: 'TELEGRAM', role: 'assistant' },
      orderBy: { createdAt: 'desc' },
    });

    const pendingUserMessages = await prisma.chatMessage.findMany({
      where: {
        userId: user.id,
        channel: 'TELEGRAM',
        role: 'user',
        ...(lastAssistantMsg ? { createdAt: { gt: lastAssistantMsg.createdAt } } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    const combinedUserText = pendingUserMessages.length > 0
      ? pendingUserMessages.map((m) => m.content).filter(Boolean).join('\n')
      : userText || '(Envió contenido multimedia)';

    console.log(`📦 [Buffer Consolidado] Procesando ${pendingUserMessages.length || 1} mensaje(s) acumulados en una sola respuesta:`);
    console.log(`"${combinedUserText}"`);

    // Refrescar acción de escribiendo...
    await sendTelegramChatAction(chatId, 'typing');

    // 7. Cargar historial previo (anterior a esta ráfaga) para memoria conversacional
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
      .map((m) => `${m.role === 'user' ? user?.name : 'Sofi'}: ${m.content}`)
      .join('\n');

    const promptWithHistory = conversationHistory
      ? `Historial reciente:\n${conversationHistory}\n\nMensajes acumulados de ${user.name}:\n${combinedUserText}`
      : combinedUserText;

    // 8. Ejecutar Orquestador Inteligente con Tools scoped por userId
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

    console.log(`\n🌸 [Sofi Response] (en ${(durationMs / 1000).toFixed(2)}s | Pasos: ${steps?.length || 1} | Mensajes acumulados: ${pendingUserMessages.length || 1})`);
    console.log(`💬 Respuesta a ${user.name}: "${responseText}"`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // 9. Guardar respuesta unificada en DB
    await prisma.chatMessage.create({
      data: {
        userId: user.id,
        channel: 'TELEGRAM',
        role: 'assistant',
        content: responseText,
      },
    });

    // 10. Enviar respuesta única por Telegram
    await sendTelegramMessage(chatId, responseText);

    return NextResponse.json({ ok: true, batchSize: pendingUserMessages.length || 1 });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`\n❌ [TELEGRAM Error] tras ${(durationMs / 1000).toFixed(2)}s:`, error);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

