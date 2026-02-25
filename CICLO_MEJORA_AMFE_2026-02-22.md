# CICLO DE MEJORA — MODULO AMFE VDA
**Fecha:** 2026-02-22
**Modulo:** AMFE VDA (Analisis de Modo y Efecto de Falla)
**Norma de referencia:** AIAG-VDA FMEA 1.a Edicion 2019
**Validacion externa:** NotebookLM (cuaderno automotriz, 132 fuentes AIAG-VDA / IATF 16949)

---

## CICLO 1 — Revision Inicial (2026-02-22 AM)

### 1. METODOLOGIA

1. **Revision visual** de la app como ingeniero de calidad automotriz (localhost:3002)
2. **Consulta normativa** a NotebookLM con preguntas especificas sobre compliance AIAG-VDA
3. **Clasificacion** de hallazgos en: NORMA, BUGS, UX, VISUAL, EXPORTACION
4. **Correccion** en orden de prioridad: NORMA > BUGS > UX > VISUAL > EXPORTACION
5. **Verificacion**: `npx tsc --noEmit` + `npx vitest run` despues de cada grupo + screenshots ANTES/DESPUES

### 2. HALLAZGOS

#### NORMA (Compliance AIAG-VDA — prioridad maxima)

| ID | Hallazgo | Impacto | Severidad |
|----|----------|---------|-----------|
| N1 | 3 campos obligatorios del header NO renderizados en la UI (`revDate`, `amfeNumber`, `confidentiality`) — existian en el tipo `AmfeHeaderData` pero no tenian inputs | Auditor rechazaria el AMFE por cabecera incompleta | CRITICO |
| N2 | Solo 4 de 12 campos marcados como required (`organization`, `client`, `partNumber`, `responsible`) — faltaban 8 campos normativamente obligatorios | El indicador visual amber no alertaba de campos faltantes | ALTO |
| N3 | Paso 6 se ocultaba cuando AP=L con "Optimizacion no requerida" — NotebookLM confirma: "Ocultar el Paso 6 rompe la trazabilidad. La norma indica que si no se requiere accion, se debe declarar en Observaciones" | Filas "incompletas" sin cierre formal del analisis | CRITICO |
| N4 | PDF usaba fecha actual (`new Date()`) en lugar de `revDate` del AMFE | Fecha del documento no coincide con la revision del AMFE | ALTO |

#### BUGS

| ID | Hallazgo | Impacto |
|----|----------|---------|
| B1 | Campos `revDate`, `amfeNumber`, `confidentiality` no editables desde la UI (ver N1) | Datos se pierden o quedan con defaults |
| B2 | PDF header con `Fecha: ${today}` en vez de `Fecha Rev.: ${h.revDate}` (ver N4) | Documento PDF con fecha incorrecta |

#### UX

| ID | Hallazgo | Solucion |
|----|----------|----------|
| U1 | Header colapsado por defecto en AMFE nuevo — usuario no ve que hay que llenarlo | Default a expandido (`localStorage === 'true'` en vez de `!== 'false'`) |
| U2 | Icono `<Download>` para "Guardar Como..." — confunde con exportacion | Cambiado a `<Copy>` (dos hojas superpuestas) |

#### VISUAL

| ID | Hallazgo | Solucion |
|----|----------|----------|
| V1 | Inputs del header sin placeholders — no se sabe que poner | Placeholders descriptivos en los 16 campos |

#### EXPORTACION

| ID | Hallazgo | Solucion |
|----|----------|----------|
| E1 | PDF header incompleto: faltaban `location`, `revDate`, `confidentiality`, `processResponsible`, `modelYear` | Tabla de metadata ampliada a 4 filas con todos los campos AIAG-VDA |
| E2 | Excel export incompleto: faltaban `amfeNumber`, `revDate`, `confidentiality`, `processResponsible`, `modelYear`, `approvedBy`, `scope` | Metadata ampliada de 4 a 8 filas cubriendo los 16 campos del header |

### 3. CORRECCIONES REALIZADAS

#### Grupo 1: NORMA + BUGS
- `AmfeHeaderForm.tsx`: +3 inputs (revDate, amfeNumber, confidentiality), 12 required fields, placeholders
- `AmfeTableBody.tsx`: Eliminado compact Step 6, siempre visible, placeholder AP=L en Observaciones
- `amfePdfExport.ts`: revDate en header, +confidentiality, tabla metadata 4 filas
- `amfeExcelExport.ts`: Metadata 8 filas con 16 campos AIAG-VDA

