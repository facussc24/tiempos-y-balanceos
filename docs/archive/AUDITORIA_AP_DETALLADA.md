# Auditoria AP Detallada — AIAG-VDA 2019

**Fecha**: 2026-03-22
**Metodologia**: Tabla oficial AIAG & VDA FMEA Handbook, 1st Edition (2019)
**Fuente de datos**: Supabase (produccion), 18 documentos AMFE, 1,112 causas totales

---

## Resumen Ejecutivo

| Metrica | Valor |
|---------|-------|
| Documentos AMFE analizados | 18 |
| Total causas | 1,112 |
| Causas con S/O/D completo | 1,104 |
| AP=H en Supabase | 304 |
| AP=M en Supabase | 690 |
| AP=L en Supabase | 110 |
| **AP=H infladas (deberian ser M/L)** | **113 (37.2% de AP=H)** |
| AP=M incorrectas | 449 (65.1% de AP=M) |
| AP=L incorrectas | 67 (60.9% de AP=L) |
| **Total causas mal clasificadas** | **629 (57.0% del total)** |

### Hallazgos criticos

1. **113 causas AP=H infladas**: 96 deberian ser M, 17 deberian ser L
2. **47 causas AP=M sub-clasificadas**: Deberian ser H — **riesgo de seguridad no identificado**
3. **4 causas AP=L sub-clasificadas**: Deberian ser H — **riesgo critico oculto**
4. **402 causas AP=M sobre-clasificadas**: Deberian ser L (bajo impacto, genera ruido)

### Diferencia con auditoria nocturna

La auditoria nocturna reporto 147 AP=H infladas. Esta auditoria detallada encuentra 113 usando la tabla AIAG-VDA exacta. La diferencia (34 causas) se debe a que la auditoria nocturna uso una funcion AP simplificada que clasifica S=7-8, O=6-7, D=2-4 como M cuando la tabla AIAG-VDA indica H.

---

## Tabla AIAG-VDA 2019 Utilizada

### S = 9-10 (Seguridad/Regulatorio)
| O | D | AP |
|---|---|---|
| 6-10 | 1-10 | H |
| 4-5 | 2-10 | H |
| 4-5 | 1 | M |
| 2-3 | 7-10 | H |
| 2-3 | 5-6 | M |
| 2-3 | 1-4 | L |
| 1 | 1-10 | L |

### S = 7-8 (Alto)
| O | D | AP |
|---|---|---|
| 8-10 | 1-10 | H |
| 6-7 | 2-10 | H |
| 6-7 | 1 | M |
| 4-5 | 7-10 | H |
| 4-5 | 1-6 | M |
| 2-3 | 5-10 | M |
| 2-3 | 1-4 | L |
| 1 | 1-10 | L |

### S = 4-6 (Moderado)
| O | D | AP |
|---|---|---|
| 8-10 | 5-10 | H |
| 8-10 | 1-4 | M |
| 6-7 | 2-10 | M |
| 6-7 | 1 | L |
| 4-5 | 7-10 | M |
| 4-5 | 1-6 | L |
| 1-3 | 1-10 | L |

### S = 2-3 (Bajo)
| O | D | AP |
|---|---|---|
| 8-10 | 5-10 | M |
| Todo lo demas | | L |

### S = 1: Siempre L

---

## Detalle: 113 Causas AP=H Infladas

### Por documento

| AMFE | Producto | Total H | Infladas | Deberian ser M | Deberian ser L |
|------|----------|---------|----------|----------------|----------------|
| AMFE-00001 [L0] | Insert Patagonia [L0] | 75 | 23 | 14 | 9 |
| AMFE-00001 | Insert Patagonia | 69 | 17 | 11 | 6 |
| AMFE-TOPROLL-001 | Top Roll | 30 | 16 | 13 | 3 |
| AMFE-PWA-112 | Telas Planas | 16 | 13 | 13 | 0 |
| AMFE-ARMREST-001 | Armrest Door Panel | 41 | 7 | 5 | 2 |
| AMFE-151 | Headrest Front | 6 | 3 | 3 | 0 |
| AMFE-HR-FRONT-L1/L2/L3 | Headrest Front (variantes) | 18 | 9 | 9 | 0 |
| AMFE-153 | Headrest Rear Center | 6 | 3 | 3 | 0 |
| AMFE-HR-REAR_CEN-L1/L2/L3 | HR Rear Center (variantes) | 18 | 9 | 9 | 0 |
| AMFE-155 | Headrest Rear Outer | 6 | 3 | 3 | 0 |
| AMFE-HR-REAR_OUT-L1/L2/L3 | HR Rear Outer (variantes) | 18 | 9 | 9 | 0 |
| AMFE-PWA-113 | Telas Termoformadas | 1 | 1 | 1 | 0 |

