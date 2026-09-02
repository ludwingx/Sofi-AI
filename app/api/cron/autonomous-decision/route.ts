import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTelegramMessage } from '@/lib/telegram';
import { generateText } from 'ai';
import { models } from '@/lib/ai';
import { SOFI_SYSTEM_PROMPT } from '@/lib/prompts';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const { searchParams } = new URL(req.url);
    const isTest = searchParams.get('test') === 'true';
    const forceUserId = searchParams.get('userId');
    const cronSecret = process.env.CRON_SECRET;

    // Permitir llamadas autorizadas por Vercel Cron o tests autenticados
    if (!isTest && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      const secretParam = searchParams.get('secret');
      if (secretParam !== cronSecret) {
        return new NextResponse('Unauthorized Cron Call', { status: 401 });
      }
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const activeUsers = await prisma.user.findMany({
      where: forceUserId ? { id: forceUserId, isActive: true } : { isActive: true },
      include: {
        moodStates: { orderBy: { lastUpdated: 'desc' }, take: 1 },
        chatMessages: { orderBy: { createdAt: 'desc' }, take: 6 },
        pantryItems: { where: { status: { in: ['POR_AGOTARSE', 'AGOTADO'] } } },
        healthEpisodes: { where: { status: 'ACTIVO' } },
        deepWorkLogs: { where: { createdAt: { gte: todayStart } } },
        reminders: { where: { status: 'PENDIENTE', dueDateTime: { lte: new Date(Date.now() + 2 * 60 * 60 * 1000) } } },
        financialTransactions: {
          where: {
            date: { gte: todayStart },
          },
        },
      },
    });

    const now = new Date();
    // Hora local Santa Cruz de la Sierra (UTC-4)
    const boliviaTimeFormatter = new Intl.DateTimeFormat('es-BO', {
      timeZone: 'America/La_Paz',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'long',
    });
    const formattedBoliviaTime = boliviaTimeFormatter.format(now);

    const decisions = [];

    for (const user of activeUsers) {
      const recentMsgs = [...user.chatMessages].reverse();
      const lastMessage = user.chatMessages[0];
      const hoursSinceLastMessage = lastMessage
        ? ((now.getTime() - new Date(lastMessage.createdAt).getTime()) / (1000 * 60 * 60)).toFixed(1)
        : '24';

      const lowStockItems = user.pantryItems.map(p => `${p.name} (${p.status}: ${p.currentStock} ${p.unit})`);
      const spentToday = user.financialTransactions.reduce((acc, t) => acc + t.amountBs, 0);
      const deepWorkHoursToday = user.deepWorkLogs.reduce((acc, dw) => acc + dw.hoursLogged, 0);
      const activeHealthIssues = user.healthEpisodes.map(h => `${h.discomfortType}: ${h.symptoms}`);
      const upcomingReminders = user.reminders.map(r => r.message);
      const mood = user.moodStates[0] || { patience: 100, affection: 90, concern: 20 };

      const chatHistorySnippet = recentMsgs
        .map(m => `[${m.role === 'user' ? user.name : 'Sofi'}]: "${m.content}"`)
        .join('\n');

      const evaluationPrompt = `Eres Sofi, compañera y copiloto de vida personal de ${user.name} en Santa Cruz de la Sierra, Bolivia.
Tu tarea es decidir de manera AUTÓNOMA e INTELIGENTE si en este momento exacto es oportuno, valioso y natural enviarle un mensaje proactivo a ${user.name} por Telegram, o si lo mejor es guardar silencio.

## 🕒 Momento Actual (Santa Cruz, Bolivia):
- Hora y Día: ${formattedBoliviaTime}
- Tiempo sin hablar: ${hoursSinceLastMessage} horas
- ¿Quién envió el último mensaje?: ${lastMessage ? (lastMessage.role === 'user' ? user.name : 'Sofi') : 'Nadie'}

## 💬 Últimos Mensajes del Chat:
${chatHistorySnippet || '(Sin mensajes recientes)'}

## 📊 Estado Actual de su Vida en Base de Datos:
- Horas de Deep Work registradas hoy: ${deepWorkHoursToday} hrs
- Gastos registrados hoy: ${spentToday} Bs
- Despensa crítica / agotada: ${lowStockItems.length > 0 ? lowStockItems.join(', ') : 'Todo abastecido'}
- Molestias de salud activas: ${activeHealthIssues.length > 0 ? activeHealthIssues.join('; ') : 'Ninguna'}
- Recordatorios próximos (próximas 2 hrs): ${upcomingReminders.length > 0 ? upcomingReminders.join(', ') : 'Ninguno'}
- Tu estado anímico: Paciencia ${mood.patience}%, Afecto ${mood.affection}%

## 🧠 Heurísticas de Decisión Autónoma:
1. **HORAS DE DESCANSO (23:00 a 07:30):** NUNCA escribir a menos que haya una alarma crítica. Si es de noche/madrugada, decide FALSE.
2. **ANTI-SPAM:** Si hablaron hace menos de 2 horas y no hay un evento relevante, decide FALSE.
3. **MOMENTOS CLAVE PARA INICIAR CONVERSACIÓN (DECIDIR TRUE):**
   - **Almuerzo (12:45 - 14:15):** Si no han hablado desde la mañana, preguntar si ya comió o qué tal la jornada.
   - **Pre-Bloque de Poder (19:15 - 19:35):** Si no ha registrado Deep Work y es hora de su bloque de 19:30, animarlo a arrancar con enfoque.
   - **Cierre de jornada (21:30 - 22:30):** Preguntar cómo le fue con el código/proyectos, recordar desconectar y descansar.
   - **Salud/Cuidado:** Si tenía dolor de cabeza o malestar activo registrado hace horas, hacer un breve follow-up de cariño.
   - **Despensa:** Si se agotó algo esencial (ej: yerba mate, huevos) y está cerca de la tarde/salida, avisarle cortito para que compre.
4. **ESTILO DE MENSAJE SI DECIDES TRUE:**
   - **1 a 2 líneas cortas (máximo 15 a 30 palabras).**
   - Cero sermones, cero menús de opciones. 100% natural, chispa cruceña cálida y fresca.

## 📤 FORMATO DE RESPUESTA OBLIGATORIO:
Devuelve ÚNICAMENTE un JSON válido sin markdown ni comillas extras:
{
  "shouldSendMessage": true,
  "reason": "Explicación breve de por qué se decidió enviar o callar",
  "urgency": "LOW" | "MEDIUM" | "HIGH",
  "messageText": "Texto exacto del mensaje corto que le llegará a Telegram (solo si shouldSendMessage es true)"
}`;

      const { text } = await generateText({
        model: models.primary,
        system: SOFI_SYSTEM_PROMPT,
        prompt: evaluationPrompt,
      });

      try {
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        if (parsed.shouldSendMessage && parsed.messageText && user.telegramId) {
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
          decision: parsed.shouldSendMessage ? 'SENT' : 'SILENT',
          reason: parsed.reason,
          urgency: parsed.urgency,
          message: parsed.messageText || null,
          localTime: formattedBoliviaTime,
        });
      } catch (err) {
        decisions.push({
          user: user.name,
          error: 'Failed to parse decision JSON',
          raw: text,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      boliviaTime: formattedBoliviaTime,
      decisions,
    });
  } catch (error) {
    console.error('Error in autonomous decision cron:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