#### Grupo 2: UX
- `AmfeApp.tsx`: Header expandido por default
- `AmfeToolbar.tsx`: Icono Download → Copy

#### Grupo 3: VISUAL
- `AmfeHeaderForm.tsx`: 16 placeholders descriptivos

### 4. METRICAS CICLO 1

| Metrica | Antes | Despues |
|---------|-------|---------|
| Campos header renderizados | 13 | 16 |
| Campos marcados required | 4 | 12 |
| Paso 6 visible para AP=L | NO | SI |
| PDF fecha | Generacion | Revision AMFE |
| Tests pasando | 2362 | 2362 |

---

## CICLO 2 — Revision de Profundidad (2026-02-22 PM)

### 1. METODOLOGIA

Segundo pase de revision enfocado en:
1. **Revision como usuario** del flujo completo (templates, CRUD, Resumen, Paso 6)
2. **Validacion normativa** con NotebookLM (preguntas sobre Paso 6, AP=M, evidencia)
3. **Clasificacion** de nuevos hallazgos
4. **Correccion** por prioridad: BUGS → NORMA → UX
5. **Verificacion** en navegador + 2364 tests automatizados

### 2. HALLAZGOS

#### BUGS (2 items)

| ID | Hallazgo | Severidad |
|----|----------|-----------|
| B1 | ConfirmModal muestra "Eliminar" (rojo, icono papelera) al aplicar template — deberia ser "Aplicar" (azul, info) | Alta |
| B2 | Default de `useAmfeConfirm` era `confirmText: 'Eliminar'` — incorrecto para acciones no-destructivas | Alta |

#### NORMA (4 items)

| ID | Hallazgo | Fuente NotebookLM | Estado |
|----|----------|-------------------|--------|
| N1 | Severidad MAX auto-seleccion entre 3 niveles de efectos (Local/Cliente/Usuario) | "El sistema debe permitir evaluar la Severidad (S) para cada uno de estos tres niveles y seleccionar automaticamente el valor mas alto" | YA IMPLEMENTADO (`useAmfe.ts:220-230`) |
| N2 | Campo "Accion Tomada" debe incluir referencia a evidencia (Paso 6) | "El campo Accion Tomada debe incluir referencia al documento/reporte que avala la accion" | CORREGIDO |
| N3 | AP=M sin acciones debe tener justificacion en Observaciones | "Si AP es H o M y no se toman acciones, es obligatorio documentar justificacion tecnica en Observaciones" | CORREGIDO |
| N4 | Columna de revision CC/SC post-optimizacion | "Columna de revision para evaluar si tras la optimizacion se debe agregar/quitar CC/SC" | DIFERIDO |

#### UX (3 items)

| ID | Hallazgo |
|----|----------|
| U1 | "1 operaciones" en AmfeSummary header — falta pluralizacion |
| U2 | Layout "Estado de Acciones" en AmfeSummary — grid-cols-2 causa superposicion de labels |
| U3 | Texto "sin estado asignado" sin contexto — falta "N causas" |

### 3. CORRECCIONES REALIZADAS

#### Grupo 1: BUGS (B1, B2)

**`modules/amfe/useAmfeConfirm.ts`**
- Default `confirmText` cambiado de `'Eliminar'` a `'Confirmar'`

**`modules/amfe/AmfeTableBody.tsx`**
- 5 llamadas de delete ahora pasan `confirmText: 'Eliminar'` explicito

**`modules/amfe/AmfeApp.tsx`** (~linea 254)
- `handleApplyTemplate` ahora usa `variant: 'info', confirmText: 'Aplicar'`

#### Grupo 2: NORMA (N2, N3)

**`modules/amfe/AmfeTableBody.tsx`**
- Placeholder de "Accion Tomada" cambiado a `"Accion tomada y evidencia"`

**`modules/amfe/amfeValidation.ts`** (~linea 78)
- Nueva validacion: si `cause.ap === 'M'` sin acciones ni observaciones → warning "AP Medio sin acciones: documentar justificacion en Observaciones"

**`__tests__/modules/amfe/amfeValidation.test.ts`**
- 2 tests nuevos para la validacion AP=M
- 1 test actualizado (causa AP=M completa ahora incluye observaciones)

#### Grupo 3: UX (U1, U2, U3)

