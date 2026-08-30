import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { models, modelNames } from '@/lib/ai';
import { getSofiTools } from '@/lib/tools';
import { SOFI_SYSTEM_PROMPT } from '@/lib/prompts';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const { message, userId: reqUserId } = await req.json();
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 1. Resolver usuario multi-tenant activo
    let user = null;
    if (reqUserId) {
      user = await prisma.user.findUnique({ where: { id: reqUserId, isActive: true } });
    }

    if (!user) {
      user = await prisma.user.findFirst({
        where: { isActive: true },
        orderBy: { role: 'asc' }, // Prioriza ADMIN
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
    console.log(`📩 [WEB CHAT] Mensaje Recibido`);
    console.log(`👤 Usuario: ${user.name} (Rol: ${user.role} | ID: ${user.id})`);
    console.log(`💬 Mensaje: "${message}"`);
    console.log(`🤖 Modelo en Proceso: ${modelNames.primary} (B.ai / Cuota 0)`);
    console.log(`⚙️  Orquestando Tools y Memoria...`);

    // 2. Guardar mensaje del usuario
    await prisma.chatMessage.create({
      data: {
        userId: user.id,
        channel: 'WEB',
        role: 'user',
        content: message,
      },
    });

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

    const promptWithHistory = `Historial reciente:\n${conversationHistory}\n\nNuevo mensaje de ${user.name} (desde Web App):\n${message}`;

    // 4. Invocación de tools scoped por userId
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

    console.log(`\n🌸 [Sofi Response] (en ${(durationMs / 1000).toFixed(2)}s | Pasos: ${steps?.length || 1})`);
    console.log(`💬 Respuesta: "${responseText}"`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // 5. Guardar respuesta
    await prisma.chatMessage.create({
      data: {
        userId: user.id,
        channel: 'WEB',
        role: 'assistant',
        content: responseText,
      },
    });

    return NextResponse.json({ response: responseText });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`\n❌ [WEB CHAT Error] tras ${(durationMs / 1000).toFixed(2)}s:`, error);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

