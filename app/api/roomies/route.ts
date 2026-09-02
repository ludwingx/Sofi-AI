import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const user = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { role: 'asc' } });
    if (!user) return NextResponse.json({ error: 'No user found' }, { status: 400 });

    const expenses = await prisma.roomieExpense.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    const pendingExpenses = expenses.filter(e => e.status === 'PENDIENTE');
    const totalPendingBs = pendingExpenses.reduce((acc, curr) => acc + curr.totalAmountBs, 0);

    return NextResponse.json({
      roomies: ['Ramón', 'Rocío', 'Molly', 'Ludwing'],
      expenses,
      totalPendingBs,
      pendingCount: pendingExpenses.length,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, expenseId, concept, totalAmountBs, paidBy = 'Ludwing' } = body;

    const user = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { role: 'asc' } });
    if (!user) return NextResponse.json({ error: 'No user found' }, { status: 400 });

    if (action === 'SETTLE' && expenseId) {
      const updated = await prisma.roomieExpense.update({
        where: { id: expenseId },
        data: { status: 'LIQUIDADO' },
      });
      return NextResponse.json({ success: true, expense: updated });
    }

    if (concept && totalAmountBs) {
      const amount = parseFloat(totalAmountBs);
      const perPerson = parseFloat((amount / 4).toFixed(2));

      const expense = await prisma.roomieExpense.create({
        data: {
          userId: user.id,
          concept,
          totalAmountBs: amount,
          paidBy,
          perPersonBs: perPerson,
          participants: 'Ramón, Rocío, Molly, Ludwing',
          status: 'PENDIENTE',
        },
      });

      return NextResponse.json({ success: true, expense });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
