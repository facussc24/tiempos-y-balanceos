# Analisis UX de Modulos APQP — Hallazgos y Mejoras Propuestas

> Auditoria de usabilidad realizada el 2026-03-11
> Enfoque: Puntos debiles, edge cases, y mejoras para usuarios no-tecnicos

---

## Resumen Ejecutivo

Se analizaron los 4 modulos APQP (PFD, AMFE, CP, HO) tanto en codigo como en UI.

**Sesion 1 (AMFE + General)**: 8 problemas de usabilidad + 6 bugs potenciales.
**Sesion 2 (CP + HO en profundidad)**: 10 problemas nuevos de usabilidad + 4 bugs confirmados.

| Categoria | Critico | Medio | Bajo | Total |
|-----------|---------|-------|------|-------|
| Navegacion | 0 | 2 | 0 | 2 |
| Toolbar / Botones | 1 | 1 | 0 | 2 |
| Estados vacios | 0 | 1 | 1 | 2 |
| Flujo de trabajo | 0 | 1 | 1 | 2 |
| Bugs de codigo (AMFE) | 2 | 2 | 2 | 6 |
| **CP: Bugs de codigo** | **1** | **1** | **0** | **2** |
| **CP: Usabilidad** | **1** | **2** | **1** | **4** |
| **HO: Bugs de codigo** | **0** | **1** | **1** | **2** |
| **HO: Usabilidad** | **1** | **3** | **2** | **6** |

---

## Parte 1: Problemas de UI/UX

### H1. Boton "Inicio" poco visible [MEDIO]

**Donde**: Tab bar superior, extremo derecho
**Archivo**: `modules/amfe/AmfeTabBar.tsx` linea ~144

**Problema**: El boton "Inicio" (volver al menu principal) esta a la derecha del
todo, con estilo gris claro (slate-500). Los tabs de modulos tienen colores vivos
(cyan, azul, verde, naranja). El usuario tiene que buscar el boton para volver.

**Escenario**: Estas editando un AMFE y queres volver al menu para abrir otro
modulo (ej: Tiempos). Buscas un boton "Volver" o "Inicio" y no lo ves rapido
porque esta perdido entre botones grises.

**Mejora propuesta**:
- Opcion A: Mover "Inicio" al extremo **izquierdo** con un icono de casa prominente
- Opcion B: Separarlo visualmente con un divisor vertical `|` y color diferente
- Opcion C: Convertirlo en el logo de Barack Mercosul (click en logo = volver)

---

### H2. Toolbar con demasiados botones [CRITICO]

**Donde**: Barra de herramientas del AMFE
**Archivo**: `modules/amfe/AmfeToolbar.tsx`

**Problema**: Hay **11 botones visibles** + **14 opciones ocultas en "Mas"** = 25 acciones
totales. Para alguien que no es programador, esto es abrumador.

**Botones visibles**:
1. Modo Edicion / Vista
2. Resumen
3. Biblioteca
4. Deshacer / Rehacer
5. Proyectos
6. Guardar Como...
7. Nueva Rev.
8. Copiloto IA
9. Mas (menu con 14 opciones)

**Menu "Mas" contiene** (14 items!):
- Herramientas: Ejemplo, Registro IATF, Analizar Cambio, Auditar AMFE, Referencia Rapida
- Exportar: 3 Excel + 3 PDF
- JSON: Importar / Exportar

**Mejoras propuestas**:
1. **Reducir toolbar a 6-8 botones esenciales**: Editar, Guardar, Deshacer/Rehacer, Exportar, Copiloto, Mas
2. **Crear modal de exportacion**: En vez de 6 opciones de export en un menu,
   un unico boton "Exportar" que abre un modal con tarjetas visuales
   (ej: tarjeta "Excel Completo" con preview, tarjeta "PDF Resumen" con preview)
3. **Promover "Auditar AMFE"**: Moverlo a la toolbar principal, es una funcion
   critica de calidad que no deberia estar escondida

---

### H3. Filtros de columnas sin tooltips [MEDIO]

**Donde**: Barra de filtros debajo del toolbar en AMFE
**Archivo**: `modules/amfe/AmfeFilters.tsx` lineas 217-240

**Problema**: Los toggles "P2: Estructura", "P3: Funciones", "P4: Fallas", etc.
usan nomenclatura AIAG-VDA que es correcta tecnicamente, pero:
- No tienen tooltips al hacer hover
- Un usuario nuevo no sabe que "P2" significa "Paso 2 del AIAG-VDA"
- Las columnas ocultas se ven con tachado (strikethrough) que es sutil

**Mejoras propuestas**:
1. Agregar `title` a cada toggle: "Paso 2: Estructura del proceso (operaciones y elementos 6M)"
2. Cambiar strikethrough por un estilo mas claro (ej: fondo gris con texto "OCULTO")
3. Opcionalmente, usar nombres mas descriptivos sin el prefijo "P2/P3/P4..."

---

### H4. Boton "Agregar Operacion" duplicado [MEDIO]

**Donde**: AMFE — estado vacio + boton flotante (FAB)
**Archivo**: `modules/amfe/AmfeApp.tsx` lineas 689-733

**Problema**: Cuando el AMFE esta vacio, hay 2 botones en el centro:
"Agregar Primera Operacion" y "Usar un Template".
Ademas hay un FAB azul abajo a la derecha que dice "Agregar Operacion"
y al clickearlo se expande mostrando "Operacion Vacia" y "Desde Template".

Son las mismas 2 opciones en 2 lugares distintos con nombres ligeramente diferentes.

**Mejora propuesta**:
- En el estado vacio, mostrar SOLO los botones centrales (sin FAB)
- Cuando ya hay operaciones, mostrar SOLO el FAB
- Agregar indicador visual al FAB de que es un menu expandible (flechita)

---

### H5. Estado vacio de Hojas de Operaciones insuficiente [BAJO]

**Donde**: Tab Hojas de Operaciones cuando no hay datos
**Archivo**: `modules/hojaOperaciones/HoSheetNavigator.tsx` lineas 90-94

**Problema**: Solo dice "Sin hojas de operaciones". No explica:
- Que son las hojas de operaciones
- Que hay que volver al AMFE y hacer click en "Generar HO"
- Que necesita tener operaciones en el AMFE primero

**Comparacion**: El AMFE vacio dice "Paso 2 AIAG-VDA: Definir la estructura..."
con botones claros. La HO deberia tener el mismo nivel de guia.

**Mejora propuesta**: Agregar texto explicativo y boton "Volver al AMFE para generar"

---

### H6. Indicador de guardado efimero [BAJO]

**Donde**: Toolbar del AMFE, indicador de estado
**Archivo**: `modules/amfe/AmfeToolbar.tsx` lineas 113-148

**Problema**: El mensaje "Guardado" (verde) desaparece despues de ~2 segundos.
El usuario tiene que mirar justo en ese momento para confirmar que se guardo.

**Mejora propuesta**: Mantener el texto "Guardado" visible por 5+ segundos,
o usar un toast notification que se quede visible mas tiempo

---

### H7. Regenerar documento sobreescribe cambios manuales [MEDIO]

**Donde**: Flujo de generacion PFD/CP/HO desde AMFE
**Archivo**: `modules/amfe/useAmfeTabNavigation.ts`

**Problema**: Si el usuario:
1. Genera un Plan de Control desde el AMFE
2. Edita manualmente 20 filas del CP
3. Vuelve al AMFE, modifica una operacion
4. Hace click en "Generar CP" de nuevo

