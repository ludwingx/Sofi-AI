import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export function getKnowledgeTools(userId: string) {
  return {
    searchKnowledgeBase: tool({
      description: 'Busca en las notas, proyectos, acuerdos y base de conocimiento de Obsidian de Ludwing información relevante sobre cualquier tema (OtherBrain, proyectos, ideas, personas, acuerdos, finanzas, recetas).',
      parameters: z.object({
        query: z.string().describe('Término de búsqueda, tema o palabras clave (ej: OtherBrain, deudas, roomies, acuerdos, rutinas)'),
      }),
      execute: async ({ query }) => {
        const terms = query
          .toLowerCase()
          .split(/[\s,]+/)
          .filter((t) => t.length > 2);

        // 1. Buscar en documentos
        const docs = await prisma.knowledgeDocument.findMany({
          where: {
            userId,
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { content: { contains: query, mode: 'insensitive' } },
              { tags: { contains: query, mode: 'insensitive' } },
              ...terms.map((term) => ({
                title: { contains: term, mode: 'insensitive' as const },
              })),
            ],
          },
          take: 4,
        });

        // 2. Buscar en chunks para mayor granularidad
        const chunks = await prisma.knowledgeChunk.findMany({
          where: {
            userId,
            OR: [
              { content: { contains: query, mode: 'insensitive' } },
              ...terms.map((term) => ({
                content: { contains: term, mode: 'insensitive' as const },
              })),
            ],
          },
          include: { document: true },
          take: 5,
        });

        if (docs.length === 0 && chunks.length === 0) {
          return {
            found: false,
            query,
            message: `No se encontraron notas en la base de conocimiento para "${query}".`,
          };
        }

        return {
          found: true,
          query,
          documents: docs.map((d) => ({
            title: d.title,
            category: d.category,
            snippet: d.content.slice(0, 350) + (d.content.length > 350 ? '...' : ''),
          })),
          relevantPassages: chunks.map((c) => ({
            docTitle: c.document?.title || 'Sin título',
            passage: c.content,
          })),
        };
      },
    }),

    getKnowledgeNote: tool({
      description: 'Obtiene el contenido completo de una nota o documento específico de la base de conocimiento por su título exacto o aproximado.',
      parameters: z.object({
        title: z.string().describe('Título de la nota a consultar'),
      }),
      execute: async ({ title }) => {
        const doc = await prisma.knowledgeDocument.findFirst({
          where: {
            userId,
            title: { contains: title, mode: 'insensitive' },
          },
        });

        if (!doc) {
          return {
            found: false,
            message: `No encontré ninguna nota con título similar a "${title}".`,
          };
        }

        return {
          found: true,
          title: doc.title,
          category: doc.category,
          tags: doc.tags,
          content: doc.content,
          updatedAt: doc.updatedAt,
        };
      },
    }),

    saveNoteToKnowledge: tool({
      description: 'Crea o sobrescribe una nota en la base de conocimiento de Obsidian / PostgreSQL.',
      parameters: z.object({
        title: z.string().describe('Título de la nota'),
        content: z.string().describe('Contenido completo en Markdown'),
        category: z.enum(['PROYECTO', 'FINANZAS', 'RUTINA', 'IDEAS', 'OBSIDIAN', 'GENERAL']).default('GENERAL'),
        tags: z.string().optional().describe('Tags separados por coma (ej: #ideas, #otherbrain)'),
      }),
      execute: async ({ title, content, category, tags }) => {
        const doc = await prisma.knowledgeDocument.upsert({
          where: {
            userId_title: { userId, title },
          },
          update: {
            content,
            category,
            tags,
          },
          create: {
            userId,
            title,
            content,
            category,
            tags,
          },
        });

        // Reindexar chunks
        await prisma.knowledgeChunk.deleteMany({ where: { documentId: doc.id } });
        const chunkSize = 500;
        const totalChunks = Math.ceil(content.length / chunkSize);

        for (let i = 0; i < totalChunks; i++) {
          const chunkText = content.slice(i * chunkSize, (i + 1) * chunkSize);
          await prisma.knowledgeChunk.create({
            data: {
              documentId: doc.id,
              userId,
              chunkIndex: i,
              content: chunkText,
            },
          });
        }

        return {
          success: true,
          title: doc.title,
          category: doc.category,
          chunksCreated: totalChunks,
          message: `Nota "${doc.title}" guardada exitosamente en la base de conocimiento con ${totalChunks} fragmentos indexados.`,
        };
      },
    }),

    appendToKnowledgeNote: tool({
      description: 'Añade información o un nuevo apunte al final de una nota existente sin borrar lo que ya tenía.',
      parameters: z.object({
        title: z.string().describe('Título de la nota existente a la que se le añadirá información'),
        textToAdd: z.string().describe('Texto o apunte nuevo que se agregará al final'),
      }),
      execute: async ({ title, textToAdd }) => {
        const doc = await prisma.knowledgeDocument.findFirst({
          where: {
            userId,
            title: { contains: title, mode: 'insensitive' },
          },
        });

        if (!doc) {
          // Si no existe, crearla
          const newDoc = await prisma.knowledgeDocument.create({
            data: {
              userId,
              title,
              content: textToAdd,
              category: 'GENERAL',
            },
          });
          return {
            success: true,
            title: newDoc.title,
            message: `No existía la nota previa, así que creé una nueva con título "${newDoc.title}".`,
          };
        }

        const updatedContent = `${doc.content.trim()}\n\n${textToAdd.trim()}`;
        await prisma.knowledgeDocument.update({
          where: { id: doc.id },
          data: { content: updatedContent },
        });

        // Reindexar chunks
        await prisma.knowledgeChunk.deleteMany({ where: { documentId: doc.id } });
        const chunkSize = 500;
        const totalChunks = Math.ceil(updatedContent.length / chunkSize);

        for (let i = 0; i < totalChunks; i++) {
          const chunkText = updatedContent.slice(i * chunkSize, (i + 1) * chunkSize);
          await prisma.knowledgeChunk.create({
            data: {
              documentId: doc.id,
              userId,
              chunkIndex: i,
              content: chunkText,
            },
          });
        }

        return {
          success: true,
          title: doc.title,
          message: `Información agregada correctamente al final de "${doc.title}".`,
        };
      },
    }),
  };
}
