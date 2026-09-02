import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const user = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { role: 'asc' } });
    if (!user) return NextResponse.json({ error: 'No user found' }, { status: 400 });

    const wardrobe = await prisma.wardrobeItem.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    const wishlist = await prisma.wishlistItem.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    const pendingWishlistTotalBs = wishlist
      .filter(w => !w.purchased)
      .reduce((acc, curr) => acc + curr.estimatedPriceBs, 0);

    return NextResponse.json({ wardrobe, wishlist, pendingWishlistTotalBs });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { target, action, itemId, name, category, color, style, title, estimatedPriceBs, priority } = body;

    const user = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { role: 'asc' } });
    if (!user) return NextResponse.json({ error: 'No user found' }, { status: 400 });

    if (target === 'WISHLIST_TOGGLE' && itemId) {
      const item = await prisma.wishlistItem.findUnique({ where: { id: itemId } });
      if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const updated = await prisma.wishlistItem.update({
        where: { id: itemId },
        data: { purchased: !item.purchased },
      });
      return NextResponse.json({ success: true, item: updated });
    }

    if (target === 'ADD_WISHLIST' && title && estimatedPriceBs) {
      const item = await prisma.wishlistItem.create({
        data: {
          userId: user.id,
          title,
          estimatedPriceBs: parseFloat(estimatedPriceBs),
          category: category || 'SETUP',
          priority: priority || 'MEDIA',
        },
      });
      return NextResponse.json({ success: true, item });
    }

    if (target === 'ADD_WARDROBE' && name && category) {
      const item = await prisma.wardrobeItem.create({
        data: {
          userId: user.id,
          name,
          category,
          color: color || 'Negro',
          style: style || 'Casual',
        },
      });
      return NextResponse.json({ success: true, item });
    }

    return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
