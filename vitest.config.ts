/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom', // Simulates browser environment for React/DOM related logic if needed
    exclude: ['node_modules', 'dist', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      reportsDirectory: './coverage',
      include: [
        'hooks/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'utils/**/*.ts',
        'core/**/*.ts',
        'modules/**/*.{ts,tsx}',
      ],
      exclude: [
        'node_modules/**',
        '__tests__/**',
        '**/*.d.ts',
        'src-tauri/**',
      ],
    },
  },
});
