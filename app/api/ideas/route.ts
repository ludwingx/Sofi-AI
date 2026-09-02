import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const user = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { role: 'asc' } });
    if (!user) return NextResponse.json({ error: 'No user found' }, { status: 400 });

    const ideas = await prisma.idea.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ ideas });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ideaId, title, description, category = 'GENERAL', tags, status = 'INBOX' } = body;

    const user = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { role: 'asc' } });
    if (!user) return NextResponse.json({ error: 'No user found' }, { status: 400 });

    if (action === 'UPDATE_STATUS' && ideaId) {
      const updated = await prisma.idea.update({
        where: { id: ideaId },
        data: { status },
      });
      return NextResponse.json({ success: true, idea: updated });
    }

    if (title && description) {
      const idea = await prisma.idea.create({
        data: {
          userId: user.id,
          title,
          description,
          category,
          tags,
          status,
        },
      });
      return NextResponse.json({ success: true, idea });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