### Top combinaciones S/O/D en causas infladas

| S | O | D | AP actual | AP correcto | Cantidad | % infladas |
|---|---|---|-----------|-------------|----------|------------|
| 6 | 6 | 6 | H | M | 32 | 28.3% |
| 6 | 7 | 6 | H | M | 16 | 14.2% |
| 6 | 4 | 4 | H | L | 7 | 6.2% |
| 7 | 4 | 6 | H | M | 7 | 6.2% |
| 8 | 4 | 5 | H | M | 6 | 5.3% |
| 5 | 1 | 8 | H | L | 6 | 5.3% |
| 7 | 5 | 5 | H | M | 5 | 4.4% |
| 8 | 4 | 6 | H | M | 4 | 3.5% |
| 7 | 5 | 4 | H | M | 3 | 2.7% |
| 7 | 5 | 6 | H | M | 3 | 2.7% |
| 8 | 5 | 6 | H | M | 3 | 2.7% |
| Otras | | | H | M/L | 21 | 18.6% |

---

## Lista Completa: 113 Causas AP=H Infladas

### AMFE-PWA-112 — Telas Planas PWA (13 infladas)

| # | Operacion | Causa | S | O | D | AP actual | AP correcto |
|---|-----------|-------|---|---|---|-----------|-------------|
| 1 | 10 Recepcion de Punzonado | Material fuera de especificacion requerida | 10 | 2 | 6 | H | M |
| 2 | 10b Recepcion con Bi-componente | Material fuera de especificacion requerida | 10 | 2 | 6 | H | M |
| 3 | 20b Horno | Mal posicionamiento, Error del Operario | 7 | 3 | 7 | H | M |
| 4 | 50 Perforado (21-8875 R/L) | Punzones Danados (modo falla 1) | 7 | 5 | 4 | H | M |
| 5 | 50 Perforado (21-8875 R/L) | Punzones Danados (modo falla 2) | 7 | 5 | 4 | H | M |
| 6 | 50 Perforado (21-8875 R/L) | Punzones Danados (modo falla 3) | 7 | 5 | 4 | H | M |
| 7 | 60 Soldadura | Mala seleccion de piezas | 7 | 4 | 6 | H | M |
| 8 | 60 Soldadura | No cumplir HO (modo falla 1) | 7 | 4 | 6 | H | M |
| 9 | 60 Soldadura | No cumplir HO (modo falla 2) | 7 | 4 | 6 | H | M |
| 10 | 60 Soldadura | No cumplir HO (modo falla 3) | 7 | 4 | 6 | H | M |
| 11 | 70 Control de pieza final | Error en ops anteriores (modo 1) | 7 | 4 | 6 | H | M |
| 12 | 70 Control de pieza final | Error en ops anteriores (modo 2) | 7 | 4 | 6 | H | M |
| 13 | 70 Control de pieza final | Error en ops anteriores (modo 3) | 7 | 4 | 6 | H | M |

### AMFE-PWA-113 — Telas Termoformadas PWA (1 inflada)

| # | Operacion | Causa | S | O | D | AP actual | AP correcto |
|---|-----------|-------|---|---|---|-----------|-------------|
| 1 | 10 Recepcion materiales | Falta de control de recepcion/capacitacion | 7 | 3 | 7 | H | M |

### AMFE-ARMREST-001 — Armrest Door Panel (7 infladas)

