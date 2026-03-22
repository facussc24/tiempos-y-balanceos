# Auditoria de Contenido APQP — Reporte Consolidado

**Fecha**: 2026-03-22
**Alcance**: 62 documentos APQP (18 AMFE, 18 CP, 9 PFD, 17 HO), 8 familias de producto
**Metodologia**: Tabla AIAG-VDA 2019, comparacion vs PDFs fuente, consistencia cruzada
**Autor**: Auditoria automatizada con verificacion manual

---

## 1. Resumen Ejecutivo

La calidad de datos APQP en Barack Mercosul es **moderada con areas criticas que requieren atencion inmediata**. El ~90% de los datos AMFE son fieles a las fuentes PDF originales, pero existen problemas sistematicos en la clasificacion de Action Priority y un CP master faltante para 90 causas significativas.

**Cifras clave:**
- 1,112 causas AMFE auditadas, 629 (57%) con AP mal clasificada segun AIAG-VDA 2019
- 113 causas AP=H infladas (deberian ser M o L)
- 51 causas sub-clasificadas que deberian ser AP=H (riesgo no gestionado)
- 1 operacion potencialmente inventada en Insert master (OP 105). **CORRECCION**: OP 60 y OP 100 inicialmente marcadas como inventadas SI estan en el PDF fuente
- 90 causas SC del Insert master sin cobertura de Plan de Control
- 15 inconsistencias HO vs CP (5 frecuencias, 10 operaciones faltantes)

---

## 2. AP=H Infladas (Tarea 1)

**Reporte completo**: `docs/AUDITORIA_AP_DETALLADA.md`

### Hallazgos

| Metrica | Valor |
|---------|-------|
| Total causas con S/O/D | 1,104 |
| AP=H infladas (deberian ser M/L) | 113 (37.2% de las 304 AP=H) |
| AP sub-clasificadas (M/L que deberian ser H) | 51 |
| Total mal clasificadas | 629 (57%) |

### Causas infladas por producto

| Producto | AP=H Total | Infladas | % |
|----------|-----------|----------|---|
| Insert [L0] | 75 | 23 | 30.7% |
| Insert master | 69 | 17 | 24.6% |
| Top Roll | 30 | 16 | 53.3% |
| Telas Planas | 16 | 13 | 81.3% |
| Armrest | 41 | 7 | 17.1% |
| Headrests (3 masters) | 18 | 9 | 50.0% |
| Headrests (9 variantes) | 54 | 27 | 50.0% |

### Causa raiz

Funcion `calcAP()` simplificada en los seed scripts no replica la tabla AIAG-VDA 2019. Ejemplo: `if (s >= 9) return 'H'` clasifica S=9, O=1 como H cuando deberia ser L.

### Recomendacion

**URGENTE**: Revisar las 51 causas sub-clasificadas (deberian ser H). **IMPORTANTE**: Recalcular AP en proxima revision formal. **ROOT CAUSE**: Corregir calcAP en seeds.

---

## 3. AMFE vs Fuente (Tarea 2)

**Reporte completo**: `docs/AUDITORIA_AMFE_VS_FUENTE.md`

### Coincidencias y discrepancias por producto

| Producto | Ops PDF | Ops Supabase | Match | Inventadas | S/O/D Precision |
|----------|---------|-------------|-------|------------|-----------------|
| Insert | 17 | 22 | 16/17 | 3 | ~85% |
| Armrest | ~18 | 22 | ~16/18 | ~4 WIP | ~90% |
| Top Roll | ~9 | 11 | ~8/9 | ~2 | ~85% |

### Operaciones inventadas (Insert)

- ~~OP 60 Troquelado~~ — **CORREGIDO**: SI esta en el PDF (4 failure modes, S=7)
- ~~OP 100 Tapizado semiautomatico~~ — **CORREGIDO**: SI esta en el PDF (5 failure modes incl. S=10 poka-yoke CC)
- **OP 105** Refilado post-tapizado — no confirmado en PDF, 3 modos de falla

### Discrepancias S/O/D

Puntuales (+-1 en severidad) en 5-10% de las causas. Los valores O/D son mas consistentes que S.

---

## 4. CP vs Fuente (Tarea 3)

**Reporte completo**: `docs/AUDITORIA_CP_VS_FUENTE.md`

### Hallazgo principal

Los CPs en Supabase NO son transcripciones de los PDFs fuente — son **auto-generados desde el AMFE**. Cada causa AP=H/M genera un item CP, resultando en 3-5x mas items que los PDFs originales.

| Producto | Items PDF | Items Supabase | Diferencia |
|----------|----------|---------------|------------|
| Insert [L0] | ~65 | 209 | 3.2x |
| Armrest | ~28 | 174 | 6.2x |
| Top Roll | ~45 | 94 | 2.1x |

### Limitaciones vs PDF

1. **Especificaciones genericas**: "Segun instruccion de proceso" vs tolerancias concretas del PDF
2. **Granularidad excesiva**: Desagregar por causa AMFE genera ruido
3. **Metodos de evaluacion genericos**: PDF lista herramientas; Supabase usa texto AMFE

### Frecuencias event-based

