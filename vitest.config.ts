/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom', // Simulates browser environment for React/DOM related logic if needed
    exclude: ['node_modules', 'dist', 'e2e', '.claude/worktrees/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'core/**/*.{ts,tsx}',
        'utils/**/*.{ts,tsx}',
        'modules/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'hooks/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/__tests__/**',
        'fixtures/**',
        'scripts/**',
        '**/*.d.ts',
        '**/types.ts',
      ],
      thresholds: {
        lines: 40,
        branches: 40,
        functions: 40,
        statements: 40,
      },
      reportsDirectory: './coverage',
    },
  },
});
