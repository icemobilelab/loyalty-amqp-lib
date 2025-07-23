import js from '@eslint/js';
import prettierPlugin from 'eslint-plugin-prettier';
import importPlugin from 'eslint-plugin-import';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default [
  js.configs.recommended,
  prettierConfig,
  {
    ignores: [
      '**/node_modules/**',
      '**/coverage/**',
      '**/.nyc_output/**',
      '**/mochawesome-report/**',
      '**/dist/**',
      '**/build/**',
      '**/*.yml',
      '**/*.yaml',
      '**/*.html',
      '**/*.md',
      '**/.vscode/**',
      '**/.idea/**',
      '**/temp/**',
      '**/.test.tmp/**',
      '**/.scannerwork/**',
    ],
  },
  {
    files: ['**/*.{js,mjs}'],
    plugins: {
      import: importPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': [
        'error',
        {
          singleQuote: true,
          semi: true,
          trailingComma: 'all',
          arrowParens: 'always',
          tabWidth: 2,
          printWidth: 130,
          quoteProps: 'as-needed',
          bracketSpacing: true,
          endOfLine: 'lf',
        },
      ],
      'import/extensions': ['error', 'ignorePackages'],
      'import/no-commonjs': 'error',
      'import/no-unresolved': ['error', { ignore: ['^got$'] }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'max-len': [
        'error',
        {
          code: 130,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
        },
      ],
      camelcase: ['warn', { properties: 'always' }],
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.mocha,
        ...globals.es2021,
        ...globals.es2022,
        ...globals.es2023,
        ...globals.es2024,
        ...globals.es2025,
        ...globals.browser,
      },
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.mjs'],
        },
      },
    },
  },
];
