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

- NUNCA poner "Falta de capacitacion", "Falta de entrenamiento", "Operario no capacitado" como causa de falla.
- Se ASUME que los operarios SIEMPRE estan capacitados (requisito IATF 16949).
- Si la causa fuera "falta de capacitacion", la solucion es "capacitar" → loop infinito sin control real.
- La causa REAL debe ser un defecto del PROCESO, METODO o SISTEMA.
- "Capacitacion" SI puede aparecer como CONTROL DE PREVENCION, pero NUNCA como causa raiz.

## Funcion del Item (focusElementFunction) — nivel PRODUCTO

- `op.focusElementFunction` es la funcion del PRODUCTO/SISTEMA para el cliente final.
- Es la MISMA para todas las operaciones del mismo AMFE (no cambia por OP).
- NO confundir con la funcion del PASO (operationFunction) que SI es especifica por operacion.

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

## Guias obligatorias

Leer ANTES de modificar datos AMFE:
- `docs/GUIA_AMFE.md` — guia de autoria completa
- `docs/ERRORES_CONCEPTUALES_APQP.md` — errores graves ya detectados, NO repetirlos
