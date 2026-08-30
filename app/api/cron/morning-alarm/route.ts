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
      include: { scheduleBlocks: true },
    });

    const results = [];

    for (const user of activeUsers) {
      const { text } = await generateText({
        model: models.primary,
        system: `${SOFI_SYSTEM_PROMPT}\nEstás despertando con calidez y enfoque a ${user.name}.`,
        prompt: `Son las 07:00 AM. Escribe un saludo matutino reconfortante, lleno de energía y enfocado para ${user.name}. Recuérdale hidratarse, prepararse un mate o café y arrancar el día con fuerza.`,
      });

      const msg = text || `🌸 ¡Buenos días ${user.name}! Que tengas una excelente jornada hoy. Recuerda tomar agua y arrancar con calma.`;

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
    console.error('Error in morning-alarm cron:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
