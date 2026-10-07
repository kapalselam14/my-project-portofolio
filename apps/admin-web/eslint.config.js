import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default [
  { ignores: ['dist', 'node_modules', '*.config.js'] },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // v7-only rules, disabled until the codebase adopts them: the
      // fetch-then-setState-with-cancelled-flag pattern they flag is
      // correct here (checked, not cascading), and the codebase predates
      // the immutability model. Re-enable deliberately, with refactors.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-caught-error': 'off',
      'react-hooks/purity': 'off',
      // ESLint 10 core rule: rethrowing with a mapped message is an
      // established pattern in these hooks (the original error is
      // network noise, not debuggable state). Revisit if we adopt `cause`.
      'preserve-caught-error': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // TypeScript already covers this; ESLint's no-undef is redundant and
      // misses TS's built-in lib.dom.d.ts types.
      'no-undef': 'off',
    },
  },
];