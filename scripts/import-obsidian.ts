import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function importObsidianNotes() {
  console.log('🧠 Iniciando importación de notas de Obsidian Vault a PostgreSQL...');

  const user = await prisma.user.findFirst({
    where: { isActive: true },
    orderBy: { role: 'asc' },
  });

  if (!user) {
    console.error('❌ No se encontró ningún usuario activo en la base de datos.');
    return;
  }

  const obsidianDir = path.resolve('d:/Users/ludwi/Documents/workspace/my-brain-obsidian/02 - Projects/21 - Sofi');

  if (!fs.existsSync(obsidianDir)) {
    console.warn(`⚠️ La ruta ${obsidianDir} no existe localmente.`);
    return;
  }

  const files = fs.readdirSync(obsidianDir).filter(f => f.endsWith('.md'));
  console.log(`📂 Encontrados ${files.length} archivos .md en ${obsidianDir}`);

  for (const filename of files) {
    const fullPath = path.join(obsidianDir, filename);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const title = filename.replace('.md', '');

    console.log(`📄 Ingestando: ${title}...`);

    const doc = await prisma.knowledgeDocument.upsert({
      where: {
        userId_title: {
          userId: user.id,
          title,
        },
      },
      update: {
        content,
        category: 'OBSIDIAN_SOFI',
        tags: '#sofi, #obsidian, #arquitectura, #segundo_cerebro',
        sourcePath: fullPath,
      },
      create: {
        userId: user.id,
        title,
        content,
        category: 'OBSIDIAN_SOFI',
        tags: '#sofi, #obsidian, #arquitectura, #segundo_cerebro',
        sourcePath: fullPath,
      },
    });

    // Chunking
    await prisma.knowledgeChunk.deleteMany({ where: { documentId: doc.id } });
    const chunkSize = 500;
    const totalChunks = Math.ceil(content.length / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const chunkText = content.slice(i * chunkSize, (i + 1) * chunkSize);
      await prisma.knowledgeChunk.create({
        data: {
          documentId: doc.id,
          userId: user.id,
          chunkIndex: i,
          content: chunkText,
        },
      });
    }

    console.log(`   ✅ "${title}" guardado (${totalChunks} chunks indexados)`);
  }

  console.log('🎉 Ingesta de Obsidian a PostgreSQL completada con éxito.');
}

importObsidianNotes()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
