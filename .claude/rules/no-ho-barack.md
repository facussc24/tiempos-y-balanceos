# Regla: Barack NO hace Hojas de Operaciones (HO) en este proyecto

## Decisión Fak — 2026-05-22

> *"las hojas de proceos las hago yo manuales deshabilita es emodulo en mis oftare unaicmane hacemos amfes ok? a paritr de ahora ni flugjoramas ni ho ok? el amfe debe eestar alineado con el ho pero el maestro no proque el amestro aplcia para barias ho y a vece slas ho no tiene los nuemros de orpeacieons todo esto deberias saberlo"*

## Qué significa

1. **NO crear ni regenerar** Hojas de Operaciones (HO) nuevas en Supabase ni desde la UI.
2. **NO sugerir** a Fak generar/regenerar HOs (ej. "después de modificar el AMFE conviene regenerar la HO").
3. **NO preguntar** a Fak sobre Hojas de Operaciones — Fak ya decidió que NO se hacen acá.
4. **Las HOs existentes** en Supabase quedan como **referencia histórica**. NO tocar ni eliminar.
5. **Validaciones cruzadas HO ↔ CP** (`hoCpLinkValidation.ts`) NO ejecutar proactivamente — si la app las dispara solas, OK, pero no las llamamos manualmente.

## Por qué Fak tomó esta decisión

Las HOs las hace Fak manualmente fuera del software Barack (en Excel/PDF con su formato `I-IN-002.4-R01`). El software Barack se enfoca en AMFE únicamente. Análogo a la decisión `no-flujogramas-barack.md` (2026-05-17) que ya removió PFD del scope.

## A partir de ahora: el software Barack sirve para AMFE

| Módulo | Estado |
|---|---|
| **AMFE** | ✅ Activo (es el foco principal) |
| **Control Plan (CP)** | ✅ Activo (genera desde AMFE, sigue siendo necesario) |
| **PFD (Flujogramas)** | ❌ Desactivado funcionalmente — regla `no-flujogramas-barack.md` |
| **HO (Hojas de Operaciones)** | ❌ Desactivado funcionalmente — esta regla |
| **Balanceo, mix, kanban, otros** | ✅ Activos según su propia decisión |

## Relación AMFE ↔ HO (importante para entender)

- **El AMFE de PRODUCTO debe estar alineado con la HO oficial Barack** (operaciones, números, contenido).
- **El AMFE MAESTRO (de un proceso, ej. inyección PU) NO se alinea con HO** porque aplica a MUCHAS HOs distintas de varios productos.
- Las HOs reales pueden tener numeración distinta a la del maestro — eso es legítimo.
- Cuando se replica un maestro a un producto, el AMFE del producto adopta la numeración real de su HO física.

## Estado del módulo HO en el código (2026-05-22)

- **Código**: `modules/hojaOperaciones/**` queda en el repo (no se borra) por compatibilidad con worktrees activos y tests existentes.
- **UI**: el módulo sigue accesible desde LandingPage. Fak puede decidir más adelante sacarlo de la UI. No se hace ahora para no romper tests visuales.
- **Validaciones**: las validaciones cruzadas HO ↔ CP existen pero NO se ejecutan proactivamente desde scripts ni desde sugerencias de Claude.

## Si en una sesión futura Fak quiere sacar el módulo de la UI

Pasos:
1. Editar `modules/LandingPage.tsx`: comentar/remover card HO, ajustar shortcuts.
2. Verificar tests visuales (`__tests__/`) y actualizar snapshots si fallan.
3. NO eliminar `modules/hojaOperaciones/` del codebase.

## Anti-patrones que esta regla previene

- ❌ Preguntar "¿querés que regenere la HO del producto X?"
- ❌ Sugerir "después del AMFE conviene regenerar la HO"
- ❌ Incluir HO en planes de "armar paquete APQP completo desde la app"
- ❌ Generar HO nueva al crear AMFE nuevo
- ❌ Pedir a Fak datos para llenar campos de HO (operaciones, EPP, ciclo de control)

## Casos legítimos donde SÍ se toca el módulo HO

- Bug fix en código de export HO (si Fak lo reporta)
- Refactor que toca múltiples módulos y arrastra HO inevitablemente
- Lectura de HO existente para EXTRAER datos al AMFE (pero NO regenerar la HO)

## Incidente fuente

Sesión 2026-05-22 maestro PU Headrest: estaba acumulando preguntas sobre alineación HO ↔ AMFE numeración (HF-PAT OP 63 vs OP 62). Fak respondió que las HOs son externas a Barack y el maestro no debe sincronizarse con ellas. Decisión análoga a `no-flujogramas-barack.md`.
