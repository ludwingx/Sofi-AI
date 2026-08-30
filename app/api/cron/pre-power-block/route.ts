import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTelegramMessage } from '@/lib/telegram';
import { generateText } from 'ai';
import { models } from '@/lib/ai';
import { SOFI_SYSTEM_PROMPT } from '@/lib/prompts';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new NextResponse('Unauthorized Cron Call', { status: 401 });
    }

    const activeUsers = await prisma.user.findMany({
      where: { isActive: true },
      include: { moodStates: { orderBy: { lastUpdated: 'desc' }, take: 1 } },
    });

    const results = [];

    for (const user of activeUsers) {
      const mood = user.moodStates[0];

      const { text } = await generateText({
        model: models.primary,
        system: `${SOFI_SYSTEM_PROMPT}\nEstás enviando una notificación proactiva a ${user.name}.`,
        prompt: `Son las 19:25 PM. Escribe un mensaje breve, cariñoso y motivador para ${user.name} avisándole que en 5 minutos arranca su Bloque de Poder (19:30 - 21:45 PM). Pregúntale en qué proyecto nos enfocaremos hoy (ej: Sofi AI u otro). Estado de ánimo actual: paciencia ${mood?.patience ?? 100}%, afecto ${mood?.affection ?? 90}%.`,
      });

      const msg = text || `🌸 Ya casi son las 19:30 ${user.name === 'Ludwing Armijo' ? 'bb' : user.name}. ¿Arrancamos hoy con tu Bloque de Poder?`;

      await sendTelegramMessage(user.telegramId, msg);

      await prisma.chatMessage.create({
        data: {
          userId: user.id,
          channel: 'TELEGRAM',
          role: 'assistant',
          content: msg,
        },
      });

      results.push({ user: user.name, sent: true });
    }

    return NextResponse.json({ ok: true, dispatched: results });
  } catch (error) {
    console.error('Error in pre-power-block cron:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
