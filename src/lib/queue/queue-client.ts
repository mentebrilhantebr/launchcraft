/**
 * Queue Client (BullMQ + Redis)
 *
 * Provides a shared Redis connection and factory helpers to create BullMQ
 * queues and workers. Used for long-running AI generation jobs.
 *
 * @module lib/queue/queue-client
 */

import { Queue, Worker, type Processor, type QueueOptions, type WorkerOptions } from 'bullmq';
import { Redis } from 'ioredis';

// Singleton Redis connection reused across queues/workers.
declare global {
  var __redisConnection: Redis | undefined;
}

/**
 * Returns a singleton ioredis connection configured for BullMQ.
 *
 * BullMQ requires `maxRetriesPerRequest: null` on the connection.
 */
export function getRedisConnection(): Redis {
  if (global.__redisConnection) {
    return global.__redisConnection;
  }

  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const connection = new Redis(url, {
    maxRetriesPerRequest: null,
    // Avoid throwing during build / when Redis isn't available yet.
    lazyConnect: true,
  });

  if (process.env.NODE_ENV !== 'production') {
    global.__redisConnection = connection;
  }

  return connection;
}

/**
 * Creates a BullMQ Queue bound to the shared Redis connection.
 */
export function createQueue<
  DataType = unknown,
  ResultType = unknown,
  NameType extends string = string,
>(name: string, options?: Omit<QueueOptions, 'connection'>): Queue<DataType, ResultType, NameType> {
  return new Queue<DataType, ResultType, NameType>(name, {
    ...options,
    connection: getRedisConnection(),
  });
}

/**
 * Creates a BullMQ Worker bound to the shared Redis connection.
 */
export function createWorker<
  DataType = unknown,
  ResultType = unknown,
  NameType extends string = string,
>(
  name: string,
  processor: Processor<DataType, ResultType, NameType>,
  options?: Omit<WorkerOptions, 'connection'>
): Worker<DataType, ResultType, NameType> {
  return new Worker<DataType, ResultType, NameType>(name, processor, {
    ...options,
    connection: getRedisConnection(),
  });
}
