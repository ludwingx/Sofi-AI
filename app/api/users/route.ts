import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Listar usuarios
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            financialTransactions: true,
            chatMessages: true,
            pantryItems: true,
            ideas: true,
          },
        },
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// Crear nuevo usuario
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, telegramId, role = 'USER', initialContext } = body;

    if (!name || !telegramId) {
      return NextResponse.json({ error: 'Name and Telegram ID are required' }, { status: 400 });
    }

    const user = await prisma.user.create({
      data: {
        name,
        telegramId,
        role,
        isActive: true,
      },
    });

    // Iniciar estado de ánimo de Sofi para este usuario
    await prisma.sofiMoodState.create({
      data: {
        userId: user.id,
        patience: 100,
        affection: 90,
        concern: 20,
        energy: 100,
      },
    });

    if (initialContext) {
      await prisma.personalContext.create({
        data: {
          userId: user.id,
          key: 'profile',
          data: JSON.stringify(initialContext),
        },
      });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// Actualizar usuario (activar/pausar, rol)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, isActive, role } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
        ...(role ? { role } : {}),
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
