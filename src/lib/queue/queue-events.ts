/**
 * QueueEvents factory (Etapa 7)
 *
 * Retorna uma instância de BullMQ QueueEvents com uma conexão Redis dedicada.
 * NUNCA reutilize getRedisConnection() para QueueEvents: o SUBSCRIBE do ioredis
 * coloca a conexão em "subscriber mode", bloqueando todos os outros comandos.
 *
 * Quem chama createQueueEvents() é responsável por invocar .close() quando o
 * cliente desconectar ou o timeout disparar (evitar leak de conexões).
 *
 * @module lib/queue/queue-events
 */

import { QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';

/**
 * Cria uma QueueEvents com conexão Redis exclusiva para escuta de eventos.
 * Caller DEVE chamar .close() ao terminar.
 */
export function createQueueEvents(queueName: string): QueueEvents {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  // Nova instância Redis por QueueEvents — nunca compartilhar com a fila.
  const connection = new Redis(url, { maxRetriesPerRequest: null });
  return new QueueEvents(queueName, { connection });
}
