# Reporte de Tests Nocturno — 2026-03-22

## Resultado General

```
npx vitest run --coverage
```

| Metrica | Valor |
|---------|-------|
| Test Files | 259 total |
| Passed | 255 |
| Failed | 3-4 (flaky) |
| Skipped | 1 |
| Tests | 4,027 total |
| Passed | 4,014-4,016 |
| Failed | 3-5 (flaky) |
| Skipped | 8 |
| Duracion | ~250s (4m 10s) |

## Tests Fallando

### 1. FormatosApp.test.tsx (2 tests)
- `shows title Formatos Estandar` — falla intermitente
- `calls onBackToLanding when back button is clicked` — falla por "Found multiple elements with the text: Inicio" (Breadcrumb + back button ambos dicen "Inicio")

**Causa raiz**: El componente FormatosApp tiene un boton "Inicio" en la toolbar Y un breadcrumb con "Inicio". El test usa `getByText('Inicio')` que encuentra 2 elementos.

**Fix recomendado**: Usar `getAllByText('Inicio')[0]` o `getByRole('button', { name: /inicio/i })` en el test.

### 2. ManualesApp.test.tsx (1 test)
- `calls onBackToLanding when back button is clicked` — misma causa que FormatosApp

**Causa raiz**: Identica — Breadcrumb + boton "Inicio" duplican el texto.

### 3. performance.test.ts (0-2 tests, flaky)
- `should complete 50 pieces through 3 stations in < 20ms` — falla en CI/runs pesados (threshold muy ajustado)

**Causa raiz**: El threshold de 20ms es demasiado ajustado para un entorno con carga (otros tests corriendo en paralelo). A veces pasa, a veces no.

## Cobertura

**NOTA**: La cobertura detallada por modulo no se pudo generar en esta ejecucion porque vitest v4 no genera el reporte de coverage cuando hay tests fallidos (exit code 1). La cobertura individual (por test file) si funciona.

**Configuracion de coverage** (vitest.config.ts):
- Provider: v8
- Include: hooks/, components/, utils/, core/, modules/
- Reporter: text, text-summary, html, json-summary

Para obtener la cobertura completa, se necesita primero corregir los 3-4 tests fallando.

## Acciones Recomendadas

### Prioridad Alta (no se aplican porque tocan tests, no produccion)
1. **FormatosApp.test.tsx**: Cambiar `getByText('Inicio')` a `getByRole('button', { name: /inicio/i })` o `getAllByText('Inicio')[0]`
2. **ManualesApp.test.tsx**: Idem
3. **performance.test.ts**: Aumentar threshold de 20ms a 50ms para el test de 50 piezas/3 estaciones

### Pendiente
- Regenerar cobertura completa despues de fijar los tests
- Identificar los 3 modulos con peor cobertura y agregar tests
