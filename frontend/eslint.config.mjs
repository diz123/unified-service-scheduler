import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// ADR-0002 pinned versions: eslint-config-next is not used, its react/import/jsx-a11y plugins do not support ESLint 10.
export default tseslint.config(
  { ignores: ['.next/**', 'next-env.d.ts'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommended, reactHooks.configs.flat.recommended],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs['core-web-vitals'].rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
