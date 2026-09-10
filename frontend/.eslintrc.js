module.exports = {
  extends: ['next/core-web-vitals', 'plugin:@typescript-eslint/recommended', 'plugin:import/recommended', 'prettier'],
  ignorePatterns: ['next-env.d.ts', '.next/**', 'node_modules/**'],
  rules: {
    // Blank-line/formatting rules are intentionally NOT set here: `extends: [... 'prettier']`
    // (eslint-config-prettier) turns them off so Prettier owns formatting. Re-enabling
    // padding-line-between-statements / newline-before-return / lines-around-comment makes
    // `lint:fix` and `format` undo each other. Import ordering below is safe: Prettier
    // does not reorder imports.
    'jsx-a11y/alt-text': 'off',
    'react/display-name': 'off',
    'react/no-children-prop': 'off',
    '@next/next/no-img-element': 'off',
    '@next/next/no-page-custom-font': 'off',
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    // A leading underscore marks a binding that is intentionally unused
    // (unused catch params, placeholder callback args). Everything else is dead code.
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_'
      }
    ],
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-unused-expressions': 'off',
    'import/no-named-as-default': 'off',
    'import/newline-after-import': [
      'error',
      {
        count: 1
      }
    ],
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', ['internal', 'parent', 'sibling', 'index'], ['object', 'unknown']],
        pathGroups: [
          {
            pattern: 'react',
            group: 'external',
            position: 'before'
          },
          {
            pattern: 'next/**',
            group: 'external',
            position: 'before'
          },
          {
            pattern: '~/**',
            group: 'external',
            position: 'before'
          },
          {
            pattern: '@/**',
            group: 'internal'
          }
        ],
        pathGroupsExcludedImportTypes: ['react', 'type'],
        'newlines-between': 'always-and-inside-groups'
      }
    ]
  },
  settings: {
    react: {
      version: 'detect'
    },
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx']
    },
    'import/resolver': {
      node: {},
      typescript: {
        project: './tsconfig.json'
      }
    }
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx', 'src/iconify-bundle/*'],
      rules: {
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-var-requires': 'off'
      }
    }
  ]
}
