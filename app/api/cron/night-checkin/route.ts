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

    const activeUsers = await prisma.user.findMany({ where: { isActive: true } });
    const results = [];

    for (const user of activeUsers) {
      const { text } = await generateText({
        model: models.primary,
        system: `${SOFI_SYSTEM_PROMPT}\nEstás cerrando el día con ${user.name} con tono suave, reflexivo y afectuoso.`,
        prompt: `Son las 21:50 PM. Escribe un mensaje cálido de cierre de jornada para ${user.name}. Pregúntale cómo se sintió hoy o comparte un pensamiento inspirador sobre tecnología e inteligencia artificial si la noche está tranquila. Si está cansado, anímalo a descansar.`,
      });

      const msg = text || `🌸 21:50 PM: Llegó la hora de ir cerrando la jornada ${user.name}. Buen descanso y gracias por el esfuerzo de hoy.`;

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
    console.error('Error in night-checkin cron:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
