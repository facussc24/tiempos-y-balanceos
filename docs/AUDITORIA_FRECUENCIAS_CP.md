# AUDITORÍA PROFUNDA DE FRECUENCIAS EN PLANES DE CONTROL

**Fecha**: 2026-03-21
**Alcance**: 18 Planes de Control (8 familias × master/variantes), ~700-800 items CP
**Estado**: Solo análisis — NO se modificó Supabase ni código
**Método**: 7 agentes especializados en 3 capas (investigación → análisis cruzado → reporte)

---

## 1. RESUMEN EJECUTIVO

### Hallazgo general: las frecuencias son SÓLIDAS, con 5 ajustes necesarios

| Métrica | Valor |
|---------|-------|
| Total items CP analizados | ~700-800 |
| Frecuencias únicas encontradas | 36 strings distintos |
| Frecuencias VÁLIDAS según AIAG | 31 (86%) |
| Frecuencias que necesitan NORMALIZACIÓN de texto | 14 (39%) |
| Frecuencias CONDICIONALES (dependen del contexto) | 3 (8%) |
| Frecuencias con FLAG (potencial no-conformidad) | 5 items específicos |
| Frecuencias INVÁLIDAS | 0 |

### Severidad general: BAJA-MEDIA

No hay frecuencias inventadas sin fundamento. Todas tienen base en:
- PDFs originales aprobados por VWA (~50% de items), o
- Algoritmo AIAG-VDA basado en AP+severidad (~50% de items)

Los 5 flags encontrados son ajustes puntuales en items CC, no problemas sistémicos.

---

## 2. TABLA DE CAMBIOS PROPUESTOS

### 2.1 Cambios de frecuencia (5 items con FLAG)

#### FLAG CC-1 (PRIORIDAD ALTA): Items CC con frecuencia insuficiente

3 items de Característica Crítica (CC) solo se verifican al inicio de turno. Per IATF 16949 cláusula 8.3.3.3, los CC requieren 100% o monitoreo continuo. "Inicio turno" deja 7+ horas sin contención.

| Producto | Operación | Característica | Clasif. | Frecuencia Actual | Frecuencia Propuesta | Justificación |
|----------|-----------|---------------|---------|-------------------|---------------------|---------------|
| Armrest Door Panel | OP 50 | Dimensiones críticas | **CC** | `Inicio turno` | `Inicio de turno + cada 2 horas` | CC dimensional requiere contención continua. Con SPC Xbar-R, Cpk ≥ 1.67. Per CQI-23: dimensional = start-up + every 8h (2h es más exigente) |
| Insert Patagonia | OP 60 | Dimensiones | **CC** | `Inicio turno` | `Inicio de turno + cada 2 horas` | Mismo caso. CC dimensional sin monitoreo post-arranque |
| Top Roll Patagonia | OP 10 | Dimensiones críticas | **CC** | `Inicio turno` | `Inicio de turno + cada 2 horas` | Mismo caso |

#### FLAG CC-2 (PRIORIDAD MEDIA): Ensayos destructivos CC 1x/turno

2 items CC de Top Roll usan ensayo destructivo 1x por turno. IATF espera la máxima frecuencia factible para CC.

| Producto | Operación | Característica | Clasif. | Frecuencia Actual | Frecuencia Propuesta | Justificación |
|----------|-----------|---------------|---------|-------------------|---------------------|---------------|
| Top Roll | OP 30 | Adherencia film | **CC** | `1x turno` | `Inicio de turno + cada 4 horas` (2x/turno mínimo) | CC requiere máxima frecuencia factible. Alternativa: documentar justificación formal si 1x/turno es lo máximo por costo |
| Top Roll | OP 60 | Resistencia soldadura | **CC** | `1x turno` | `Inicio de turno + cada 4 horas` (2x/turno mínimo) | Mismo caso |

#### FLAG SC-1 (PRIORIDAD BAJA): SPC faltante en método de control

| Producto | Operación | Característica | Clasif. | Frecuencia Actual | Cambio Propuesto | Justificación |
|----------|-----------|---------------|---------|-------------------|-----------------|---------------|
| Insert Patagonia | OP 100 | Temperatura vinilo/sustrato | **SC** | `Cada 2 horas` (OK) | Sin cambio de frecuencia — agregar "gráfico SPC (Cpk ≥ 1.33)" al método de control | Per IATF 16949, SC debe tener SPC. La frecuencia "Cada 2 horas" es correcta per AIAG |