| # | Operacion | Causa | S | O | D | AP actual | AP correcto |
|---|-----------|-------|---|---|---|-----------|-------------|
| 1 | 10 Recepcionar MP | Error en orden de compra/ficha tecnica | 7 | 5 | 6 | H | M |
| 2 | 10 Recepcionar MP | Proveedor sin trazabilidad robusta | 6 | 6 | 6 | H | M |
| 3 | 10 Recepcionar MP | Procesos administrativos deficientes | 6 | 4 | 4 | H | **L** |
| 4 | 20 Corte vinilo/tela | Falta verificacion codigo material | 8 | 5 | 6 | H | M |
| 5 | 25 Control con mylar | Operador omite verificacion visual | 6 | 3 | 9 | H | **L** |
| 6 | 80 Adhesivado | Adhesivo/reticulante vencido | 8 | 4 | 5 | H | M |
| 7 | 81 Inspeccion adhesivado | Adhesivo/reticulante vencido | 8 | 4 | 5 | H | M |

### AMFE-151/153/155 — Headrest Masters (3 infladas c/u, 9 total)

Patron identico en los 3 masters (Headrest Front, Rear Center, Rear Outer):

| # | Operacion | Causa | S | O | D | AP actual | AP correcto |
|---|-----------|-------|---|---|---|-----------|-------------|
| 1 | 10 Recepcionar MP | Falta control dimensional en recepcion | 6 | 6 | 6 | H | M |
| 2 | 10 Recepcionar MP | Proveedor no respeta tolerancias | 6 | 7 | 6 | H | M |
| 3 | 10 Recepcionar MP | Almacenaje inadecuado en transporte | 6 | 6 | 6 | H | M |

### Headrest Variantes L1/L2/L3 (3 infladas c/u, 27 total)

Exactamente el mismo patron heredado del master. 9 variantes x 3 causas = 27 causas infladas.

### AMFE-00001 — Insert Patagonia (17 infladas)

| # | Operacion | Causa | S | O | D | AP actual | AP correcto |
|---|-----------|-------|---|---|---|-----------|-------------|
| 1 | 10 Recepcionar MP | Mala estiba y embalaje inadecuado | 6 | 6 | 6 | H | M |
| 2 | 10 Recepcionar MP | Manipulacion incorrecta en transito | 6 | 7 | 6 | H | M |
| 3 | 10 Recepcionar MP | Almacenaje inadecuado en transporte | 6 | 6 | 6 | H | M |
| 4 | 10 Recepcionar MP | Proveedor no respeta tolerancias | 6 | 7 | 6 | H | M |
| 5 | 20 Corte vinilo/tela | Falla en maquina de corte | 6 | 6 | 8 | H | M |
| 6 | 20 Corte vinilo/tela | Falta verificacion codigo material | 8 | 5 | 6 | H | M |
| 7 | 25 Control con mylar | Operador omite verificacion visual | 6 | 6 | 9 | H | M |
| 8 | 80 Prearmado espuma | Error alineacion separador | 6 | 7 | 8 | H | M |
| 9 | 80 Prearmado espuma | Burbujas en adhesivo separador | 8 | 4 | 6 | H | M |
| 10 | 90 Adhesivado | Adhesivo/reticulante vencido | 8 | 4 | 5 | H | M |
| 11 | 91 Inspeccion adhesivado | Adhesivo/reticulante vencido | 8 | 4 | 5 | H | M |
| 12 | 100 Tapizado | Tiempos ciclo no verificados | 8 | 4 | 4 | H | M |
| 13 | 103 Reproceso adhesivo | Falta plantilla/mascara proteccion | 4 | 7 | 8 | H | M |
| 14 | 105 Refilado post-tapizado | Presion excesiva / desvio cutter | 8 | 4 | 6 | H | M |
| 15 | 111 Inspeccion final | Operador omite identificacion | 5 | 1 | 8 | H | **L** |
| 16 | 111 Inspeccion final | Insumos identificacion no disponibles | 5 | 1 | 8 | H | **L** |
| 17 | 111 Inspeccion final | Procedimiento no requiere tarjeta | 5 | 1 | 8 | H | **L** |

