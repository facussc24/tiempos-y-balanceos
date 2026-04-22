---
description: Reglas del modulo AMFE (severidades, CC/SC, efectos, familias)
globs:
  - "modules/amfe/**/*.ts"
  - "modules/amfe/**/*.tsx"
---

# AMFE VDA

## Severidades calibradas — piezas de cabina interior (Insert, Armrest, Top Roll, Headrest)

| Rango | Aplica a | Ejemplos |
|-------|----------|----------|
| S=9-10 | Flamabilidad, emisiones VOC, interferencia airbag, bordes filosos | TL 1010 VW, normativa REACH |
| S=7-8 | Falla de encastre severa que para linea VW, desprendimiento en campo | Clips rotos, deformacion estructural |
| S=5-6 | Arrugas masivas, delaminacion, costura torcida, Squeak & Rattle, retrabajo offline | Burbuja en termoformado, costura corrida |
| S=3-4 | Cosmetico menor, hilo suelto, mancha limpiable, retrabajo in-station | Color desparejo visible solo con luz rasante |

## Clasificacion CC/SC

- **CC (Critica):** S >= 9 O requerimiento legal/seguridad. Benchmark: 1-5% de items.
- **SC (Significativa):** Cliente designo con simbolo O funcion primaria (S=7-8 encastre). Benchmark: 10-15%.
- **Estandar:** Todo lo demas. Benchmark: 80-90%.
- "Quitar pieza durante tapizado" NO es CC — riesgo al operador se gestiona con EPP, no con clasificacion de producto.
- Flamabilidad es OBLIGATORIA como CC en toda pieza de cabina interior.

## Normas de flamabilidad por cliente

- La norma de flamabilidad es ESPECIFICA por cliente:
  - VW (VWA): TL 1010
  - Toyota/PWA: norma propia del cliente (NO es TL 1010)
- NUNCA poner TL 1010 en productos que no son VW.
- Cada cliente tiene sus propias normas de materiales, tolerancias y ensayos. No extrapolar normas de un cliente a otro.

## Efectos VDA — 3 niveles obligatorios

Todo modo de falla DEBE tener los 3 campos completados:
- `effectLocal` — efecto en la operacion actual
- `effectNextLevel` — efecto en la operacion siguiente o ensamble
- `effectEndUser` — efecto para el usuario final del vehiculo

NUNCA dejar ningun nivel vacio.

## Prioridad de Accion (AP)

- AP=H SIEMPRE requiere accion con responsable, fecha y estado.
- Sin excepcion: si AP=H y no hay accion definida, es un error grave.

## Familias de producto

- UN solo AMFE por familia de producto si el proceso es identico.
- Ejemplo: 4 colores del mismo headrest = 1 AMFE con todos los part numbers en `applicableParts`.
- NO crear AMFEs separados para variantes de color con proceso identico.

## Elementos de Trabajo (Work Elements) — Regla 1M por linea

### Regla AIAG-VDA 2019: UN solo elemento por fila
- Cada Work Element DEBE ser UN SOLO item de las 4M/6M (Material, Maquina, Metodo, Mano de obra, Medio ambiente, Medicion)
- PROHIBIDO agrupar multiples items en un solo WE: "Material: Tela / Hilos / Refuerzos" es INCORRECTO
- Cada material/maquina/etc. va en su propia fila con su propia cadena de funcion → falla → causa
- Ejemplo correcto:
  - WE 1: "Material: Tela termoformable" → funcion: "Proveer cobertura estetica" → fallas propias de la tela
  - WE 2: "Material: Hilo de costura" → funcion: "Unir piezas cosidas" → fallas propias del hilo
  - WE 3: "Material: Refuerzos" → funcion: "Proveer rigidez estructural" → fallas propias del refuerzo
- Ejemplo INCORRECTO: "Material: Tela / Hilo / Refuerzos" (destruye el hilo digital del AMFE)

### Materiales Directos vs Indirectos en operaciones de proceso
- En operaciones de proceso (NO recepcion), la categoria "Material" de las 4M/6M se refiere tipicamente a materiales INDIRECTOS (aceite, grasa, pegamento, concentracion de lavado)
- El estandar ASUME que los materiales directos (tela, hilo, sustrato) llegan correctos del proveedor
- Los riesgos de materiales directos se evaluan en:
  - OP 10 Recepcion de Materia Prima (inspeccion de entrada)
  - DFMEA (AMFE de Diseno, no de Proceso)
- Solo listar materiales directos como WE en una estacion de proceso cuando:
  - Existe riesgo de que el operador cargue material equivocado (color, tipo)
  - El material puede danarse/contaminarse durante manipuleo en esa estacion
  - Historial de problemas recurrentes con proveedor en inspeccion de entrada

## Operaciones condicionales por variante