Se le advierte que perdera cambios, pero:
- La advertencia es un simple confirm() (si/no)
- No hay opcion de "merge" (generar solo lo nuevo)
- No hay preview de que se va a perder

**Mejora propuesta (futuro)**:
- Opcion "Agregar solo operaciones nuevas" (merge incremental)
- Preview de diff antes de regenerar
- Backup automatico del documento actual antes de sobreescribir

---

## Parte 2: Bugs Potenciales en Codigo

### B1. NaN en Excel export [CRITICO]

**Donde**: `modules/amfe/amfeExcelExport.ts` lineas ~50-75
**Problema**: `Math.max(...emptyArray)` devuelve `-Infinity`, causa celdas con `#NUM!`
**Fix**: Validar array no-vacio antes de Math.max, usar `|| 0` como fallback

### B2. Referencia circular en biblioteca AMFE [CRITICO]

**Donde**: `modules/amfe/useAmfeLibrary.ts`, `amfeLibraryMerge.ts`
**Problema**: Si el usuario importa una operacion de la biblioteca que ya esta
vinculada a si misma, se crea una referencia circular. No hay guard.
**Fix**: Filtrar operaciones locales al mostrar la biblioteca

### B3. AP indefinido con S/O/D invalidos [MEDIO]

**Donde**: `modules/amfe/apTable.ts`
**Problema**: Si algun valor S/O/D es NaN (por import JSON o race condition),
`apLookup[NaN][o][d]` devuelve `undefined` y el campo AP queda sin valor
**Fix**: Validar que S, O, D sean numeros finitos antes del lookup

### B4. Library merge pierde work elements [MEDIO]

**Donde**: `modules/amfe/amfeLibraryMerge.ts` lineas ~40-65
**Problema**: Si la base tiene 3 WE tipo "Machine" pero el local solo 2,
el tercer WE se pierde silenciosamente sin log
**Fix**: Agregar log de warning cuando se dropea un WE por mismatch de tipo

### B5. Snapshots de revision sin limite de tamano [BAJO]

**Donde**: `utils/repositories/amfeRepository.ts`
**Problema**: Cada revision guarda un snapshot completo JSON del AMFE.
Con 500+ causas x 10 revisiones = megabytes por documento.
No hay limite ni compresion.
**Fix**: Comprimir snapshots con LZ-String o limitar a N revisiones retenidas

### B6. Whitespace en observaciones pasa validacion [BAJO]

**Donde**: `modules/amfe/amfeValidation.ts`
**Problema**: Si `observations` tiene solo espacios en blanco, pasa la validacion
de "observaciones presentes" cuando no deberia
**Fix**: Usar `.trim()` antes de verificar

---

## Parte 3: Escenarios del Dia a Dia

### Escenario 1: "Edito el AMFE y quiero ir rapido al flujograma"
**Actual**: Click tab "Diagrama de Flujo" (arriba). Si no hay PFD generado, ve un
mensaje de que no hay datos + advertencia amarilla.
**Ideal**: El tab deberia mostrar un boton "Generar PFD desde este AMFE" directamente

### Escenario 2: "Termine el AMFE, quiero exportar todo de una"
**Actual**: Hay que ir a "Mas" > elegir entre 6 formatos de export.
Luego cambiar de tab > exportar CP > cambiar tab > exportar HO.
**Ideal**: Boton "Exportar Paquete APQP" que genera todos los documentos
en una sola operacion (Excel AMFE + PDF PFD + Excel CP + PDF HO)

### Escenario 3: "Alguien me devolvio el AMFE en Excel con correcciones"
**Actual**: No hay forma de importar Excel. Solo se puede importar JSON.
**Ideal**: (Ver seccion 4.3 de APQP_MODULES_GOALS.md) Marcar revision externa
y actualizar manualmente, con alerta para alinear.

### Escenario 4: "Quiero ver como queda el PDF antes de exportar"
**Actual**: Hay que exportar y abrir el archivo. No hay preview inline.
**Ideal**: Modal de preview PDF dentro de la app (ya existe para HO,
extender a AMFE y CP)

### Escenario 5: "Estoy en el Plan de Control y quiero volver al AMFE"
**Actual**: Click en tab "AMFE VDA" (funciona bien)
**Ideal**: Funciona correctamente. Sin cambios necesarios.

### Escenario 6: "Abro la app despues de semanas y no me acuerdo donde quede"
**Actual**: El landing muestra "Documentos Recientes" con los ultimos 5 abiertos.
**Ideal**: Funciona razonablemente. Se podria agregar "Ultimo modulo editado"
con contexto (ej: "AMFE Columna Direccion - 3 causas AP=H pendientes")

---

## Parte 4: Plan de Implementacion Sugerido

### Fase 1: Quick Wins (esfuerzo bajo, impacto alto)
- [ ] Agregar tooltips a toggles de columnas (H3) — 30 min
- [ ] Mejorar estado vacio de HO con texto guia (H5) — 30 min
- [ ] Fix NaN en Excel export (B1) — 1 hora
- [ ] Fix whitespace en validacion (B6) — 15 min
- [ ] Extender tiempo de "Guardado" visible (H6) — 15 min

### Fase 2: Mejoras de Navegacion (esfuerzo medio)
- [ ] Redisenar boton "Inicio" (H1) — 1-2 horas
- [ ] Ocultar FAB duplicado en estado vacio (H4) — 1 hora
- [ ] Agregar guard de referencia circular en biblioteca (B2) — 2 horas

### Fase 3: Simplificacion de Toolbar (esfuerzo medio-alto)
- [ ] Crear modal de exportacion unificado (H2) — 4-6 horas
- [ ] Promover "Auditar AMFE" a toolbar principal (H2) — 1 hora
- [ ] Reducir botones visibles de toolbar (H2) — 2-3 horas

### Fase 4: Features Nuevos (esfuerzo alto)
- [ ] Banner de "revision externa" para sync con Excel — 4-6 horas
- [ ] Boton "Exportar Paquete APQP" completo — 8-12 horas
- [ ] Preview de regeneracion (diff antes de sobreescribir) — 6-8 horas
- [ ] Compresion de snapshots de revision (B5) — 2-3 horas

---
---

# Sesion 2: Analisis en Profundidad — Plan de Control y Hojas de Operaciones

> Auditoria realizada el 2026-03-11
> Metodo: Se cargo el Ejemplo Completo del AMFE, se genero el CP automaticamente,
> luego se generaron las HO. Se navego cada modulo como usuario real en Preview 1920x1080.
> Se verifico generacion, datos, exportaciones, y usabilidad.

---

## Parte 5: Generacion AMFE → Plan de Control

### Datos de la prueba

Se genero el CP desde el Ejemplo Completo del AMFE (3 operaciones: Soldadura MIG,
Inspeccion Dimensional, Proteccion Anticorrosiva).

**Resultado**: 26 items generados (13 proceso + 13 producto) de 3 operaciones,
a partir de 5 causas AP Alto/Medio + 8 SC/CC.

### Lo que funciona bien

1. **Separacion proceso/producto correcta**: Las filas de proceso tienen
   `processCharacteristic` llenado y `productCharacteristic` vacio, y viceversa.
   Cumple con la regla CP 2024 de no mezclar ambas en la misma fila.
