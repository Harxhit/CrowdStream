import tseslint   from 'typescript-eslint';
import eslintJs   from '@eslint/js';
import nodePlugin from 'eslint-plugin-n';
import globals    from 'globals';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(

  // ── Ignored paths ───────────────────────────────────────────────────────────
  {
    ignores: ['dist/**', 'node_modules/**'],
  },

  eslintJs.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        project:        true,
        tsconfigRootDir: __dirname,
      },
    },
  },

  // ── Source-file rules ────────────────────────────────────────────────────────
  {
    files: ['src/**/*.ts'],
    plugins: {
      n: nodePlugin,
    },
    rules: {

      // '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-floating-promises': 'warn',

      '@typescript-eslint/await-thenable': 'error',

      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],

      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/promise-function-async': 'error',

      'no-return-await': 'off',

      '@typescript-eslint/return-await': [
        'error',
        'in-try-catch',
      ],

      // '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',

      // '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'off',

      // '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-call': 'off',

      // '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'off',

      // '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-return': 'off',

      // '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-argument': 'off',

      // '@typescript-eslint/no-unsafe-enum-comparison': 'error',
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',

      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unnecessary-type-arguments': 'error',
      '@typescript-eslint/no-redundant-type-constituents': 'error',

      '@typescript-eslint/method-signature-style': [
        'error',
        'property',
      ],

      '@typescript-eslint/unified-signatures': 'error',

      '@typescript-eslint/no-require-imports': 'error',

      // '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'off',

      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      // '@typescript-eslint/strict-boolean-expressions': [
      //   'error',
      //   {
      //     allowString: false,
      //     allowNumber: false,
      //     allowNullableObject: true,
      //     allowNullableBoolean: false,
      //     allowNullableString: false,
      //     allowNullableNumber: false,
      //     allowAny: false,
      //   },
      // ],
      '@typescript-eslint/strict-boolean-expressions': 'off',

      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',

      // '@typescript-eslint/explicit-function-return-type': [
      //   'error',
      //   {
      //     allowExpressions: true,
      //     allowTypedFunctionExpressions: true,
      //     allowHigherOrderFunctions: true,
      //   },
      // ],
      '@typescript-eslint/explicit-function-return-type': 'off',

      // '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'off',

      '@typescript-eslint/no-non-null-assertion': 'error',

      '@typescript-eslint/prefer-nullish-coalescing': 'error',

      '@typescript-eslint/prefer-optional-chain': 'error',

      '@typescript-eslint/prefer-readonly': 'error',

      '@typescript-eslint/only-throw-error': 'error',

      '@typescript-eslint/no-confusing-void-expression': [
        'error',
        { ignoreArrowShorthand: true, ignoreVoidOperator: true },
      ],

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],

      'no-use-before-define': 'off',

      '@typescript-eslint/no-use-before-define': [
        'error',
        {
          functions: false,
          classes: true,
          variables: true,
          typedefs: true,
        },
      ],

      'no-shadow': 'off',

      '@typescript-eslint/no-shadow': 'error',

      'default-param-last': 'off',

      '@typescript-eslint/default-param-last': 'error',

      'no-loop-func': 'error',

      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      '@typescript-eslint/consistent-type-exports': 'error',

      '@typescript-eslint/no-import-type-side-effects': 'error',

      'no-duplicate-imports': 'error',

      // '@typescript-eslint/naming-convention': [
      //   'error',
      // ],
      '@typescript-eslint/naming-convention': 'off',

      'n/no-process-exit': 'error',

      'n/handle-callback-err': 'error',

      'n/no-sync': 'warn',

      // 'no-console': 'warn',
      'no-console': 'off',

      'prefer-const': 'error',

      'no-var': 'error',

      eqeqeq: ['error', 'always'],

      'no-eval': 'error',

      curly: ['error', 'all'],

      'object-shorthand': 'error',

      'no-else-return': 'error',

      'no-nested-ternary': 'error',

      'prefer-template': 'error',

      'no-implicit-coercion': 'error',

      'no-param-reassign': 'error',

      radix: 'error',

      yoda: 'error',

      'no-useless-concat': 'error',
    },
  },
);