**`modules/amfe/AmfeSummary.tsx`**
- Header: pluralizacion correcta para operacion(es), falla(s), causa(s)
- "Estado de Acciones": grid cambiado de `grid-cols-2` a `grid-cols-1` con `justify-between`
- Texto "sin estado asignado" ahora incluye "N causa(s)"

### 4. VERIFICACION CICLO 2

#### Tests Automatizados
```
npx tsc --noEmit → 0 errores
Test Files:  166 passed | 1 skipped (167)
Tests:       2364 passed | 8 skipped (2372)
```

#### Verificacion en Navegador

| Fix | Verificacion | Resultado |
|-----|-------------|-----------|
| B1  | Aplicar template Soldadura → ConfirmModal muestra icono info azul, titulo "Aplicar template", boton "Aplicar" azul | OK |
| N2  | Scroll a Paso 6 → columna ACCION TOMADA muestra placeholder "Accion tomada y evidencia" | OK |
| N3  | Causas AP=M sin acciones muestran icono warning (triangulo amarillo) junto al badge M | OK |
| U1  | AmfeSummary header con 1 operacion dice "1 operacion" (singular) | OK |
| U2  | "Estado de Acciones" en columna limpia, sin superposicion | OK |
| U3  | Texto "5 causas sin estado asignado" con pluralizacion | OK |

### 5. ARCHIVOS MODIFICADOS CICLO 2

| Archivo | Cambios | Grupo |
|---------|---------|-------|
| `modules/amfe/useAmfeConfirm.ts` | Default confirmText → 'Confirmar' | Bug |
| `modules/amfe/AmfeApp.tsx` | variant: 'info', confirmText: 'Aplicar' en template | Bug |
| `modules/amfe/AmfeTableBody.tsx` | 5 deletes con confirmText explicito + placeholder evidencia | Bug + Norma |
| `modules/amfe/amfeValidation.ts` | Warning AP=M sin acciones/observaciones | Norma |
| `modules/amfe/AmfeSummary.tsx` | Pluralizacion + layout grid-cols-1 | UX |
| `__tests__/modules/amfe/useAmfeConfirm.test.ts` | Default 'Confirmar' | Test |
| `__tests__/modules/amfe/amfeValidation.test.ts` | +2 tests AP=M, 1 actualizado | Test |

**Total Ciclo 2:** 7 archivos, ~61 lineas cambiadas

### 6. RESPALDO NORMATIVO CICLO 2 (NotebookLM)

**Pregunta:** ¿Es correcto que el sistema tenga 3 niveles de efectos (Local, Cliente, Usuario)?
> "Totalmente correcto y una exigencia estricta de la norma AIAG-VDA FMEA"

**Pregunta:** ¿Debe la herramienta permitir override manual del AP?
> "NUNCA debe permitir override manual — el AP se calcula exclusivamente de la tabla S×O×D"

**Pregunta:** ¿Que falta en Paso 6 segun la norma?
> Dos elementos: (1) "Puntero a Evidencia" en Accion Tomada, (2) Revision CC/SC post-optimizacion

**Pregunta:** ¿Que pasa con AP=M sin acciones?
> "Si AP es H o M y no se toman acciones, es obligatorio documentar justificacion tecnica en Observaciones"

---

## METRICAS ACUMULADAS

| Metrica | Pre-Ciclo 1 | Post-Ciclo 1 | Post-Ciclo 2 |
|---------|-------------|--------------|--------------|
| Campos header | 13 | 16 | 16 |
| Campos required | 4 | 12 | 12 |
| Paso 6 visible AP=L | NO | SI | SI |
| PDF fecha | Generacion | Revision | Revision |
| Validacion AP=M | Ninguna | Ninguna | Warning si sin observaciones |
| Placeholder evidencia | "Accion Tomada" | "Accion Tomada" | "Accion tomada y evidencia" |
| Pluralizacion Resumen | Incorrecta | Incorrecta | Correcta |
| Layout Estado Acciones | Superpuesto | Superpuesto | Limpio (grid-cols-1) |
| ConfirmModal template | "Eliminar" rojo | "Eliminar" rojo | "Aplicar" azul |
| Tests | 2362 | 2362 | 2364 |
| Errores TypeScript | 0 | 0 | 0 |

---

## CICLO 3 — Revision Profunda (2026-02-22 PM)