2. **Deduplicacion efectiva**: Causas repetidas se agrupan correctamente,
   tomando el AP mas alto y la severidad mas alta del grupo.
3. **CC/SC propagado**: Las clasificaciones SC y CC se propagan correctamente
   del AMFE al CP (auto-derivadas por severidad: S>=9→CC, S>=5→SC).
4. **Defaults por AP**: Tamano muestra y frecuencia se llenan segun nivel de AP
   (H→100% Cada pieza, M→5 piezas Cada turno, L→1 pieza Cada turno).
5. **Header pre-llenado**: Nro. pieza, organizacion, cliente, equipo, etc.
   se copian del header del AMFE.
6. **Warning banner claro**: El banner superior dice exactamente cuantos items
   se generaron y de donde vienen.
7. **Advertencia de exportacion**: Al exportar Excel, muestra 3 advertencias
   claras sobre campos faltantes antes de permitir la descarga.

---

## Parte 6: Bugs del Plan de Control

### CP-B1. Porcentaje de completitud mal calculado [CRITICO]

**Donde**: `modules/controlPlan/ControlPlanApp.tsx` lineas 217-228
**Verificado en UI**: El CP muestra 71% con 26 items, pero deberia ser mas alto.

**Problema**: El calculo de completitud usa una lista fija de campos requeridos:
```
requiredFields = ['processStepNumber', 'processDescription', 'productCharacteristic',
                  'sampleSize', 'controlMethod', 'reactionPlan', 'reactionPlanOwner']
```

El error es que **`productCharacteristic` se cuenta como requerido para TODAS las filas**,
incluyendo filas de proceso que por diseno tienen ese campo vacio.
Igualmente, **`controlMethod` se cuenta como requerido** para filas de producto
que por diseno no lo tienen (usan `evaluationTechnique` en su lugar).

**Impacto**: El porcentaje esta permanentemente inflado hacia abajo. Con 26 items
(13 proceso + 13 producto), siempre faltan al menos 26 campos "fantasma" que
nunca se van a llenar porque no corresponden al tipo de fila.

**Calculo real**:
- 26 rows x 7 fields = 182 total
- 13 process rows: siempre falta productCharacteristic (13) + reactionPlanOwner (13) = 26
- 13 product rows: siempre falta controlMethod (13) + reactionPlanOwner (13) = 26
- Total faltante real: 52 (pero 26 son por tipo de fila, no por falta de datos)
- Resultado: 130/182 = 71% (deberia ser ~85% sin los campos fantasma)

**Fix**: Hacer el calculo context-aware por tipo de fila:
```
if (isProcessRow) requiredFields = [...base, 'processCharacteristic', 'controlMethod']
if (isProductRow) requiredFields = [...base, 'productCharacteristic', 'evaluationTechnique']
```

---

### CP-B2. Cross-validation con falsos positivos en orphan failures [MEDIO]

**Donde**: `modules/controlPlan/cpCrossValidation.ts` lineas 189-191

**Problema**: La funcion `validateOrphanFailures` usa substring matching para
verificar si una operacion AMFE tiene cobertura en el CP:
```
covered = cpProcesses.some(cp => cp.includes(opNorm) || opNorm.includes(cp))
```

**Edge case**: Si el CP tiene "Soldadura" y el AMFE tiene "Soldadura MIG":
- `"soldadura".includes("soldadura mig")` = false
- `"soldadura mig".includes("soldadura")` = true → OK

Pero si el CP tiene "Soldadura MIG" y el AMFE tiene "Soldadura TIG":
- `"soldadura mig".includes("soldadura tig")` = false
- `"soldadura tig".includes("soldadura mig")` = false
- Se reporta como "orphan" cuando ambas son operaciones de soldadura → FALSO POSITIVO

**Fix**: Usar tokenized matching o Levenshtein distance para fuzzy matching.

---

## Parte 7: Problemas de Usabilidad del Plan de Control

### CP-H1. 26 campos "Espec./Tolerancia" vacios sin explicacion [MEDIO]

**Donde**: Columna "Espec./Tolerancia" en la tabla CP
**Archivo**: `modules/controlPlan/ControlPlanTable.tsx`

**Problema**: TODAS las celdas de especificacion estan vacias despues de generar.
Esto es correcto por diseno (la especificacion viene del plano de ingenieria,
no se auto-llena desde el AMFE), pero el usuario ve 26 celdas vacias sin entender por que.

**Escenario**: El usuario genera el CP, ve 26 celdas vacias en "Espec./Tolerancia",
y piensa que el generador fallo o que hay un bug.

**Mejora propuesta**:
- Agregar placeholder text en las celdas: "Del plano de ingenieria"
- O agregar tooltip en el header de la columna: "Este campo debe completarse
  manualmente con los datos del plano de producto/proceso"

---

### CP-H2. 26 campos "Resp. Reaccion" vacios — bloquea exportacion [CRITICO]

**Donde**: Columna "Resp. Reaccion" en la tabla CP
**Archivo**: `modules/controlPlan/ControlPlanTable.tsx`

**Problema**: TODAS las celdas de responsable de reaccion estan vacias.
Esto es correcto por diseno (debe ser una persona real del piso, no se auto-llena),
pero:
1. El header de la columna se pone ROJO para alertar
2. La exportacion muestra advertencia: "26 item(s) sin Responsable de Reaccion"
3. El usuario no sabe QUE poner (nombre? cargo? puesto?)
4. No hay forma de llenar masivamente (ej: todos = "Operador de turno")

**Escenario**: El usuario genera el CP, quiere exportar rapido para una auditoria,
pero tiene que llenar manualmente 26 celdas de "responsable" una por una.

**Mejora propuesta**:
- Agregar placeholder: "Ej: Operador de Linea / Supervisor Turno"
- Agregar boton "Llenar todos" que setee un valor default (ej: "Operador de Produccion")
  con opcion de editar individualmente despues
- Mostrar tooltip en el header explicando la norma CP 2024

---

### CP-H3. "AMFE Vinculado" muestra "Sin nombre" [BAJO]

**Donde**: Header del CP, campo "AMFE Vinculado"
**Archivo**: `modules/controlPlan/ControlPlanApp.tsx`

**Problema**: Cuando se genera el CP desde el AMFE ejemplo, el campo "AMFE Vinculado"
muestra "Sin nombre" en vez del nombre del proyecto AMFE. Esto es porque el AMFE
nunca fue guardado formalmente como proyecto (solo cargado como ejemplo).

**Mejora propuesta**: Mostrar el titulo del AMFE (`header.subject`) si no hay
nombre de proyecto guardado, o mostrar "AMFE no guardado — guardar para vincular".

---

### CP-H4. No hay indicador visual de tipo de fila (proceso vs producto) [MEDIO]

**Donde**: Tabla CP, todas las filas
**Archivo**: `modules/controlPlan/ControlPlanTable.tsx`

**Problema**: Visualmente no hay diferencia entre una fila de proceso y una de producto.
El usuario tiene que mirar si "Producto" o "Proceso" tiene texto para entender
el tipo de fila. Esto es critico para la norma CP 2024 que prohibe mezclarlas.

**Mejora propuesta**:
- Colorear fondo de filas segun tipo: azul claro para proceso, verde claro para producto
- O agregar icono/badge en la columna "Nro." que diga "P" (proceso) o "D" (deteccion)
- O agregar columna "Tipo" con badge visual

---

## Parte 8: Generacion CP → Hojas de Operaciones

### Datos de la prueba

