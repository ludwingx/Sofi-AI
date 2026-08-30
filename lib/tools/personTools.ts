import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export function getPersonTools(userId: string) {
  return {
    findPerson: tool({
      description: 'Busca a una persona en el directorio (roomies, socios, amigos, clientes) para obtener contexto previo, notas y acuerdos.',
      parameters: z.object({
        name: z.string().describe('Nombre o apodo de la persona a buscar (ej: Carlos, Maycol, Ramón, Rocío, Molly)'),
      }),
      execute: async ({ name }) => {
        const person = await prisma.person.findFirst({
          where: { userId, name: { contains: name } },
          include: {
            notes: { orderBy: { createdAt: 'desc' }, take: 5 },
            agreements: { where: { status: 'ACTIVO' } },
          },
        });

        if (!person) {
          return { found: false, message: `No se encontró a nadie llamado "${name}" en el directorio.` };
        }

        return {
          found: true,
          id: person.id,
          name: person.name,
          role: person.role,
          recentNotes: person.notes.map((n) => n.content),
          activeAgreements: person.agreements.map((a) => a.title),
        };
      },
    }),

    saveNewContact: tool({
      description: 'Crea o actualiza a una persona en el directorio de contactos con su rol y notas de acuerdos o contexto.',
      parameters: z.object({
        name: z.string().describe('Nombre de la persona'),
        role: z.string().optional().describe('Rol o vínculo (ej: Socio, Roomie, Cliente, Amigo)'),
        note: z.string().describe('Detalle, acuerdo o contexto de la persona'),
      }),
      execute: async ({ name, role, note }) => {
        let person = await prisma.person.findFirst({
          where: { userId, name: { contains: name } },
        });

        if (person) {
          person = await prisma.person.update({
            where: { id: person.id },
            data: {
              role: role || person.role,
              notes: { create: { content: note } },
            },
          });
          return { success: true, action: 'UPDATED', person: person.name, message: `Contacto ${person.name} actualizado con nueva nota.` };
        } else {
          person = await prisma.person.create({
            data: {
              userId,
              name,
              role: role || 'Contacto',
              notes: { create: { content: note } },
            },
          });
          return { success: true, action: 'CREATED', person: person.name, message: `Nuevo contacto ${person.name} registrado.` };
        }
      },
    }),

    saveBirthday: tool({
      description: 'Registra la fecha de cumpleaños de una persona para alertas anticipadas.',
      parameters: z.object({
        personName: z.string().describe('Nombre de la persona'),
        birthDateIso: z.string().describe('Fecha en formato YYYY-MM-DD o MM-DD'),
        relationship: z.string().optional().describe('Relación o parentesco'),
        advanceDays: z.number().default(3).describe('Días de aviso previo'),
      }),
      execute: async ({ personName, birthDateIso, relationship, advanceDays }) => {
        const birthDate = new Date(birthDateIso);
        const bday = await prisma.birthday.create({
          data: {
            userId,
            personName,
            birthDate,
            relationship,
            advanceDays,
          },
        });

        return {
          success: true,
          id: bday.id,
          personName,
          birthDate: birthDate.toISOString().split('T')[0],
          message: `Cumpleaños de ${personName} guardado para el ${birthDate.toISOString().split('T')[0]}.`,
        };
      },
    }),
  };
}