- Operaciones que no aplican a todos los PN de la familia: marcar "(Aplica solo a PN X, Y, Z)" en el nombre de la operacion. NUNCA crear documentos separados por esto.
- Ejemplo headrests: Costura Vista aplica solo a L1/L2/L3 (Rennes Black, Andino Gray, Dark Slate), no a L0 (Titan Black). Se documenta en 1 solo AMFE/CP/HO con la restriccion en el nombre.
- La HO de la operacion condicional debe incluir instruccion explicita de verificar numero de parte antes de ejecutar.

## PROHIBIDO: "Capacitacion" como causa de falla

- NUNCA poner "Falta de capacitacion", "Falta de entrenamiento", "Operario no capacitado" como causa.
- Se ASUME que los operarios SIEMPRE estan capacitados (requisito IATF 16949).
- La causa REAL debe ser defecto del PROCESO, METODO o SISTEMA (ej: "Instruccion de trabajo incompleta").
- "Capacitacion" SI puede aparecer como CONTROL DE PREVENCION (es control conductual), pero:
  - Es control CONDUCTUAL -> asignar O=7-8 si es el unico control preventivo
  - Para bajar O a 4 o menos -> necesita controles TECNICOS (poka-yoke, scanner, sensor)
  - Un auditor IATF la considerara insuficiente sola

## Funcion del Item (focusElementFunction) — 3 FUNCIONES OBLIGATORIAS

`op.focusElementFunction` requiere 3 perspectivas (AIAG-VDA):
1. **Funcion INTERNA (tu planta):** que hace la pieza en Barack (ensamble, encastre, integridad bordes)
2. **Funcion CLIENTE (OEM):** que hace en la linea del cliente (montaje, Gap & Flush, fuerza insercion)
3. **Funcion USUARIO FINAL:** que hace para el conductor (estetica, confort, seguridad airbag, S&R)

Es la MISMA para todas las operaciones del mismo AMFE. Separar con " / ".

## Material en 6M — SOLO indirectos de proceso

- Material 6M = adhesivo, grasa, solvente, concentracion lavado (indirectos de proceso)
- Clips, film, etiquetas, tornillos = COMPONENTES -> van en WE tipo "Man" (riesgo de error humano)
- Materiales directos (tela, hilo, sustrato, plastico) -> solo en OP 10 Recepcion
- Quimicos de proceso (primer, fenoclor) -> SI van como Material 6M (son indirectos)

## Reglas especificas

- "Remito" NO es una operacion de proceso interno. Solo aplica en Recepcion de MP.
- "Almacenamiento WIP" NO es operacion de proceso. No debe tener AMFE propio.
- Transporte interno NO es operacion con controles.

## Escala de Ocurrencia (O) — guia de asignacion

| O | Significado | Ejemplo tipico (piezas interiores) |
|---|-------------|-----------------------------------|
| 10 | Muy alta, falla inevitable | Proceso sin control alguno |
| 8-9 | Alta, fallas frecuentes | Falla en 5-10% de produccion |
| 6-7 | Moderada, fallas ocasionales | Costura saltada 1-2 veces/semana |
| 4-5 | Baja, fallas infrecuentes | Problema 1 vez/mes |
| 2-3 | Muy baja, fallas raras | Problema 1-2 veces/ano |
| 1 | Remota, casi imposible | Nunca ocurrio en la historia del proceso |

## Escala de Deteccion (D) — guia de asignacion

| D | Significado | Ejemplo tipico |
|---|-------------|---------------|
| 10 | No hay deteccion | Sin control, sin inspeccion |
| 8-9 | Deteccion muy baja | Solo se detecta en campo |
| 6-7 | Deteccion moderada | Inspeccion visual cada lote |
| 4-5 | Deteccion buena | Inspeccion 100% visual + dimensional |
| 2-3 | Deteccion muy buena | Poka-Yoke o inspeccion automatica |
| 1 | Deteccion casi perfecta | Sensor automatico con interlock (para linea) |

## Campos de AmfeCause — documentacion completa

### characteristicNumber
- Numero secuencial de caracteristica dentro de la operacion (ej: "1", "2", "3")
- Se reinicia en cada operacion
- Formato: string numerico sin prefijos
- Vinculo con ControlPlanItem.characteristicNumber

### specialChar
- Valores validos: `"CC"` (Critica), `"SC"` (Significativa), `""` (estandar)
- Override manual: si se llena explicitamente, toma prioridad sobre el calculo automatico
- Calculo automatico: S>=9 → "CC", S=7-8 (funcion primaria) → "SC", otro → ""
- NUNCA poner otros valores como "CRITICO", "C", "S", etc.

### filterCode
- Campo libre para filtrado/agrupacion de causas en documentos grandes
- NO se usa en calculo de AP ni en generacion de CP
- Uso tipico: codigo de area, codigo de proceso, o referencia interna

