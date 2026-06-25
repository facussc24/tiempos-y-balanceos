# Auditoria General APQP — Barack Mercosul

**Fecha:** 2026-03-30
**Tipo:** Solo lectura — no se modifico ningun dato ni codigo
**Alcance:** 32 documentos APQP (8 familias x 4 tipos) + revision de codigo
**Fuentes:** Supabase (produccion), archivos de referencia (BOMs/planos), codigo fuente

---

## Resumen Ejecutivo

| Severidad | Cantidad | Descripcion |
|-----------|----------|-------------|
| BLOQUEANTE | 0 | — |
| GRAVE | 1 | Bug SC en codigo (4 ubicaciones) |
| MEDIO | 15 | Gaps CP→HO, componentMaterial, filas mixtas, links rotos |
| MENOR | 18 | Metodos genericos, SGC faltante, visual aids, ingles, EPP |
| INFO | 1 | Conteo de documentos |
| **TOTAL** | **35** | |

**Productos mas afectados:** Headrest Front/Rear Center/Rear Outer (por gaps CP→HO y componentMaterial), Top Roll (componentMaterial 30/33 vacios).

**Comparacion vs auditoria anterior** (ERRORES_CONCEPTUALES_APQP.md, 2026-03-25):
- Items corregidos: WIP storage eliminado, CC/SC reclasificados, 52 AP=H actions pendientes de equipo
- Items nuevos: Bug SC en codigo (no detectado antes), gaps CP→HO ampliados, componentMaterial sistematico
- La base de datos consolido de 62 a 32 documentos (variantes eliminadas, 1 doc por familia)

---

## Inventario de Documentos

| Tipo | Cantidad | Esperado |
|------|----------|----------|
| AMFE | 8 | 8 masters |
| CP | 8 | 8 masters |
| HO | 8 | 8 masters |
| PFD | 8 | 8 masters |
| **Total** | **32** | Variantes eliminadas — consolidadas en master con applicableParts |
| Familias activas | 8 | 8 (correcto) |
| Productos vinculados | 33 | OK (product_family_members) |

---

## Bloque 1 — Coherencia entre Documentos (PFD ↔ AMFE ↔ CP ↔ HO)

### 1.1 PFD ↔ AMFE

| Producto | Links PFD→AMFE rotos | Links AMFE→PFD rotos | Nombres divergentes |
|----------|---------------------|---------------------|-------------------|
| Todos (8) | 0 | 0 | 0 |

**Resultado:** Links bidireccionales intactos en los 8 productos. Sin discrepancias de nombres ni numeracion.

### 1.2 AMFE ↔ CP

| Producto | Hallazgo | Severidad |
|----------|----------|-----------|
| INSERT | 133 items CP con amfeFailureId apuntando a failure inexistente en AMFE | MEDIO |

Los demas 7 productos no presentan causas AP=H/M sin cobertura ni orphans. El Insert tiene 133 links rotos — probablemente residuo de una regeneracion de UUIDs al consolidar variantes. Los links no impiden el funcionamiento pero ensucian la trazabilidad.

### 1.3 CP ↔ HO (Gap de cobertura)

Items CP con responsable de operario/produccion que NO estan en la HO:

| Producto | Items CP sin HO | Severidad |
|----------|----------------|-----------|
| Headrest Front | 27 | MEDIO |
| Headrest Rear Center | 25 | MEDIO |
| Headrest Rear Outer | 25 | MEDIO |
| Armrest Door Panel | 7 | MEDIO |
| Top Roll | 4 | MEDIO |
| Telas Termoformadas | 3 | MEDIO |
| Telas Planas | 2 | MEDIO |
| Insert | 1 | MEDIO |

Ademas: Telas Planas tiene 1 QC item con responsable diferente entre HO y CP.

**Nota:** Los headrests son los mas afectados. Muchos controles definidos en el CP no llegan a la HO del operador. Esto significa que el operador no tiene instruccion formal para ~25 controles que le corresponden.

### 1.4 y 1.5 — Nombres y numeracion de operaciones

Sin discrepancias detectadas entre PFD, AMFE, CP y HO para los 8 productos. Los nombres estan alineados.

