import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { files, userId: reqUserId } = body; // files: Array<{ title: string, content: string, category?: string, sourcePath?: string, tags?: string }>

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'Array of files is required' }, { status: 400 });
    }

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

    const imported = [];

    for (const f of files) {
      if (!f.title || !f.content) continue;

      const doc = await prisma.knowledgeDocument.upsert({
        where: {
          userId_title: { userId: user.id, title: f.title },
        },
        update: {
          content: f.content,
          category: f.category || 'OBSIDIAN',
          tags: f.tags || '#obsidian',
          sourcePath: f.sourcePath,
        },
        create: {
          userId: user.id,
          title: f.title,
          content: f.content,
          category: f.category || 'OBSIDIAN',
          tags: f.tags || '#obsidian',
          sourcePath: f.sourcePath,
        },
      });

      // Chunking
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

    return NextResponse.json({ success: true, count: imported.length, imported });
  } catch (error) {
    console.error('Error importing knowledge files:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