## Campos deprecados (NO USAR)

AmfeFailure tiene 13 campos @deprecated (effect, cause, preventionControl, etc.)
que fueron migrados a AmfeCause[]. La funcion `migrateFailureToCausesModel` en
`amfeValidation.ts` maneja la migracion automaticamente.
Al crear o modificar datos, SIEMPRE usar `failure.causes[]` — NUNCA los campos
deprecados del failure.

## Validaciones preventivas (pre-guardado)

El modulo AMFE tiene validacion automatica antes de cada guardado (`amfeValidation.ts`).
7 reglas, sensibles al estado del documento:

| # | Regla | Draft/InReview | Approved/Archived |
|---|-------|----------------|-------------------|
| A1 | S/O/D parciales (al menos 1 llenado pero no los 3) | warning | bloqueo |
| A2 | AP=H sin acciones correctivas | warning | bloqueo |
| A3 | Modo de falla con descripcion pero sin causas | warning | bloqueo |
| A4 | Causa con ratings pero sin control prevencion ni deteccion | warning | bloqueo |
| A5 | Efectos 3-niveles VDA incompletos | warning | bloqueo |
| A6 | CC marcado con S<9 (salvo flamabilidad/legal) | warning | bloqueo |
| A7 | SC con S<7 (sospechoso de formula vieja) | warning siempre | warning siempre |

Keywords exentos para A6: flamabilidad, flamable, tl 1010, voc, emisiones, airbag, legal, seguridad.

## Acciones de optimizacion
Ver regla completa en `.claude/rules/amfe-actions.md`.
RESUMEN: NUNCA inventar acciones. Solo el equipo humano las define.

## Valores numericos (pesos, tolerancias, consumos)
NUNCA confirmar ni conservar valores numericos sin confirmacion explicita de Fak.
En caso de duda: TBD. Solo Fak valida datos de ingenieria.

## Campos legacy a nivel failure — MANTENER SINCRONIZADOS con cause[]

AmfeFailure tiene campos @deprecated segun VDA 2019 (severity, occurrence, detection, ap, preventionControl, detectionControl, specialChar, classification, effect, etc.) que fueron migrados a `AmfeCause[]`. El modulo AMFE moderno lee de `cause[]`, pero **exports legacy, UIs antiguas y reportes pueden todavia leer `fm.X`**. Si ese campo esta vacio mientras `cause[].X` tiene valor, aparecen celdas en blanco en Excel/PDF.

**Reglas obligatorias:**
- Si una failure tiene al menos 1 causa con severity/occurrence/detection, `fm.severity/occurrence/detection` **NO pueden quedar vacios**. Deben contener el max de las causas.
- Lo mismo aplica a `fm.preventionControl`, `fm.detectionControl`, `fm.specialChar`, `fm.ap`, etc.
- **Automatizacion**: `saveAmfe()` en `scripts/_lib/amfeIo.mjs` llama a `syncLegacyFmFields(doc)` ANTES de escribir. No hace falta hacerlo a mano — pero SI escribis por fuera de saveAmfe (raw `.update()`), correrlo manualmente.
- **Gate**: `amfeValidator.mjs` tiene check `FM_LEGACY_EMPTY_BUT_CAUSE_HAS_VALUE` (critical). `runWithValidation` bloquea `--apply` si algun script introduce este gap.

**Incidente 2026-04-22**: Fak detecto en export de OP80 Telas Planas (AMFE-1) celdas vacias en columna severidad. 35 failures con fm.severity="" mientras cause[].severity tenia valor. Resuelto con syncLegacyFmFields + check validator. Script one-shot: `_syncLegacyFmFields.mjs`.

## Schema de campos AMFE — OBLIGATORIO para scripts .mjs

Los scripts .mjs DEBEN usar AMBOS nombres de campo (alias). El TypeScript usa unos, el export Excel usa otros. Si falta uno, el export se rompe.

### AmfeOperation (los 2 aliases son OBLIGATORIOS)
- `opNumber` + `operationNumber` (AMBOS, identicos)
- `name` + `operationName` (AMBOS, identicos)
- `focusElementFunction`, `operationFunction`
- `workElements[]`

### AmfeWorkElement
- `name` (NO usar "description" — campo inexistente)
- `type` ("Machine", "Man", "Method", "Material", "Measurement", "Environment")
- `functions[]`

### AmfeFunction
- `description` + `functionDescription` (AMBOS)
- `requirements` (puede ser vacio)
- `failures[]`

### AmfeCause
- `ap` + `actionPriority` (AMBOS, identicos)
- `cause` + `description` (AMBOS — "cause" es el texto de la causa)
- `severity`, `occurrence`, `detection` (numeros)
- `preventionControl`, `detectionControl`
- `specialChar`, `characteristicNumber`, `filterCode`

