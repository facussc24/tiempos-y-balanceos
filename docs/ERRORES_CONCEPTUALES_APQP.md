# Errores Conceptuales APQP — NO REPETIR

> Documento permanente. Registra errores de concepto detectados en datos APQP.
> Auditoria inicial: 2026-03-25 | Correcciones aplicadas: 2026-03-25

---

## Resumen Ejecutivo

| Auditoria | Hallazgos | Errores reales | Para revision manual |
|-----------|-----------|----------------|---------------------|
| B1: Operaciones no-proceso | 207 | 1 grave | 124 naming convention |
| B2: Controles sin sentido | 86 | 7 TBD methods | 43 HO QCs vacios |
| B3: Inconsistencias de flujo | 171 | 42 name mismatches | 129 HO coverage |
| B4: Clasificacion/severidad | 74 | 3 CC/SC + 52 AP=H sin accion | 18 D vs control |
| **Total** | **538** | **63 errores** | **314 para revision** |

Productos mas afectados: Insert (93+36), Armrest Door Panel (72), Telas Planas (50), Telas Termoformadas (41).

---

## Errores Graves de Concepto

### 1. Almacenamiento WIP como operacion con controles de calidad (B1)

**Error**: TOP_ROLL OP 11 "ALMACENAMIENTO EN MEDIOS WIP" es una operacion standalone (no combinada con proceso real) que tiene 3 modos de falla y 6 items de Plan de Control.

**Por que es error**: El almacenamiento intermedio entre procesos NO es una operacion productiva. No transforma ni inspecciona el producto. Los controles FIFO e identificacion de lotes en WIP los gestiona el sistema de produccion, no son controles de calidad del producto.

**Correcto**: En el PFD, el almacenamiento se representa como simbolo de almacenamiento. NO debe tener operaciones AMFE, items CP ni hojas HO propias.

**CORREGIDO**: Eliminado de AMFE (1 operacion, 5 work elements) y CP (6 items).

### 2. Nombres combinados "PROCESO - ALMACENAMIENTO EN MEDIOS WIP" (B1)

**Patron detectado**: 124 operaciones en Insert, Armrest y Top Roll usan nombres como:
- "CORTE DE COMPONENTES - ALMACENAMIENTO EN MEDIOS WIP" (OP 30)
- "COSTURA - ALMACENAMIENTO EN MEDIOS WIP" (OP 52)
- "INYECCION PLASTICA - ALMACENAMIENTO EN MEDIOS WIP" (OP 61)

**Problema**: El nombre sugiere almacenamiento, pero los controles son del proceso real (corte, costura, inyeccion). Confuso en auditorias.

**Correcto**: La operacion debe llamarse solo por el proceso productivo. El almacenamiento WIP posterior es un paso separado en el PFD sin controles.

### 3. CC/SC faltantes para severidades altas (B4-R1)

| Producto | OP | Severidad | Ocurrencia | Tenia | Corregido a |
|----------|-----|-----------|------------|-------|-------------|
| ARMREST | 90 | 10 (seguridad) | - | SC | **CC** |
| ARMREST | 25 | 6 | >=4 | vacio | **SC** |
| HEADREST_FRONT + vars | 60 | 6 | >=4 | vacio | **SC** |

**CORREGIDO**: 19 items de CP actualizados (2 ARMREST OP90, 2 ARMREST OP25, 15 HEADREST_FRONT OP60).

### 4. AP=H sin acciones correctivas (B4-R2) — 52 causas

52 causas AMFE con Prioridad de Accion = H sin ninguna accion de prevencion ni deteccion.

Productos: ARMREST (11), INSERT+L0 (16), HEADREST_FRONT+vars (11), HEADREST_REAR_CEN+vars (4), HEADREST_REAR_OUT+vars (4), TELAS_PLANAS (5).

Muchos se repiten en variantes por herencia. Corrigiendo maestros se corrigen variantes.

### 5. Metodos TBD en Plan de Control (B2-R4) — 7 items

7 items de CP tienen evaluationTechnique Y controlMethod vacios o "TBD".

### 6. Quality Checks vacios en HO (B2-R6-R4) — 43 items

43 quality checks en HO con descripcion y especificacion vacias. Concentrados en headrests (14 por producto). Placeholder que nunca se completaron.

---

## Hallazgos Informativos

### Discrepancias de nombres PFD vs AMFE (B3) — 42 casos
Los PFD usan nombres genericos y los AMFE nombres mas especificos para la misma operacion. No es error de concepto, es inconsistencia de nomenclatura.

### Operaciones solo en PFD (B3) — 31 operaciones
Reproceso, clasificacion de no conforme y segregacion. Aceptable: flujos NG en PFD no siempre requieren AMFE/CP/HO propios.

### Controles de identificacion en Embalaje (B2-R1) — 33 items
Identificacion del producto terminado en embalaje ES valida para el cliente. No son errores.

### Detection vs control mismatch (B4-R6) — 18 warnings
D<=3 con inspeccion visual. Para defectos obvios, D=2-3 puede ser aceptable sin automatizacion.

---

## Reglas Permanentes

1. **"Almacenamiento WIP" NO es operacion de proceso.** No debe tener AMFE, CP ni HO propios.

2. **Nombres de operacion = solo el proceso productivo.** No combinar "CORTE - ALMACENAMIENTO WIP".

3. **Todo control DEBE tener metodo de evaluacion especifico.** Nunca "TBD", "A definir" o vacio.

