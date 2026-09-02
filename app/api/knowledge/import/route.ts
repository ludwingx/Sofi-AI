import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

function getMarkdownFilesRecursive(dir: string): { title: string; content: string; sourcePath: string }[] {
  let results: { title: string; content: string; sourcePath: string }[] = [];
  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of list) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      results = results.concat(getMarkdownFilesRecursive(fullPath));
    } else if (file.name.endsWith('.md')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const title = file.name.replace('.md', '');
        results.push({ title, content, sourcePath: fullPath });
      } catch (e) {
        console.error(`Error reading ${fullPath}:`, e);
      }
    }
  }
  return results;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { files: inputFiles, localPath, category = 'OBSIDIAN', tags = '#obsidian', userId: reqUserId } = body;

    let user = null;
    if (reqUserId) {
      user = await prisma.user.findUnique({ where: { id: reqUserId } });
    }
    if (!user) {
      user = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { role: 'asc' } });
    }

    if (!user) {
      return NextResponse.json({ error: 'No active user found' }, { status: 400 });
    }

    let filesToProcess: { title: string; content: string; category?: string; sourcePath?: string; tags?: string }[] = [];

    if (Array.isArray(inputFiles) && inputFiles.length > 0) {
      filesToProcess = inputFiles;
    } else if (localPath) {
      const scanned = getMarkdownFilesRecursive(localPath);
      filesToProcess = scanned.map(s => ({
        ...s,
        category,
        tags,
      }));
    } else {
      return NextResponse.json({ error: 'Debe proporcionar una lista de archivos o una ruta local válida.' }, { status: 400 });
    }

    const imported = [];

    for (const f of filesToProcess) {
      if (!f.title || !f.content) continue;

      const doc = await prisma.knowledgeDocument.upsert({
        where: {
          userId_title: { userId: user.id, title: f.title },
        },
        update: {
          content: f.content,
          category: f.category || category || 'OBSIDIAN',
          tags: f.tags || tags || '#obsidian',
          sourcePath: f.sourcePath,
        },
        create: {
          userId: user.id,
          title: f.title,
          content: f.content,
          category: f.category || category || 'OBSIDIAN',
          tags: f.tags || tags || '#obsidian',
          sourcePath: f.sourcePath,
        },
      });

      // Chunking (~500 caracteres por fragmento)
      await prisma.knowledgeChunk.deleteMany({ where: { documentId: doc.id } });
      const chunkSize = 500;
      const totalChunks = Math.ceil(f.content.length / chunkSize);

      for (let i = 0; i < totalChunks; i++) {
        const chunkText = f.content.slice(i * chunkSize, (i + 1) * chunkSize);
        await prisma.knowledgeChunk.create({
          data: {
            documentId: doc.id,
            userId: user.id,
            chunkIndex: i,
            content: chunkText,
          },
        });
      }

      imported.push({ title: doc.title, chunks: totalChunks });
    }

    return NextResponse.json({
      success: true,
      count: imported.length,
      imported,
      message: `${imported.length} documentos .md importados con éxito a PostgreSQL.`,
    });
  } catch (error) {
    console.error('Error importing knowledge files:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