### 2.2 Normalización de texto (14 strings → forma canónica)

Estos NO son errores de frecuencia — son variaciones de texto que dicen lo mismo. Normalizar mejora la consistencia documental.

| Frecuencia Actual | Frecuencia Canónica | Productos Afectados | Prioridad |
|-------------------|--------------------|--------------------|-----------|
| `Por lote` | `Cada lote` | 3 Headrests (extenso) | ALTA — ~15% de items |
| `Por entrega` | `Cada recepción` | 3 Headrests (~20% de items) | ALTA |
| `1x turno` | `Cada turno` | 5 productos (TP, TT, ARM, INS, TR) | ALTA |
| `Por turno` | `Cada turno` | 3 Headrests | ALTA |
| `Cada lote de material` | `Cada lote` | TP, TT (flamabilidad) | MEDIA |
| `C/hora` | `Cada hora` | TT (espesor) | MEDIA |
| `Cada cont.` | `Cada contenedor` | Insert | MEDIA |
| `Inicio turno` | `Inicio de turno` | ARM, INS, varios | MEDIA |
| `Inicio + c/hora` | `Inicio de turno + cada hora` | ARM, TT, TR | ALTA |
| `Inicio turno + c/hora` | `Inicio de turno + cada hora` | TP | MEDIA |
| `Inicio turno + cada hora` | `Inicio de turno + cada hora` | ARM | MEDIA |
| `Inicio + c/50` | `Inicio de turno + cada 50 piezas` | INS | BAJA |
| `Inicio + c/50 pzas` | `Inicio de turno + cada 50 piezas` | TP | BAJA |
| `Inicio lote` | `Inicio de lote` | TT, ARM, TR, INS | BAJA |

**Causa raíz**: Dos convenciones de datos — el seed de 5 productos (español estructurado: "Cada lote") vs el seed de headrests (copiado directo del PDF: "Por lote"). Ambas son válidas pero deberían unificarse.

---

## 3. ORIGEN DE CADA FRECUENCIA

### 3.1 Clasificación general

| Origen | % de items | Descripción |
|--------|-----------|-------------|
| **VIENE DEL PDF ORIGINAL** | ~30% | Headrests (3 familias × 4 niveles) — transcripción fiel de PDFs aprobados por VWA |
| **HARDCODE CONTEXTUAL del seed** | ~40% | 5 productos (TP, TT, ARM, INS, TR) — hardcodeado en seedApqpDocuments.ts por el desarrollador, probablemente con el PDF abierto |
| **ALGORITMO del seed** | ~20% | Items generados por getCompleteDefaults()/getDefaults() basados en AP+severidad de AMFE |
| **TEMPLATE MANUAL** | ~5% | 10 items manuales del template Patagonia (controlPlanPatagoniaTemplate.ts) |
| **DEFAULT RUNTIME** | ~5% | Sugerencias de controlPlanDefaults.ts al crear items nuevos en la UI |

### 3.2 Frecuencias del PDF original (verificadas al 100%)