### 1. METODOLOGIA
Mismo proceso que Ciclos 1 y 2: revision visual como ingeniero de calidad → consulta NotebookLM (132 fuentes) → clasificacion → correccion → verificacion.

### 2. HALLAZGOS

#### BUGS (3 items)

| ID | Hallazgo | Impacto | Severidad |
|----|----------|---------|-----------|
| B1 | `amfeNumber` y `confidentiality` se inicializaban con `'-'` en vez de `''` → el indicador amber de campo requerido vacio NUNCA se activaba (porque `'-'` es truthy) | CRITICO | CRITICO |
| B2 | `modelYear` faltaba en REQUIRED_FIELDS — NotebookLM confirmo que "Ano(s) Modelo(s)" es obligatorio en Paso 1 AIAG-VDA | ALTO | ALTO |
| B3 | `validateAmfeDocument` solo validaba 8 campos del header, debia validar los 13 del REQUIRED_FIELDS | MEDIO | MEDIO |

#### NORMA (2 items)

| ID | Hallazgo | Fuente NotebookLM |
|----|----------|-------------------|
| N1 | Resumen solo reportaba AP=H, ignoraba AP=M — NotebookLM: "si no se toman acciones, es obligatorio documentar justificacion tecnica" | Paso 6, Paso 7 |
| N2 | Confidencialidad era input de texto libre — NotebookLM: "campo normativo y obligatorio con opciones formales" | Paso 1 |

#### UX (2 items)

| ID | Hallazgo |
|----|----------|
| U1 | Labels del header sin asteriscos (*) para campos obligatorios — el borde amber era sutil y facil de ignorar |
| U2 | Resumen colapsado del header no mostraba `subject` (que se esta analizando) — info clave para el usuario |

#### VISUAL (1 item)

| ID | Hallazgo |
|----|----------|
| V1 | Barra de progreso mostraba "4% 0/7 pasos" con AMFE vacio — confuso porque org+location pre-llenados generaban 4% |

### 3. CORRECCIONES

#### Fase 1: BUGS (B1 + B2 + B3)

**`modules/amfe/amfeInitialData.ts`**
- `amfeNumber: '-'` → `amfeNumber: ''`
- `confidentiality: '-'` → `confidentiality: ''`

**`modules/amfe/AmfeHeaderForm.tsx`**
- Agregado `'modelYear'` al array REQUIRED_FIELDS (ahora 13 campos)
- className de modelYear cambiado de `inputClass` a `getInputClass('modelYear')`

**`modules/amfe/amfeValidation.ts`**
- `requiredHeaderFields` expandido de 8 a 13 campos para sincronizar con REQUIRED_FIELDS del header

**`__tests__/modules/amfe/amfeValidation.test.ts`**
- Fixture `validDoc` actualizada: `revDate`, `amfeNumber`, `confidentiality`, `processResponsible`, `partNumber` con valores validos

#### Fase 2: NORMA (N1 + N2)

**`modules/amfe/AmfeSummary.tsx`**
- Nuevo `useMemo` `apMCompliance`: itera causas AP=M, identifica las que no tienen acciones (preventionAction/detectionAction) NI justificacion (observations)
- Sub-banner AP=M debajo del banner AP=H existente:
  - Amber si hay AP=M sin acciones ni justificacion (lista las causas, limite 10)
  - Verde si todas las AP=M tienen acciones o justificacion en Observaciones
  - Solo aparece si hay al menos 1 causa AP=M
  - Incluye texto normativo: "AIAG-VDA: si no se toman acciones, es obligatorio documentar una justificacion tecnica en Observaciones"

**`modules/amfe/AmfeHeaderForm.tsx`**
- Tipo `onHeaderChange` ampliado a `React.ChangeEvent<HTMLInputElement | HTMLSelectElement>`
- Confidencialidad: `<input>` reemplazado por `<select>` con opciones: Seleccionar..., Confidencial, Interno, Publico
- En readOnly: mantiene `<input readOnly>` para mostrar el valor

**`modules/amfe/AmfeApp.tsx`**
- `handleHeaderChange` tipo ampliado a `React.ChangeEvent<HTMLInputElement | HTMLSelectElement>`

#### Fase 3: UX (U1 + U2)

