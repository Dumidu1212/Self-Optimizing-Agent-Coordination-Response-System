// eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  // Ignore build, deps, and config files
  { ignores: ['dist', 'node_modules', '**/*.cjs', '.eslintrc.*'] },

  // Base JS rules
  js.configs.recommended,

  // TS recommended (fast, non-type-checked rules)
  ...tseslint.configs.recommended,

  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      }
    },
    rules: {
      'no-console': 'warn',
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error'
    }
  }
];
