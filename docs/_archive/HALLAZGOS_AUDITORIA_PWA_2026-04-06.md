# Hallazgos Auditoria PWA — Para Correccion Directa

> Generado: 2026-04-06 | Autor: Auditoria Cowork
> Las lecciones aprendidas de `docs/LECCIONES_APRENDIDAS.md` y `docs/ERRORES_CONCEPTUALES_APQP.md` ya fueron aplicadas en este analisis.
> Las reglas de `.claude/rules/` ya fueron consultadas. Respetalas al corregir.

---

## CONTEXTO

Se auditaron los 2 productos PWA comparando datos en Supabase vs AMFEs de referencia reales:

- **Telas Planas 581D**: AMFE referencia Rev D (29/04/2025) en `AMFES PC HO/PWA/TELAS PWA PLANAS/amfe viejo referencia/AMFE_TELAS_PLANAS.txt`
- **Telas Termoformadas 582D**: AMFE 148 Rev 2 (02/12/2024) en `AMFES PC HO/PWA/TELAS PWA TERMOFORMADAS/AMFE REFERENCIA/AMFE_TERMOFORMADAS.txt`

Comparaciones detalladas ya existentes:
- `docs/COMPARACION_TELAS_PLANAS_REF_VS_SUPABASE.md`
- `docs/COMPARACION_TELAS_TERMO_REF_VS_SUPABASE.md`

---

## CORRECCIONES SEGURAS (no requieren confirmacion de Fak)

### 1. FLAMABILIDAD CC — Telas Termoformadas

**Problema**: La flamabilidad NO esta marcada como CC en el AMFE ni CP de Telas Termoformadas en Supabase.
**Referencia**: AMFE 148 Rev 2 tiene flamabilidad con S=10 y clasificacion CC para ambos materiales (Punzonado y Bicomp).
**Regla**: `.claude/rules/amfe.md` dice "Flamabilidad es OBLIGATORIA como CC en toda pieza de cabina interior".
**Accion**: En AMFE-PWA-113 (TELAS_TERMOFORMADAS), buscar todas las causas relacionadas con flamabilidad y marcar `specialChar: "CC"`, `severity: 10`. Propagar CC al CP correspondiente (CP-TELAS-TERMO-001).
**IMPORTANTE**: La norma de flamabilidad para PWA NO es TL 1010 (esa es VW). Poner "Norma flamabilidad cliente PWA" o dejar TBD si no se conoce la norma exacta.

### 2. FLAMABILIDAD CC — Telas Planas

**Problema**: Verificar si flamabilidad esta como CC en Telas Planas. Si no lo esta, corregir igual que punto 1.
**Regla**: Misma regla, toda pieza de cabina interior.

### 3. LIMPIAR FM DE PRODUCTO EQUIVOCADO — Telas Planas

**Problema critico**: En el AMFE de Telas Planas (Supabase), las operaciones 30 a 80 tienen modos de falla que pertenecen a Telas TERMOFORMADAS, no a Telas Planas. Alguien copio datos de Termoformadas a Planas y solo renombro las operaciones, pero los work elements, funciones y FM quedaron del producto equivocado.

**Evidencia**:
- OP 20b HORNO, OP 30 TERMOFORMADO, OP 40 CORTE EN PRENSA, OP 50 PERFORADO, OP 60 SOLDADURA → estas operaciones NO existen en Telas Planas. El proceso real de Planas es: Recepcion → Preparacion corte → Corte → Costura → Colocado clips → Pegado dots → Inspeccion final → Embalaje.
- FM como "deformacion en termoformado", "falla de soldadura", "perforado fuera de tolerancia" no aplican a telas planas que son cosidas, no termoformadas.

**Proceso real de Telas Planas (segun AMFE ref Rev D)**:
| OP | Nombre |
|----|--------|
| 10 | Recepcion de materia prima |
| 15 | Preparacion de corte (agregada 29/4/2025) |
| 20 | Corte |
| 30 | Costura |
| 40 | Colocado de clips |
| 50 | Pegado de dots |
| 60 | Inspeccion final |
| 70 | Embalaje |

**Accion**: Las operaciones que NO corresponden al proceso real de Telas Planas deben eliminarse o reemplazarse con las correctas. Los FM de la referencia para Costura (OP 30) incluyen:
- Costura floja (S=8)
- Costura corrida / fuera de posicion
- Hilo roto
- Puntada saltada
- Refuerzo costurado inverso al airbag (S=7, con accion correctiva: crear instructivo de retrabajo - Cecilia Rodriguez)
- Costura con arrugas
- Rotura de aguja

**PRECAUCION**: No inventar FM ni acciones. Copiar SOLO los que estan en la referencia. Para FM que no estan en la referencia, poner TBD o preguntar a Fak.

### 4. ALINEAR NOMBRES OPERACIONES PFD/AMFE/CP/HO

**Problema**: Los nombres de operaciones no coinciden entre documentos (PFD dice una cosa, AMFE otra, CP otra).
**Regla**: `.claude/rules/pfd.md` y `.claude/rules/control-plan.md` exigen nombres IDENTICOS entre PFD, AMFE, CP y HO.
**Accion**: Para ambos productos, estandarizar nombres usando el formato de `.claude/rules/pfd.md`:
- Recepcion: "RECEPCION DE MATERIA PRIMA"
- Control final: "CONTROL FINAL DE CALIDAD"
- Embalaje: "EMBALAJE"

