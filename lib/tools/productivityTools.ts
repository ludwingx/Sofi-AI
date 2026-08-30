import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export function getProductivityTools(userId: string) {
  return {
    scheduleReminder: tool({
      description: 'Programa un recordatorio para una fecha y hora exacta.',
      parameters: z.object({
        message: z.string().describe('Texto del recordatorio'),
        dueDateTimeIso: z.string().describe('Fecha y hora en formato ISO (ej: 2026-08-29T19:30:00)'),
      }),
      execute: async ({ message, dueDateTimeIso }) => {
        const reminder = await prisma.reminder.create({
          data: {
            userId,
            message,
            dueDateTime: new Date(dueDateTimeIso),
            status: 'PENDIENTE',
          },
        });

        return {
          success: true,
          id: reminder.id,
          message: reminder.message,
          dueAt: reminder.dueDateTime.toISOString(),
        };
      },
    }),

    createCalendarEvent: tool({
      description: 'Registra una cita, evento o compromiso puntual en el calendario.',
      parameters: z.object({
        title: z.string().describe('Título del evento'),
        dateTimeIso: z.string().describe('Fecha y hora ISO'),
        location: z.string().optional(),
      }),
      execute: async ({ title, dateTimeIso, location }) => {
        const event = await prisma.calendarEvent.create({
          data: {
            userId,
            title,
            dateTime: new Date(dateTimeIso),
            location,
          },
        });

        return {
          success: true,
          id: event.id,
          title: event.title,
          dateTime: event.dateTime.toISOString(),
        };
      },
    }),

    logDeepWorkSession: tool({
      description: 'Registra el avance y horas dedicadas en el Bloque de Poder (19:30 - 21:45) o sesión de trabajo profundo.',
      parameters: z.object({
        project: z.string().describe('Proyecto trabajado (ej: Sofi App, OtherBrain, BrandBook AI)'),
        hoursLogged: z.number().describe('Horas trabajadas (ej: 2.25)'),
        deliverables: z.string().describe('Entregables concretos o avance logrado'),
      }),
      execute: async ({ project, hoursLogged, deliverables }) => {
        const log = await prisma.deepWorkLog.create({
          data: {
            userId,
            project,
            hoursLogged,
            deliverables,
          },
        });

        // Crear log de actividad
        await prisma.activityLog.create({
          data: {
            userId,
            type: 'BLOQUE_TRABAJO',
            description: `Deep Work en "${project}": ${hoursLogged}h. Logros: ${deliverables}`,
          },
        });

        return {
          success: true,
          id: log.id,
          project,
          hoursLogged,
          deliverables,
          message: `Sesión de Deep Work de ${hoursLogged}h en "${project}" guardada.`,
        };
      },
    }),

    saveIdea: tool({
      description: 'Guarda una idea, concepto técnico o proyecto futuro en el Sandbox de ideas.',
      parameters: z.object({
        title: z.string().describe('Título breve de la idea'),
        description: z.string().describe('Explicación o notas clave'),
        category: z.enum(['TECH', 'NEGOCIO', 'PERSONAL', 'SOFI', 'GENERAL']).default('GENERAL'),
        tags: z.string().optional().describe('Tags separados por coma'),
      }),
      execute: async ({ title, description, category, tags }) => {
        const idea = await prisma.idea.create({
          data: {
            userId,
            title,
            description,
            category,
            tags,
            status: 'INBOX',
          },
        });

        return {
          success: true,
          id: idea.id,
          title: idea.title,
          category: idea.category,
          message: `Idea "${title}" guardada en el Sandbox.`,
        };
      },
    }),

    listIdeas: tool({
      description: 'Consulta las ideas registradas en el Sandbox por categoría o estado.',
      parameters: z.object({
        category: z.string().optional(),
      }),
      execute: async ({ category }) => {
        const whereClause: Record<string, unknown> = { userId, status: { not: 'ARCHIVADA' } };
        if (category) whereClause.category = category;

        const ideas = await prisma.idea.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          take: 10,
        });

        return {
          count: ideas.length,
          ideas: ideas.map((i) => ({ id: i.id, title: i.title, category: i.category, tags: i.tags })),
        };
      },
    }),

    getCurrentScheduleContext: tool({
      description: 'Obtiene el bloque de rutina actual y horario sugerido para Ludwing en función de la hora.',
      parameters: z.object({}),
      execute: async () => {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const timeDecimal = hours + minutes / 60;

        let currentBlock = 'Tiempo Libre / Descanso';
        let focus = 'Descanso o actividades personales';

        if (timeDecimal >= 7.0 && timeDecimal < 8.5) {
          currentBlock = 'Despertar, Desayuno & Preparación';
          focus = 'Desayuno nutritivo, mate, planificación rápida';
        } else if (timeDecimal >= 8.5 && timeDecimal < 13.0) {
          currentBlock = 'Laboral 1 (OtherBrain)';
          focus = 'Desarrollo de software y tareas prioritarias de agencia';
        } else if (timeDecimal >= 13.0 && timeDecimal < 14.5) {
          currentBlock = 'Almuerzo & Pausa';
          focus = 'Cocinar / comer en casa, desconexión mental';
        } else if (timeDecimal >= 14.5 && timeDecimal < 18.5) {
          currentBlock = 'Laboral 2 (OtherBrain / Operativo)';
          focus = 'Cierre de tareas de OtherBrain, bots, soporte';
        } else if (timeDecimal >= 18.5 && timeDecimal < 19.5) {
          currentBlock = 'Transición & Cena Ligera';
          focus = 'Despejarse, comer algo ligero antes del bloque nocturno';
        } else if (timeDecimal >= 19.5 && timeDecimal < 21.75) {
          currentBlock = '🔥 Bloque de Poder (Deep Work Personal)';
          focus = 'Sofi AI, proyectos propios de alto impacto, cero distracciones';
        } else if (timeDecimal >= 21.75 && timeDecimal < 23.5) {
          currentBlock = 'Cierre del Día & Desconexión';
          focus = 'Bitácora, curiosidad tecnológica, charla relajada';
        }

        return {
          currentTime: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
          currentBlock,
          focus,
        };
      },
    }),

    logDailyThought: tool({
      description: 'Guarda reflexiones diarias, nivel de energía, estado de ánimo y calcula el score de disciplina diaria (DDI).',
      parameters: z.object({
        reflection: z.string().describe('Pensamiento o reflexión del día'),
        moodScore: z.number().min(1).max(10).describe('Puntaje de ánimo del 1 al 10'),
        energyScore: z.number().min(1).max(10).describe('Puntaje de energía del 1 al 10'),
        deepWorkHours: z.number().default(0),
        spentTodayBs: z.number().default(0),
      }),
      execute: async ({ reflection, moodScore, energyScore, deepWorkHours, spentTodayBs }) => {
        // Cálculo del DDI (0 - 100)
        let ddi = 50;
        if (deepWorkHours >= 2) ddi += 25;
        if (spentTodayBs <= 35) ddi += 15;
        if (moodScore >= 7) ddi += 10;
        ddi = Math.min(100, Math.max(0, ddi));

        const log = await prisma.dailyLog.create({
          data: {
            userId,
            reflection,
            moodScore,
            energyScore,
            deepWorkHours,
            spentTodayBs,
            ddiScore: ddi,
          },
        });

        return {
          success: true,
          id: log.id,
          ddiScore: ddi,
          message: `Registro diario guardado. Índice de Disciplina Diaria (DDI): ${ddi}/100.`,
        };
      },
    }),
  };
}
