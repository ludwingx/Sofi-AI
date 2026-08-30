import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export function getFinancialTools(userId: string) {
  return {
    logExpense: tool({
      description: 'Registra un gasto personal de Ludwing en Bolivianos (Bs) con su categoría y descripción.',
      parameters: z.object({
        amountBs: z.number().describe('Monto gastado en Bolivianos (ej: 25.5)'),
        category: z.enum(['COMIDA', 'TRANSPORTE', 'SERVICIOS', 'SALUD', 'SALIDAS_OCIO', 'TRABAJO', 'RECREATIVO']).describe('Categoría del gasto'),
        description: z.string().describe('Detalle breve de la compra o gasto'),
      }),
      execute: async ({ amountBs, category, description }) => {
        const tx = await prisma.financialTransaction.create({
          data: {
            userId,
            type: 'EXPENSE',
            amountBs,
            category,
            description,
          },
        });

        // Calcular total de gastos de la quincena actual
        const now = new Date();
        const currentDay = now.getDate();
        const startDate = new Date(now.getFullYear(), now.getMonth(), currentDay <= 15 ? 1 : 16);

        const totalFortnight = await prisma.financialTransaction.aggregate({
          where: {
            userId,
            type: 'EXPENSE',
            date: { gte: startDate },
          },
          _sum: { amountBs: true },
        });

        return {
          success: true,
          transactionId: tx.id,
          amountBs,
          category,
          description,
          spentInFortnight: totalFortnight._sum.amountBs || 0,
          message: `Gasto de ${amountBs} Bs registrado en ${category}.`,
        };
      },
    }),

    logIncome: tool({
      description: 'Registra un ingreso de dinero recibido por sueldo, adelanto o freelance.',
      parameters: z.object({
        amountBs: z.number().describe('Monto en Bolivianos'),
        description: z.string().describe('Origen del ingreso (ej: Sueldo quincena 1, Anticipo proyecto)'),
      }),
      execute: async ({ amountBs, description }) => {
        const tx = await prisma.financialTransaction.create({
          data: {
            userId,
            type: 'INCOME',
            amountBs,
            category: 'TRABAJO',
            description,
          },
        });

        return {
          success: true,
          transactionId: tx.id,
          amountBs,
          message: `Ingreso de ${amountBs} Bs registrado correctamente.`,
        };
      },
    }),

    getFinancialReport: tool({
      description: 'Obtiene el balance financiero de la quincena en curso, gastos por categoría y cálculo de gasto seguro diario.',
      parameters: z.object({}),
      execute: async () => {
        const now = new Date();
        const currentDay = now.getDate();
        const isFirstFortnight = currentDay <= 15;
        const startDate = new Date(now.getFullYear(), now.getMonth(), isFirstFortnight ? 1 : 16);
        const endDate = isFirstFortnight
          ? new Date(now.getFullYear(), now.getMonth(), 15, 23, 59, 59)
          : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const daysRemaining = Math.max(1, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

        const expenses = await prisma.financialTransaction.findMany({
          where: {
            userId,
            type: 'EXPENSE',
            date: { gte: startDate, lte: endDate },
          },
        });

        const totalSpent = expenses.reduce((acc, curr) => acc + curr.amountBs, 0);
        const baseFortnightIncome = 1650.0; // Paga base quincenal de Ludwing (3,300 total)
        const fixedDeductions = isFirstFortnight ? 450 + 150 + 250 : 450 + 250; // Alquiler, servicios, deuda Maycol
        const freeBudgetFortnight = baseFortnightIncome - fixedDeductions;
        const remainingFreeBudget = freeBudgetFortnight - totalSpent;
        const safeDailyMargin = remainingFreeBudget > 0 ? (remainingFreeBudget / daysRemaining).toFixed(2) : '0.00';

        return {
          fortnight: isFirstFortnight ? 'Primera Quincena (Día 1-15)' : 'Segunda Quincena (Día 16-Fin de mes)',
          baseIncome: baseFortnightIncome,
          totalSpentFortnight: totalSpent,
          remainingFreeBudget,
          daysRemainingInFortnight: daysRemaining,
          safeDailyBurnRateBs: Number(safeDailyMargin),
          expensesBreakdown: expenses.slice(-5).map((e) => ({ cat: e.category, desc: e.description, bs: e.amountBs })),
        };
      },
    }),

    manageDebt: tool({
      description: 'Gestiona la deuda con Maycol (abonos, cuotas quincenales de 250 Bs y estado de saldo restante).',
      parameters: z.object({
        action: z.enum(['STATUS', 'PAY_INSTALLMENT']).describe('Consultar estado o registrar abono'),
        amountPaidBs: z.number().optional().describe('Monto abonado (por defecto 250 Bs si es PAY_INSTALLMENT)'),
        notes: z.string().optional().describe('Notas o comprobante del pago'),
      }),
      execute: async ({ action, amountPaidBs = 250, notes }) => {
        let debt = await prisma.debtCommitment.findFirst({
          where: { userId, creditorName: 'Maycol', status: 'ACTIVA' },
        });

        if (!debt) {
          debt = await prisma.debtCommitment.create({
            data: {
              userId,
              creditorName: 'Maycol',
              totalAmountBs: 1500.0,
              remainingAmountBs: 1500.0,
              installmentBs: 250.0,
              notes: 'Deuda única consolidada con Maycol',
            },
          });
        }

        if (action === 'PAY_INSTALLMENT') {
          const newRemaining = Math.max(0, debt.remainingAmountBs - amountPaidBs);
          debt = await prisma.debtCommitment.update({
            where: { id: debt.id },
            data: {
              remainingAmountBs: newRemaining,
              status: newRemaining === 0 ? 'LIQUIDADA' : 'ACTIVA',
              notes: notes ? `${debt.notes || ''} | Pago: ${amountPaidBs} Bs (${notes})` : debt.notes,
            },
          });

          // Registrar también la transacción financiera
          await prisma.financialTransaction.create({
            data: {
              userId,
              type: 'EXPENSE',
              category: 'SERVICIOS',
              amountBs: amountPaidBs,
              description: `Abono a deuda Maycol (Saldo restante: ${newRemaining} Bs)`,
            },
          });

          return {
            success: true,
            amountPaid: amountPaidBs,
            remainingDebtBs: newRemaining,
            status: debt.status,
            message: `Abono de ${amountPaidBs} Bs a Maycol registrado. Saldo pendiente: ${newRemaining} Bs.`,
          };
        }

        return {
          creditor: debt.creditorName,
          totalOriginal: debt.totalAmountBs,
          remainingDebtBs: debt.remainingAmountBs,
          installmentPlan: `${debt.installmentBs} Bs por quincena`,
          status: debt.status,
        };
      },
    }),
  };
}
