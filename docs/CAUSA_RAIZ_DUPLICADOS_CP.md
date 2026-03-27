# Causa Raiz — Duplicados en CP Export + Aprob. Planta + Estructura Producto/Proceso

**Fecha:** 2026-03-27
**Metodo:** Query directa a Supabase de los 8 CPs + lectura linea por linea del codigo de export y generador.

---

## 1. Duplicados en el CP

### Diagnostico de datos

Se consultaron los 8 CPs en Supabase. Resultado:

| CP | Items | Grupos con duplicados | Exactos (100% identicos) |
|----|-------|-----------------------|--------------------------|
| PWA/TELAS_PLANAS | 44 | 4 | 2 |
| PWA/TELAS_TERMOFORMADAS | 27 | 2 | 0 |
| VWA/PATAGONIA/ARMREST_DOOR_PANEL | 178 | 20 | 0 |
| VWA/PATAGONIA/HEADREST_FRONT | 69 | 1 | 0 |
| VWA/PATAGONIA/HEADREST_REAR_CEN | 67 | 1 | 0 |
| VWA/PATAGONIA/HEADREST_REAR_OUT | 69 | 1 | 0 |
| VWA/PATAGONIA/INSERT | 253 | 87 | 0 |
| VWA/PATAGONIA/TOP_ROLL | 96 | 11 | 2 |
| **TOTAL** | **803** | **127** | **4** |

### Causa raiz

**Los duplicados estan en Supabase** (no los genera el export). El export (`controlPlanExcelExport.ts:315-329`) hace un loop simple sobre `doc.items` sin joins ni flatMaps — una fila de entrada = una fila de salida.

**Hay DOS tipos de duplicados:**

#### Tipo A — "Falsos duplicados" (123 de 127 grupos)

Filas con la **misma caracteristica** pero **diferentes** evaluationTechnique, sampleSize, controlMethod, etc.

Ejemplo (Insert, OP 10, "Material / pieza golpeada o danada durante transporte" x3):

| # | evaluationTechnique (recortado) |
|---|------|
| 1 | Inspeccion visual en recepcion |
| 2 | Verificacion del estado del embalaje antes de... |
| 3 | Inspeccion Visual de danos/suciedad en el empaque... |

**Por que se generan:** El generador (`controlPlanGenerator.ts`) usa como clave de dedup:
- Product rows: `opNumber + fail.description + detectionControl`
- Process rows: `opNumber + cause.cause + preventionControl`

Cuando el **mismo modo de falla** en el AMFE tiene N causas con N **detection controls diferentes**, genera N filas product, todas con el mismo `productCharacteristic` pero diferente `evaluationTechnique`.

Ejemplo: falla "Material golpeado" tiene 3 causas:
1. Causa: "Mala estiba" → detectionControl: "Inspeccion visual en recepcion"
2. Causa: "Manipulacion incorrecta" → detectionControl: "Verificacion del embalaje..."
3. Causa: "Almacenaje inadecuado" → detectionControl: "Inspeccion Visual de danos..."

Cada una genera 1 fila product con la misma descripcion de falla pero diferente evaluationTechnique.

**El mismo patron aplica a process rows:** misma causa con diferentes prevention controls genera multiples filas con el mismo `processCharacteristic`.

**Ademas**, el Insert (253 items, 87 grupos duplicados) muestra un patron adicional: muchos items aparecen 2x con diferencias sistematicas en sampleSize y reactionPlan (una copia con "100%" y otra con "3 piezas"). Esto indica que el seed script (`run-seed-complete-inserto.mjs`) tiene su propio generador con defaults diferentes al del modulo (`controlPlanGenerator.ts`), y ambos conjuntos de items coexisten en el mismo documento.

#### Tipo B — Duplicados exactos (4 grupos)

| CP | OP | Caracteristica |
|----|-----|---------------|
| PWA/TELAS_PLANAS | 20 | Material fuera de especificacion requerida (process) |
| PWA/TELAS_PLANAS | 10d | Orificios fuera de posicion / Error del operario (process) |
| VWA/PATAGONIA/TOP_ROLL | 50 | Adherencia del material en zona de plegado (product) |
| VWA/PATAGONIA/TOP_ROLL | 50 | Temperatura de aire caliente/IR por debajo del set-point (process) |

Estos son bugs reales en los datos — filas 100% identicas que deberian eliminarse.

### Donde NO esta el problema

- **Export** (`controlPlanExcelExport.ts`): Loop simple, no multiplica filas.
- **Supabase queries** (`cpRepository.ts`): SELECT simple del JSON, no hay joins.
- **Dedup del generador**: Funciona correctamente dentro de su propia ejecucion. El problema es que el criterio de agrupacion es por `(falla + detectionControl)`, no solo por falla.

---

## 2. Campo "Aprob. Planta" = Carlos Baptista

### Causa raiz CONFIRMADA

El script `scripts/normalize-names-amfe-cp.mjs` (linea 27-31) hardcodea:

```javascript
const CP_HEADER = {
    responsible: 'Manuel Meszaros',
    approvedBy: 'Carlos Baptista',   // <── ACA ESTA EL PROBLEMA
    coreTeam: 'Carlos Baptista (Ingenieria), Manuel Meszaros (Calidad)',
};
```

Este script se ejecuto sobre TODOS los CPs y sobreescribio el campo `approvedBy` en los 8 documentos.

