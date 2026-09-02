import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const user = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { role: 'asc' } });
    if (!user) return NextResponse.json({ error: 'No user found' }, { status: 400 });

    const items = await prisma.pantryItem.findMany({
      where: { userId: user.id },
      orderBy: { name: 'asc' },
    });

    const lowStock = items.filter(i => i.status !== 'DISPONIBLE');
    const estimatedRestockTotalBs = lowStock.reduce((acc, curr) => acc + (curr.estimatedPriceBs || 0), 0);

    return NextResponse.json({ items, lowStock, estimatedRestockTotalBs });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, itemId, name, currentStock, unit, defaultPortion, minThreshold, estimatedPriceBs } = body;

    const user = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { role: 'asc' } });
    if (!user) return NextResponse.json({ error: 'No user found' }, { status: 400 });

    if (action === 'CONSUME' && itemId) {
      const item = await prisma.pantryItem.findUnique({ where: { id: itemId } });
      if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

      const newStock = Math.max(0, item.currentStock - item.defaultPortion);
      let status = 'DISPONIBLE';
      if (newStock === 0) status = 'AGOTADO';
      else if (newStock <= item.minThreshold) status = 'POR_AGOTARSE';

      const updated = await prisma.pantryItem.update({
        where: { id: item.id },
        data: { currentStock: newStock, status },
      });

      return NextResponse.json({ success: true, item: updated });
    }

    if (action === 'RESTOCK' && itemId) {
      const item = await prisma.pantryItem.findUnique({ where: { id: itemId } });
      if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

      const updated = await prisma.pantryItem.update({
        where: { id: item.id },
        data: {
          currentStock: item.name === 'Huevos Frescos' ? 30 : item.name === 'Yerba Mate' ? 500 : 200,
          status: 'DISPONIBLE',
        },
      });
      return NextResponse.json({ success: true, item: updated });
    }

    if (name) {
      const created = await prisma.pantryItem.create({
        data: {
          userId: user.id,
          name,
          currentStock: parseFloat(currentStock),
          unit,
          defaultPortion: parseFloat(defaultPortion || '1'),
          minThreshold: parseFloat(minThreshold || '1'),
          estimatedPriceBs: estimatedPriceBs ? parseFloat(estimatedPriceBs) : null,
          status: parseFloat(currentStock) <= parseFloat(minThreshold) ? 'POR_AGOTARSE' : 'DISPONIBLE',
        },
      });
      return NextResponse.json({ success: true, item: created });
    }

    return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
