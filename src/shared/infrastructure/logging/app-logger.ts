import { ConsoleLogger } from '@nestjs/common';

/** DESIGN.md O-1: the one logger configuration main.ts uses — one JSON line per message. */
export function createAppLogger(): ConsoleLogger {
  return new ConsoleLogger({ json: true });
}