Se generaron las HO desde el AMFE + CP (3 operaciones).

**Resultado**: 3 hojas generadas con 26 verificaciones de calidad total:
- HO-10: Soldadura MIG - Subchasis (8 quality checks)
- HO-20: Inspeccion Dimensional y Visual (8 quality checks)
- HO-30: Proteccion Anticorrosiva E-coat (10 quality checks)

### Lo que funciona bien

1. **Una hoja por operacion**: Cada operacion AMFE genera exactamente 1 hoja HO.
2. **Quality checks importados del CP**: Los controles del CP se mapean correctamente
   a la tabla de "Ciclo de Control" en la HO, con caracteristica, metodo, frecuencia.
3. **CC/SC badges visibles**: Las clasificaciones CC/SC aparecen como badges de color
   en la tabla de quality checks.
4. **Header pre-llenado**: Nro. pieza, organizacion, cliente, piezas aplicables
   se copian del AMFE.
5. **Navegacion por sidebar**: El panel izquierdo permite navegar entre hojas
   con buscador y estado de completitud.
6. **PDF con preview**: La HO tiene modal de preview PDF antes de exportar
   (a diferencia del CP que exporta directo).

---

## Parte 9: Bugs de Hojas de Operaciones

### HO-B1. Completitud del navigator ignora quality checks [MEDIO]

**Donde**: `modules/hojaOperaciones/HoSheetNavigator.tsx` lineas 16-23
**Verificado en codigo**: Confirmado.

**Problema**: La funcion `isSheetComplete()` solo verifica:
- `steps.length > 0` (tiene pasos)
- `safetyElements.length > 0` (tiene EPP)
- `preparedBy` no vacio
- `approvedBy` no vacio

**Falta verificar**: `qualityChecks.length > 0`. Una hoja se puede marcar como
"completa" (checkmark verde en el navigator) sin tener NINGUNA verificacion de calidad,
lo cual es invalido per IATF 16949 cl.8.5.1.2.

**Fix**: Agregar `sheet.qualityChecks.length > 0` al check de completitud.

---

### HO-B2. Visual aids no ordenadas por campo `order` en PDF [BAJO]

**Donde**: `modules/hojaOperaciones/hojaOperacionesPdfExport.ts` linea 190

**Problema**: `aids.slice(0, MAX_PDF_VISUAL_AIDS)` toma las primeras 6 sin ordenar
por el campo `order` que el usuario puede haber reordenado.

**Fix**: Agregar `.sort((a, b) => a.order - b.order)` antes del `.slice()`.

---

## Parte 10: Problemas de Usabilidad de Hojas de Operaciones

### HO-H1. Pasos de operacion vacios despues de generar [CRITICO]

**Donde**: Seccion "Descripcion de la Operacion" en cada HO generada
**Archivo**: `modules/hojaOperaciones/hojaOperacionesGenerator.ts`

**Problema**: Al generar las HO, la seccion de pasos de manufactura queda
COMPLETAMENTE VACIA. Solo dice "No hay pasos definidos. Agrega pasos para
describir la operacion."

Los pasos son el NUCLEO de una hoja de operaciones — le dicen al operador
QUE hacer paso a paso. Sin pasos, la HO es solo una lista de quality checks
sin contexto operativo.

**Causa tecnica**: La funcion `generateHoFromAmfeAndCp()` crea las hojas con
`steps: []` vacio porque el AMFE no tiene informacion de pasos de manufactura
(el AMFE analiza fallas, no describe el proceso). La informacion de pasos
deberia venir del PFD o ser ingresada manualmente.

**Mejora propuesta**:
- Generar pasos stub desde las operaciones AMFE (al menos: "Realizar [nombre operacion]")
- Si hay PFD generado, importar la secuencia de pasos del PFD
- Mostrar banner claro: "Los pasos de manufactura deben completarse manualmente.
  Describir cada accion que el operador debe realizar."

---

### HO-H2. EPP no seleccionado para operaciones peligrosas [MEDIO]

**Donde**: Seccion "Elementos de Seguridad" en cada HO
**Archivo**: `modules/hojaOperaciones/hojaOperacionesGenerator.ts`

**Problema**: Al generar las HO, todos los iconos de EPP aparecen en gris
(ningun elemento seleccionado), incluso para la operacion "Soldadura MIG"
que obviamente requiere anteojos, guantes, y proteccion auditiva.

**Mejora propuesta**:
- Inferir EPP basico por tipo de operacion usando regex en el nombre:
  - "Soldadura" → anteojos, guantes, delantal, proteccion auditiva
  - "Pintura/E-coat" → respirador, guantes, anteojos
  - "Inspeccion" → anteojos, zapatos seguridad
- O importar EPP desde los work elements del AMFE si existe esa informacion

---

### HO-H3. Columnas "Especificacion", "Resp." y "Registro" vacias [MEDIO]

**Donde**: Tabla "Ciclo de Control" en cada HO
**Archivo**: `modules/hojaOperaciones/HoQualityCheckTable.tsx`

**Problema**: Las 3 columnas del ciclo de control estan vacias en TODAS las hojas:
1. **Especificacion**: Vacia porque el CP no la auto-llena (viene del plano)
2. **Resp.**: Vacia porque el CP no tiene `reactionPlanOwner` (nunca se auto-llena)
3. **Registro**: Siempre vacia (el usuario debe indicar en que planilla registrar)

**Impacto**: La tabla de quality checks tiene 3 de 7 columnas vacias, lo que
da la impresion de que la generacion fue incompleta.

**Mejora propuesta**:
- Agregar placeholders en cada columna:
  - Especificacion: "Segun plano" o "Ver CP"
  - Resp.: "Completar desde CP" o "Operador"
  - Registro: "Ej: Planilla de control diario"
- Cuando el CP tenga esos datos llenados, propagarlos automaticamente a la HO

---

### HO-H4. No hay validacion antes de exportar [MEDIO]

**Donde**: Botones de exportacion en sidebar del navigator
**Archivo**: `modules/hojaOperaciones/HojaOperacionesApp.tsx` lineas 229-259

**Problema**: Al exportar Excel o PDF, no se ejecuta ninguna validacion.
El modulo tiene reglas de validacion en `hojaOperacionesValidation.ts`
(pasos vacios = error, EPP vacio = error, preparedBy vacio = error),
pero la UI nunca las llama antes de exportar.

**Comparacion**: El Plan de Control SI muestra advertencias antes de exportar
Excel (3 warnings sobre campos faltantes). La HO deberia tener el mismo comportamiento.

**Mejora propuesta**: Llamar a `getHoExportErrors()` antes de exportar.
Si hay errores, mostrar modal de advertencia (como hace el CP).

---

### HO-H5. Campo "Registro" sin documentacion para el usuario [BAJO]

**Donde**: Columna "Registro" en la tabla de quality checks
**Archivo**: `modules/hojaOperaciones/HoQualityCheckTable.tsx`

**Problema**: El campo "Registro" es la unica columna editable por el operador
en la tabla de quality checks (las demas vienen del CP). Pero no hay
tooltip, placeholder, ni ayuda que explique que debe contener.

Per IATF 16949, el registro es "el formulario o planilla donde se anotan
los resultados de la medicion" (ej: "PLN-001 Control Dimensional",
"Registro de control de soldadura turno 1").

**Fix**: Agregar placeholder "Ej: PLN-001 Control dimensional" y tooltip
en el header de la columna.

