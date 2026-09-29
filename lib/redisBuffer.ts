import { redis } from '@/lib/redis';

// Tiempo de silencio para considerar que el usuario terminó de escribir una ráfaga (en segundos)
export const DEBOUNCE_SILENCE_SECONDS = 5;
// Tiempo máximo de espera acumulada para evitar bloqueos por ráfagas interminables
export const MAX_BUFFER_WAIT_SECONDS = 15;

export interface BufferedMessageItem {
  id: string;
  userId: string;
  chatId: number;
  text: string;
  createdAt: number;
}

// Fallback en memoria en caso de que Redis no esté disponible temporalmente
const memoryBuffers = new Map<string, BufferedMessageItem[]>();
const memoryLastTimes = new Map<string, number>();
const memoryWaiters = new Set<string>();

/**
 * Agrega un mensaje entrante al buffer de Redis del usuario y actualiza el timestamp de actividad.
 * NO envía typing en este paso.
 */
export async function pushMessageToRedisBuffer(
  userId: string,
  chatId: number,
  messageId: string,
  text: string
): Promise<number> {
  const now = Date.now();
  const item: BufferedMessageItem = {
    id: messageId,
    userId,
    chatId,
    text,
    createdAt: now,
  };

  // Mantener fallback en memoria
  const currentList = memoryBuffers.get(userId) || [];
  currentList.push(item);
  memoryBuffers.set(userId, currentList);
  memoryLastTimes.set(userId, now);

  if (!redis) {
    return currentList.length;
  }

  try {
    const listKey = `sofi:buffer:${userId}`;
    const timeKey = `sofi:last_msg_time:${userId}`;
    const chatKey = `sofi:chat_id:${userId}`;

    await redis.rpush(listKey, JSON.stringify(item));
    await redis.set(timeKey, now.toString(), 'EX', 3600);
    await redis.set(chatKey, chatId.toString(), 'EX', 3600);
    await redis.expire(listKey, 3600);

    const length = await redis.llen(listKey);
    return length;
  } catch (err) {
    console.warn('⚠️ [Redis pushMessageToRedisBuffer error, fallback a memoria]:', err);
    return currentList.length;
  }
}

/**
 * Intenta adquirir el rol de Esperador (Waiter Lock) para este usuario.
 * Solo la primera petición de una ráfaga lo adquiere y sostiene el bucle de espera.
 * Las peticiones posteriores devuelven false y delegan su procesamiento al bucle activo.
 */
export async function tryAcquireWaiterLock(userId: string): Promise<boolean> {
  const lockKey = `sofi:waiter:${userId}`;

  if (memoryWaiters.has(userId)) {
    return false;
  }

  if (!redis) {
    memoryWaiters.add(userId);
    return true;
  }

  try {
    const acquired = await redis.set(lockKey, 'waiting', 'EX', 30, 'NX');
    if (acquired === 'OK') {
      memoryWaiters.add(userId);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('⚠️ [Redis tryAcquireWaiterLock error, usando memoria]:', err);
    if (!memoryWaiters.has(userId)) {
      memoryWaiters.add(userId);
      return true;
    }
    return false;
  }
}

/**
 * Bucle de espera de silencio:
 * Itera cada 1s verificando si han transcurrido 'silenceSeconds' desde el ÚLTIMO mensaje recibido.
 * Si el usuario envía mensajes adicionales durante la espera, el tiempo de silencio se resetea automáticamente.
 * Rompe el bucle de espera en cuanto se detecta silencio o se llega al tiempo máximo.
 * NO envía ningún evento de "typing" durante la espera.
 */
export async function waitForSilenceAndBreak(
  userId: string,
  silenceSeconds: number = DEBOUNCE_SILENCE_SECONDS,
  maxWaitSeconds: number = MAX_BUFFER_WAIT_SECONDS
): Promise<{ broken: boolean; totalWaitMs: number }> {
  const loopStart = Date.now();
  const silenceMs = silenceSeconds * 1000;
  const maxWaitMs = maxWaitSeconds * 1000;
  const timeKey = `sofi:last_msg_time:${userId}`;

  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    let lastTime = memoryLastTimes.get(userId) || loopStart;
    if (redis) {
      try {
        const lastTimeStr = await redis.get(timeKey);
        if (lastTimeStr) {
          lastTime = parseInt(lastTimeStr, 10);
        }
      } catch {
        // Fallback a timestamp local
      }
    }

    const elapsedSilence = Date.now() - lastTime;
    const totalElapsed = Date.now() - loopStart;

    // Se rompe el bucle de espera
    if (elapsedSilence >= silenceMs || totalElapsed >= maxWaitMs) {
      return { broken: true, totalWaitMs: totalElapsed };
    }
  }
}

/**
 * Extrae y limpia atómicamente todos los mensajes acumulados en el buffer de Redis para el usuario.
 */
export async function getAndClearRedisBuffer(userId: string): Promise<BufferedMessageItem[]> {
  const listKey = `sofi:buffer:${userId}`;
  const timeKey = `sofi:last_msg_time:${userId}`;
  const waiterKey = `sofi:waiter:${userId}`;
  const chatKey = `sofi:chat_id:${userId}`;

  memoryWaiters.delete(userId);
  memoryLastTimes.delete(userId);
  const memItems = memoryBuffers.get(userId) || [];
  memoryBuffers.delete(userId);

  if (!redis) {
    return memItems;
  }

  try {
    const rawItems = await redis.lrange(listKey, 0, -1);
    await redis.del(listKey, timeKey, waiterKey, chatKey);

    if (rawItems && rawItems.length > 0) {
      return rawItems.map((item) => JSON.parse(item) as BufferedMessageItem);
    }
    return memItems;
  } catch (err) {
    console.warn('⚠️ [Redis getAndClearRedisBuffer error, usando memoria]:', err);
    return memItems;
  }
}

/**
 * Intenta adquirir el lock atómico final de procesamiento.
 */
export async function tryAcquireBufferProcessingLock(
  userId: string,
  ttlSeconds: number = 45
): Promise<boolean> {
  const lockKey = `sofi:lock:processing:${userId}`;
  if (!redis) {
    return true;
  }

  try {
    const acquired = await redis.set(lockKey, 'locked', 'EX', ttlSeconds, 'NX');
    return acquired === 'OK';
  } catch {
    return true;
  }
}

/**
 * Limpieza de seguridad total para el usuario en Redis y memoria.
 */
export async function clearRedisBufferAndLock(userId: string) {
  memoryWaiters.delete(userId);
  memoryBuffers.delete(userId);
  memoryLastTimes.delete(userId);

  if (!redis) return;
  try {
    const listKey = `sofi:buffer:${userId}`;
    const timeKey = `sofi:last_msg_time:${userId}`;
    const waiterKey = `sofi:waiter:${userId}`;
    const lockKey = `sofi:lock:processing:${userId}`;
    const chatKey = `sofi:chat_id:${userId}`;
    await redis.del(listKey, timeKey, waiterKey, lockKey, chatKey);
  } catch (err) {
    console.warn('⚠️ [Redis clearRedisBufferAndLock error]:', err);
  }
}