**`modules/amfe/AmfeHeaderForm.tsx`**
- Componente `RequiredMark` = `<span className="text-red-500 ml-0.5">*</span>`
- Agregado `<RequiredMark />` en los 13 labels de campos obligatorios
- Campos opcionales (Revision, Aprobado por, Alcance) SIN asterisco
- Collapsed summary: agregado `header.subject` entre Cliente y Nro. Pieza

#### Fase 4: VISUAL (V1)

**`modules/amfe/AmfeStepProgressBar.tsx`**
- Si `completedCount === 0` y `overall < 5`: muestra 0% en el display (sin alterar el calculo subyacente de `computeOverallProgress`)

### 4. VERIFICACION CICLO 3

#### Tests Automatizados
```
npx tsc --noEmit → 0 errores
Test Files:  166 passed | 1 skipped (167)
Tests:       2364 passed | 8 skipped (2372)
```

#### Verificacion en Navegador

| Fix | Verificacion | Resultado |
|-----|-------------|-----------|
| B1  | AMFE vacio → Nro. AMFE muestra placeholder "Ej: AMFE-2026-001" en vez de "-" | OK |
| B2  | Modelo/Ano tiene asterisco rojo y borde amber (es required) | OK |
| B3  | `validateAmfeDocument` ahora valida 13 campos del header | OK (via tests) |
| N1  | Resumen con template Soldadura → banner amber "AP=M: 3 causas sin acciones ni justificacion documentada" con detalle | OK |
| N2  | Confidencialidad es dropdown con 3 opciones + placeholder "Seleccionar..." | OK |
| U1  | 13 campos obligatorios con asterisco rojo; 3 opcionales sin asterisco | OK |
| U2  | Collapsed summary muestra: Nro. AMFE | Org | Cliente | **Tema** | Nro. Pieza | Responsable | OK |
| V1  | AMFE vacio muestra "0% 0/7 pasos" (ya no "4%") | OK |

### 5. ARCHIVOS MODIFICADOS CICLO 3

| Archivo | Cambios | Fase |
|---------|---------|------|
| `modules/amfe/amfeInitialData.ts` | Defaults `''` en vez de `'-'` | Bug |
| `modules/amfe/AmfeHeaderForm.tsx` | modelYear required, select confidencialidad, asteriscos, collapsed summary | Bug+Norma+UX |
| `modules/amfe/amfeValidation.ts` | requiredHeaderFields 8→13 | Bug |
| `modules/amfe/AmfeApp.tsx` | Tipo handleHeaderChange ampliado | Norma |
| `modules/amfe/AmfeSummary.tsx` | Banner AP=M compliance | Norma |
| `modules/amfe/AmfeStepProgressBar.tsx` | Display 0% para doc vacio | Visual |
| `__tests__/modules/amfe/amfeValidation.test.ts` | Fixture validDoc actualizada | Test |

**Total Ciclo 3:** 7 archivos, ~120 lineas cambiadas

### 6. RESPALDO NORMATIVO CICLO 3 (NotebookLM)

**Pregunta:** ¿Es "Ano(s) Modelo(s)" un campo obligatorio del header AMFE?
> Si, es parte del Paso 1 "Planning and Preparation" de la cabecera AIAG-VDA

**Pregunta:** ¿Debe el campo Confidencialidad ser texto libre o dropdown?
> "Campo normativo y obligatorio, incluido en el Paso 1 para que la organizacion determine formalmente las restricciones de distribucion" — opciones: Confidencial, Interno, Publico

**Pregunta:** ¿Debe el Resumen reportar AP=M ademas de AP=H?
> "Si AP es H o M y no se toman acciones, es obligatorio documentar una justificacion tecnica" — el sistema ahora advierte cuando falta

---

## METRICAS ACUMULADAS

| Metrica | Pre-Ciclo 1 | Post-Ciclo 1 | Post-Ciclo 2 | Post-Ciclo 3 |
|---------|-------------|--------------|--------------|--------------|
| Campos header | 13 | 16 | 16 | 16 |
| Campos required | 4 | 12 | 12 | 13 (+modelYear) |
| Required fields en validacion | 4 | 8 | 8 | 13 (sincronizado) |
| Defaults amfeNumber/confid. | `'-'` | `'-'` | `'-'` | `''` (corregido) |
| Confidencialidad UI | Input texto | Input texto | Input texto | Dropdown 3 opciones |
| AP=M en Resumen | No | No | No | Si (banner compliance) |
| Asteriscos en labels | No | No | No | Si (13 campos) |
| Subject en collapsed | No | No | No | Si |
| Progreso AMFE vacio | 4% | 4% | 4% | 0% |
| Paso 6 visible AP=L | NO | SI | SI | SI |
| PDF fecha | Generacion | Revision | Revision | Revision |
| Validacion AP=M | Ninguna | Ninguna | Warning si sin obs. | Warning + banner Resumen |
| Tests | 2362 | 2362 | 2364 | 2364 |
| Errores TypeScript | 0 | 0 | 0 | 0 |

