/** Injection tokens for the application ports (ADR-0001: plain classes wired via useFactory). */
export const BOOKING_UNIT_OF_WORK = Symbol('BOOKING_UNIT_OF_WORK');
export const CLOCK = Symbol('CLOCK');
export const PRISMA_CLIENT = Symbol('PRISMA_CLIENT');
export const SCHEDULING_READ_MODEL = Symbol('SCHEDULING_READ_MODEL');
