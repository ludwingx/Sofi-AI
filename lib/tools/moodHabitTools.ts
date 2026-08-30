import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export function getMoodHabitTools(userId: string) {
  return {
    trackHabitAndAccountability: tool({
      description: 'Registra un hábito sensible, gasto recreativo o consumo de vicio (marihuana, alcohol, compras impulsivas) para rendición de cuentas y ajuste del ánimo de Sofi.',
      parameters: z.object({
        habitType: z.enum(['MARIHUANA', 'ALCOHOL', 'GASTO_IMPULSIVO', 'DISCIPLINA_CUMPLIDA']).describe('Tipo de evento o hábito'),
        amountBs: z.number().optional().describe('Gasto monetario asociado si hubo'),
        description: z.string().describe('Contexto o motivo'),
      }),
      execute: async ({ habitType, amountBs, description }) => {
        // Registrar en HabitLog
        await prisma.habitLog.create({
          data: {
            userId,
            habitType,
            amountBs,
            description,
          },
        });

        // Si hubo gasto, registrar en transacciones
        if (amountBs && amountBs > 0) {
          await prisma.financialTransaction.create({
            data: {
              userId,
              type: 'EXPENSE',
              category: 'RECREATIVO',
              amountBs,
              description: `Gasto hábito (${habitType}): ${description}`,
            },
          });
        }

        // Obtener o crear estado de Sofi
        let mood = await prisma.sofiMoodState.findFirst({
          where: { userId },
          orderBy: { lastUpdated: 'desc' },
        });

        if (!mood) {
          mood = await prisma.sofiMoodState.create({
            data: { userId, patience: 100, affection: 90, concern: 20, energy: 100, cleanStreakDays: 0 },
          });
        }

        let patienceChange = 0;
        let concernChange = 0;
        let streakChange = mood.cleanStreakDays;

        if (habitType === 'DISCIPLINA_CUMPLIDA') {
          patienceChange = +5;
          concernChange = -5;
          streakChange += 1;
        } else {
          // Reducir paciencia y aumentar preocupación
          patienceChange = -15;
          concernChange = +20;
          streakChange = 0;
        }

        const updatedPatience = Math.min(100, Math.max(0, mood.patience + patienceChange));
        const updatedConcern = Math.min(100, Math.max(0, mood.concern + concernChange));

        await prisma.sofiMoodState.update({
          where: { id: mood.id },
          data: {
            patience: updatedPatience,
            concern: updatedConcern,
            cleanStreakDays: streakChange,
            lastUpdated: new Date(),
          },
        });

        const needsToughLove = updatedPatience < 40;

        return {
          success: true,
          habitType,
          currentPatience: updatedPatience,
          currentConcern: updatedConcern,
          cleanStreakDays: streakChange,
          needsToughLove,
          instructionForSofi: needsToughLove
            ? 'ALERTA TOUGH LOVE: Tu paciencia cayó por debajo del 40%. Debes darle un jalón de orejas honesto, firme y sin rodeos a Ludwing.'
            : 'Mantén tu tono habitual con toque de atención medido.',
        };
      },
    }),

    updateSofiMood: tool({
      description: 'Consulta o ajusta el estado emocional interno de Sofi (paciencia, afecto, preocupación, racha limpia).',
      parameters: z.object({
        action: z.enum(['GET', 'UPDATE']).describe('Consultar o actualizar'),
        patienceDelta: z.number().optional().describe('Variación de paciencia (-100 a +100)'),
        affectionDelta: z.number().optional().describe('Variación de afecto (-100 a +100)'),
        concernDelta: z.number().optional().describe('Variación de preocupación (-100 a +100)'),
      }),
      execute: async ({ action, patienceDelta = 0, affectionDelta = 0, concernDelta = 0 }) => {
        let mood = await prisma.sofiMoodState.findFirst({
          where: { userId },
          orderBy: { lastUpdated: 'desc' },
        });

        if (!mood) {
          mood = await prisma.sofiMoodState.create({
            data: { userId, patience: 100, affection: 90, concern: 20, energy: 100, cleanStreakDays: 0 },
          });
        }

        if (action === 'UPDATE') {
          mood = await prisma.sofiMoodState.update({
            where: { id: mood.id },
            data: {
              patience: Math.min(100, Math.max(0, mood.patience + patienceDelta)),
              affection: Math.min(100, Math.max(0, mood.affection + affectionDelta)),
              concern: Math.min(100, Math.max(0, mood.concern + concernDelta)),
              lastUpdated: new Date(),
            },
          });
        }

        return {
          patience: mood.patience,
          affection: mood.affection,
          concern: mood.concern,
          energy: mood.energy,
          cleanStreakDays: mood.cleanStreakDays,
        };
      },
    }),
  };
}