Evaluadas como **razonables** para todos los productos. Consistentes con practica industrial.

---

## 5. Consistencia Cruzada PFD - AMFE - CP (Tarea 4)

**Reporte completo**: `docs/AUDITORIA_CONSISTENCIA_CRUZADA.md`

### Mapa de consistencia

| Producto | PFD→AMFE | AMFE→PFD | AMFE→CP | CP→PFD |
|----------|----------|----------|---------|--------|
| Insert (master) | 4 gaps | 1 gap | **90 gaps** | 0 |
| Insert [L0] | 4 gaps | 1 gap | **0** | 1 gap |
| Armrest | **0** | **0** | **0** | **0** |
| Top Roll | 0 | 2 gaps | 0 | 2 gaps |
| HR Front | 5 gaps | 0 | 0 | 3 gaps |
| HR Rear Cen | 6 gaps | 0 | 0 | 3 gaps |
| HR Rear Out | 6 gaps | 0 | 0 | 3 gaps |
| Telas Planas | 6 gaps | 4 gaps | 0 | 2 gaps |
| Telas Termo | 9 gaps | 0 | 0 | 0 |

**Mejor**: Armrest — consistencia perfecta
**Peor**: Insert master — 90 causas SC sin CP

### Patrones

- PFD→AMFE gaps: Operaciones de soporte (almacenamiento, reproceso, clasificacion PNC) que no requieren AMFE necesariamente
- AMFE→CP gap critico: Insert master con 90 causas SC sin Plan de Control
- Sub-numeracion incompatible entre PFD y AMFE (ej: 10b, 10c en AMFE, solo 10 en PFD)

---

## 6. HO vs CP (Tarea 5)

**Reporte completo**: `docs/AUDITORIA_HO_VS_CP.md`

### Sincronizacion de controles y frecuencias

| Tipo issue | Cantidad | Productos afectados |
|-----------|----------|-------------------|
| Frecuencia HO != CP | 5 | Armrest |
| HO sheet sin CP | 10 | Telas Planas (4), Telas Termoformadas (6) |
| **Total** | **15** | 3 de 8 |

### Discrepancias de frecuencia (Armrest)

| OP | Control | Freq HO | Freq CP |
|----|---------|---------|---------|
| 60 | Llenado incompleto | Inicio de turno | Inicio y fin de turno |
| 80-81 | Adhesion insuficiente | Inicio y fin de turno | Inicio de turno |

### HO sin CP (Telas PWA)

Causadas por numeracion de operaciones incompatible entre HO y CP, no por contenido faltante.

---

## 7. Acciones Recomendadas Priorizadas

### URGENTE (resolver antes de proxima auditoria externa)

1. **Revisar 51 causas sub-clasificadas** (47 M→H, 4 L→H) — representan riesgos potencialmente no gestionados adecuadamente
2. **Generar CP para Insert master** — 90 causas SC sin Plan de Control es un gap documental critico
3. **Sincronizar frecuencias HO↔CP del Armrest** — definir si adhesivado es "inicio de turno" o "inicio y fin"

### IMPORTANTE (resolver en proxima revision formal)

4. **Recalcular AP** de las 113 causas infladas usando tabla AIAG-VDA 2019 exacta
5. **Verificar OP 105 (Refilado post-tapizado) del Insert** — unica operacion no confirmada en PDF fuente
6. **Alinear numeracion HO↔CP de Telas PWA** — actualmente incompatible

### MEJORA CONTINUA

7. **Corregir funcion calcAP** en seed scripts para futuros AMFE
8. **Enriquecer especificaciones CP** con tolerancias concretas del PDF (actualmente genericas)
9. **Agregar operaciones de reproceso al AMFE** de headrests si involucran riesgos de calidad
10. **Verificar implementacion apTable.ts** vs tabla AIAG-VDA 2019 publicada (diferencias en edge cases)

---

## Archivos de esta auditoria

| Archivo | Contenido |
|---------|-----------|
| `AUDITORIA_AP_DETALLADA.md` | Tarea 1: 113 AP=H infladas, tabla completa |
| `AUDITORIA_AMFE_VS_FUENTE.md` | Tarea 2: AMFE vs PDFs, 3 productos |
| `AUDITORIA_CP_VS_FUENTE.md` | Tarea 3: CP vs PDFs, 3 productos |
| `AUDITORIA_CONSISTENCIA_CRUZADA.md` | Tarea 4: PFD↔AMFE↔CP, 8 productos |
| `AUDITORIA_HO_VS_CP.md` | Tarea 5: HO vs CP, 8 productos |
| `AUDITORIA_CONTENIDO_APQP_CONSOLIDADO.md` | Tarea 6: Este reporte |
| `audit_ap_detailed_data.json` | Datos AP: 1,104 causas con S/O/D/AP |
| `audit_cross_consistency_data.json` | Datos consistencia cruzada |
| `audit_amfe_insert_comparison.md` | Comparacion detallada Insert |
| `audit_amfe_armrest_comparison.md` | Comparacion detallada Armrest |
| `audit_amfe_toproll_comparison.md` | Comparacion detallada Top Roll |
