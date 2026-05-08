# Regla — Los 3 niveles de Función en AMFE Step 3 (AIAG-VDA 2019)

## Contexto

Esta regla nace de un incidente 2026-05-08: el AMFE 150 (Armrest Rear Center) tenía las 10 OPs con `operationFunction` copiado literal de `focusElementFunction`. Al exportar a Excel aparecían 2 columnas adyacentes con texto idéntico. Causa raíz: confusión entre los 3 niveles de función que AIAG-VDA 2019 PFMEA Step 3 define en la Structure Tree.

## Los 3 niveles según AIAG-VDA 2019 Step 3 (Function Analysis)

Fuentes verificadas:
- [PQ-FMEA: PFMEA step 3](https://pq-fmea.com/pfmea-step-3-according-to-aiag-vda-function-analysis/)
- [Quality Digest: AIAG-VDA's FMEA](https://www.qualitydigest.com/inside/lean-article/understanding-aiag-vda-s-fmea-process-and-approach-061820.html)
- [Pretesh Biswas: AIAG & VDA PFMEA](https://preteshbiswas.com/2023/08/21/aiag-vda-process-failure-mode-and-effect-analysis/)
- [Anleitner LinkedIn: PFMEA in AIAG-VDA Handbook Part 3](https://www.linkedin.com/pulse/part-3-pfmea-new-aiag-vda-handbook-michael-anleitner)

### Jerarquía (Structure Tree)

```
NIVEL 1 — System / Item Function          (focusElementFunction)
                |
                v
NIVEL 2 — Process Step / Operation Function   (operationFunction)
                |
                v
NIVEL 3 — Process Work Element / 4M Function  (function.description en cada WE)
```

Regla AIAG-VDA: **"Process Item functions lead to effects, Process Step functions lead to failure modes, and Process Work Elements lead to causes."** O sea: cada nivel "alimenta" un tipo distinto de análisis.

### Nivel 1 — `focusElementFunction` (Func. Item)

**Qué es:** función del PRODUCTO en el vehículo / sistema cliente. Lo que la pieza ENTREGA al usuario final.

**Quién la cumple:** el item terminado (no el proceso, no el operario, no la máquina).

**Cuándo cambia:** **NUNCA dentro del mismo AMFE.** Es la MISMA en todas las OPs del documento (regla Barack confirmada en `amfe.md` línea 94-101).

**Estructura Barack obligatoria:** 3 perspectivas separadas con " / ":
```
Función Interna: <qué hace en planta Barack>
 / Función del Cliente: <qué hace en línea VW/PWA/etc.>
 / Función del Usuario Final: <qué hace para el conductor/pasajero>
```

**Ejemplo correcto (de AMFE-ARM-PAT, Armrest Door Panel)**:
```
Interno: Proveer pieza tapizada conforme dimensional, costuras y bordes sin defectos
 / Cliente: Permitir ensamble en panel de puerta sin interferencia ni Gap & Flush fuera de spec
 / Usr. Final: Confort ergonómico al apoyar antebrazo, estética coherente con interior, ausencia de S&R
```

**Errores comunes:**
- ❌ Dejar "Función Interna: -" (guion) sin contenido — equipo APQP debe llenarlo.
- ❌ Repetir el mismo texto en `operationFunction` (eso convierte 2 niveles en 1).
- ❌ Cambiar el contenido entre OPs del mismo AMFE (debe ser invariante).

### Nivel 2 — `operationFunction` (Func. Paso)

**Qué es:** qué HACE ESTA OPERACIÓN específica para que el item logre su función.

**Quién la cumple:** el PASO de proceso (la estación, la operación productiva concreta).

**Cuándo cambia:** **POR CADA OP.** Cambia en cada paso del flujograma.

**Estructura recomendada:** verbo + objetivo + criterio/condición.

**Ejemplos correctos (de AMFE-ARM-PAT)**:
- OP 10 RECEPCION: "Asegurar conformidad de calidad, cantidad y trazabilidad de materia prima recibida"
- OP 50 COSTURA UNION: "Unir piezas de tela garantizando resistencia y alineación de costuras"
- OP 60 INYECCION PLASTICAS: "Fabricar pieza plástica cumpliendo especificaciones dimensionales y apariencia, sin scrap ni retrabajo"
- OP 90 TAPIZADO: "Revestir sustrato con funda cosida asegurando adherencia, posición y ausencia de defectos"
- OP 110 EMBALAJE: "Mantener integridad física y conformidad durante almacenamiento y transporte"

**Patrones de redacción (extraídos de canónicos Barack)**:
- Empieza con VERBO ("Asegurar", "Unir", "Fabricar", "Revestir", "Mantener", "Inspeccionar")
- Longitud típica: 80-200 caracteres
- Incluye criterio/restricción cuando es posible ("...sin scrap ni retrabajo", "...cumpliendo especificaciones dimensionales")

**Errores comunes:**
- ❌ Copiar literal de `focusElementFunction` (bug del AMFE 150 pre-2026-05-08).
- ❌ Vaciar el campo cuando ya hay contenido en `focusElementFunction` (genera columna vacía en Excel).
- ❌ Usar el nombre de la OP como función ("Función: COSTURA UNION" — eso no es función, es nombre).

### Nivel 3 — `function.description` (Func. Elem. Trabajo / 4M Function)

**Qué es:** qué APORTA cada recurso 4M (Máquina, Operario, Material, Método, Medio Ambiente, Medición) a este paso de proceso para que cumpla su función.

**Quién la cumple:** el RECURSO específico (la inyectora, el operador, el hilo VW 50106, el procedimiento P-09/I, etc.).

**Cuándo cambia:** POR CADA Work Element + función dentro del WE.

**Estructura recomendada:** verbo activo + objeto + criterio (atómica, una sola acción por línea).

**Ejemplos correctos (de AMFE-ARM-PAT, OP 60 Inyección Plásticas)**:
- WE "Máquina inyectora" → fn.description: "Inyectar plástico controlando presión, temperatura y tiempo de ciclo"
- WE "Operador" → fn.description: "Inspección visual 100% de pieza al desmoldeo"
- WE "Molde" → fn.description: "Conformar geometría con tolerancia ±0.5mm"
- WE "Hoja parámetros" → fn.description: "Validar dossier vigente al arranque de turno"

**Errores comunes (detectados en AMFE 150 pre-fix):**
- ❌ `function.description` igual al `name` del WE (ej: WE.name="Máquina", fn.description="Máquina") — sin sentido.
- ❌ `function.description` igual al `we.type` traducido (ej: WE.type=Material, fn.description="Material") — sin sentido.
- ❌ `function.description` con texto del paso (que va en `operationFunction`) en lugar de la contribución del recurso.
- ❌ `function.description` vacía (deja la celda Excel vacía pero permite continuar).

## Cómo se exporta

El export Excel del AMFE imprime las 3 funciones en 3 columnas adyacentes ("Func. Item" / "Func. Paso" / "Func. Elem. Trabajo"). Si dos están iguales, el lector ve duplicación. Si las 3 están iguales, el AMFE pasa por uno con 1 nivel en vez de 3. **AIAG-VDA 2019 exige los 3 niveles distintos.**

## Validación

### Pre-guardado (a agregar a `amfeValidation.ts` — TODO)

| Check | Tipo | Acción |
|---|---|---|
| `focusElementFunction` vacío en cualquier OP | warning (draft) / blocker (approved) | Pedir al equipo APQP llenarlo |
| `operationFunction` vacío en cualquier OP | warning | Pedir al equipo APQP llenarlo |
| `focusElementFunction` = `operationFunction` literalmente | **blocker** | Vaciar `operationFunction` y pedir al equipo definir el específico |
| `focusElementFunction` distinto entre OPs del mismo AMFE | **blocker** | Debe ser idéntico (regla Barack) |
| `function.description` igual al `we.name` o `we.type` traducido | warning | Probable placeholder/copia-pega |
| `function.description` vacío en WE con failures | warning | Llenar antes de approved |

### Auditor `_auditAll.mjs` (a extender — TODO)

Agregar checks 3.A1, 3.A2, 3.A3 que ejecuten lo de arriba sobre todos los AMFEs.

## Acciones automáticas que SÍ puede hacer Claude

1. ✅ **Vaciar `operationFunction` cuando es literalmente igual a `focusElementFunction`**. Esto resuelve el bug visual del Excel (no muestra duplicación) sin inventar contenido.
2. ✅ **Reportar en dossier** OPs con campos vacíos para que el equipo APQP los llene.
3. ✅ **Replicar literal** de un AMFE canónico hermano cuando hay equivalente directo de OP (ej: copiar Func.Paso de ARM-PAT OP 50 a 150 OP 50 si la operación es funcionalmente igual).
4. ❌ **NUNCA inventar** Func.Item, Func.Paso o Func.WE. El equipo APQP define el contenido.

## Referencia rápida — comparación de los 3 niveles

| Nivel | Pregunta que responde | Cambia con OP? | Ejemplo (OP Costura Unión) |
|---|---|---|---|
| 1. Item Function | ¿Qué función entrega el armrest al cliente final? | NO | "Brindar comodidad ergonómica al pasajero trasero" |
| 2. Process Step Function | ¿Qué hace esta operación de costura? | SÍ | "Unir paneles textiles con costura recta resistente y alineada" |
| 3. Work Element Function | ¿Qué aporta la máquina de coser a este paso? | SÍ (por WE) | "Mantener tensión de hilo y velocidad constante para 4 puntadas/16mm" |

## Glosario rápido

- **Step 1 (Scope)** — alcance del análisis
- **Step 2 (Structure Analysis)** — items, pasos, work elements identificados
- **Step 3 (Function Analysis)** — los 3 niveles de función ← ESTA REGLA
- **Step 4 (Failure Analysis)** — modos de falla, efectos, causas
- **Step 5 (Risk Analysis)** — S/O/D, AP, controles
- **Step 6 (Optimization)** — acciones
- **Step 7 (Documentation)** — comunicación

## Incidentes asociados

- **2026-05-08 (AMFE 150)**: 10/10 OPs con `operationFunction` = `focusElementFunction` literal. Causa: imports/clones que duplicaron el campo. Fix: vaciar `operationFunction` para que el equipo APQP lo defina específicamente.
- **2026-05-08 PARTE 2 (AMFE 150)**: WEs con `function.description` = etiqueta de tipo 6M textual (ej: type=Measurement con fn.description="Método de Fabricación"). El campo arrastraba un placeholder genérico del data crudo del PPAP original. Una heurística parcial (solo regex sobre algunas variantes) no lo detectó. Fix sistémico abajo.
- **2026-04-12 (LECCIONES_APRENDIDAS)**: `operationFunction` no se propagaba de maestro a variantes en 3 Headrest. Quedó vacío.

## Heurística anti-recaída — detección de strings 6M genéricos

Cualquier `we.name` o `fn.description` que coincida (case+tildes insensitive, trim) con la lista canónica de etiquetas 6M es un PLACEHOLDER que debe reemplazarse:

```javascript
const GENERIC_LABELS = [
  'machine', 'maquina', 'máquina',
  'man', 'mano de obra',
  'material', 'material (indirectos)', 'materiales',
  'method', 'metodo', 'método', 'metodo de fabricacion', 'método de fabricación',
  'measurement', 'medicion', 'medición',
  'environment', 'medio ambiente', 'ambiente',
];

function normalize(s) {
  return (s || '').toString().trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // saca tildes
}

function isGeneric6MLabel(s) {
  return GENERIC_LABELS.map(normalize).includes(normalize(s));
}
```

### Reglas de validación

Un AMFE NO puede tener:
1. WE con `name` que matchee `isGeneric6MLabel()` → debe ser específico (ej: "Operador de Costura", "Inyectora PU + Dosificadora A:B").
2. `function.description` que matchee `isGeneric6MLabel()` → debe describir la contribución del recurso ("Coser uniones controlando tensión de hilo y longitud de puntada").
3. `function.description` igual al `we.name` o al `we.type` traducido → significa que es placeholder copiado.

### Query SQL de auditoría — correr antes de cada entrega PPAP

```sql
WITH amfe AS (SELECT amfe_number, data::jsonb as d FROM amfe_documents)
SELECT amfe_number,
       op->>'operationNumber' as op_num,
       we->>'type' as type,
       we->>'name' as we_name,
       fn->>'functionDescription' as fn_desc
FROM amfe,
     jsonb_array_elements(d->'operations') op,
     jsonb_array_elements(op->'workElements') we,
     jsonb_array_elements(we->'functions') fn
WHERE LOWER(TRIM(unaccent(COALESCE(we->>'name','')))) IN
        ('machine','maquina','man','mano de obra','material','material (indirectos)',
         'method','metodo','metodo de fabricacion','measurement','medicion',
         'environment','medio ambiente')
   OR LOWER(TRIM(unaccent(COALESCE(fn->>'functionDescription','')))) IN
        ('machine','maquina','man','mano de obra','material','material (indirectos)',
         'method','metodo','metodo de fabricacion','measurement','medicion',
         'environment','medio ambiente');
```

(`unaccent()` requiere extensión postgres; alternativa: hacer en JS post-query.)

### Acción correctiva

Si la query devuelve resultados:
1. Para `we.name` genérico → renombrar con el recurso real (ej: "Operador", "Inyectora PU", "Hilo VW 50106"). Si no se sabe el específico, usar `OP_TYPE_FN[`${opNum}__${type}`]` como mejor aproximación o consultar al equipo APQP.
2. Para `fn.description` genérico → describir la CONTRIBUCIÓN del recurso al paso ("Coser uniones...", "Inyectar mezcla...").

### Lección aprendida

**No alcanza con una regex parcial** que cubra "algunos" placeholders. La detección debe ser por LISTA CANÓNICA + NORMALIZACIÓN (lowercase + sin tildes + trim). Si se agrega un nuevo término genérico al diccionario de tipos 6M (ej: `WORK_ELEMENT_LABELS`), también hay que agregarlo a `GENERIC_LABELS`.

**Auditor `_auditAll.mjs` debe incluir esta validación** (TODO: agregar check `WE_GENERIC_PLACEHOLDER` y `FN_GENERIC_PLACEHOLDER`).
