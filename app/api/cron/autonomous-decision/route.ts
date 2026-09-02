import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTelegramMessage } from '@/lib/telegram';
import { generateText } from 'ai';
import { models } from '@/lib/ai';
import { SOFI_SYSTEM_PROMPT } from '@/lib/prompts';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new NextResponse('Unauthorized Cron Call', { status: 401 });
    }

    const activeUsers = await prisma.user.findMany({
      where: { isActive: true },
      include: {
        moodStates: { orderBy: { lastUpdated: 'desc' }, take: 1 },
        chatMessages: { orderBy: { createdAt: 'desc' }, take: 3 },
        pantryItems: { where: { status: 'POR_AGOTARSE' } },
        financialTransactions: {
          where: {
            date: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        },
      },
    });

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const currentDayName = days[now.getDay()];

    const decisions = [];

    for (const user of activeUsers) {
      const lastMessage = user.chatMessages[0];
      const hoursSinceLastMessage = lastMessage
        ? ((now.getTime() - new Date(lastMessage.createdAt).getTime()) / (1000 * 60 * 60)).toFixed(1)
        : '12';

      const lowStockItems = user.pantryItems.map(p => `${p.name} (quedan ${p.currentStock} ${p.unit})`);
      const spentToday = user.financialTransactions.reduce((acc, t) => acc + t.amountBs, 0);
      const mood = user.moodStates[0] || { patience: 100, affection: 90, concern: 20 };

      const evaluationPrompt = `Eres Sofi, con tu personalidad camba cruceña (Santa Cruz de la Sierra).
Evalúa autónomamente si tiene sentido escribirle proactivamente a ${user.name} en este instante.

## Estado Actual en Base de Datos:
- Día: ${currentDayName} (${currentHour}:${currentMinutes.toString().padStart(2, '0')})
- Horas sin hablar con ${user.name}: ${hoursSinceLastMessage} horas
- Último mensaje recibido: "${lastMessage?.content || '(Ninguno reciente)'}"
- Insumos por agotarse: ${lowStockItems.length > 0 ? lowStockItems.join(', ') : 'Todo en orden'}
- Gastado hoy: ${spentToday} Bs
- Tu estado anímico: Paciencia ${mood.patience}%, Afecto ${mood.affection}%

## Reglas de Decisión:
1. No hagas spam innecesario. Si pasaron pocas horas y no hay motivos relevantes (despensa, comida, Bloque de Poder 19:30 o cierre del día), decide NO escribir.
2. Si decides escribir (YES), genera un mensaje corto, natural, con tono cruceño cálido (Santa Cruz de la Sierra) y genuinamente oportuno. Usa "bb" con mucho cuidado o simplemente trátalo de tú/che.
3. Devuelve OBLIGATORIAMENTE un JSON con esta estructura exacta:
{"shouldSendMessage": true|false, "reason": "explicación breve", "messageText": "texto del mensaje si es true"}`;

      const { text } = await generateText({
        model: models.primary,
        system: SOFI_SYSTEM_PROMPT,
        prompt: evaluationPrompt,
      });

      try {
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        if (parsed.shouldSendMessage && parsed.messageText) {
          await sendTelegramMessage(user.telegramId, parsed.messageText);

          await prisma.chatMessage.create({
            data: {
              userId: user.id,
              channel: 'TELEGRAM',
              role: 'assistant',
              content: parsed.messageText,
            },
          });
        }

        decisions.push({
          user: user.name,
          decision: parsed.shouldSendMessage ? 'SENT' : 'SKIPPED',
          reason: parsed.reason,
          message: parsed.messageText,
        });
      } catch (err) {
        decisions.push({ user: user.name, error: 'Failed to parse decision JSON', raw: text });
      }
    }

    return NextResponse.json({ ok: true, decisions });
  } catch (error) {
    console.error('Error in autonomous decision cron:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
