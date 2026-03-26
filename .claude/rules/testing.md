---
description: Reglas de testing - se aplica al editar o crear tests
globs:
  - "__tests__/**/*.test.ts"
  - "__tests__/**/*.test.tsx"
---

# Testing Standards

## Framework y Setup
- Vitest 4.x con globals habilitados: `describe`, `it`, `expect` (sin import)
- Patron obligatorio: `describe > it > expect`
- Hooks: `import { renderHook } from '@testing-library/react'`
- DOM: jsdom environment (configurado en vitest.config.ts)

## React 19 Gotchas
- ErrorBoundary tests: NO usar patron "throw once" (concurrent mode re-ejecuta el render)
- `ConfirmModal`: requiere `vi.useFakeTimers()` para tests con `isOpen=false`
- `aria-haspopup` en DropdownNav es `"menu"`, NO `"true"`

## Mocks
- **Repositorios**: mockear `utils/repositories/*` (settingsRepository, amfeRepository, draftRepository, etc.)
- **Filesystem**: mockear `unified_fs`, NO el filesystem real
- **Servicios**: mockear `logger`, `crypto`, `settingsStore`, `pathManager`
- **NUNCA** mockear implementaciones internas de React (@testing-library maneja eso)

## Datos de Test
- `INITIAL_PROJECT` y `EXAMPLE_PROJECT` en `types.ts` para datos de proyectos
- Crear datos inline para tests de AMFE/CP/HO (no depender de fixtures globales)

## Cobertura
- Plugin: `@vitest/coverage-v8`
- Correr: `npx vitest run --coverage`
