import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { models, modelNames } from '@/lib/ai';
import { getSofiTools } from '@/lib/tools';
import { SOFI_SYSTEM_PROMPT } from '@/lib/prompts';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    let user = null;
    if (userId) {
      user = await prisma.user.findUnique({ where: { id: userId, isActive: true } });
    }
    if (!user) {
      user = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { role: 'asc' } });
    }

    if (!user) {
      return NextResponse.json({ messages: [] });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      take: 25,
    });

    return NextResponse.json({
      messages: messages.map((m) => {
        const d = new Date(m.createdAt);
        const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        return {
          id: m.id,
          role: m.role,
          content: m.content,
          channel: m.channel,
          time: timeStr,
        };
      }),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const { message, messages: incomingList, userId: reqUserId } = await req.json();
    const rawMessages: string[] = incomingList && Array.isArray(incomingList)
      ? incomingList.filter((m: string) => Boolean(m && m.trim()))
      : message ? [message.trim()] : [];

    if (rawMessages.length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 1. Resolver usuario activo
    let user = null;
    if (reqUserId) {
      user = await prisma.user.findUnique({ where: { id: reqUserId, isActive: true } });
    }

    if (!user) {
      user = await prisma.user.findFirst({
        where: { isActive: true },
        orderBy: { role: 'asc' },
      });
    }

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: 'Ludwing Armijo',
          telegramId: process.env.TELEGRAM_ALLOWED_USER_ID || 'ludwing_web',
          role: 'ADMIN',
          isActive: true,
        },
      });
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📩 [WEB CHAT] Mensaje(s) Recibido(s): ${rawMessages.length}`);
    console.log(`👤 Usuario: ${user.name} (Rol: ${user.role} | ID: ${user.id})`);
    console.log(`💬 Contenido: "${rawMessages.join(' | ')}"`);
    console.log(`🤖 Modelo en Proceso: ${modelNames.primary} (B.ai / Cuota 0)`);
    console.log(`⚙️  Orquestando Tools y Memoria...`);

    // 2. Guardar todos los mensajes entrantes del lote
    let lastCreatedMsg = null;
    for (const msg of rawMessages) {
      lastCreatedMsg = await prisma.chatMessage.create({
        data: {
          userId: user.id,
          channel: 'WEB',
          role: 'user',
          content: msg,
        },
      });
    }

    // 3. Buffer breve (1.5s) por si entran más peticiones concurrentes desde la UI
    await new Promise((r) => setTimeout(r, 1500));

    if (lastCreatedMsg) {
      const newerMsg = await prisma.chatMessage.findFirst({
        where: {
          userId: user.id,
          channel: 'WEB',
          role: 'user',
          OR: [
            { createdAt: { gt: lastCreatedMsg.createdAt } },
            { createdAt: lastCreatedMsg.createdAt, id: { gt: lastCreatedMsg.id } },
          ],
        },
      });

      if (newerMsg) {
        console.log(`⏳ [Web Buffer] Ráfaga adicional detectada. Delegando respuesta al último lote.`);
        return NextResponse.json({ ok: true, buffered: true });
      }
    }

    // 4. Obtener todos los mensajes acumulados desde la última respuesta del asistente
    const lastAssistantMsg = await prisma.chatMessage.findFirst({
      where: { userId: user.id, channel: 'WEB', role: 'assistant' },
      orderBy: { createdAt: 'desc' },
    });

    const pendingUserMessages = await prisma.chatMessage.findMany({
      where: {
        userId: user.id,
        channel: 'WEB',
        role: 'user',
        ...(lastAssistantMsg ? { createdAt: { gt: lastAssistantMsg.createdAt } } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    const combinedText = pendingUserMessages.length > 0
      ? pendingUserMessages.map((m) => m.content).filter(Boolean).join('\n')
      : rawMessages.join('\n');

    // 5. Cargar historial previo
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
      ? `Historial reciente:\n${conversationHistory}\n\nMensajes acumulados de ${user.name} (desde Web App):\n${combinedText}`
      : combinedText;

    // 6. Invocación de tools scoped por userId
    const tools = getSofiTools(user.id);

    const { text, steps } = await generateText({
      model: models.primary,
      system: `${SOFI_SYSTEM_PROMPT}\nEstás interactuando en la Web App con ${user.name} (Rol: ${user.role}).`,
      prompt: promptWithHistory,
      tools,
      maxSteps: 5,
    });

    const durationMs = Date.now() - startTime;
    const responseText = text || '🌸 Listo bb, anotado.';

    console.log(`\n🌸 [Sofi Response] (en ${(durationMs / 1000).toFixed(2)}s | Pasos: ${steps?.length || 1} | Lote: ${pendingUserMessages.length || 1})`);
    console.log(`💬 Respuesta: "${responseText}"`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // 7. Guardar respuesta
    await prisma.chatMessage.create({
      data: {
        userId: user.id,
        channel: 'WEB',
        role: 'assistant',
        content: responseText,
      },
    });

    return NextResponse.json({
      response: responseText,
      batchSize: pendingUserMessages.length || rawMessages.length,
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`\n❌ [WEB CHAT Error] tras ${(durationMs / 1000).toFixed(2)}s:`, error);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}


