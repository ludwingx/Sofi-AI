import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export function getPantryTools(userId: string) {
  return {
    consumePantryItem: tool({
      description: 'Descuenta automáticamente del stock un insumo consumido (yerba mate, huevos, café, avena, pollo, arroz) y alerta si entra en umbral mínimo de reposición.',
      parameters: z.object({
        itemName: z.string().describe('Nombre del insumo (ej: Yerba Mate, Huevos Frescos, Café, Avena, Pollo, Arroz)'),
        quantity: z.number().optional().describe('Cantidad consumida (si no se indica, usa la porción por defecto)'),
        unit: z.string().optional().describe('Unidad (ej: cebada, unidades, tazas, g)'),
      }),
      execute: async ({ itemName, quantity }) => {
        const item = await prisma.pantryItem.findFirst({
          where: { userId, name: { contains: itemName } },
        });

        if (!item) {
          return {
            found: false,
            message: `El insumo "${itemName}" no está registrado en el inventario base.`,
          };
        }

        const consumed = quantity ?? item.defaultPortion;
        const newStock = Math.max(0, item.currentStock - consumed);
        let newStatus = 'DISPONIBLE';

        if (newStock === 0) {
          newStatus = 'AGOTADO';
        } else if (newStock <= item.minThreshold) {
          newStatus = 'POR_AGOTARSE';
        }

        const updated = await prisma.pantryItem.update({
          where: { id: item.id },
          data: {
            currentStock: newStock,
            status: newStatus,
          },
        });

        // Log activity
        await prisma.activityLog.create({
          data: {
            userId,
            type: 'CONSUMO',
            description: `Consumo: ${consumed} ${item.unit} de ${item.name}. Stock restante: ${newStock} ${item.unit}.`,
          },
        });

        return {
          success: true,
          item: updated.name,
          consumedAmount: consumed,
          remainingStock: updated.currentStock,
          unit: updated.unit,
          status: updated.status,
          needsRestock: newStatus !== 'DISPONIBLE',
          estimatedPriceBs: updated.estimatedPriceBs,
          message: `Descontado ${consumed} ${updated.unit} de ${updated.name}. Quedan ${updated.currentStock} ${updated.unit}.${newStatus !== 'DISPONIBLE' ? ` ⚠️ Alerta: Estado ${newStatus}` : ''}`,
        };
      },
    }),

    checkPantryAndSuggestMeal: tool({
      description: 'Revisa los insumos disponibles en alacena y refrigerador para sugerir recetas prácticas y rápidas con lo que hay.',
      parameters: z.object({
        mealType: z.enum(['DESAYUNO', 'ALMUERZO', 'CENA', 'SNACK', 'MATE']).optional().describe('Tipo de comida deseada'),
      }),
      execute: async ({ mealType = 'ALMUERZO' }) => {
        const availableItems = await prisma.pantryItem.findMany({
          where: {
            userId,
            currentStock: { gt: 0 },
          },
        });

        const lowStockItems = availableItems.filter((i) => i.status === 'POR_AGOTARSE');

        return {
          mealType,
          totalAvailable: availableItems.length,
          availableIngredients: availableItems.map((i) => `${i.name} (${i.currentStock} ${i.unit})`),
          lowStockWarning: lowStockItems.map((i) => `${i.name} (quedan ${i.currentStock} ${i.unit})`),
        };
      },
    }),

    generateGroceryList: tool({
      description: 'Genera la lista de compras de despensa con insumos agotados o por agotarse y costo estimado en Bolivianos.',
      parameters: z.object({}),
      execute: async () => {
        const neededItems = await prisma.pantryItem.findMany({
          where: {
            userId,
            status: { in: ['POR_AGOTARSE', 'AGOTADO'] },
          },
        });

        const totalEstimatedBs = neededItems.reduce((acc, curr) => acc + (curr.estimatedPriceBs || 0), 0);

        return {
          count: neededItems.length,
          totalEstimatedBs,
          items: neededItems.map((i) => ({
            name: i.name,
            currentStock: `${i.currentStock} ${i.unit}`,
            status: i.status,
            estimatedPriceBs: i.estimatedPriceBs || 0,
          })),
        };
      },
    }),
  };
}
