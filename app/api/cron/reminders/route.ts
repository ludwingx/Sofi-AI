import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTelegramMessage } from '@/lib/telegram';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new NextResponse('Unauthorized Cron Call', { status: 401 });
    }

    const now = new Date();
    const pendingReminders = await prisma.reminder.findMany({
      where: {
        status: 'PENDIENTE',
        dueDateTime: { lte: now },
      },
      include: {
        user: true,
      },
    });

    for (const reminder of pendingReminders) {
      if (reminder.user?.telegramId && reminder.user.isActive) {
        await sendTelegramMessage(reminder.user.telegramId, `⏰ Recordatorio de Sofi:\n\n${reminder.message}`);
        await prisma.reminder.update({
          where: { id: reminder.id },
          data: { status: 'ENVIADO' },
        });
      }
    }

    return NextResponse.json({ processed: pendingReminders.length });
  } catch (error) {
    console.error('Error executing reminders cron:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
