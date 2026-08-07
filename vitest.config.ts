/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom', // Simulates browser environment for React/DOM related logic if needed
    exclude: ['node_modules', 'dist', 'e2e', '.claude/worktrees/**'],
    // Medido 2026-08-07 en la notebook: la suite COMPLETA con el pool por defecto
    // (`forks`) rompe con "Failed to start forks worker" / "Timeout waiting for worker
    // to respond" — 3 archivos fallados y 9 tests en rojo que NO tienen nada roto:
    // corridos de a uno pasan con cualquiera de los dos pools (navigation_a11y: 14/14).
    // No es un bug de esos tests, es contencion: `forks` levanta un PROCESO por worker
    // y con 241 archivos en paralelo la maquina no da (environment acumulo 1707s).
    // `threads` usa hilos y no se cae. Va en la config y no como flag `--pool=threads`
    // a mano, porque un fallo espurio entrena a ignorar el rojo — que es peor que el rojo.
    pool: 'threads',
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