### AMFE-00001 [L0] — Insert Patagonia [L0] (23 infladas)

| # | Operacion | Causa | S | O | D | AP actual | AP correcto |
|---|-----------|-------|---|---|---|-----------|-------------|
| 1 | 10 Recepcionar MP | Mala estiba (TEST PROPAGACION v2) | 6 | 6 | 6 | H | M |
| 2 | 10 Recepcionar MP | Manipulacion incorrecta en transito | 6 | 7 | 6 | H | M |
| 3 | 10 Recepcionar MP | Almacenaje inadecuado transporte | 6 | 6 | 6 | H | M |
| 4 | 10 Recepcionar MP | Proveedor no respeta tolerancias | 6 | 7 | 6 | H | M |
| 5 | 10 Recepcionar MP | No verifica color Hilo Needle thread | 6 | 4 | 4 | H | **L** |
| 6 | 10 Recepcionar MP | No verifica fecha vencimiento SikaMelt | 6 | 4 | 4 | H | **L** |
| 7 | 10 Recepcionar MP | No verifica identificacion Tessa 52110 | 6 | 4 | 4 | H | **L** |
| 8 | 10 Recepcionar MP | No verifica color/estado Vinilo PVC | 6 | 4 | 4 | H | **L** |
| 9 | 10 Recepcionar MP | No verifica lote PC/ABS CYCOLOY | 6 | 4 | 4 | H | **L** |
| 10 | 10 Recepcionar MP | No verifica PU FOAM 35Kg/m3 | 6 | 4 | 4 | H | **L** |
| 11 | 20 Corte vinilo/tela | Falla maquina de corte | 6 | 6 | 8 | H | M |
| 12 | 20 Corte vinilo/tela | Falta verificacion codigo material | 8 | 5 | 6 | H | M |
| 13 | 25 Control con mylar | Operador omite verificacion visual | 6 | 6 | 9 | H | M |
| 14 | 80 Prearmado espuma | Error alineacion separador | 6 | 7 | 8 | H | M |
| 15 | 80 Prearmado espuma | Burbujas adhesivo separador | 8 | 4 | 6 | H | M |
| 16 | 90 Adhesivado | Adhesivo/reticulante vencido | 8 | 4 | 5 | H | M |
| 17 | 91 Inspeccion adhesivado | Adhesivo/reticulante vencido | 8 | 4 | 5 | H | M |
| 18 | 100 Tapizado | Tiempos ciclo no verificados | 8 | 4 | 4 | H | M |
| 19 | 103 Reproceso adhesivo | Falta plantilla/mascara proteccion | 4 | 7 | 8 | H | M |
| 20 | 105 Refilado | Presion excesiva / desvio cutter | 8 | 4 | 6 | H | M |
| 21 | 111 Inspeccion final | Operador omite identificacion | 5 | 1 | 8 | H | **L** |
| 22 | 111 Inspeccion final | Insumos no disponibles | 5 | 1 | 8 | H | **L** |
| 23 | 111 Inspeccion final | Procedimiento no requiere tarjeta | 5 | 1 | 8 | H | **L** |

### AMFE-TOPROLL-001 — Top Roll (16 infladas)

