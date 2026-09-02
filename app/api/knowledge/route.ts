import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    let user = null;
    if (userId) {
      user = await prisma.user.findUnique({ where: { id: userId } });
    }
    if (!user) {
      user = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { role: 'asc' } });
    }

    if (!user) {
      return NextResponse.json({ documents: [] });
    }

    const documents = await prisma.knowledgeDocument.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Error fetching knowledge docs:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, content, category = 'GENERAL', tags, sourcePath, userId: reqUserId } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
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

    const doc = await prisma.knowledgeDocument.upsert({
      where: {
        userId_title: { userId: user.id, title },
      },
      update: {
        content,
        category,
        tags,
        sourcePath,
      },
      create: {
        userId: user.id,
        title,
        content,
        category,
        tags,
        sourcePath,
      },
    });

    // Re-generar chunks
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

    return NextResponse.json({ document: doc, chunksCreated: totalChunks });
  } catch (error) {
    console.error('Error saving knowledge doc:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const clearAll = searchParams.get('clearAll');

    if (clearAll === 'true') {
      const user = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { role: 'asc' } });
      if (user) {
        await prisma.knowledgeDocument.deleteMany({ where: { userId: user.id } });
      }
      return NextResponse.json({ success: true, message: 'Todas las notas han sido eliminadas.' });
    }

    if (!id) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    await prisma.knowledgeDocument.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting knowledge doc:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