### 5. AGREGAR OPERACIONES FALTANTES — Telas Termoformadas

**Problema**: En el AMFE de Supabase faltan operaciones que SI estan en la referencia y en el PFD:
- OP 80: Costura refuerzos (esta en PFD pero no en AMFE)
- OP 90: Aplicacion aplix (esta en PFD pero no en AMFE)
- OP 11: Retrabajo Aplix (en referencia)
- OP 61: Retrabajo soldadura (en referencia)

**Accion**: Agregar las operaciones faltantes al AMFE con FM de la referencia. Para OP 11 y 61 (retrabajos), verificar si el flujo actual los incluye. Si no hay info suficiente, crear la operacion con FM "TBD".

### 6. HO SIN EPP — Ambos productos

**Problema**: Las Hojas de Operaciones tienen 0 EPP asignado en ambos productos PWA.
**Regla**: `.claude/rules/hoja-operaciones.md` define EPP coherente por tipo de operacion:
- Costura: proteccion auditiva + anteojos
- Corte: guantes anticorte + anteojos
- Embalaje: zapatos de seguridad + guantes

**Accion**: Asignar EPP a cada HO sheet segun el tipo de operacion, siguiendo la tabla de `.claude/rules/hoja-operaciones.md`.

### 7. HO CON POCOS QC ITEMS — Telas Planas

**Problema**: 12 hojas de operaciones pero solo 3 QC items total. Los controles del CP no estan vinculados a las HO.
**Regla**: `.claude/rules/hoja-operaciones.md` dice que HO recibe controles del CP que ejecuta el operario en su estacion (no lab/metrologia/auditoria).
**Accion**: Vincular QC items del CP a las HO correspondientes. Filtrar solo controles que el operario ejecuta.

---

## ITEMS QUE REQUIEREN CONFIRMACION DE FAK

### A. Part number Telas Planas
- Header AMFE/CP: 21-8909
- Familia landing: 21-9463
- Referencia PdC: 21-6567
**Pregunta**: Cual es el part number correcto? Son productos distintos?

### B. Cantidades discrepantes (Telas Planas vs Termoformadas mezclados)
- Agujeros: Supabase dice 17 (dato de Termoformadas), referencia Planas no tiene agujeros (es costura)
- Aplix: Supabase dice 9 (dato de Termoformadas), referencia Termoformadas dice 9, Planas es distinto
- Pzs/medio: Supabase dice 25, referencia Termoformadas dice 25

Esto se resuelve mayormente con la correccion #3 (limpiar FM equivocados).

### C. Temperatura horno Termoformadas
3 valores distintos en 3 documentos:
- Set-up real (Setup Termoconformado): **100°C ±10°C**
- AMFE referencia 148: **150°C ±20°C**
- Plan de Control referencia: **200°C**
**Pregunta**: Cual es la temperatura real actual? El set-up dice 100°, el AMFE viejo 150°, el PC viejo 200°.

### D. Proceso real Telas Planas — operaciones OP 15 y clips/dots
- La referencia Rev D agrego OP 15 "Preparacion de corte" en abril 2025
- La referencia tiene OP 40 "Colocado de clips" y OP 50 "Pegado de dots"
**Pregunta**: Estas operaciones siguen vigentes en el proceso actual?

### E. Materiales especificos Termoformadas
La referencia lista 3 materiales con gramajes:
- Punzonado 120 g/m2
- Bicomp 280 g/m2
- Aplix (rollo)
Supabase tiene materiales genericos.
**Pregunta**: Confirmar gramajes actuales.

---

## RESUMEN DE PRIORIDADES

| # | Correccion | Producto | Impacto |
|---|-----------|----------|---------|
| 1 | Flamabilidad CC | Termoformadas | CRITICO - seguridad |
| 2 | Flamabilidad CC | Planas | CRITICO - seguridad |
| 3 | Limpiar FM equivocados | Planas | CRITICO - datos corruptos |
| 4 | Alinear nombres ops | Ambos | MEDIO - coherencia |
| 5 | Agregar ops faltantes | Termoformadas | MEDIO - completitud |
| 6 | EPP en HO | Ambos | MEDIO - seguridad operario |
| 7 | QC items en HO | Planas | BAJO - completitud |

---

## RECORDATORIOS CRITICOS

- **NUNCA inventar acciones correctivas** (regla absoluta, ver `.claude/rules/amfe-actions.md` — incidente de 408 acciones inventadas)
- **NUNCA inventar FM** — solo copiar de referencia o poner TBD
- **NUNCA poner TL 1010 en productos PWA** — esa norma es solo VW
- **NUNCA confirmar valores numericos sin Fak** — en duda: TBD
- Leer `docs/GUIA_AMFE.md` antes de tocar datos AMFE
- Leer `docs/LECCIONES_APRENDIDAS.md` para no repetir errores
- Leer `docs/ERRORES_CONCEPTUALES_APQP.md` para contexto de errores ya corregidos