---

### HO-H6. Status "BORRADOR" sin forma de cambiar [BAJO]

**Donde**: Header de cada HO, badge "BORRADOR" naranja
**Archivo**: `modules/hojaOperaciones/HoSheetEditor.tsx`

**Problema**: Cada hoja muestra un badge "BORRADOR" pero no hay forma visible
de cambiarlo a "APROBADO" o "PENDIENTE REVISION". El usuario no sabe
si hay que hacer click en algun lado o si es solo informativo.

**Mejora propuesta**: Hacer el badge clickeable con dropdown de estados:
Borrador → Pendiente Revision → Aprobado.

---

## Parte 11: Escenarios Adicionales CP + HO

### Escenario 7: "Genere el CP y quiero llenar los responsables rapido"
**Actual**: Hay que hacer click en cada celda de "Resp. Reaccion" (26 veces)
y tipear el nombre del responsable uno por uno.
**Ideal**: Boton "Autocompletar" en el header de la columna que aplique un valor
a todas las filas vacias (ej: "Operador de Produccion"), editable despues.

### Escenario 8: "Genere las HO y necesito agregar pasos de manufactura"
**Actual**: Cada hoja tiene boton "Agregar pasos" pero hay que crearlos desde cero
para cada operacion. No hay template ni sugerencias.
**Ideal**: Al generar, crear al menos un paso generico ("Realizar [operacion]
segun instruccion de trabajo IT-XXX"). O permitir copiar pasos de otra hoja.

### Escenario 9: "Quiero exportar el paquete completo APQP para auditor"
**Actual**: Exportar CP (Menu Mas > Excel), cambiar tab a HO, exportar PDF de
cada hoja, volver a AMFE, exportar Excel AMFE, ir a PFD, exportar PDF.
5+ clics y 4 cambios de tab.
**Ideal**: Boton "Exportar Paquete APQP" en cualquier tab que genere un ZIP
con todos los documentos.

### Escenario 10: "Quiero ver que quality checks tiene la Op 10 en el CP"
**Actual**: Estar en el CP, buscar las filas de la operacion 10 scrolleando.
O estar en la HO y ver el "Ciclo de Control".
**Ideal**: Desde la HO, tener un link "Ver en Plan de Control" que lleve
directamente a las filas filtradas del CP para esa operacion.

---

## Parte 12: Plan de Implementacion — CP y HO

### Fase 5: Quick Wins CP + HO (esfuerzo bajo, impacto alto)

- [ ] **CP-B1** Fix completitud context-aware por tipo de fila — 1 hora
- [ ] **HO-B1** Agregar qualityChecks al check de completitud — 15 min
- [ ] **HO-B2** Ordenar visual aids por `order` en PDF — 15 min
- [ ] **HO-H4** Agregar validacion antes de exportar HO — 1 hora
- [ ] **CP-H3** Mostrar titulo AMFE en "AMFE Vinculado" — 30 min
- [ ] **HO-H5** Agregar placeholders al campo "Registro" — 15 min

### Fase 6: Mejoras de Generacion (esfuerzo medio, impacto alto)

- [ ] **HO-H1** Generar pasos stub desde operaciones AMFE — 2-3 horas
- [ ] **HO-H2** Inferir EPP por tipo de operacion (regex) — 2-3 horas
- [ ] **CP-H1** Agregar placeholders en "Espec./Tolerancia" — 30 min
- [ ] **CP-H2** Agregar boton "Llenar todos" para Resp. Reaccion — 2 horas
- [ ] **HO-H3** Agregar placeholders en columnas vacias QC — 30 min

### Fase 7: Mejoras de UX (esfuerzo medio)

- [ ] **CP-H4** Colorear filas por tipo (proceso=azul, producto=verde) — 2 horas
- [ ] **HO-H6** Hacer badge de status clickeable (Borrador/Aprobado) — 1-2 horas
- [ ] **CP-B2** Mejorar fuzzy matching en cross-validation — 2-3 horas

### Fase 8: Features Cross-Modulo (esfuerzo alto)

- [ ] Boton "Exportar Paquete APQP" (ZIP con todos los docs) — 8-12 horas
- [ ] Link "Ver en CP" desde quality checks de HO — 3-4 horas
- [ ] Importar pasos de manufactura desde PFD — 4-6 horas

---
---

# Sesion 3: Analisis de IA Integrada (Copiloto Gemini)

> Auditoria realizada el 2026-03-11
> Metodo: Lectura exhaustiva de los 17+ archivos de codigo de IA, pruebas en Preview
> 1920x1080 con el Ejemplo Completo cargado, evaluacion de prompts, manejo de errores,
> y experiencia de usuario con y sin IA activada.

---

## Parte 13: Inventario Completo de Funcionalidad IA

### 13.1 Arquitectura General

| Componente | Archivo | Modelo | Proposito |
|-----------|---------|--------|-----------|
| Gemini Client | `utils/geminiClient.ts` | gemini-2.5-flash-lite / gemini-2.5-flash | Wrapper central: cache, circuit breaker, timeout |
| AMFE Sugerencias | `modules/amfe/amfeAiSuggestions.ts` | flash-lite (10s timeout) | 7 campos elegibles con autocomplete |
| AMFE Chat Copiloto | `modules/amfe/amfeChatEngine.ts` | flash (60s timeout) | Chat multi-turno, 11 tipos de accion |
| AMFE Auditor | `modules/amfe/amfeAudit.ts` | flash-lite (30s timeout) | Revision IA opcional del AMFE |
| AMFE Cambio | `modules/amfe/amfeChangeAnalysis.ts` | flash-lite (30s timeout) | Analisis de impacto de cambio de proceso |
| CP Sugerencias | `modules/controlPlan/cpAiSuggestions.ts` | flash-lite (10s timeout) | 5 campos elegibles con autocomplete |
| CP Chat Copiloto | `modules/controlPlan/cpChatEngine.ts` | flash (60s timeout) | Chat multi-turno, 6 tipos de accion |
| SuggestableTextarea | `modules/amfe/SuggestableTextarea.tsx` | - | Textarea reutilizable con popover |
| SuggestionPopover | `components/SuggestionPopover.tsx` | - | Dropdown dual: local + Gemini |
| AMFE Chat Panel | `modules/amfe/AmfeChatPanel.tsx` | - | UI del copiloto AMFE (modal) |
| CP Chat Panel | `modules/controlPlan/CpChatPanel.tsx` | - | UI del copiloto CP (modal) |
| Audit Panel | `modules/amfe/AmfeAuditPanel.tsx` | - | UI de auditoria (revision IA) |
| Change Panel | `modules/amfe/AmfeChangeAnalysisPanel.tsx` | - | UI de analisis de cambio |

### 13.2 Campos con Sugerencias IA

**AMFE (7 campos):**
1. `failureDescription` — Modo de falla
2. `cause` — Causa raiz
3. `preventionControl` — Control preventivo
4. `detectionControl` — Control de deteccion
5. `effectLocal` — Efecto local
6. `effectNextLevel` — Efecto en planta cliente
7. `effectEndUser` — Efecto usuario final

**Plan de Control (5 campos):**
1. `controlMethod` — Metodo de control (prevencion)
2. `evaluationTechnique` — Tecnica de evaluacion (deteccion)
3. `sampleSize` — Tamano de muestra
4. `sampleFrequency` — Frecuencia de muestreo
5. `reactionPlan` — Plan de reaccion

### 13.3 Infraestructura Tecnica

**Cache en memoria:**
- TTL: 5 minutos, max 200 entradas por sesion
- Key: hash djb2 del system prompt + user prompt
- Eviccion: las 20 entradas mas antiguas cuando supera 200

**Circuit Breaker:**
- Umbral: 3 fallos consecutivos → 60s de cooldown
- Abortos del usuario NO cuentan como fallos
- Reset automatico al cambiar settings

**Manejo de errores (6 tipos):**
- `NO_KEY`: Sin API key configurada
- `TIMEOUT`: 10s para sugerencias, 60s para chat
- `RATE_LIMIT`: 15 RPM / 1000 RPD (free tier)
- `AUTH_ERROR`: API key invalida (401/403)
- `NETWORK_ERROR`: Error de red generico
- `PARSE_ERROR`: Respuesta de Gemini no parseable (incluye guard HTML)

**Degradacion graciosa:** En TODOS los casos de error de sugerencias, se retorna
array vacio y las sugerencias locales (biblioteca) siguen funcionando normalmente.

---

## Parte 14: Elementos de IA Visibles al Usuario

### 14.1 Elementos SIEMPRE visibles (independientemente de si IA esta activada)

| Elemento | Ubicacion | Descripcion visual |
|----------|-----------|-------------------|
| **Boton "Copiloto IA"** | Toolbar AMFE, extremo derecho | Gradiente violeta/purple, icono Bot, texto "Copiloto IA". MUY prominente. |
| **Boton "Copiloto"** | Toolbar CP, extremo derecho (FAB) | Gradiente verde/emerald, icono Sparkles, texto "Copiloto". Prominente. |
| **78 iconos Sparkles** | Tabla CP, en celdas auto-generadas | Icono purple 12x12px junto a valores como "100%", "Cada pieza", planes de reaccion. |
| **Fondo purple en celdas** | Tabla CP, celdas con `autoFilledFields` | Fondo `bg-purple-50/60` y texto `text-purple-600/70 italic` |
| **Tooltip "Sugerencia auto-generada"** | Tabla CP, hover en celdas autoFilled | Aparece al pasar el mouse |
| **"Analizar Cambio"** | Menu "Mas" del AMFE | Sin indicacion de que usa IA |
| **"Auditar AMFE"** | Menu "Mas" del AMFE | Sin indicacion de que usa IA |
| **Atajo Ctrl+I** | Help panel AMFE y CP | "Abrir/cerrar Copiloto IA" |
| **Referencia en ayuda** | AMFE Help Panel, paso 6 | "Use IA Gemini para sugerencias. El Copiloto puede agregar causas y controles." |

### 14.2 Elementos visibles SOLO cuando IA esta activa

| Elemento | Ubicacion | Cuando aparece |
|----------|-----------|---------------|
| Seccion "Gemini" en popover | SuggestionPopover | Al escribir en campo elegible con IA habilitada |
| Icono Sparkles en popover | SuggestionPopover | Junto a cada sugerencia de Gemini |
| Texto "Consultando Gemini..." | SuggestionPopover | Mientras espera respuesta |
| Loader spinner violeta | SuggestionPopover | Mientras espera respuesta |

### 14.3 Hallazgo critico: Confusion sparkles auto-generado vs IA

**Problema**: Los 78 iconos Sparkles en la tabla del CP usan el campo `autoFilledFields`
que se setea cuando el CP se GENERA desde el AMFE (logica determinista, no IA).
Sin embargo, visualmente son identicos a los iconos de IA (mismo icono Sparkles,
mismo color purple-400), lo que crea una asociacion incorrecta:

- El usuario ve sparkles → piensa "esto lo hizo la IA"
- En realidad lo hizo el generador automatico (sin IA)
- La palabra "auto-generada" en el tooltip refuerza la confusion
- El fondo purple y texto italico sugieren "provisional / no confiable"

**Impacto en confianza**: En un software de ingenieria de calidad automotriz,
cada numero y control tiene implicancias regulatorias. Si el usuario percibe
que los valores "100%" y "Cada pieza" fueron "generados por IA" en vez de
"derivados del AMFE segun reglas AIAG", puede desconfiar de datos que en
realidad son correctos y derivados de un algoritmo determinista.

---

## Parte 15: Evaluacion del Copiloto como Usuario Real

### 15.1 AMFE Chat Copilot — Lo que funciona bien

1. **Flujo Aplicar/Rechazar**: La IA propone acciones y el usuario decide. Nunca se modifica
   el documento sin consentimiento explicito. Esto es excelente para confianza.
2. **Action Cards**: Cada accion propuesta se muestra como tarjeta visual con path completo
   (ej: "Soldadura > Machine > Aplicar cordon"). El usuario sabe exactamente que se va a tocar.
3. **Error handling claro**: Mensajes de error en espanol con instrucciones especificas
   (ej: "Configurá tu API key con el botón ⚙ de arriba").
4. **Ejemplo prompts utiles**: Los 4 prompts de ejemplo cubren los casos tipicos
   (agregar falla, cambiar severidad, agregar control, agregar operacion completa).
5. **Multi-turno funcional**: Historial de hasta 10 turnos (20 mensajes) con trim automatico.
6. **AP auto-calculado**: Cuando la IA agrega/modifica S, O, D, el AP se recalcula.
7. **Validacion de duplicados**: Detecta operaciones duplicadas y sugiere usar update.
8. **Cancelacion**: Boton "Cancelar" durante la espera. AbortController correcto.

### 15.2 AMFE Chat Copilot — Problemas encontrados

| # | Problema | Severidad | Detalle |
|---|---------|-----------|---------|
| IA-1 | Copiloto se abre sin API key configurada | MEDIO | El modal se abre completo, muestra prompts de ejemplo, y recien cuando el usuario envia un mensaje descubre que falta la key. Deberia advertir ANTES de permitir escribir. |
| IA-2 | Settings dentro del copiloto son confusos | MEDIO | El toggle "Sugerencias con IA" y la API key estan DENTRO del copiloto. Si el usuario deshabilita las sugerencias ahi, tambien afecta el autocomplete en los campos del AMFE (son la misma setting). No hay separacion visual. |
| IA-3 | No hay preview del documento ANTES de aplicar | BAJO | Las Action Cards muestran que se va a hacer, pero no muestran el resultado final. Un preview "antes/despues" seria mas claro. |
| IA-4 | Prompts de ejemplo no se adaptan al contexto | BAJO | Los 4 prompts son estaticos. Si el AMFE no tiene soldadura, "Agrega modo de falla de porosidad en soldadura" sigue apareciendo. Podrian adaptarse a las operaciones existentes. |

### 15.3 Plan de Control Chat Copilot

**Funciona igual que el AMFE** con 6 acciones especificas:
- `addItem`, `updateItem`, `removeItem`, `bulkUpdate`, `suggestControls`, `validateCP`

**Problemas adicionales:**
- Mismos problemas IA-1 e IA-2 del AMFE
- El boton se llama "Copiloto" (sin "IA") en el CP pero "Copiloto IA" en el AMFE — inconsistencia

### 15.4 Sugerencias en campos (Autocomplete)

**Lo que funciona bien:**
- Dual-source: primero muestra biblioteca local (instantaneo), luego Gemini (async)
- Debouncing correcto: 150ms local, 500ms IA
- Minimo 3 caracteres para IA (evita queries vacias)
- Anti-context: no sugiere valores que ya existen en el AMFE
- 14 vocabularios de proceso especificos (soldadura, pintura, mecanizado, etc.)
- Hints por severidad, ocurrencia, deteccion (adapta sugerencias al nivel de riesgo)

**Problemas:**
| # | Problema | Severidad |
|---|---------|-----------|
| IA-5 | Popover "Gemini" visible sin API key | BAJO | Si la IA esta habilitada pero sin key, se ve "Consultando Gemini..." y luego desaparece silenciosamente. No hay feedback de que falta la key. |
| IA-6 | "IA Gemini" como fuente en sugerencias | MEDIO | Cada sugerencia IA dice `source: "IA Gemini"`. Un ingeniero de calidad ve "IA" junto al texto y puede desconfiar. Deberia decir algo como "Sugerencia tecnica" o no mostrar la fuente. |

---

## Parte 16: Calidad Tecnica de las Sugerencias

### 16.1 System Prompts — Evaluacion

**AMFE System Prompt**: EXCELENTE
- Define la escala AIAG-VDA completa (S, O, D, AP)
- Incluye estructura 6M con ejemplos por categoria
- Ejemplos especificos por proceso (soldadura, ensamble, pintura, mecanizado, inyeccion, inspeccion)
- Vocabulario tecnico correcto en espanol
- Formato JSON estricto de respuesta

**CP System Prompt**: EXCELENTE
- Relacion AMFE → CP documentada (IATF 16949 cl.8.5.1.1)
- Reglas por AP (H/M/L) para control method, sample, frequency
- Reglas por severidad para plan de reaccion
- Vocabulario tecnico correcto (Poka-Yoke, SPC, CMM, etc.)

### 16.2 Prompt Builders — Evaluacion

**Los prompts por campo son sofisticados:**
- `processVocabHint()`: 14 vocabularios de manufactura (soldadura, ensamble, etc.)
- `severityHint()`: Adapta rigurosidad segun S (>=9 critico, 7-8 alto, <=6 moderado)
- `occurrenceHint()`: Adapta prevencion segun O
- `detectionHint()`: Adapta deteccion segun D
- `antiContext()`: Evita repetir valores existentes
- `apHint()`: Adapta controles segun AP del AMFE
- `phaseHint()`: Adapta segun fase (safe launch, prototype, pre-launch)

**Calificacion general**: Los prompts son de alta calidad tecnica. Un ingeniero
de calidad automotriz reconoceria la terminologia AIAG-VDA correcta. Las sugerencias
NO son genericas — estan contextualizadas al proceso, severidad, y riesgo.

### 16.3 Limitaciones tecnicas de las sugerencias

1. **Modelo flash-lite**: gemini-2.5-flash-lite es el modelo mas basico. Para respuestas
   JSON simples de 5 sugerencias funciona bien, pero podria generar respuestas menos
   precisas que flash completo para contextos complejos.
2. **Sin validacion de dominio**: Las sugerencias no se validan contra una base de datos
   de controles conocidos. La IA podria sugerir un control que no existe (ej: un tipo
   de sensor que no es standard).
3. **Free tier**: 15 RPM / 1000 RPD limita el uso intensivo. Un AMFE grande con
   50+ causas agotaria rapidamente el limite diario si el usuario usa mucho autocomplete.

---

## Parte 17: Evaluacion UX sin IA Activada

### 17.1 Que ve el usuario que NO quiere IA

Incluso con `geminiEnabled: false` en settings:

| Elemento visible | Impacto en confianza |
|-----------------|---------------------|
| Boton "Copiloto IA" en toolbar AMFE | ALTO NEGATIVO — El usuario ve un boton prominente purple con "IA" en un software de precision. Genera la pregunta "¿este software depende de IA?" |
| Boton "Copiloto" en toolbar CP | MEDIO NEGATIVO — Menos prominente que el AMFE pero sigue visible |
| 78 sparkles en tabla CP | ALTO NEGATIVO — El usuario ve iconos de "varita magica" junto a valores criticos como "100%" o "Detener linea". No hay forma de saber que son auto-generados (sin IA). |
| Fondo purple + texto italico en CP | MEDIO NEGATIVO — Sugiere que los valores son "provisionales" o "no confiables" |
| "Analizar Cambio" en menu Mas | BAJO — No dice "IA" pero falla sin key |
| "Auditar AMFE" en menu Mas | BAJO — Parte determinista funciona sin IA |
| Ctrl+I atajo documentado | BAJO — Solo en help panel |
| Referencia "IA Gemini" en ayuda | BAJO — Solo si el usuario lee el help |

### 17.2 Conclusion sobre UX sin IA

**El software NO se ve profesional sin la IA activada** porque:

1. El boton "Copiloto IA" SIEMPRE esta visible en el toolbar del AMFE, sin importar
   la configuracion. Es imposible "esconder" la IA.
2. Los 78 sparkles en el Plan de Control son visibles SIEMPRE porque no dependen
   del setting `geminiEnabled` sino de `autoFilledFields` (generacion desde AMFE).
3. Un auditor o cliente que vea sparkles + "Copiloto IA" en un software IATF 16949
   podria cuestionar la integridad de los datos ("¿la IA llenó estos campos?").

---

## Parte 18: Plan de Accion — Tres Opciones

### Opcion A: Eliminar la IA por Completo

**Que se elimina:**

| Archivo | Accion |
|---------|--------|
| `utils/geminiClient.ts` | Eliminar completo |
| `modules/amfe/amfeAiSuggestions.ts` | Eliminar completo |
| `modules/amfe/amfeChatEngine.ts` | Eliminar completo |
| `modules/amfe/AmfeChatPanel.tsx` | Eliminar completo |
| `modules/amfe/amfeAudit.ts` | Eliminar solo `requestAiReview()`, mantener auditor determinista |
| `modules/amfe/amfeChangeAnalysis.ts` | Eliminar completo |
| `modules/amfe/AmfeAuditPanel.tsx` | Eliminar seccion de revision IA |
| `modules/amfe/AmfeChangeAnalysisPanel.tsx` | Eliminar completo |
| `modules/controlPlan/cpAiSuggestions.ts` | Eliminar completo |
| `modules/controlPlan/cpChatEngine.ts` | Eliminar completo |
| `modules/controlPlan/CpChatPanel.tsx` | Eliminar completo |
| `modules/controlPlan/cpSuggestionTypes.ts` | Eliminar completo |
| `modules/controlPlan/cpSuggestionEngine.ts` | Mantener solo motor local |
| `components/SuggestionPopover.tsx` | Simplificar: eliminar seccion "Gemini", solo mostrar biblioteca |
| `modules/amfe/SuggestableTextarea.tsx` | Simplificar: eliminar props de IA |
| `modules/amfe/amfeSuggestionEngine.ts` | Mantener solo motor local |
| `utils/settingsStore.ts` | Eliminar `geminiApiKey` y `geminiEnabled` |
| `utils/repositories/settingsRepository.ts` | Limpiar AppSettings type |
| `modules/amfe/AmfeToolbar.tsx` | Eliminar boton "Copiloto IA" |
| `modules/controlPlan/CpToolbar.tsx` | Eliminar boton "Copiloto" |
| `modules/controlPlan/ControlPlanTable.tsx` | Eliminar sparkles de `autoFilledFields` |
| `modules/controlPlan/ControlPlanApp.tsx` | Eliminar FAB "Copiloto" |
| `modules/amfe/AmfeApp.tsx` | Eliminar estados `showChat`, `aiEnabled` |
| `modules/amfe/AmfeHelpPanel.tsx` | Eliminar referencia a IA/Copiloto |
| `modules/controlPlan/CpHelpPanel.tsx` | Eliminar referencia a IA/Copiloto |
| `__tests__/` (4 archivos test IA) | Eliminar tests de IA |
| `package.json` | Eliminar `@google/generative-ai` |

**Esfuerzo estimado:** 25+ archivos a modificar/eliminar. ~6-10 horas de trabajo.
**Riesgo:** Bajo — la IA no esta entrelazada con la logica core.
**Beneficio:** Software 100% determinista. Cero dependencias externas. Cero dudas
de auditores. Eliminacion de ~3000 lineas de codigo y 1 dependencia npm.

---

### Opcion B: IA Invisible por Defecto (Recomendada)

**Filosofia**: La IA existe pero NO se ve hasta que el usuario la habilita
explicitamente en Configuracion. Cero sparkles, cero botones, cero menciones
de "IA" en la UI por defecto.

**Cambios necesarios:**

| Cambio | Archivo | Detalle |
|--------|---------|---------|
| Ocultar boton "Copiloto IA" | `AmfeToolbar.tsx` | Renderizar SOLO si `aiEnabled === true` |
| Ocultar boton "Copiloto" | `CpToolbar.tsx`, `ControlPlanApp.tsx` | Renderizar SOLO si `aiEnabled === true` |
| Eliminar sparkles de autoFill | `ControlPlanTable.tsx` | Eliminar TODOS los iconos Sparkles de campos auto-generados. Usar indicador neutro (ej: tooltip "Derivado del AMFE" sin icono). |
| Eliminar fondo purple | `ControlPlanTable.tsx` | Los valores auto-generados deben verse iguales a los manuales. Sin fondo, sin italica. |
| Ocultar seccion Gemini en popover | `SuggestionPopover.tsx` | No mostrar seccion "Gemini" si IA no esta habilitada |
| Mover settings de IA | Crear seccion en Settings global | Actualmente la config esta DENTRO del copiloto. Moverla a una pantalla de Configuracion accesible desde el menu principal. |
| Default: `geminiEnabled: false` | `settingsRepository.ts` | Cambiar default de `true` a `false` |
| Ocultar "Analizar Cambio" | `AmfeToolbar.tsx` (menu Mas) | Ocultar si IA deshabilitada, o mostrar con advertencia |
| Agregar indicador en Audit | `AmfeAuditPanel.tsx` | La parte determinista siempre funciona. La revision IA se muestra solo si habilitada. |
| Limpiar help panels | `AmfeHelpPanel.tsx`, `CpHelpPanel.tsx` | Condicionar menciones de IA segun `aiEnabled` |
| Eliminar atajo Ctrl+I | Condicionalmente | Solo registrar si IA habilitada |

**Esfuerzo estimado:** ~12 archivos a modificar. ~4-6 horas de trabajo.
**Riesgo:** Bajo — solo se cambia visibilidad condicional.
**Beneficio:**
- Software profesional por defecto (sin rastro de IA)
- Usuarios que QUIEREN IA la activan desde Configuracion
- Auditores no ven menciones de IA a menos que el usuario las active
- Se conserva todo el codigo — nada se pierde
- Si el usuario habilita IA, tiene TODA la funcionalidad disponible

---

### Opcion C: Mejorar la IA

**Filosofia**: Mantener la IA visible pero mejorarla para que genere mas confianza.

**Cambios necesarios:**

| Cambio | Archivo | Detalle |
|--------|---------|---------|
| Renombrar sparkles a "Derivado del AMFE" | `ControlPlanTable.tsx` | Cambiar icono Sparkles por icono Link o ArrowRight. Tooltip: "Valor derivado del AMFE automaticamente". |
| Renombrar boton "Copiloto IA" | `AmfeToolbar.tsx` | Cambiar a "Asistente" o "Herramientas IA" — menos intimidante |
| Cambiar fuente "IA Gemini" | `amfeAiSuggestions.ts`, `cpAiSuggestions.ts` | Cambiar `source: "IA Gemini"` a `source: "Sugerencia tecnica"` |
| Verificar API key al abrir copiloto | `AmfeChatPanel.tsx`, `CpChatPanel.tsx` | Si no hay key, mostrar banner "Configura tu API key para usar el copiloto" en vez de permitir escribir |
| Prompts de ejemplo dinamicos | `AmfeChatPanel.tsx` | Adaptar a las operaciones existentes del AMFE |
| Consistencia de nombre | `CpToolbar.tsx` vs `AmfeToolbar.tsx` | Usar el mismo nombre en ambos modulos |
| Indicar IA en menu Mas | `AmfeToolbar.tsx` | Agregar badge "IA" a "Analizar Cambio" y "Auditar AMFE" |
| Upgrade modelo para chat | `geminiClient.ts` | Considerar gemini-2.5-flash para sugerencias tambien (mejor calidad) |

**Esfuerzo estimado:** ~10 archivos a modificar. ~4-6 horas de trabajo.
**Riesgo:** Medio — requiere probar que los cambios de nombre no rompan logica.
**Beneficio:**
- IA mas profesional y menos intimidante
- Mejor UX para usuarios que SI quieren IA
- Sparkles correctamente identificados como "derivado del AMFE"

---

## Parte 19: Recomendacion

### Recomendacion: Opcion B (IA Invisible por Defecto)

**Razones:**

1. **Prioridad del usuario**: La preocupacion principal es que botones de IA visibles
   generan desconfianza en un software de ingenieria de calidad. La Opcion B elimina
   TODA visibilidad de IA por defecto.

2. **No se pierde nada**: A diferencia de la Opcion A (eliminar), la Opcion B conserva
   todo el codigo de IA. Si en el futuro se decide usar IA o se vende el software a
   usuarios que la quieran, esta disponible con un click en Configuracion.

3. **Los sparkles son el problema mas urgente**: Los 78 iconos Sparkles en el Plan de
   Control son el hallazgo mas critico. NO son de IA pero PARECEN serlo. Eliminarlos
   es independiente de si se conserva o no la IA — cualquier opcion debe hacerlo.

4. **Esfuerzo moderado**: ~4-6 horas vs ~6-10 horas de la Opcion A, con mejor resultado
   (conservar funcionalidad vs perderla).

5. **Default correcto**: `geminiEnabled: false` por defecto es lo seguro. Quien quiera
   IA la activa conscientemente.

### Orden de implementacion sugerido

1. **URGENTE**: Eliminar sparkles y fondo purple de `autoFilledFields` en CP (30 min)
2. **URGENTE**: Cambiar default `geminiEnabled` de `true` a `false` (5 min)
3. **ALTO**: Ocultar boton "Copiloto IA" si IA deshabilitada (30 min)
4. **ALTO**: Ocultar boton "Copiloto" en CP si IA deshabilitada (30 min)
5. **MEDIO**: Ocultar seccion Gemini en SuggestionPopover si IA deshabilitada (15 min)
6. **MEDIO**: Mover settings de IA a pantalla de Configuracion global (2-3 horas)
7. **BAJO**: Limpiar help panels de menciones de IA (30 min)
8. **BAJO**: Condicionar "Analizar Cambio" y "Auditar" en menu Mas (30 min)
