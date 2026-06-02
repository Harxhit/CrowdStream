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
        project:        true,        // uses nearest tsconfig.json
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

      '@typescript-eslint/no-floating-promises':    'error',   // must .catch() or await
      '@typescript-eslint/await-thenable':           'error',   // no await on non-Promise
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } }, // async fn in event handlers
      ],
      '@typescript-eslint/require-await':            'error',   // no async fn without await
      '@typescript-eslint/promise-function-async':   'error',   // fn returning Promise must be async
      'no-return-await':                             'off',     // replaced by TS-aware version ↓
      '@typescript-eslint/return-await':            ['error', 'in-try-catch'], // required inside try

      '@typescript-eslint/no-explicit-any':              'error',
      '@typescript-eslint/no-unsafe-assignment':          'error',
      '@typescript-eslint/no-unsafe-call':                'error',
      '@typescript-eslint/no-unsafe-member-access':       'error',
      '@typescript-eslint/no-unsafe-return':              'error',
      '@typescript-eslint/no-unsafe-argument':            'error',
      '@typescript-eslint/no-unsafe-enum-comparison':     'error',
      // Remove pointless casts: `(value as string)` when value is already string
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      // Remove useless type args matching defaults: `Array<string>` → `string[]`
      '@typescript-eslint/no-unnecessary-type-arguments': 'error',
      // No `string | string`, `boolean | true`, etc.
      '@typescript-eslint/no-redundant-type-constituents': 'error',
      // Property-style methods are contravariant (safer than method signatures)
      '@typescript-eslint/method-signature-style':    ['error', 'property'],
      // Collapse overloads that only differ by union: (a: A): R; (a: B): R → (a: A|B): R
      '@typescript-eslint/unified-signatures':         'error',
      // Enforce import — no require() anywhere in source
      '@typescript-eslint/no-require-imports':         'error',

      // Catch dead code: conditions that are always true or always false
      '@typescript-eslint/no-unnecessary-condition':   'error',
      // Every union member must have a matching case in switch (mediasoup events!)
      '@typescript-eslint/switch-exhaustiveness-check':'error',
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        {
          allowString:          false,
          allowNumber:          false,
          allowNullableObject:  true,  // `if (transport)` / `if (producer)` OK
          allowNullableBoolean: false,
          allowNullableString:  false,
          allowNullableNumber:  false,
          allowAny:             false,
        },
      ],
      // No `if (x === true)` — just write `if (x)`
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions:              true,  // const fn = () => ...
          allowTypedFunctionExpressions: true,  // const fn: Type = () => ...
          allowHigherOrderFunctions:     true,  // router.get('/', async (req, res) => ...)
        },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'error',

      // ────────────────────────────────────────────────────────────────────────
      // 🛡️  NULL / UNDEFINED SAFETY
      // ────────────────────────────────────────────────────────────────────────
      '@typescript-eslint/no-non-null-assertion':     'error',   // no x!.y
      '@typescript-eslint/prefer-nullish-coalescing': 'error',   // ?? over ||
      '@typescript-eslint/prefer-optional-chain':     'error',   // a?.b?.c


      // Class fields never re-assigned after construction must be readonly.
      // Perfect for: private readonly worker: Worker, readonly router: Router
      '@typescript-eslint/prefer-readonly': 'error',

      // Only `throw new Error(...)` — never `throw "message"` or `throw { code }`
      '@typescript-eslint/only-throw-error':  'error',
      // No void where a value is expected (e.g. arr.forEach(async () => void op()))
      '@typescript-eslint/no-confusing-void-expression': [
        'error',
        { ignoreArrowShorthand: true, ignoreVoidOperator: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern:              '^_',
          varsIgnorePattern:              '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      // No access before declaration (TypeScript-aware)
      'no-use-before-define':                    'off',
      '@typescript-eslint/no-use-before-define': [
        'error',
        { functions: false, classes: true, variables: true, typedefs: true },
      ],
      // No variable shadowing (TypeScript-aware — handles overloads correctly)
      'no-shadow':                    'off',
      '@typescript-eslint/no-shadow': 'error',
      // Default parameters must always be the last parameter
      'default-param-last':                    'off',
      '@typescript-eslint/default-param-last': 'error',
      // No functions created inside loops (stale closure bug)
      'no-loop-func': 'error',

      // Separate `import type` keeps runtime bundle clean and avoids circular refs
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/consistent-type-exports':     'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',
      'no-duplicate-imports':                           'error',


      '@typescript-eslint/naming-convention': [
        'error',
        // Default: camelCase — covers most identifiers
        {
          selector: 'default',
          format:   ['camelCase'],
          leadingUnderscore:  'allow',
          trailingUnderscore: 'allow',
        },
        // Variables may also be UPPER_CASE (true constants)
        {
          selector: 'variable',
          format:   ['camelCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        // Parameters: camelCase, _prefix allowed for unused
        {
          selector: 'parameter',
          format:   ['camelCase'],
          leadingUnderscore: 'allow',
        },
        // Class members: camelCase, private _prefix allowed
        {
          selector: 'memberLike',
          format:   ['camelCase'],
          leadingUnderscore: 'allow',
        },
        // Classes, interfaces, type aliases, enums: PascalCase
        {
          selector: 'typeLike',
          format:   ['PascalCase'],
        },
        // Interface: PascalCase — no forced I-prefix (mediasoup convention)
        {
          selector: 'interface',
          format:   ['PascalCase'],
        },
        // Enum members: UPPER_CASE
        {
          selector: 'enumMember',
          format:   ['UPPER_CASE'],
        },
      ],

      'n/no-process-exit':     'error',   // use graceful shutdown instead
      'n/handle-callback-err': 'error',   // always handle callback errors
      'n/no-sync':             'warn',    // prefer async fs / crypto APIs

      'no-console':           'warn',     // replace with pino / winston in prod
      'prefer-const':         'error',
      'no-var':               'error',
      eqeqeq:                ['error', 'always'],
      'no-eval':              'error',
      curly:                 ['error', 'all'],
      'object-shorthand':     'error',    // { fn: fn } → { fn }
      'no-else-return':       'error',    // no else after return
      'no-nested-ternary':    'error',
      'prefer-template':      'error',    // `${x}` not 'a' + x
      'no-implicit-coercion': 'error',    // no !!x, +x, '' + x
      'no-param-reassign':    'error',    // don't mutate function params
      radix:                  'error',    // parseInt always needs radix
      yoda:                   'error',    // no 'red' === color
      'no-useless-concat':    'error',    // no 'a' + 'b'
    },
  },
);