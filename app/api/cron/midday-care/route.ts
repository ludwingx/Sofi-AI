import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTelegramMessage } from '@/lib/telegram';
import { generateResilientText } from '@/lib/ai';
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
      const { text } = await generateResilientText({
        system: `${SOFI_SYSTEM_PROMPT}\nEstás cuidando la salud de ${user.name} a media tarde.`,
        prompt: `Son las 15:30 PM. Envía un mensaje breve a ${user.name} para recordarle tomar un vaso de agua, despegar la vista de la pantalla por 2 minutos y estirar un poco el cuello y la espalda.`,
      });

      const msg = text || `🌸 Pausa de las 15:30: Tómate un vasito de agua y descansa la vista unos minutos ${user.name}.`;

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
    console.error('Error in midday-care cron:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
