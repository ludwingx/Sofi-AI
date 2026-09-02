import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const user = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { role: 'asc' } });
    if (!user) return NextResponse.json({ error: 'No user found' }, { status: 400 });

    const episodes = await prisma.healthEpisode.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    const habits = await prisma.habitLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const dailyLogs = await prisma.dailyLog.findMany({
      where: { userId: user.id },
      orderBy: { date: 'desc' },
      take: 7,
    });

    const mood = await prisma.sofiMoodState.findFirst({
      where: { userId: user.id },
    });

    return NextResponse.json({ episodes, habits, dailyLogs, mood });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { target, discomfortType, symptoms, possibleTriggers, habitType, amountBs, description } = body;

    const user = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { role: 'asc' } });
    if (!user) return NextResponse.json({ error: 'No user found' }, { status: 400 });

    if (target === 'HEALTH_EPISODE' && discomfortType && symptoms) {
      const episode = await prisma.healthEpisode.create({
        data: {
          userId: user.id,
          discomfortType,
          symptoms,
          possibleTriggers,
          status: 'ACTIVO',
        },
      });
      return NextResponse.json({ success: true, episode });
    }

    if (target === 'HABIT' && habitType) {
      const habit = await prisma.habitLog.create({
        data: {
          userId: user.id,
          habitType,
          amountBs: amountBs ? parseFloat(amountBs) : null,
          description,
        },
      });
      return NextResponse.json({ success: true, habit });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
