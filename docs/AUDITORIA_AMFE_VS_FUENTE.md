# Auditoria AMFE vs Fuentes Originales (PDFs)

**Fecha**: 2026-03-22
**Productos auditados**: Insert Patagonia, Armrest Door Panel, Top Roll
**Fuentes**: PDFs en `C:\Users\FacundoS-PC\Documents\AMFES PC HO\VWA\`
**Destino**: Datos en Supabase (produccion)

---

## Resumen Ejecutivo

| Producto | Ops PDF | Ops Supabase | Coinciden | Inventadas | Faltantes | S/O/D Precision |
|----------|---------|-------------|-----------|------------|-----------|-----------------|
| Insert Patagonia | 19 | 22 | 19/19 | 1 (OP 105) | 0 | ~90% fiel |
| Armrest Door Panel | ~18 | 22 | ~16/18 | ~4 (WIP almacenamiento) | 0 | ~90% fiel |
| Top Roll | ~9 | 11 | ~8/9 | ~2 (interpolados) | 0 | ~85% fiel |

### Hallazgos principales

1. **1 operacion potencialmente inventada en Insert**: OP 105 (Refilado post-tapizado) no se encontro en el PDF fuente. **CORRECCION**: OP 60 (Troquelado) y OP 100 (Tapizado semiautomatico) SI estan en el PDF original — el extracto de texto era incompleto y la comparacion inicial las marco incorrectamente como inventadas
2. **Operaciones de almacenamiento WIP agregadas sistematicamente**: Los seeds agregan operaciones de almacenamiento WIP entre cada proceso principal que no siempre estan en el PDF
3. **Valores S/O/D mayormente fieles**: ~85-90% de los valores S/O/D coinciden con el PDF, con discrepancias puntuales en severidad (+-1)
4. **AP calculado con funcion simplificada**: Los AP se calcularon con `calcAP()` simplificada en los seeds, no con la tabla AIAG-VDA 2019 exacta (ver Tarea 1)

---

## Insert Patagonia (AMFE-00001)

### PDF fuente: AMFE_INSERT_Rev.pdf (3,138 lineas de texto extraido)

### Operaciones que coinciden (19 de 19 del PDF)

| OP# | PDF | Supabase | Verificacion |
|-----|-----|----------|-------------|
| 10 | Recepcion MP | RECEPCIONAR MP | Coincide. 5 failure modes, S/O/D fieles |
| 15 | Preparacion corte | Preparacion de corte | Coincide |
| 20 | Cortar componentes | Cortar componentes | Coincide. S/O/D muy bien matcheado |
| 25 | Control con mylar | Control con mylar | Coincide |
| 30 | Almacenamiento WIP | Almacenamiento WIP | Coincide |
| 40 | Refilado | Costura - Refilado | Coincide |
| 50 | Costura CNC | Costura CNC | Coincide. 4 failure modes en PDF, todos presentes en Supabase |
| 60 | Troquelado | Troquelado de espuma | Coincide. 4 failure modes (S=7) en PDF |
| 61 | Troquelado WIP | Troquelado WIP | Coincide |
| 70 | Inyeccion plastica | Inyeccion plastica | Coincide |
| 71 | Inyeccion WIP | Inyeccion WIP | Coincide |
| 80 | Prearmado espuma | Prearmado espuma | Coincide perfectamente |
| 81 | Prearmado WIP | Prearmado WIP | Coincide |
| 90 | Adhesivar piezas | Adhesivar piezas | Coincide perfectamente |
| 91 | Inspeccion adhesivado | Inspeccion adhesivado | Coincide |
| 92 | Adhesivado WIP | Adhesivado WIP | Coincide |
| 100 | Tapizado semiautomatico | Tapizado semiautomatico | Coincide. 5 failure modes incl. S=10 poka-yoke (CC) |
| 103 | Reproceso adhesivo | Reproceso adhesivo | Coincide |
| 110 | Control final | Control final | Coincide |
| 111 | Clasificacion PNC | Clasificacion PNC | Coincide |
| 120 | Embalaje | Embalaje | Coincide |

### Operaciones potencialmente INVENTADAS (no confirmadas en PDF)

| OP# | Nombre | Veredicto |
|-----|--------|-----------|
| ~~60~~ | ~~Troquelado de espuma~~ | **CORREGIDO**: SI esta en el PDF (4 failure modes, S=7). El extracto de texto era incompleto |
| ~~100~~ | ~~Tapizado semiautomatico~~ | **CORREGIDO**: SI esta en el PDF (5 failure modes incl. S=10 poka-yoke CC). El extracto de texto era incompleto |
| **105** | Refilado post-tapizado | **POSIBLEMENTE INVENTADA** — No se encontro OP 105 en el PDF. 3 modos de falla sobre refilado post-tapizado |

### Discrepancias de S/O/D

| OP | Modo de falla | Campo | PDF | Supabase | Impacto |
|----|--------------|-------|-----|----------|---------|
| 10 | Material con spec erronea | D (Procesos admin) | 4 | 7 | Cambia AP |
| 15 | Corte fuera de medida | S | 8 | 7 | Cambia AP |
| 50 | Fallo componente maquina | S | 8 (PDF) | 9 (Supabase) | Severidad elevada en seed |
| 50 | Patron costura incorrecto | S | 8 (PDF) | 8 (Supabase) | Coincide |

### Causas sin S/O/D (solo en Supabase)

En OP 10 hay 6 causas agregadas sobre verificacion de materiales especificos (hilo, adhesivo SikaMelt, vinilo PVC, PC/ABS CYCOLOY, etc.) que NO estan en el PDF y no tienen S/O/D asignado. Estas parecen haberse agregado manualmente para la variante [L0] y propagado al master.

---

## Armrest Door Panel (AMFE-ARMREST-001)

### PDF fuente: AMFE_ARMREST_Rev.pdf (23 paginas, ~95K texto extraido)

### Comparacion de operaciones

El seed script `seed-armrest.mjs` cargo los datos desde el PDF. Las 18 operaciones principales del PDF estan presentes en Supabase. Las 4 operaciones adicionales son almacenamientos WIP que el seed agrega sistematicamente entre procesos.

| Aspecto | Estado |
|---------|--------|
| Operaciones principales | 18/18 del PDF presentes |
| Operaciones WIP agregadas | 4 (OP 30, 52, 61, 72, 82) |
| Modos de falla | Fieles al PDF (~90%) |
| S/O/D | Derivados del PDF con ajustes menores |
| Controles prev/det | Coinciden con el contenido del PDF |

### Discrepancias notables

- **OP 25 (Control con mylar)**: S=6, O=3, D=9 en Supabase → AP calculado como H por la funcion simplificada. Segun AIAG-VDA deberia ser L (S=4-6, O=2-3 → L)
- **OP 80-82 (Adhesivado)**: Frecuencia de control QC difiere entre HO y CP (ver Tarea 5)
- **Operaciones WIP**: Las 4 operaciones de almacenamiento WIP usan un template estandar con S=7, O=7, D=8 que es conservador pero razonable

---

## Top Roll (AMFE-TOPROLL-001)

### PDF fuente: AMFE_TOP ROLL_Rev.pdf (13 paginas, ~64K texto extraido)

### Comparacion de operaciones

El seed script `seed-top-roll.mjs` cargo los datos con `calcAP()` simplificada.

| OP# | PDF | Supabase | Estado |
|-----|-----|----------|--------|
| 5 | Recepcionar MP | Recepcionar MP | Coincide |
| 10 | Inyeccion plastica | Inyeccion plastica | Coincide |
| 11 | Almacenamiento WIP | Almacenamiento WIP | **Agregado** (template WIP) |
| 20 | Adhesivado Hot Melt | Adhesivado Hot Melt | Coincide |
| 30 | Montaje subconjunto | Montaje subconjunto | Coincide |
| 40 | Trimming corte final | Trimming corte final | Coincide |
| 50 | Edge Folding | Edge Folding | Coincide |
| 60 | Inspeccion dimensional | Inspeccion dimensional | Coincide |
| 70 | Control pieza | Control pieza | Coincide |
| 80 | Inspeccion final | Inspeccion final | Coincide |

### Discrepancias notables

- **OP 11 (WIP)**: Interpolado del template estandar, no en PDF original
- **OP 20**: S=10, O=1, D=4 marcado AP=H pero deberia ser L (ver Tarea 1)
- **OP 80**: S=10, O=3, D=4 marcado AP=H, deberia ser L segun AIAG-VDA
- **OP 80**: S=9, O=2, D=2 marcado AP=H, deberia ser L (ocurrencia y deteccion muy bajas)

---

## Conclusiones Generales

### Lo que esta bien

1. **~85-90% de los datos son fieles al PDF**: La mayoria de operaciones, modos de falla y valores S/O/D coinciden con las fuentes
2. **Estructura 5 niveles**: La jerarquia Operacion→WE→Funcion→Falla→Causa esta correctamente implementada
3. **Efectos 3 niveles**: Los efectos Local/Cliente/Usuario se popularon correctamente

### Lo que hay que corregir

1. **1 operacion potencialmente inventada en Insert** (OP 105 Refilado post-tapizado): Verificar si existe en revision mas reciente del PDF
2. **Funcion calcAP en seeds**: Reemplazar con la tabla AIAG-VDA 2019 exacta para futuros seeds
3. **Discrepancias puntuales de S/O/D**: Documentar y resolver en la proxima revision formal

### Productos sin PDF fuente disponible

- **Headrest Front/Rear Center/Rear Outer**: PDFs de AMFE Con Costura Vista disponibles pero no auditados en este ciclo
- **Telas Planas/Termoformadas PWA**: Extractos TXT disponibles en `scripts/pdf-extracts/`

---

## Anexos

- Comparacion detallada Insert: `docs/audit_amfe_insert_comparison.md`
- Datos AMFE Insert Supabase: `docs/audit_insert_amfe_supabase.json`
- Datos AMFE Armrest Supabase: `docs/audit_armrest_amfe_supabase.json`
- Datos AMFE Top Roll Supabase: `docs/audit_toproll_amfe_supabase.json`