Todos los PDFs de referencia fueron leídos en `C:\Users\FacundoS-PC\Documents\AMFES PC HO\PLANES DE CONTROL ACTUALES REFERENCIA UNICAMENTE\`:

| Frecuencia PDF | Contexto | ¿Seed coincide? |
|---------------|----------|-----------------|
| `Por entrega`, 1 muestra | Recepción de materiales | SÍ — todos los seeds |
| `Inicio de turno y después de cada intervención mecánica` | Set-up (corte, costura, horno) | SÍ — ligeramente abreviado |
| `Inicio de turno`, 1 Control | Corte (capas, cuchilla, dimensional) | SÍ |
| `Inicio y fin de turno` + `Por lote 100%` | Costura apariencia | SÍ — combinado en un string |
| `Por lote`, 100% | Adhesivado, tapizado, virolado, ensamble | SÍ |
| `Por lote`, 5 pzas/lote inyección | Inspección final dimensional | SÍ |
| `Por turno`, 100% | Embalaje | SÍ |
| `Auditoría de Producto` | Test de Layout (flamabilidad, dimensional completo) | SÍ |
| `Inicio turno`, 1 Pieza | Espumado peso (headrest) | SÍ |
| `Inicio de turno`, 1 control | Espumado parámetros PU (headrest) | SÍ |

**Conclusión**: Los PDFs originales fueron aprobados por VWA como parte del proceso de calificación VDA 6.3. Sus frecuencias son correctas según estándar automotriz.

### 3.3 Frecuencias algorítmicas (inventadas por seed, basadas en AIAG-VDA)

| Regla | AP | Severidad | Frecuencia Generada | ¿Válida según AIAG? |
|-------|----|-----------|--------------------|---------------------|
| R1 | H | cualquiera | `Cada pieza` (100%) | **CORRECTA** |
| R2 | M | ≥ 9 | `Cada hora` | **ACEPTABLE** — agregar check CC |
| R3 | M | 7-8 | `Cada 2 horas` | **ACEPTABLE** |
| R4 | M | < 7 | `Cada turno` | **ACEPTABLE** |
| R5 | L | ≥ 9 | `Cada 2 horas` | **CONDICIONAL** — insuficiente si es CC |
| R6 | L | 5-8 | `Cada turno` | **ACEPTABLE** |
| R7 | L | < 5 | `Inicio de turno` | **ACEPTABLE** |

**Mejora sugerida a las reglas default**: Agregar conciencia CC/SC. Cualquier item CC, independientemente del AP, debería default a `Cada pieza` (100%).

---

## 4. IMPACTO EN OTROS MÓDULOS

### 4.1 ¿Qué pasa si cambiamos frecuencias en CP?

| Componente | ¿Afectado? | ¿Automático? | Detalle |
|-----------|-----------|-------------|---------|
| **cp_documents** (Supabase) | SÍ — es la tabla a modificar | Manual o script | JSON blob: `items[].sampleFrequency` |
| **ho_documents** (Supabase) | SÍ — copia snapshot | NO automático | `sheets[].qualityChecks[].frequency` queda desactualizado |
| **CP variantes** (familias) | SÍ | SÍ automático | `changePropagation.ts` genera proposals auto_applied o pending |
| **HO variantes** | SÍ — copia snapshot | NO automático | Cada HO variante necesita regeneración separada |
| **AMFE** | NO | N/A | AMFE no tiene campo de frecuencia |
| **PFD** | NO | N/A | PFD no tiene campo de frecuencia |
| **Validación V5/V7** | SÍ | Automático en próxima validación | Checks de Poka-Yoke y consistencia muestreo |
| **Alerta cross-doc** | SÍ | Automático al cambiar revisión CP | Alerta genérica "CP fue actualizado" |
| **Exports Excel/PDF** | SÍ | Automático — leen dato actual | CP export refleja nuevo valor; HO export muestra snapshot viejo |

### 4.2 Ruta de propagación de frecuencias

```
AMFE (S,O,D,AP) ──[generación única]──▶ CP (sampleFrequency)
                                           │
                                           ├──[generación única]──▶ HO (frequency) [SNAPSHOT, no live]
                                           │
                                           ├──[herencia live]──▶ CP variante (sampleFrequency) [vía proposals]
                                           │
                                           └──[alerta genérica]──▶ HO notificación [no auto-update]
