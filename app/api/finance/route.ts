import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const user = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { role: 'asc' } });
    if (!user) return NextResponse.json({ error: 'No user found' }, { status: 400 });

    const now = new Date();
    const currentDay = now.getDate();
    const isFirstFortnight = currentDay <= 15;
    const startDate = new Date(now.getFullYear(), now.getMonth(), isFirstFortnight ? 1 : 16);
    const endDate = isFirstFortnight
      ? new Date(now.getFullYear(), now.getMonth(), 15, 23, 59, 59)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const daysRemaining = Math.max(1, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    const transactions = await prisma.financialTransaction.findMany({
      where: { userId: user.id },
      orderBy: { date: 'desc' },
      take: 20,
    });

    const fortnightExpenses = transactions.filter(
      t => t.type === 'EXPENSE' && new Date(t.date) >= startDate && new Date(t.date) <= endDate
    );

    const totalSpent = fortnightExpenses.reduce((acc, curr) => acc + curr.amountBs, 0);
    const baseFortnightIncome = 1650.0;
    const fixedDeductions = isFirstFortnight ? 450 + 150 + 250 : 450 + 250;
    const freeBudget = baseFortnightIncome - fixedDeductions;
    const remainingFree = freeBudget - totalSpent;
    const burnRate = remainingFree > 0 ? (remainingFree / daysRemaining).toFixed(2) : '0.00';

    const debt = await prisma.debtCommitment.findFirst({
      where: { userId: user.id, creditorName: 'Maycol' },
    });

    return NextResponse.json({
      fortnight: isFirstFortnight ? '1ra Quincena (1-15)' : '2da Quincena (16-Fin de mes)',
      baseIncome: baseFortnightIncome,
      totalSpentFortnight: totalSpent,
      remainingFreeBudget: remainingFree,
      daysRemaining,
      burnRateBs: Number(burnRate),
      debt,
      transactions,
    });
  } catch (error) {
    console.error('Error in finance API:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type = 'EXPENSE', category = 'COMIDA', amountBs, description } = body;

    const user = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { role: 'asc' } });
    if (!user) return NextResponse.json({ error: 'No user found' }, { status: 400 });

    const tx = await prisma.financialTransaction.create({
      data: {
        userId: user.id,
        type,
        category,
        amountBs: parseFloat(amountBs),
        description,
      },
    });

    return NextResponse.json({ success: true, transaction: tx });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