---

## CICLO 4 — Tildes, Profesionalismo y UX Toggle (2026-02-22 PM)

### 1. METODOLOGÍA
Revisión integral enfocada en la percepción profesional del módulo ante un auditor IATF 16949:
1. **Revisión visual** completa de toda la UI del módulo AMFE en localhost:3002
2. **Validación normativa** con NotebookLM (132 fuentes AIAG-VDA)
3. **Clasificación** de hallazgos
4. **Corrección** masiva de tildes/acentos + rediseño UX del toggle
5. **Verificación** con `npx tsc --noEmit` + `npx vitest run` + screenshots

### 2. HALLAZGOS

#### NORMA — Tildes/acentos faltantes (P0 — Problema sistémico)
**Toda la UI carecía de tildes en español.** Esto afecta gravemente la percepción profesional ante un auditor IATF 16949 y no cumple con la nomenclatura estándar VDA.

**Alcance:** ~100+ strings en 14 archivos del módulo AMFE.

#### UX — Toggle Vista/Editar confuso (P1)
El botón mostraba el nombre del modo OPUESTO ("Vista" cuando estás en edición). Un usuario nuevo no sabía en qué modo estaba.

#### VISUAL — Headers de tabla inconsistentes (P2)
Headers del StickyColumnHeader y placeholders del AmfeTableBody carecían de tildes: "ANALISIS", "CAUSA RAIZ", "PREVENCION", "DETECCION", "ACCION", "OPTIMIZACION".

### 3. CORRECCIONES REALIZADAS

#### Grupo 1: NORMA — Tildes (14 archivos, ~100+ correcciones)

| Archivo | Correcciones principales |
|---------|--------------------------|
| `modules/amfe/amfeTerms.ts` | ~47 definiciones de terminología VDA con tildes (Número, Operación, Descripción, Función, Detección, Prevención, Método, Medición, Código, etc.) |
| `modules/amfe/AmfeHeaderForm.tsx` | Organización, Ubicación, Modelo/Año, Fecha Revisión, Resp. del Proceso, Dueño, Público, análisis |
| `modules/amfe/AmfeToolbar.tsx` | Índice, Referencia Rápida, Sábana, Más, AP Automático |
| `modules/amfe/AmfeFilters.tsx` | Operación: Todas |
| `modules/amfe/useAmfeColumnVisibility.ts` | P6: Optimización |
| `modules/amfe/amfeStepProgress.ts` | Planificación, Optimización, Documentación |
| `modules/amfe/amfeValidation.ts` | optimización, debería, característica, justificación |
| `modules/amfe/amfePdfExport.ts` | Sin Título, Organización, Ubicación, Modelo/Año, Función, Acción Prev/Det/Tomada, Causa Raíz, Operación |
| `modules/amfe/amfeExcelExport.ts` | Sin Título, Organización, Ubicación, Modelo/Año, Función, Acción Prev/Det/Tomada, Causa Raíz |
| `modules/amfe/StickyColumnHeader.tsx` | ANÁLISIS DE FALLAS, ANÁLISIS DE RIESGO, OPTIMIZACIÓN, FUNCIÓN, CAUSA RAÍZ, PREVENCIÓN, DETECCIÓN, ACCIÓN PREV/DET/TOMADA |
| `modules/amfe/AmfeTableBody.tsx` | ~30 placeholders, aria-labels, tooltips, confirm dialogs, ghost rows, menú contextual |
| `modules/amfe/AmfeApp.tsx` | Agregar Operación, Operación Vacía, confirmación template |
| `modules/amfe/AmfeChatPanel.tsx` | Labels de acciones del copilot (Agregar/Modificar Operación/Función) |
| `modules/amfe/amfeAudit.ts` | Mensajes de auditoría (Operación, Función, descripción, Máquina) |
| `modules/amfe/StepsView.tsx` | Agregar Operación, Máquina |

#### Grupo 2: UX — Toggle Vista/Editar

