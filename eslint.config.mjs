import path from 'node:path';
import { fileURLToPath } from 'node:url';
import globals from 'globals';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});
export default [
  {
    ignores: [
      '**/dist',
      '**/node_modules',
      'packages/load/tests/loaders/schema',
      '**/website',
      '**/scripts',
      '**/e2e',
      '**/benchmarks',
      'deno-jest.ts',
      '.bob',
      '*.mjs',
      '*.cjs',
      '*.js',
    ],
  },
  ...compat.extends(
    'eslint:recommended',
    'standard',
    'prettier',
    'plugin:@typescript-eslint/recommended',
  ),
  {
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },

    languageOptions: {
      globals: {
        ...globals.node,
        BigInt: true,
      },

      parser: tsParser,
      ecmaVersion: 5,
      sourceType: 'commonjs',

      parserOptions: {
        project: './tsconfig.json',
      },
    },

    rules: {
      'no-empty': 'off',
      'no-console': 'off',
      'no-prototype-builtins': 'off',
      'no-useless-constructor': 'off',
      'no-useless-escape': 'off',
      'no-undef': 'off',
      'no-dupe-class-members': 'off',
      'dot-notation': 'off',
      'no-use-before-define': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/ban-ts-ignore': 'off',
      '@typescript-eslint/return-await': 'error',
      '@typescript-eslint/naming-convention': 'off',
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'default-param-last': 'off',
      '@typescript-eslint/ban-types': 'off',

      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            '**/*.test.ts',
            '**/*.spec.ts',
            '**/vitest.config.ts',
            '**/vitest.projects.ts',
          ],
        },
      ],
    },
  },
  {
    files: ['**/{test,tests,testing}/**/*.{ts,js}', '**/*.{spec,test}.{ts,js}'],

    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },

    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'import/no-extraneous-dependencies': 'off',
    },
  },
];
