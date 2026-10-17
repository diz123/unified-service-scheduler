const nextJest = require('next/jest');

// next/jest loads next.config.ts and compiles TypeScript with SWC (ADR-0002, Testing).
const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/unit'],
};

module.exports = createJestConfig(config);
