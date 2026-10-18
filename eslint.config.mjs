import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'frontend/**'] },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts', 'prisma/**/*.ts', 'e2e/**/*.ts'],
    extends: [...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