---

## Bloque 2 — Integridad de Datos AMFE

| Verificacion | Resultado | Detalle |
|-------------|-----------|---------|
| 2.1 S/O/D undefined | 0 encontrados | 544 causas, todas con S, O, D en rango 1-10 |
| 2.2 AP=H sin accion | 0 encontrados | Todas las causas AP=H tienen accion asignada |
| 2.3 CC/SC sin justificacion | 0 encontrados | Clasificaciones coherentes con severidad |
| 2.4 Failures sin causes | 0 encontrados | Todos los modos de falla tienen al menos 1 causa |
| 2.5 Causes sin controles | 0 encontrados | Todas las causas tienen prevencion y/o deteccion |
| 2.6 Efectos VDA incompletos | 0 encontrados | 3 niveles completos en todos los failures |
| 2.7 Divergencia master/variante | N/A | Variantes consolidadas en masters |
| 2.8 Flamabilidad VWA→TL 1010 | OK | 6 productos VWA referencian TL 1010 |
| 2.8 Flamabilidad PWA→sin TL 1010 | OK | 2 productos PWA no usan TL 1010 |

**Resultado:** La integridad AMFE es solida. Los datos estan completos y coherentes. Los problemas detectados en auditorias anteriores (severity undefined, AP=H sin accion) fueron corregidos.

---

## Bloque 3 — Integridad de Datos CP

### 3.1 Especificaciones vacias/TBD/genericas

| Producto | Vacias | TBD | Genericas | Total items |
|----------|--------|-----|-----------|-------------|
| Todos (8) | 0 | 0 | 0 | — |

**Resultado:** Todas las especificaciones estan pobladas con valores concretos. Ningun "TBD" ni "Conforme a especificacion".

### 3.2 componentMaterial en recepcion (OP ≤ 10)

| Producto | Sin material | Total OP≤10 | % vacio | Severidad |
|----------|-------------|-------------|---------|-----------|
| Top Roll | 30 | 33 | 91% | MEDIO |
| Armrest Door Panel | 14 | 18 | 78% | MEDIO |
| Insert | 13 | 16 | 81% | MEDIO |
| Headrest Front | 7 | 21 | 33% | MEDIO |
| Headrest Rear Center | 7 | 21 | 33% | MEDIO |
| Headrest Rear Outer | 7 | 21 | 33% | MEDIO |
| Telas Termoformadas | 4 | 7 | 57% | MEDIO |
| Telas Planas | 3 | 14 | 21% | MEDIO |

La columna "Componente/Material" esta vacia en la mayoria de los items de recepcion. Esto dificulta saber a que material se refiere cada control cuando se mira el CP impreso. Los datos estan en los BOMs (ver Bloque 5).

### 3.3 Frecuencias time-based

0 encontradas. Todas las frecuencias son event-based (por entrega, por lote, inicio de turno, 100%, etc.).

### 3.4 Metodos de evaluacion genericos

| Producto | Items genericos | Severidad |
|----------|----------------|-----------|
| Headrest Rear Center | 7 | MENOR |
| Headrest Rear Outer | 7 | MENOR |
| Headrest Front | 7 | MENOR |
| Armrest Door Panel | 5 | MENOR |
| Top Roll | 4 | MENOR |
| Insert | 4 | MENOR |
| Telas Planas | 1 | MENOR |

35 items totales con evaluationTechnique = "Visual" o "Inspeccion" sin especificar instrumento. Deberian decir "Control visual contra patron de aspecto" o "Inspeccion visual 100%" etc.

### 3.5 Aprobaciones

Todos los CPs tienen:
- approvedBy = Carlos Baptista (Ingenieria) — correcto
- plantApproval = Gonzalo Cal / G.Cal — correcto

### 3.6 Duplicados

0 items duplicados encontrados en ningun CP.

### 3.7 Referencias SGC en planes de reaccion