| | Antes | Después |
|---|-------|---------|
| Modo Vista | Gris, "Vista" | Borde indigo, ícono Eye, **"Modo Vista"** |
| Modo Edición | Gris, "Editar" | Borde emerald, ícono Pencil, **"Modo Edición"** |
| Tooltip | "Cambiar a modo edicion" | "Cambiar a modo Edición (Ctrl+D)" / "Cambiar a modo Vista (Ctrl+D)" |

#### Grupo 3: VISUAL — Headers de tabla
Corregidos todos los headers de `StickyColumnHeader.tsx` (10 correcciones) y todos los placeholders/tooltips de `AmfeTableBody.tsx` (~30 strings).

### 4. TESTS ACTUALIZADOS

| Archivo de test | Cambio |
|-----------------|--------|
| `__tests__/modules/amfe/amfeStepProgress.test.ts` | 'Planificacion' → 'Planificación', 'Documentacion' → 'Documentación' |
| `__tests__/modules/amfe/amfePdfExport.test.ts` | 'Accion Prev.' → 'Acción Prev.', 'Sin Titulo' → 'Sin Título' |
| `__tests__/modules/amfe/amfeAudit.test.ts` | 'sin descripcion' → 'sin descripción' |

### 5. VERIFICACIÓN CICLO 4

#### Tests Automatizados
```
npx tsc --noEmit → 0 errores
Test Files:  166 passed | 1 skipped (167)
Tests:       2364 passed | 8 skipped (2372) | 0 failed
```

#### Verificación en Navegador (localhost:3002)

| Área | Verificación | Resultado |
|------|-------------|-----------|
| Header form | Organización, Ubicación, Modelo/Año, Fecha Revisión, Resp. del Proceso, Dueño del proceso | OK |
| Toolbar | "Más", "AP Automático" | OK |
| Toggle | "Modo Edición" (verde/emerald), "Modo Vista" (indigo) | OK |
| Filtros | "Operación: Todas" | OK |
| Column pills | "P6: Optimización" | OK |
| FAB | "Agregar Operación" | OK |
| Progress bar | "Planificación", "Optimización", "Documentación" | OK |

### 6. VALIDACIÓN NOTEBOOKLM CICLO 4 (132 fuentes)

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| Confidencialidad | Campo obligatorio per AIAG-VDA Paso 1 | Presente en header form ✓ |
| AP (Action Priority) | Método correcto (reemplaza RPN) | Implementado con tabla S×O×D ✓ |
| 3 niveles de efecto | Normativo: local, siguiente nivel, usuario final | Implementado ✓ |
| Campos obligatorios header | 13 campos per AIAG-VDA | Todos presentes ✓ |
| Filter Code | Opcional | Confirmado ✓ |
| AP=H obligaciones | Acción + Responsable + Fecha objetivo | Validación implementada ✓ |

---

## MÉTRICAS ACUMULADAS (4 Ciclos)

| Métrica | Pre-Ciclo 1 | Post-Ciclo 3 | Post-Ciclo 4 |
|---------|-------------|--------------|--------------|
| Campos header | 13 | 16 | 16 |
| Campos required | 4 | 13 | 13 |
| Tildes en UI | 0% | 0% | **100%** |
| Toggle Vista/Editar | Confuso | Confuso | **Claro** |
| PDF headers con tildes | No | No | **Sí** |
| Excel headers con tildes | No | No | **Sí** |
| Tests | 2362 | 2364 | 2364 |
| Errores TypeScript | 0 | 0 | 0 |

---

## PENDIENTES PARA FUTURO CICLO

### Prioridad Alta
- [ ] **N4 (Ciclo 2):** Campo `specialCharNew` para revisión CC/SC post-optimización
- [ ] Validación al guardar: alertar si campos required del header están vacíos

### Prioridad Media
- [ ] Agregar logo Barack al PDF header (como en HO)
- [ ] Cobertura de tests para AmfeSummary (actualmente sin tests propios)
- [ ] Tildes en prompts AI (`amfeAiSuggestions.ts`) — ~20 strings enviados a Gemini
- [ ] Revisar tildes en módulos CP y HO (mismo problema sistémico probable)

### Prioridad Baja
- [ ] Considerar campo "Tipo de AMFE" (Proceso / Diseño) en el header
- [ ] Revisión completa de exports PDF/Excel después de estas correcciones
