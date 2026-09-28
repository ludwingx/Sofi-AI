import { redis } from '@/lib/redis';
import { prisma } from '@/lib/prisma';

// Tiempo de silencio para considerar que el usuario terminó de escribir una ráfaga (en segundos)
export const DEBOUNCE_SILENCE_SECONDS = 15;

export interface BufferedMessageItem {
  id: string;
  userId: string;
  chatId: number;
  text: string;
  createdAt: number;
}

/**
 * Agrega un mensaje entrante al buffer de Redis del usuario y actualiza el timestamp de actividad.
 */
export async function pushMessageToRedisBuffer(
  userId: string,
  chatId: number,
  messageId: string,
  text: string
): Promise<number> {
  if (!redis) {
    return 1;
  }

  const listKey = `sofi:buffer:${userId}`;
  const timeKey = `sofi:last_msg_time:${userId}`;
  const now = Date.now();

  const item: BufferedMessageItem = {
    id: messageId,
    userId,
    chatId,
    text,
    createdAt: now,
  };

  // Guardar en Redis y reiniciar expiración de seguridad
  await redis.rpush(listKey, JSON.stringify(item));
  await redis.set(timeKey, now.toString(), 'EX', 3600); // 1 hora de TTL de seguridad
  await redis.expire(listKey, 3600);

  const length = await redis.llen(listKey);
  return length;
}

/**
 * Intenta adquirir el lock para procesar la ráfaga de mensajes acumulados del usuario.
 * Solo lo otorga si transcurrió el tiempo de silencio (DEBOUNCE_SILENCE_SECONDS)
 * desde el último mensaje ingresado.
 */
export async function tryAcquireBufferProcessingLock(
  userId: string,
  silenceSeconds: number = DEBOUNCE_SILENCE_SECONDS
): Promise<boolean> {
  if (!redis) {
    return true;
  }

  const timeKey = `sofi:last_msg_time:${userId}`;
  const lastTimeStr = await redis.get(timeKey);

  if (!lastTimeStr) {
    return true;
  }

  const lastTime = parseInt(lastTimeStr, 10);
  const elapsed = (Date.now() - lastTime) / 1000;

  // Si aún no pasaron los segundos de silencio, no procesar aún
  if (elapsed < silenceSeconds) {
    return false;
  }

  const lockKey = `sofi:lock:processing:${userId}`;
  // Lock atómico por 45 segundos para que solo 1 worker/webhook procese la IA
  const acquired = await redis.set(lockKey, 'locked', 'EX', 45, 'NX');
  return acquired === 'OK';
}

/**
 * Libera el lock de procesamiento y vacía el buffer de Redis para el usuario.
 */
export async function clearRedisBufferAndLock(userId: string) {
  if (!redis) return;
  const listKey = `sofi:buffer:${userId}`;
  const timeKey = `sofi:last_msg_time:${userId}`;
  const lockKey = `sofi:lock:processing:${userId}`;

  await redis.del(listKey);
  await redis.del(timeKey);
  await redis.del(lockKey);
}