| Producto | Items recepcion sin P-14 | Items produccion sin P-09/I | Severidad |
|----------|-------------------------|---------------------------|-----------|
| Headrest Front | 18 | 0 | MENOR |
| Headrest Rear Center | 18 | 0 | MENOR |
| Headrest Rear Outer | 18 | 0 | MENOR |
| Top Roll | 14 | 0 | MENOR |
| Telas Planas | 5 | 0 | MENOR |
| Insert | 2 | 0 | MENOR |
| Armrest Door Panel | 2 | 0 | MENOR |
| Telas Termoformadas | 2 | 0 | MENOR |

79 items de recepcion no referencian P-14 en su plan de reaccion. Segun la guia SGC, recepcion debe referenciar "P-14." y produccion "Segun P-09/I."

### 3.8 Producto y Proceso en la misma fila

| Producto | Filas mixtas | Severidad |
|----------|-------------|-----------|
| Armrest Door Panel | 2 | MEDIO |
| Top Roll | 2 | MEDIO |
| Insert | 1 | MEDIO |
| Headrest Front | 1 | MEDIO |
| Headrest Rear Center | 1 | MEDIO |
| Headrest Rear Outer | 1 | MEDIO |

8 items tienen productCharacteristic Y processCharacteristic en la misma fila. Segun AIAG CP 2024, deben estar en filas separadas.

---

## Bloque 4 — Integridad de Datos HO

### 4.1 EPP asignado

| Producto | Sheets sin EPP | Total sheets | Severidad |
|----------|---------------|-------------|-----------|
| Headrest Front | 1 | 10 | MENOR |
| Resto (7) | 0 | — | OK |

1 unica sheet sin EPP en Headrest Front. Los demas productos tienen EPP en todas las sheets.

### 4.2 Sheets vacias

0 sheets vacias en ningun producto. Todas tienen al menos steps TWI o QC items.

### 4.3 Responsables QC vs CP

1 discrepancia en Telas Planas (reportado en B1/1.3). Los demas coinciden.

### 4.4 cpItemId validos

0 links rotos. Todos los cpItemId en HO apuntan a items existentes en el CP vinculado.

### 4.5 Ayudas visuales

| Producto | Sheets con visual aids | Total sheets | Severidad |
|----------|----------------------|-------------|-----------|
| Insert | 3 | 22 | MENOR |
| Resto (7) | 0 | 9-22 c/u | MENOR |

Solo Insert tiene imagenes cargadas (3 de 22 sheets). Los otros 7 productos tienen 0 visual aids. Para el operador, las imagenes son importantes para entender la pieza y los defectos esperados.

---

## Bloque 5 — Datos vs Archivos de Referencia

### BOMs disponibles y datos extraidos

