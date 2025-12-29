// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from 'eslint-plugin-storybook'
import nextConfig from 'eslint-config-next'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ['coverage/**', 'storybook-static/**', '.worktrees/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  ...storybook.configs['flat/recommended'],
  eslintConfigPrettier, // Must be last to disable formatting rules that conflict with Prettier
]

export default eslintConfig
