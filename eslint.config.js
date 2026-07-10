import eslint from '@eslint/js';
import { flatConfigs as importXFlatConfigs } from 'eslint-plugin-import-x';
import { configs as perfectionistConfigs } from 'eslint-plugin-perfectionist';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import { config, configs as tseslintConfigs } from 'typescript-eslint';

export default config(
  {
    ignores: ['dist', 'node_modules', 'src/app/routeTree.gen.ts'],
  },
  eslint.configs.recommended,
  ...tseslintConfigs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  perfectionistConfigs['recommended-natural'],
  importXFlatConfigs.recommended,
  importXFlatConfigs.typescript,
  unicorn.configs['flat/recommended'],
  {
    rules: {
      'unicorn/no-null': 'warn',
    },
    settings: {
      'import-x/resolver': {
        typescript: {
          noWarnOnMultipleProjects: true,
          project: ['./tsconfig.app.json', './tsconfig.node.json'],
        },
      },
    },
  },
);