Se leyeron 3 BOMs de `C:\Users\FacundoS-PC\Documents\26.3.26\`:

**Headrest SET BOM:**
- PVC Titan Black: 1.1±10% sobre PET + Ether-PUR 1.0+0.5 + base PES 55 g/m2 ±10%
- PU Foam Front: 0.350 kg (MAS-TIN)
- PU Foam Rear Center: 0.102 kg
- PU Foam Rear Outer: 0.146 kg
- Hilo 30/3: Polyester, Jet Black Pantone 19-0303
- Hilo 20/3: decorativo, Alpe Gray / Gray Violet
- TPU barrier tape: sin especificacion definida
- EPP cores + frames: VW-consigned

**Armrest Rear BOM:**
- PVC Titan Black: 1.10±0.10mm sobre PET + Ether-PUR 1.0+0.5 + base 55g/m2 ±10%
- PU Foam: 0.424 kg (MAS-TIN)
- Nonwoven: 300 g/m2, 6.7 dtex, 70%PES + 30%PES-BICO
- Hilo 30/3: Polyester, Jet Black
- Perfiles PP: INPLACA
- Hard Felt: 2.5mm PP, VALERIO
- Felt hook tapes: PP+PET, APLIX

**Door Panel BOM (Top Roll + Insert + Armrest DP):**
- PC/ABS CYCOLOY LG9000: 0.14-0.268 kg (SABIC)
- TPO Bilaminate IMG-L: 0.5mm + foam 2mm, 66 kg/m3 (HAARTZ)
- SikaMelt-171: 0.048-0.08 kg (SIKA)
- PU Foam Insert: 35 kg/m3, 3mm backing
- Cinta Tesa 52110: 0.101 m2
- PVC colores: 1mm PVC + 3mm PU (SANSUY)

### Comparacion contra CP items

| Dato del BOM | Esta en CP? | Detalle |
|-------------|------------|---------|
| PVC espesor 1.1±10% (1.10±0.10mm) | Parcial | Headrests tienen spec pero componentMaterial vacio |
| PU Foam peso (0.102-0.424 kg) | No verificable | Peso de consumo no aparece como control individual |
| Densidad foam 35-66 kg/m3 | No encontrado | No hay item CP con densidad como especificacion |
| PC/ABS CYCOLOY LG9000 | No como material | Material ausente en componentMaterial de Top Roll/Insert/Armrest |
| TPO Bilaminate 0.5mm+2mm | No encontrado | Top Roll no tiene este material en CP OP 10 |
| SikaMelt-171 adhesivo | No encontrado | Adhesivo no aparece como material controlado en recepcion |
| Nonwoven 300 g/m2 | No encontrado | Armrest no tiene este material en CP OP 10 |
| Hard Felt 2.5mm | No encontrado | No aparece en CP items |
| TPU barrier tape | No encontrado | Material critico (barrera) sin control en ningun doc |

**Conclusion Bloque 5:** La columna componentMaterial esta mayormente vacia (ver B3/3.2), lo que dificulta la trazabilidad BOM→CP. Varios materiales del BOM (PC/ABS CYCOLOY, TPO Bilaminate, SikaMelt, Nonwoven, Hard Felt, TPU tape) no tienen controles individuales en recepcion. Las especificaciones de los materiales que SI tienen control en CP son correctas (espesor PVC, flamabilidad), pero faltan datos dimensionales como densidades y pesos de consumo.

---

## Bloque 6 — Coherencia del Software

### 6.1 y 6.2 — Generadores CP y HO

| Verificacion | Resultado |
|-------------|-----------|
| CP generator: AP=H/M individual, AP=L agrupado | Correcto |
| CP generator: dedup por buildProcessKey/buildProductKey | Correcto |
| CP generator: filas genericas AP=L | Correcto |
| CP generator: ordenamiento parseInt(processStepNumber) | Correcto |
| HO generator: filtrado lab/metrologia/auditor | Correcto (en validacion, no en generador) |
| HO generator: cpItemId vinculado | Correcto |

### 6.3 — Exports

Referencia: La auditoria anterior (AUDITORIA_GENERAL_APP.md, 2026-03-27) verifico que los 8 paquetes APQP exportan sin error. No se re-verifico en esta auditoria.

### 6.4 — PFD visualizacion

No se re-verifico. La auditoria anterior no reporto problemas con PFD.

### 6.5 — Bug SC en cpCrossValidation.ts (GRAVE)

**BUG CONFIRMADO en 4 ubicaciones:**

**Archivo 1:** `modules/controlPlan/cpCrossValidation.ts`
- **Linea 102:** `const hasSpecialChar = ... || sev >= 9 || (sev >= 5 && occ >= 4);`
- **Linea 112:** `} else if (sev >= 5 && occ >= 4) { expected = 'SC'; }`
- **Linea 189:** `const hasSpecialChar = ... || sev >= 9 || (sev >= 5 && occ2 >= 4);`

**Archivo 2:** `modules/controlPlan/controlPlanGenerator.ts`
- **Linea 131-133:** `const autoSpecialChar = cause.specialChar || (severity >= 9 ? 'CC' : (severity >= 5 && occurrence >= 4) ? 'SC' : '');`

**Regla PROHIBIDA (CLAUDE.md):** SC = S>=5 AND O>=4 infla clasificaciones y genera no conformidades IATF.

**Regla CORRECTA:** SC solo cuando cliente lo designa con simbolo O equipo demuestra impacto en funcion primaria (tipicamente S=7-8 encastre).

**Impacto:** El generador de CP asigna SC a causas con S=5 y O=4 (ej: arruga cosmetic con occurrence mensual) que deberian ser estandar. La cross-validation reporta warnings incorrectos cuando un item NO tiene SC pero la regla erroneamente dice que deberia.

### 6.6 — TypeScript

| Modulo | Errores |
|--------|---------|
| modules/amfe/ | 0 |
| modules/controlPlan/ | 0 |
| modules/hojaOperaciones/ | 0 |
| modules/pfd/ | 0 |
| modules/CavityCalculator/ | 10 (pre-existentes, fuera de alcance) |
| **Total APQP** | **0** |

---

## Bloque 7 — Anomalias Generales

### 7.1 — AP almacenado vs calculado

| Producto | Mismatches | Detalle |
|----------|-----------|---------|
| Telas Planas | 1 | S=5/O=4/D=5 → stored M, calc L |
| Top Roll | 1 | S=10/O=2/D=3 → stored M, calc L |
| Resto (6) | 0 | — |

2 causas de 544 tienen AP ligeramente elevado (M en vez de L). No es critico pero deberia corregirse por precision.

### 7.2 — Patrones uniformes de severidad/ocurrencia/deteccion

No se detectaron patrones sospechosos. Las distribuciones de S, O, D son variadas en todos los AMFEs.

### 7.3 — Datos vacios o JSON invalido

0 documentos con data vacia. Todos los 32 documentos parsean correctamente.

### 7.4 — Texto en ingles en controles AMFE

| Producto | Causas con ingles |
|----------|------------------|
| Telas Planas | 30 |
| Armrest Door Panel | 22 |
| Insert | 19 |
| Headrest Front | 18 |
| Headrest Rear Center | 18 |
| Headrest Rear Outer | 18 |
| Telas Termoformadas | 17 |
| Top Roll | 8 |

150 textos con palabras en ingles detectadas (ej: "control", "check", "inspect", "before", "after", "during", "with"). Muchas pueden ser falsos positivos por palabras tecnicas compartidas (ej: "control" es valido en espanol), pero vale la pena una revision manual de los textos marcados.

---

## Tabla Consolidada de Hallazgos

| # | Bloque | Severidad | Producto | Hallazgo |
|---|--------|-----------|----------|----------|
| 1 | B6 | **GRAVE** | Global (codigo) | Bug SC = S>=5 AND O>=4 en cpCrossValidation.ts (3 lineas) y controlPlanGenerator.ts (1 linea) |
| 2 | B1 | MEDIO | Insert | 133 items CP con amfeFailureId roto (residuo de consolidacion) |
| 3 | B1 | MEDIO | Headrest Front | 27 items CP de operario no reflejados en HO |
| 4 | B1 | MEDIO | Headrest Rear Center | 25 items CP de operario no reflejados en HO |
| 5 | B1 | MEDIO | Headrest Rear Outer | 25 items CP de operario no reflejados en HO |
| 6 | B1 | MEDIO | Armrest Door Panel | 7 items CP de operario no reflejados en HO |
| 7 | B1 | MEDIO | Top Roll | 4 items CP de operario no reflejados en HO |
| 8 | B1 | MEDIO | Telas Termoformadas | 3 items CP de operario no reflejados en HO |
| 9 | B1 | MEDIO | Telas Planas | 2 items CP no en HO + 1 responsable diferente |
| 10 | B3 | MEDIO | Top Roll | 30/33 items recepcion sin componentMaterial |
| 11 | B3 | MEDIO | Armrest Door Panel | 14/18 items recepcion sin componentMaterial |
| 12 | B3 | MEDIO | Insert | 13/16 items recepcion sin componentMaterial |
| 13 | B3 | MEDIO | Headrest (x3) | 7/21 items recepcion sin componentMaterial (c/u) |
| 14 | B3 | MEDIO | Telas Termoformadas | 4/7 items recepcion sin componentMaterial |
| 15 | B3 | MEDIO | Telas Planas | 3/14 items recepcion sin componentMaterial |
| 16 | B3 | MEDIO | 6 productos | 8 items con Producto+Proceso en misma fila |
| 17 | B3 | MENOR | 7 productos | 35 items con evaluationTechnique generica |
| 18 | B3 | MENOR | 8 productos | 79 items recepcion sin ref P-14 en reaccion |
| 19 | B4 | MENOR | 7 productos | 0 visual aids en HO (Insert tiene 3/22) |
| 20 | B4 | MENOR | Headrest Front | 1 sheet sin EPP |
| 21 | B7 | MENOR | 2 productos | 2 causas AP=M que deberian ser AP=L |
| 22 | B7 | MENOR | 8 productos | ~150 textos con posible ingles en AMFE |
| 23 | B5 | MEDIO | Todos VWA | Materiales BOM sin control individual en CP (PC/ABS, TPO, SikaMelt, Nonwoven, Hard Felt, TPU tape) |

---

## Recomendacion de Orden de Correccion

### Prioridad 1 — Corregir el bug SC (GRAVE, 1 sesion)
1. Eliminar `(sev >= 5 && occ >= 4)` de cpCrossValidation.ts (lineas 102, 112, 189)
2. Eliminar `(severity >= 5 && occurrence >= 4)` de controlPlanGenerator.ts (linea 131-133)
3. Actualizar comentarios para reflejar la regla correcta
4. Correr tests: `npx vitest run --testPathPattern="cpCrossValidation|controlPlanGenerator"`

### Prioridad 2 — Poblar componentMaterial en CP (MEDIO, 1-2 sesiones)
Afecta 85+ items de recepcion. Los datos estan en los BOMs. Script batch que:
- Lee cada CP
- Para items de OP ≤ 10, asigna el material correspondiente del BOM
- Guarda sin crear duplicados

### Prioridad 3 — Cerrar gaps CP→HO (MEDIO, 2-3 sesiones)
77 items CP de operario no estan en HO (headrests son el grueso). Opciones:
- Re-ejecutar generador HO para los 3 headrests + Armrest
- Agregar manualmente los QC items faltantes
- Verificar que los items CP realmente corresponden al operador (no lab/metrologia)

### Prioridad 4 — Limpiar amfeFailureId rotos en Insert (MEDIO, rapido)
133 links rotos en Insert CP. Script que vuelve a vincular o limpia los IDs inexistentes.

### Prioridad 5 — Separar filas Producto/Proceso mixtas (MEDIO, rapido)
8 items en 6 productos. Duplicar cada item mixto en 2 filas separadas.

### Prioridad 6 — Mejorar calidad de datos menores (MENOR, gradual)
- Especificar evaluationTechnique en 35 items genericos
- Agregar P-14 a 79 planes de reaccion de recepcion
- Corregir 2 AP mismatches (Telas Planas, Top Roll)
- Agregar EPP faltante en 1 sheet Headrest Front
- Cargar visual aids en HOs (requiere fotos reales)

### Prioridad 7 — Completar materiales BOM en AMFE/CP (MEDIO-LARGO PLAZO)
Materiales del BOM sin cobertura APQP: PC/ABS CYCOLOY, TPO Bilaminate, SikaMelt-171, Nonwoven, Hard Felt, TPU barrier tape. Requiere decision de equipo sobre cuales justifican control individual vs inclusion en linea generica de recepcion.

---

## Notas Metodologicas

1. **Script de auditoria:** `scripts/audit_general_2026_03_30.mjs` — conecta a Supabase, descarga 32 documentos, ejecuta 65+ verificaciones programaticas.
2. **AP verification:** Se uso la tabla AIAG-VDA 2019 exacta (`modules/amfe/apTable.ts`) para verificar los 544 causes. Solo 2 discrepancias reales.
3. **Texto en ingles:** La deteccion usa regex basico que puede dar falsos positivos en palabras compartidas (ej: "control" es valido en espanol). Requiere revision manual.
4. **Visual aids:** La ausencia de imagenes no es un error de datos sino de contenido pendiente de cargar.
5. **Variantes eliminadas:** Las 9 variantes (Insert L0, Headrest L1/L2/L3 x3) fueron consolidadas en los masters. El sistema usa `applicableParts` en el header para listar los PN de cada variante. Esto es correcto segun la guia AMFE (1 doc por familia si proceso identico).