El seed original del Insert (`run-seed-complete-inserto.mjs` linea 591) tenia el valor correcto: `approvedBy: 'G.Cal'`.

**Estado actual en Supabase (verificado):**

| CP | header.approvedBy |
|----|-------------------|
| PWA/TELAS_PLANAS | Carlos Baptista |
| PWA/TELAS_TERMOFORMADAS | Carlos Baptista |
| VWA/PATAGONIA/ARMREST_DOOR_PANEL | Carlos Baptista |
| VWA/PATAGONIA/HEADREST_FRONT | Carlos Baptista |
| VWA/PATAGONIA/HEADREST_REAR_CEN | Carlos Baptista |
| VWA/PATAGONIA/HEADREST_REAR_OUT | Carlos Baptista |
| VWA/PATAGONIA/INSERT | Carlos Baptista |
| VWA/PATAGONIA/TOP_ROLL | Carlos Baptista |

Los 8 dicen "Carlos Baptista". Todos deberian decir "Gonzalo Cal" (G.Cal).

---

## 3. Estructura productCharacteristic vs processCharacteristic

### Estado actual

**CPs generados desde AMFE (Insert, Armrest, Top Roll, PWA):**
- `productCharacteristic` = descripcion del **modo de falla** del AMFE (ej: "Material golpeado", "Costura descosida")
- `processCharacteristic` = descripcion de la **causa** del AMFE (ej: "Mala estiba", "Aguja despuntada")

Ejemplo (Insert, OP 10):
```
Producto: "(vacio)"        | Proceso: "Mala estiba y embalaje inadecuado"
Producto: "(vacio)"        | Proceso: "Manipulacion incorrecta en transito"
Producto: "Material / pieza golpeada..." | Proceso: "(vacio)"
```

Cada fila tiene UN solo campo lleno (product O process, nunca ambos) — esto es correcto segun AIAG-VDA CP 2024.

**CPs de Headrests (Front, Rear Center, Rear Outer):**
- `productCharacteristic` = **propiedad del material** (ej: "Tipo de Producto", "Color", "Espesor", "Aspecto")
- `processCharacteristic` = generalmente vacio

Ejemplo (Headrest Front, OP 10):
```
Producto: "Tipo de Producto" | Proceso: "(vacio)"
Producto: "Color"             | Proceso: "(vacio)"
Producto: "Dimensional de control" | Proceso: "(vacio)"
```

### Comparacion con la referencia de la empresa

La referencia de la empresa usa:
- **Columna "Producto"**: COMPONENTE/MATERIAL (ej: "VWA C00686690 Armazon interior (EPP) cod.: TB")
- **Columna "Proceso"**: TIPO DE PRODUCTO y COLOR asociado

**Conclusion:** Ninguno de los dos formatos actuales coincide exactamente con la referencia:
- Los CPs generados desde AMFE usan fallas/causas (terminologia AIAG-VDA pura)
- Los CPs de headrests usan propiedades del material (mas cercano a la referencia pero no identico)
- La referencia de la empresa usa componente + variante de color, que es una interpretacion propia

---

## 4. Plan de correccion propuesto

### 4.1 Duplicados — Tipo A (falsos duplicados por dedup granular)

**Opcion A — Cambiar el criterio de dedup del generador:**
Agrupar product rows por `(opNumber + fail.description)` en vez de `(opNumber + fail.description + detectionControl)`. Esto consolidaria todas las detecciones del mismo modo de falla en UNA sola fila, concatenando los detection controls.

- Pro: Elimina "duplicados" visuales
- Contra: Pierde detalle — multiples detection controls se colapsan en una celda

**Opcion B — Consolidar items existentes en Supabase:**
Script que agrupe items con misma (op + characteristic) y los fusione, concatenando los campos que difieren.

- Pro: Limpia los datos sin cambiar el generador
- Contra: Requiere decision sobre como fusionar (primer valor, concatenar, etc.)

**Opcion C — No hacer nada (los items son correctos segun AIAG):**
El estandar AIAG-VDA permite 1 fila por combinacion de (caracteristica + control). Las filas NO son duplicados reales — cada una tiene un control diferente.

- Pro: Cumple el estandar al pie de la letra
- Contra: El CP queda muy largo y parece tener duplicados

**Recomendacion:** Opcion B — consolidar items existentes, agrupando por (op + characteristic) y concatenando evaluationTechnique y controlMethod con " / ". Esto reduce el largo del CP sin perder informacion. El generador tambien deberia actualizarse (Opcion A) para evitar que se regeneren duplicados en el futuro.

### 4.2 Duplicados — Tipo B (exactos)

Eliminar las 4 filas duplicadas exactas directamente en Supabase. Son bugs claros.

### 4.3 Aprob. Planta

Actualizar `header.approvedBy` de "Carlos Baptista" a "Gonzalo Cal" en los 8 CPs. Script simple de UPDATE sobre el JSON.

Tambien corregir `scripts/normalize-names-amfe-cp.mjs` linea 29 para que diga `approvedBy: 'Gonzalo Cal'` (o eliminar ese campo del script si no debe normalizarse).

### 4.4 productCharacteristic vs processCharacteristic

Requiere decision del usuario:
- Mantener el formato AIAG-VDA actual (fallas/causas)?
- Adaptar al formato de la referencia de la empresa (componente/variante)?
- Usar un hibrido?

Esto es un cambio de contenido que afecta a los 8 CPs y no deberia hacerse sin aprobacion.
