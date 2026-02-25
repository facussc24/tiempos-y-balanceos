import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    { ignores: ['dist'] },
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
            react,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true },
            ],
            'react/jsx-runtime': 'off', // React 17+ doesn't need this, but good to be explicit if needed
            ...react.configs.recommended.rules,
            'react/react-in-jsx-scope': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            // Prevent console.log in production code (allow warn/error/info)
            'no-console': ['warn', {
                allow: ['warn', 'error', 'info']
            }]
        },
        settings: {
            react: {
                version: 'detect'
            }
        }
    },
);
