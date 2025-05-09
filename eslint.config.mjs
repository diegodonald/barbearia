import js from '@eslint/js';
import globals from 'globals';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'url';
import path from 'path';

// Configuração para usar arquivos legados com o novo formato flat
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

const config = [
  // Configurações globais
  {
    ignores: ['node_modules/**', '.next/**', 'dist/**', 'build/**'],
  },

  // Importar configurações do Next.js via compat
  ...compat.extends('next/core-web-vitals'),

  // Configurações para arquivos JavaScript/TypeScript
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      react: reactPlugin,
    },
    rules: {
      // Desativa regras que estão causando muitos avisos
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          // Permite importações e variáveis não utilizadas durante o desenvolvimento
          ignoreRestSiblings: true,
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off', // Desliga verificação de 'any'
      'no-console': 'off', // Desativa verificação de console.log
      'react/no-unescaped-entities': 'off', // Desativa verificação de caracteres não escapados
      'react-hooks/exhaustive-deps': 'warn', // Reduz para aviso em vez de erro

      // Mantenha outras regras como estão
      'react/react-in-jsx-scope': 'off',
    },
  },
];

export default config;
