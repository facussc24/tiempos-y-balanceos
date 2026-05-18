# Regla: Barack NO hace flujogramas de proceso (PFD) en este proyecto

## Decisión Fak — 2026-05-17

> *"los flujogramas de proceso no los hacemos aca, deshabilita ese modulo ya que estas ok? no quiero que me vuelvas a preguntar pos los flujogramas de proceso porque no, simplemente no los vas a hacer ok?"*

## Qué significa

1. **NO crear ni regenerar** PFDs nuevos en Supabase ni desde la UI.
2. **NO sugerir** a Fak generar/regenerar PFDs (ej. "después de modificar el AMFE conviene regenerar el PFD").
3. **NO preguntar** a Fak sobre flujogramas de proceso — Fak ya decidió que no se hacen acá.
4. **Los 3 PFDs existentes** en Supabase (`AMFE-HF-PAT`, `AMFE-HRC-PAT`, `AMFE-HRO-PAT` + cualquier otro) quedan como **referencia histórica**. NO tocar ni eliminar.
5. **Validaciones cruzadas PFD ↔ AMFE** (`pfdAmfeLinkValidation.ts`) NO ejecutar proactivamente — si la app las dispara solas, OK, pero no las llamamos manualmente.

## Por qué Fak tomó esta decisión

Los flujogramas de proceso los hacen externamente (probablemente un colega o herramienta separada). La app Barack Mercosul se enfoca en AMFE, CP, HO, Balanceo, Calculadora de Medios, etc. — pero NO en PFDs.

## Estado del módulo (2026-05-17)

- **Código**: `modules/pfd/**` queda en el repo (no se borra) por compatibilidad con worktrees activos y tests existentes.
- **UI**: el módulo sigue accesible desde LandingPage (card "PFD", tecla `1`, etc.) — Fak puede decidir más adelante si quiere también sacarlo de la UI. No se hizo en sesión 2026-05-17 para no romper tests visuales.
- **Validaciones**: las validaciones cruzadas PFD ↔ AMFE existen pero NO se ejecutan proactivamente desde scripts ni desde sugerencias de Claude.

## Si en una sesión futura Fak quiere sacar el módulo de la UI

Pasos:
1. Editar `modules/LandingPage.tsx`: comentar/remover card PFD, ajustar shortcuts.
2. Verificar tests visuales (`__tests__/`) y actualizar snapshots si fallan.
3. Mantener rutas de debug `pfdTest`, `pfdSvgAudit`, `pfdDebug` en AppRouter (las usa Claude MCP — comentario en línea 80-82).
4. NO eliminar `modules/pfd/` del codebase.

## Anti-patrones que esta regla previene

- ❌ Preguntar "¿querés que actualice el PFD del producto X?"
- ❌ Sugerir "después del AMFE conviene regenerar el PFD"
- ❌ Incluir PFD en planes de "armar paquete APQP completo"
- ❌ Generar PFD nuevo al crear AMFE nuevo
- ❌ Tratar el módulo PFD como "WIP" o "para terminar"

## Incidente fuente

Sesión soft-snacking-elephant 2026-05-17 (parte D): Fak preguntó si actualizar también los 3 PFDs cuando le pedí confirmación para los 3 AMFEs. Respondió que NO se hacen acá, que deshabilite el módulo, y que **no le vuelva a preguntar**.
