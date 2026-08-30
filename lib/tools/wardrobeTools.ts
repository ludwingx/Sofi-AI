import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export function getWardrobeTools(userId: string) {
  return {
    suggestOutfit: tool({
      description: 'Recomienda combinaciones de ropa del armario de Ludwing según la ocasión y el clima de Santa Cruz.',
      parameters: z.object({
        occasion: z.enum(['TRABAJO_CASA', 'SALIDA_CASUAL', 'REUNION_FORMAL', 'ENTRENAMIENTO', 'CALOR_INTENSO']).describe('Ocasión'),
      }),
      execute: async ({ occasion }) => {
        const items = await prisma.wardrobeItem.findMany({
          where: { userId, status: 'DISPONIBLE' },
        });

        return {
          occasion,
          availablePiecesCount: items.length,
          items: items.map((i) => `${i.name} (${i.color}, ${i.category})`),
        };
      },
    }),

    manageWishlist: tool({
      description: 'Gestiona la lista de compras deseadas y calcula el total acumulado para evitar compras compulsivas.',
      parameters: z.object({
        action: z.enum(['ADD', 'LIST', 'MARK_PURCHASED']).describe('Acción en la wishlist'),
        title: z.string().optional().describe('Nombre del artículo'),
        estimatedPriceBs: z.number().optional().describe('Precio estimado en Bolivianos'),
        category: z.enum(['SETUP', 'HABITACION', 'CASA', 'OUTFITS']).optional(),
        priority: z.enum(['BAJA', 'MEDIA', 'ALTA']).optional(),
        itemId: z.string().optional().describe('ID para marcar como comprado'),
      }),
      execute: async ({ action, title, estimatedPriceBs, category = 'SETUP', priority = 'MEDIA', itemId }) => {
        if (action === 'ADD' && title && estimatedPriceBs) {
          const item = await prisma.wishlistItem.create({
            data: {
              userId,
              title,
              estimatedPriceBs,
              category,
              priority,
            },
          });

          const all = await prisma.wishlistItem.findMany({ where: { userId, purchased: false } });
          const totalWishlist = all.reduce((acc, curr) => acc + curr.estimatedPriceBs, 0);

          return {
            success: true,
            added: item.title,
            priceBs: item.estimatedPriceBs,
            totalWishlistPendingBs: totalWishlist,
            message: `"${item.title}" (${item.estimatedPriceBs} Bs) añadido a la Wishlist. Total pendiente acumulado: ${totalWishlist} Bs.`,
          };
        }

        if (action === 'MARK_PURCHASED' && itemId) {
          await prisma.wishlistItem.update({
            where: { id: itemId },
            data: { purchased: true },
          });
          return { success: true, message: 'Artículo marcado como comprado.' };
        }

        const pending = await prisma.wishlistItem.findMany({
          where: { userId, purchased: false },
          orderBy: { createdAt: 'desc' },
        });

        const totalPendingBs = pending.reduce((acc, curr) => acc + curr.estimatedPriceBs, 0);

        return {
          totalItems: pending.length,
          totalPendingBs,
          items: pending.map((i) => ({ id: i.id, title: i.title, priceBs: i.estimatedPriceBs, priority: i.priority })),
        };
      },
    }),
  };
}