4. **Todo quality check en HO DEBE tener descripcion y especificacion.** QCs vacios confunden al operario.

5. **CC/SC se deriva de la severidad AMFE:** S >= 9 -> CC. S = 5-8 AND O >= 4 -> SC.

6. **AP=H requiere accion correctiva obligatoria.** Al menos una accion con responsable y fecha.

7. **Controles de trazabilidad interna** solo aplican en Recepcion de MP.

8. **Nombres de operacion deben coincidir** entre PFD, AMFE, CP y HO.

9. **"Remito" NO es operacion de proceso.** Solo aplica como documento en Recepcion de MP del proveedor.

10. **Transporte interno NO es operacion con controles.** Se representa como simbolo de transporte en PFD, sin AMFE/CP/HO.

11. **1 documento por familia si el proceso es identico.** Variantes de color del mismo producto (ej: 4 headrests) = 1 AMFE, 1 CP, 1 set de HOs con todos los part numbers en `applicableParts`. NO crear documentos separados.

12. **Consolidar master y variantes con mismo proceso.** Si el Insert master y su variante [L0] tienen exactamente el mismo proceso productivo, considerar consolidar en un solo juego de documentos.

13. **Unico modo de falla exclusivo de variante de color: "ensamblar el color equivocado".** Ese si va como control especifico en CP. Todos los demas modos de falla son identicos al master y no requieren documento separado.

14. **Severidades infladas — patron detectado y corregido.** Error frecuente: asignar S=7-8 a defectos cosmeticos (arrugas, manchas) que realmente son S=5-6 o S=3-4. Inflar severidades genera CC/SC falsos, planes de reaccion desproporcionados y no conformidades en auditoria. Recalibrar siempre contra la tabla de severidades de cabina interior (ver `.claude/rules/amfe.md`).
15. **Normas de ensayo/material son ESPECIFICAS por cliente.** VW tiene normas TL (ej: TL 1010 para flamabilidad), Toyota tiene sus propias normas. NUNCA mezclar normas entre clientes. Si no se conoce la norma exacta del cliente, usar "Segun requisito de flamabilidad del cliente (XXX)" con el nombre del cliente. Detectado 2026-03-26: headrests y Top Roll tenian spec "<100 mm/min" (norma Toyota) en vez de "TL 1010 VW".

16. **El generador CP creaba 1 fila por causa AMFE en vez de 1 por caracteristica.** Eso multiplicaba filas (803 items → 653 tras consolidacion). CORREGIDO 2026-03-27 — nunca repetir. buildProcessKey y buildProductKey ya no incluyen el control method en la clave de dedup.

17. **"Aprob. Planta" y "approvedBy" son campos DISTINTOS.** `approvedBy` = Aprobacion de Ingenieria (Carlos Baptista). `plantApproval` = Aprobacion de Planta (Gonzalo Cal / G.Cal). El script normalize-names-amfe-cp.mjs sobreescribia approvedBy con "Carlos Baptista" para todas las aprobaciones — corregido.

18. **Columna Producto = propiedad medible del producto.** Columna Proceso = parametro de maquina/proceso. Material/componente va en campo aparte (`componentMaterial`).

---

## Hallazgos por Producto

| Familia | B1 | B2 | B3 | B4 | Total |
|---------|----|----|----|----|-------|
| Armrest Door Panel | 30 | 2 | 24 | 16 | 72 |
| Insert (master) | 29 | 23 | 24 | 17 | 93 |
| Insert [L0] | 22 | 6 | - | 8 | 36 |
| Top Roll | 15 | 3 | 14 | 6 | 38 |
| Headrest Front | 0 | 2 | 21 | 5 | 28 |
| Headrest Front [L1-L3] | 0 | 3 | - | 12 | 15 |
| Headrest Rear Center | 0 | 2 | 21 | 1 | 24 |
| Headrest Rear Center [L1-L3] | 0 | 3 | - | 3 | 6 |
| Headrest Rear Outer | 0 | 2 | 21 | 1 | 24 |
| Headrest Rear Outer [L1-L3] | 0 | 3 | - | 3 | 6 |
| Telas Planas | 17 | 1 | 22 | 10 | 50 |
| Telas Termoformadas | 14 | 3 | 24 | 0 | 41 |

---

## Acciones Correctivas (2026-03-25)

### Automaticas (APLICADAS en Supabase — 2026-03-25)
- [x] TOP_ROLL OP 11: eliminado de AMFE (1 op, 5 work elements) y CP (6 items)
- [x] ARMREST OP 90: 2 items SC -> CC en CP (Severidad=10, seguridad)
- [x] ARMREST OP 25: 2 items sin clasificacion -> SC en CP (S=6, O>=4)
- [x] HEADREST_FRONT OP 60: 15 items sin clasificacion -> SC en CP (S=6, O>=4) — master + 3 variantes

Script: `scripts/audit/D_applyCorrections.ts` | Backups: `scripts/audit/backups/`

### Para revision manual
- [ ] 52 causas AP=H sin acciones (requiere definir acciones reales con el equipo)
- [ ] 7 CP items con metodo TBD (requiere definir metodo real)
- [ ] 43 HO QCs vacios (requiere completar descripcion y especificacion)
- [ ] 124 nombres combinados "PROCESO - ALMACENAMIENTO WIP" (requiere decision de nomenclatura)
- [ ] 42 discrepancias de nombre PFD vs AMFE (requiere alinear manualmente)