**INCIDENTE 2026-04-08:** Scripts usaron nombres de campo incorrectos (description vs name, operationNumber sin opNumber). Rompieron el export Excel completamente. SIEMPRE verificar contra un WE existente que funcione antes de crear nuevos.

## Guias obligatorias

Leer ANTES de modificar datos AMFE:
- `docs/GUIA_AMFE.md` — guia de autoria completa
- `docs/ERRORES_CONCEPTUALES_APQP.md` — errores graves ya detectados, NO repetirlos

## Maestros vs Familias (Library de AMFEs Maestros)

El panel "Maestros" distingue 2 conceptos AIAG-VDA 2019. NO mezclar:

1. **AMFEs de Fundacion (Procesos Base):** procesos genericos NO vinculados a producto especifico (Inyeccion Plastica, Costura, Tapizado, Ultrasonido). Son familias **SIN** productos vinculados (`memberCount=0`). Capturan conocimiento base de la organizacion sobre una tecnologia.
2. **AMFEs de Familia (Productos):** familias de producto que comparten proceso (Insert, Armrest, Top Roll, etc.). Son familias **CON** productos vinculados (`memberCount>0`). Especializados.

Titulo correcto del panel: "Libreria de AMFEs Maestros" (no "Procesos Maestros"). La distincion en la DB es `memberCount`.

## Terminologia Barack — SCRAP se queda

La palabra **"SCRAP"** se mantiene en PFDs y documentacion Barack. NO traducir a "DESCARTE", aunque otras reglas pidan "cero ingles".

- "SCRAP" en disposicion de rechazos (OP manufactura): NUNCA cambiar.
- La regla "cero ingles" aplica a descripciones de operaciones, NO a disposiciones tecnicas estandar de planta.
- Excepciones similares probables: palabras tecnicas especificas de industria (KLT, PPAP, Rework si se usa).
- Antes de "traducir" o "corregir" terminologia aparentemente inglesa: confirmar con Fak.
- **Principio meta:** NotebookLM y reglas externas son referencia. Fak es autoridad final en contexto Barack. Si conflicto referencia vs Fak, priorizar Fak.

## Lenguaje simple en AMFE/CP/HO — OBLIGATORIO

Textos en AMFE, CP y HO deben ser **CORTOS y SIMPLES**. Fak encontro descripciones como "Retirar el sistema de alimentacion sin dejar rebaba residual ni bebedero visible en el punto de inyeccion de la pieza" cuando debia decir "Cortar la colada sin dejar marca en la pieza".

Reglas de redaccion:
- **Maximo 8-10 palabras** por campo cuando sea posible.
- NO explicar lo obvio (si dice "Calibre", NO agregar "para verificar cumplimiento de tolerancias criticas segun plano").
- NO sinonimos rebuscados: "residual", "insuficiencia", "inadecuada", "desalineada" — sacar.
- Causa = que salio mal, 3-5 palabras: "Dosificacion corta" NO "Volumen de inyeccion demasiado bajo (dosificacion corta) respecto al tamano de pieza".
- Control = que se hace, 3-5 palabras: "Dossier + alarmas en panel" NO "Dossier de parametros validado + panel de la inyectora con alarmas configuradas por zona".
- Funcion = para que sirve, 5 palabras: "Mesa de control con buena luz" NO "Proveer superficie estable y bien iluminada para el control visual y dimensional".
- NO parentesis con aclaraciones obvias.
- Si dudas entre larga y corta, elegi la corta.
- NO palabras tecnicas rebuscadas que Fak no use: "husillo" -> "tornillo".
- **Regla:** si Fak no la dijo, NO la uses. Usar las mismas palabras que usa Fak.

## Verificar contenido antes de clasificar o propagar

NO confiar en el nombre de la operacion para clasificar su tipo. SIEMPRE leer las primeras fallas/causas del WorkElement para verificar el proceso real.

**Incidente 2026-04-20:** Headrest AMFE tiene OP 40 rotulada "INYECCION DE SUSTRATO" pero las fallas son todas de costura ("Costura desviada", "Falta de guia en costura"). Si hubiera leido esto antes, no habria propagado el maestro de inyeccion plastica a Headrest ni reportado falsamente que tiene inyeccion.

**How to apply:**
- Antes de correr sync scripts entre documentos: leer 1-2 fallas del origen/destino para confirmar tipo de proceso.
- Antes de reportar un hallazgo basado en el nombre de una OP: leer al menos la primera falla.
- Antes de cambiar nombre/clasificacion: leer contenido completo y verificar con Fak.
- "INYECCION" en el nombre puede significar: plastica (termoplasticos), PU (espuma), de sustrato (ambiguo), o estar mal rotulado.
