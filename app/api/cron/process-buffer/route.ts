import { NextRequest, NextResponse } from 'next/server';
import { processAllPendingBuffers } from '@/lib/bufferProcessor';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const { searchParams } = new URL(req.url);
    const isTest = searchParams.get('test') === 'true';
    const cronSecret = process.env.CRON_SECRET;

    if (!isTest && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      const secretParam = searchParams.get('secret');
      if (secretParam !== cronSecret) {
        return new NextResponse('Unauthorized Cron Call', { status: 401 });
      }
    }

    const results = await processAllPendingBuffers();
    const processedCount = results.filter((r) => r.processed).length;

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      processedCount,
      details: results,
    });
  } catch (error) {
    console.error('Error in process-buffer cron:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
