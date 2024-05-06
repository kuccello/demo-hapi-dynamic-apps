import { performance } from 'perf_hooks';

export async function timedMethod(method: Function, logger: any, ...args: any[]) {
  const start = performance.now();
  const result = await method(...args);
  const end = performance.now();
  logger.info(`Time taken for ${method.name}: ${(end - start).toFixed(3)} ms`, ['performance']);
  return result;
}

export function createTimedProxy(target: any, logger: any) {
  return new Proxy(target, {
    get(target, prop, receiver) {
      const originalMethod = target[prop];
      if (typeof originalMethod === 'function') {
        return function(...args: any[]) {
          return timedMethod(originalMethod.bind(target), logger, ...args);
        };
      }
      return Reflect.get(target, prop, receiver);
    }
  });
}

export function formatMilliseconds(ms: number): string {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  let humanReadable = `${ms} ms`;
  if (days > 0) humanReadable = `${days}d ${hours}h ${minutes}m ${seconds}s`;
  else if (hours > 0) humanReadable = `${hours}h ${minutes}m ${seconds}s`;
  else if (minutes > 0) humanReadable = `${minutes}m ${seconds}s`;
  else if (seconds > 0) humanReadable = `${seconds}s`;

  return humanReadable;
}