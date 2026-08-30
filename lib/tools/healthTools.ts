import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export function getHealthTools(userId: string) {
  return {
    trackHealthSymptom: tool({
      description: 'Registra síntomas físicos o episodios de malestar (dolor de cabeza, fatiga, postura, gastritis) para historial de salud y seguimiento.',
      parameters: z.object({
        discomfortType: z.string().describe('Tipo de malestar (ej: Dolor de cabeza, Fatiga ocular, Molestia de espalda)'),
        symptoms: z.string().describe('Descripción detallada de lo que siente'),
        possibleTriggers: z.string().optional().describe('Posible causa (ej: Muchas horas frente a pantalla, poca agua, mala postura)'),
        actionsTaken: z.string().optional().describe('Acción inmediata (ej: Tomó agua, descansó 15 min, tomó paracetamol)'),
      }),
      execute: async ({ discomfortType, symptoms, possibleTriggers, actionsTaken }) => {
        const episode = await prisma.healthEpisode.create({
          data: {
            userId,
            discomfortType,
            symptoms,
            possibleTriggers,
            actionsTaken,
            status: 'ACTIVO',
          },
        });

        return {
          success: true,
          id: episode.id,
          discomfortType,
          message: `Episodio de "${discomfortType}" registrado para seguimiento de salud.`,
        };
      },
    }),
  };
}
