import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export function getRoomieTools(userId: string) {
  return {
    logRoomieExpense: tool({
      description: 'Registra un gasto compartido del departamento (gas, agua, bidones, limpieza) y lo divide automáticamente entre los 4 roomies (Ramón, Rocío, Molly, Ludwing).',
      parameters: z.object({
        concept: z.string().describe('Concepto del gasto (ej: Garrafa de gas, Detergente para piso, Bidón de agua)'),
        amountBs: z.number().describe('Monto total pagado en Bolivianos'),
        paidBy: z.string().default('Ludwing').describe('Quién realizó el pago (Ludwing, Ramón, Rocío, Molly)'),
      }),
      execute: async ({ concept, amountBs, paidBy }) => {
        const perPerson = parseFloat((amountBs / 4).toFixed(2));

        const expense = await prisma.roomieExpense.create({
          data: {
            userId,
            concept,
            totalAmountBs: amountBs,
            paidBy,
            perPersonBs: perPerson,
            participants: 'Ramón, Rocío, Molly, Ludwing',
            status: 'PENDIENTE',
          },
        });

        // Si lo pagó Ludwing, registrar el gasto inicial en sus transacciones
        if (paidBy.toLowerCase() === 'ludwing') {
          await prisma.financialTransaction.create({
            data: {
              userId,
              type: 'EXPENSE',
              category: 'SERVICIOS',
              amountBs,
              description: `Gasto depa (Roomie split): ${concept} (Total: ${amountBs} Bs)`,
            },
          });
        }

        return {
          success: true,
          id: expense.id,
          concept,
          totalAmountBs: amountBs,
          paidBy,
          perPersonBs: perPerson,
          splitBetween: ['Ramón', 'Rocío', 'Molly', 'Ludwing'],
          status: 'PENDIENTE',
          message: `Gasto de "${concept}" por ${amountBs} Bs registrado. Corresponde a ${perPerson} Bs por roomie.`,
        };
      },
    }),

    getRoomieBalance: tool({
      description: 'Consulta los gastos compartidos pendientes entre los roomies y cuánto deben reembolsar a quien pagó.',
      parameters: z.object({}),
      execute: async () => {
        const pendingExpenses = await prisma.roomieExpense.findMany({
          where: { userId, status: 'PENDIENTE' },
          orderBy: { createdAt: 'desc' },
        });

        const totalPending = pendingExpenses.reduce((acc, curr) => acc + curr.totalAmountBs, 0);

        return {
          totalPendingExpensesBs: totalPending,
          count: pendingExpenses.length,
          items: pendingExpenses.map((e) => ({
            id: e.id,
            concept: e.concept,
            total: e.totalAmountBs,
            paidBy: e.paidBy,
            perPerson: e.perPersonBs,
            date: e.createdAt.toISOString().split('T')[0],
          })),
        };
      },
    }),
  };
}