```

### 4.3 Enfoque recomendado para hacer cambios

**Opción recomendada: Script a través del repository layer de la app** (no SQL directo).

Razones:
1. Dispara `changePropagation.ts` automáticamente para master→variante
2. Dispara `crossDocumentAlerts.ts` para notificar HOs
3. Mantiene `updated_at` y metadata consistentes
4. Evita riesgo de corromper JSON con SQL manual
5. Para los HOs, hacer update quirúrgico de `qc.frequency` matcheando `cpItemId`

---

## 5. RECOMENDACIÓN: Frecuencias estándar por tipo de operación

Basado en AIAG CP-1:2024, IATF 16949, CQI-23, y los PDFs originales aprobados por VWA:

### 5.1 Tabla de frecuencias recomendadas

| Tipo de Operación | Característica Típica | CC | SC | Estándar |
|-------------------|-----------------------|----|-----|----------|
| **Recepción MP** | Material, color, certificados | Cada recepción | Cada recepción | Cada recepción |
| **Set-up máquina** | Parámetros, hoja de set-up | Inicio de turno + c/intervención mecánica | Inicio de turno + c/intervención mecánica | Inicio de turno |
| **Corte tela** | Dimensional, capas, cuchilla | Cada pieza | Inicio de turno | Inicio de turno |
| **Costura** | Apariencia, puntada, alineación | Cada pieza | Inicio y fin de turno + 100% por lote | Cada lote |
| **Inyección PU / Espumado** | Peso, densidad | Inicio de turno + cada hora (SPC) | Cada 2 horas (SPC) | Cada turno |
| **Inyección PU** | Parámetros proceso (temp, presión) | Continuo (sensor) | Inicio de turno | Inicio de turno |
| **Tapizado / Adhesivado** | Aspecto, adherencia, posición | Cada pieza | Cada lote (100%) | Cada lote |
| **Inspección visual final** | Aspecto general, defectos | Cada pieza | Cada pieza | Cada lote |
| **Ensayo destructivo** | Resistencia, pelado, tracción | Inicio de turno + cada 4 horas | Cada turno | Cada turno |
| **Dimensional final** | Cotas funcionales | Inicio de turno + cada 2 horas (SPC) | Cada lote (5 pzas) | Cada lote |
| **Embalaje** | Identificación, cantidad, trazabilidad | Cada caja/contenedor | Cada caja/contenedor | Cada turno |
| **Test de Layout** | Flamabilidad, dimensional completo | Auditoría de Producto | Auditoría de Producto | Auditoría de Producto |

### 5.2 Principios clave (AIAG 2024)

1. **CC siempre 100% o continuo** — IATF 16949 cláusula 8.3.3.3 requiere monitoreo diferenciado. Si 100% no es factible (ensayo destructivo), documentar justificación formal.
2. **SC con SPC** — SC debe tener gráfico SPC con Cpk ≥ 1.33 como mínimo.
3. **Volumen > Tiempo** — AIAG 2024 prefiere frecuencias basadas en volumen ("Cada 50 piezas") sobre tiempo ("Cada 2 horas"), pero no prohíbe las basadas en tiempo.
4. **Contención efectiva** — La pregunta clave: "¿Cuántas piezas se producen entre controles? ¿Se pueden contener si hay defecto?"
5. **Set-up siempre al inicio + después de intervención** — CQI-23 y todos los PDFs originales coinciden.

---

## 6. FUENTES

### Estándares y Manuales Oficiales
1. [AIAG CP-1:2024 — Control Plan Reference Manual](https://www.aiag.org/training-and-resources/manuals/details/CP-1)
2. [AIAG CQI-23-2 — Molding System Assessment](https://www.aiag.org/training-and-resources/manuals/details/CQI-23)
3. [AIAG & VDA FMEA Handbook](https://www.aiag.org/training-and-resources/manuals/details/FMEAAV-1)
4. [IATF 16949 Clause 8.5.1.1 — Control Plan](https://preteshbiswas.com/2023/07/31/iatf-169492016-clause-8-5-1-1-control-plan/)
5. [IATF 16949 Clause 8.3.3.3 — Special Characteristics](https://preteshbiswas.com/2023/07/16/iatf-16949-clause-8-3-3-3-special-characteristics/)

### Guías Técnicas
6. [simpleQuE — Critical Concepts New CP Manual](https://www.simpleque.com/critical-concepts-to-know-about-the-new-iatf-16949-control-plan-reference-manual/)
7. [Quality Assist — FMEA and Control Plan Linkage](https://quasist.com/fmea/fmea-and-control-plan-linkage/)
8. [Quality-One — Control Plan Development](https://quality-one.com/control-plan/)
9. [Knowllence — AIAG CP 1st Ed](https://www.knowllence.com/en/blog-design-manufacturing/control-plan-apqp.html)
10. [MTG Transform — How to Fill Out a Control Plan](https://www.mtg-transform.com/blog/how-to-fill-out-a-process-control-plan-to-raise-product-quality)

### CQI-23 y Manufactura PU
11. [CQI Support — CQI-23 Standards](https://www.cqi-support.de/en/cqi_standards/cqi_23)
12. [Woodbridge — Foam-In-Place Head Restraint Assembly](https://www.woodbridgegroup.com/Products/Foam-in-Place-Head-Restraint-Assembly)
13. [MGA Research — Automotive PU Foam Testing](https://www.mgaresearch.com/blog/automotive-polyurethane-foam-testing-a-deep-dive-into-astm-d3754)

### Foros y Discusiones de Practitioners
14. [Elsmar — Control Plan Frequency of Sampling](https://elsmar.com/elsmarqualityforum/threads/control-plan-and-the-frequency-of-sampling.84990/)
15. [Elsmar — Linking Control Plans and PFMEAs](https://elsmar.com/elsmarqualityforum/threads/linking-control-plans-and-pfmeas.80339/)
16. [Elsmar — Special Characteristics Classification](https://elsmar.com/elsmarqualityforum/threads/critical-key-significant-characteristics-special-characteristics-classification.36526/)

### PDFs Originales de Referencia (analizados)
17. PdC Insertos.pdf — Insert Front DI/DD TAOS (Rev 1, 7/9/2024)
18. PC_TOP ROLL.pdf — Top Roll Front DI-DD TAOS (Rev 0, 25/2/2025)
19. PATAGONIA_FRONT_HEADREST_L0_PdC preliminar.pdf (10/4/2025)
20. PATAGONIA_FRONT_HEADREST_L1-L2-L3_PdC preliminar.pdf (10/4/2025)
21. PATAGONIA_REAR CENT_HEADREST_L0/L1-L2-L3_PdC preliminar.pdf (10/4/2025)
22. PATAGONIA_REAR OUT_HEADREST_L0/L1-L2-L3_PdC preliminar.pdf (10/4/2025)
23. PC 2GJ.867.165-166 Rev.0.pdf — APB Rev de Puerta Delantero TAOS

---

## APÉNDICE A: Evaluación de riesgo ante auditoría IATF

Si un auditor IATF revisara hoy los Planes de Control:

| Hallazgo Potencial | Severidad | Probabilidad | Cláusula IATF | Estado Actual |
|--------------------|-----------|-------------|---------------|--------------|
| CC dimensionales con "Inicio turno" solamente | No-conformidad Menor | ALTA | 8.5.1.1 + 8.3.3.3 | **3 items a corregir** |
| CC destructivos con 1x/turno sin justificación | Observación | MEDIA | 8.3.3.3 | **2 items a justificar o subir frecuencia** |
| Misma frecuencia para CC y estándar | Observación | MEDIA | 8.3.3.3 | Bajo riesgo — mayoría CC ya tiene "Cada pieza" |
| Strings de frecuencia inconsistentes | Observación | BAJA | 8.5.1.1 (calidad documental) | Cosmético, no funcional |
| SPC no mencionado en método de control para SC | Observación | BAJA | 8.5.1.1 | 1 item específico |

## APÉNDICE B: Distribución de frecuencias por categoría

| Categoría | Valores Únicos | % Estimado de Items |
|-----------|---------------|---------------------|
| BASADAS EN EVENTO | 17 | ~55% |
| BASADAS EN TIEMPO | 8 | ~25% |
| HÍBRIDAS | 8 | ~20% |

**Top 5 frecuencias más usadas:**
1. `Por entrega` / `Cada recepción` — ~20% (recepción en todos los headrests)
2. `Cada pieza` — ~18% (inspecciones visuales, 100%)
3. `Por lote` / `Cada lote` — ~15% (controles por lote)
4. `Inicio de turno` — ~12% (verificaciones de set-up)
5. `Inicio y fin de turno / 100% Por lote` — ~8% (costura headrests)

---

## APÉNDICE C: Reportes intermedios de auditoría

Los 7 reportes detallados de cada capa están disponibles para consulta:

| Reporte | Archivo | Contenido |
|---------|---------|-----------|
| Capa 1A | `docs/_audit_layer1A_frequencies.md` | Inventario completo de 36 frecuencias, distribución por producto |
| Capa 1B | `docs/_audit_layer1B_sources.md` | Trazabilidad PDF→seed para cada frecuencia |
| Capa 1C | `docs/_audit_layer1C_aiag_standards.md` | Investigación AIAG CP-1:2024, IATF 16949, CQI-23 |
| Capa 1D | `docs/_audit_layer1D_impact.md` | Impacto en AMFE, HO, PFD, herencia familias |
| Capa 2A | `docs/_audit_layer2A_comparison.md` | Cada frecuencia vs estándar AIAG (36 evaluaciones) |
| Capa 2B | `docs/_audit_layer2B_origin.md` | Origen por producto (PDF vs algoritmo vs manual) |
| Capa 2C | `docs/_audit_layer2C_impact_map.md` | Mapa de impacto detallado, opciones de cambio |

---

*Auditoría realizada el 2026-03-21. Análisis READ-ONLY — no se modificó Supabase ni código.*
*Para decidir qué cambiar, revisar la Sección 2 (Tabla de Cambios Propuestos) y la Sección 5 (Recomendaciones).*
