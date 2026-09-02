import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const user = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { role: 'asc' } });
    if (!user) return NextResponse.json({ error: 'No user found' }, { status: 400 });

    const logs = await prisma.deepWorkLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const totalHours = logs.reduce((acc, curr) => acc + curr.hoursLogged, 0);

    return NextResponse.json({ logs, totalHours, count: logs.length });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { project = 'Sofi AI', hoursLogged, deliverables } = body;

    const user = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { role: 'asc' } });
    if (!user) return NextResponse.json({ error: 'No user found' }, { status: 400 });

    const log = await prisma.deepWorkLog.create({
      data: {
        userId: user.id,
        project,
        hoursLogged: parseFloat(hoursLogged),
        deliverables,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        type: 'BLOQUE_TRABAJO',
        description: `Bloque de Poder en "${project}": ${hoursLogged}h. Entregables: ${deliverables}`,
      },
    });

    return NextResponse.json({ success: true, log });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