| # | Operacion | Causa | S | O | D | AP actual | AP correcto |
|---|-----------|-------|---|---|---|-----------|-------------|
| 1 | 5 Recepcionar MP | Manipulacion incorrecta en transito | 7 | 5 | 6 | H | M |
| 2 | 5 Recepcionar MP | Almacenaje inadecuado en transporte | 7 | 5 | 6 | H | M |
| 3 | 5 Recepcionar MP | Proveedor sin trazabilidad robusta | 7 | 5 | 5 | H | M |
| 4 | 5 Recepcionar MP | Ambiente sucio en planta proveedor | 6 | 6 | 6 | H | M |
| 5 | 10 Inyeccion plasticas | Operador omite verificacion dimensional | 7 | 5 | 5 | H | M |
| 6 | 10 Inyeccion plasticas | Instruccion trabajo ambigua | 7 | 5 | 5 | H | M |
| 7 | 10 Inyeccion plasticas | Falta inspeccion al llegar | 6 | 6 | 6 | H | M |
| 8 | 11 Almacenamiento WIP | Operador no realiza conteo | 7 | 5 | 5 | H | M |
| 9 | 11 Almacenamiento WIP | Mano obra no verifica vs OP | 8 | 5 | 5 | H | M |
| 10 | 11 Almacenamiento WIP | Operador no sigue revision visual | 7 | 5 | 5 | H | M |
| 11 | 20 Adhesivado Hot Melt | Falta de EPP y herramientas | 10 | 1 | 4 | H | **L** |
| 12 | 40 Trimming corte final | Velocidad avance cuchilla incorrecta | 5 | 6 | 5 | H | M |
| 13 | 50 Edge Folding | Fuga aire/baja presion cilindros | 6 | 6 | 6 | H | M |
| 14 | 50 Edge Folding | Pieza mal posicionada en nido | 5 | 6 | 5 | H | M |
| 15 | 80 Inspeccion final | Sensor presencia falso | 10 | 3 | 4 | H | **L** |
| 16 | 80 Inspeccion final | Error seleccion etiqueta | 9 | 2 | 2 | H | **L** |

---

## Hallazgo adicional: 51 Causas Sub-clasificadas (deberian ser H)

**CRITICO**: Ademas de las 113 infladas, se encontraron 51 causas que deberian ser H pero estan marcadas como M (47) o L (4). Estas representan riesgos potencialmente no gestionados adecuadamente.

### 47 causas M que deberian ser H

Combinaciones tipicas:
- S=7-8, O=6-7, D=2-6 → deberia ser H (actualmente M)
- S=9-10, O=4-5, D=2-10 → deberia ser H (actualmente M)
- S=4-6, O=8-10, D=5-10 → deberia ser H (actualmente M)

### 4 causas L que deberian ser H

Estos son los casos mas criticos de sub-clasificacion. Requieren revision inmediata.

---

## Causa raiz del problema

La funcion `calcAP()` usada en los seed scripts (seed-armrest.mjs, seed-top-roll.mjs, etc.) es una version simplificada que NO replica la tabla AIAG-VDA 2019:

```javascript
// Funcion INCORRECTA usada en seeds:
if (s >= 9) return 'H';          // INCORRECTO: S=9, O=1 deberia ser L
if (s >= 7 && o >= 4 && d >= 4) return 'H';  // INCORRECTO: S=7, O=4, D=5 deberia ser M
if (s >= 5 && o >= 6) return 'H';            // INCORRECTO: S=5, O=6 deberia ser M
```

La funcion correcta en la app (`apTable.ts`) usa una lookup table 3D de 11x11x11, pero esta tambien difiere de la tabla AIAG-VDA oficial en algunos edge cases (ej: trata S=10 y S=9 por separado, lo cual no esta en la tabla publicada que agrupa 9-10).

---

## Patron de herencia

El sistema de familias maestro→variante propaga los AP incorrectos:
- 3 causas infladas en Headrest Front (master) → se replican en L1, L2, L3 = 9 causas adicionales
- Mismo patron para Rear Center y Rear Outer
- Total: 9 causas originales en masters → 27 causas adicionales en variantes = 36 causas por herencia

---

## Recomendaciones

1. **URGENTE**: Revisar las 51 causas sub-clasificadas (47 M→H, 4 L→H) ya que representan riesgos no gestionados
2. **IMPORTANTE**: Recalcular AP de las 113 causas infladas en la proxima revision formal
3. **ROOT CAUSE**: Corregir la funcion `calcAP` en los seed scripts para que use la tabla AIAG-VDA exacta
4. **VERIFICAR**: La implementacion de `apTable.ts` en la app para confirmar que coincide con la tabla AIAG-VDA 2019 publicada
5. **NO corregir automaticamente**: Los AP en documentos que esten bajo revision formal activa

---

## Datos completos

Los datos de esta auditoria estan disponibles en formato JSON:
- `docs/audit_ap_detailed_data.json` — 1,104 causas con S/O/D/AP actual/AP correcto
