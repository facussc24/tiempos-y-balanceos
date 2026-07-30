/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom', // Simulates browser environment for React/DOM related logic if needed
    exclude: ['node_modules', 'dist', 'e2e', '.claude/worktrees/**'],
    // El default de 5000ms era intermitente bajo carga. Medido 2026-07-30:
    // `database.test.ts > closeDatabase > should allow re-initialization after close`
    // tarda ~2600ms aislado (53% del presupuesto) y se pasaba de los 5000ms cuando
    // la suite corre en paralelo, sobre todo con --coverage. El costo acumulado de
    // levantar el environment jsdom fue de 908-913s contra 81-90s de reloj (~11x de
    // paralelismo), asi que el timeout no medía el test sino la contencion de la maquina.
    // Un timeout que falla por carga no detecta nada y entrena a ignorar el rojo.
    testTimeout: 15000,
    hookTimeout: 15000,
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
