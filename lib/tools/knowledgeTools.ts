import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export function getKnowledgeTools(userId: string) {
  return {
    searchKnowledgeBase: tool({
      description: 'Busca en las notas, proyectos, acuerdos y base de conocimiento de Obsidian de Ludwing información relevante sobre cualquier tema.',
      parameters: z.object({
        query: z.string().describe('Término de búsqueda, tema o palabras clave (ej: deudas, roomies, OtherBrain, recetas, rutinas)'),
      }),
      execute: async ({ query }) => {
        const terms = query.toLowerCase().split(' ').filter(t => t.length > 2);

        // Buscar en documentos
        const docs = await prisma.knowledgeDocument.findMany({
          where: {
            userId,
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { content: { contains: query, mode: 'insensitive' } },
              { tags: { contains: query, mode: 'insensitive' } },
            ],
          },
          take: 3,
        });

        // Buscar en chunks
        const chunks = await prisma.knowledgeChunk.findMany({
          where: {
            userId,
            content: { contains: query, mode: 'insensitive' },
          },
          include: { document: true },
          take: 4,
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
          documents: docs.map(d => ({
            title: d.title,
            category: d.category,
            snippet: d.content.slice(0, 300) + '...',
          })),
          relevantPassages: chunks.map(c => ({
            docTitle: c.document.title,
            passage: c.content,
          })),
        };
      },
    }),

    saveNoteToKnowledge: tool({
      description: 'Guarda una nota o documento nuevo en la base de conocimiento de Obsidian / PostgreSQL.',
      parameters: z.object({
        title: z.string().describe('Título de la nota'),
        content: z.string().describe('Contenido completo en Markdown'),
        category: z.enum(['PROYECTO', 'FINANZAS', 'RUTINA', 'IDEAS', 'OBSIDIAN', 'GENERAL']).default('GENERAL'),
        tags: z.string().optional().describe('Tags separados por coma'),
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

        // Generar chunks de ~500 caracteres
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
          message: `Documento "${doc.title}" guardado en la base de conocimiento con ${totalChunks} fragmentos indexados.`,
        };
      },
    }),
  };
}
