---
name: amfe-domain
description: Conocimiento AMFE profundo de Barack — ejemplos de los 3 niveles de funcion, jerarquia de fuentes para WE.name con vectores de test, tabla keyword→OP para detectar fallas mal alocadas, SQL de auditoria de placeholders 6M, formato canonico de applicableParts L0-L3, workflow completo de renumeracion. Usar cuando se edita contenido de AMFEs (funciones, WEs, renumeraciones, placeholders) y la regla amfe.md no alcanza. Complementa amfe-cookbook (recetas de gaps) y apqp-schema (schema JSON).
---

# amfe-domain — detalle profundo del dominio AMFE Barack

La regla operativa vive en `.claude/rules/amfe.md`. Este skill tiene el detalle que no entra ahi.

## 1. Los 3 niveles de funcion — ejemplos canonicos (de AMFE-ARM-PAT)

**Nivel 1 `focusElementFunction`** (identica en TODAS las OPs del AMFE):
```
Función Interna: Proveer pieza tapizada conforme dimensional, costuras y bordes sin defectos
 / Función del Cliente: Permitir ensamble en panel de puerta sin interferencia ni Gap & Flush fuera de spec
 / Función del Usuario Final: Confort ergonómico al apoyar antebrazo, estética coherente con interior, ausencia de S&R
```

**Nivel 2 `operationFunction`** (verbo + objetivo + criterio, 80-200 chars, cambia por OP):
- OP 10 RECEPCION: "Asegurar conformidad de calidad, cantidad y trazabilidad de materia prima recibida"
- OP 50 COSTURA UNION: "Unir piezas de tela garantizando resistencia y alineación de costuras"
- OP 60 INYECCION PLASTICAS: "Fabricar pieza plástica cumpliendo especificaciones dimensionales y apariencia, sin scrap ni retrabajo"
- OP 90 TAPIZADO: "Revestir sustrato con funda cosida asegurando adherencia, posición y ausencia de defectos"
- OP 110 EMBALAJE: "Mantener integridad física y conformidad durante almacenamiento y transporte"

**Nivel 3 `function.description`** (contribucion del recurso, atomica, 1 accion por linea):
- WE "Máquina inyectora" → "Inyectar plástico controlando presión, temperatura y tiempo de ciclo"
- WE "Operador" → "Inspección visual 100% de pieza al desmoldeo"
- WE "Molde" → "Conformar geometría con tolerancia ±0.5mm"
- WE "Máquina de coser" (OP costura) → "Mantener tensión de hilo y velocidad constante para 4 puntadas/16mm"

Regla AIAG-VDA: *"Process Item functions lead to effects, Process Step functions lead to failure modes, Process Work Elements lead to causes."*

**Errores tipicos:** operationFunction = copia de focusElementFunction; usar el NOMBRE de la OP como funcion ("Función: COSTURA UNION"); fn.description = WE.name o type traducido; fn.description con texto del paso en vez de la contribucion del recurso.

## 2. Heuristica anti-placeholder 6M — lista canonica

Fuente unica: `core/amfe/genericLabels.ts` (+ espejo `scripts/_lib/genericLabels.mjs`). Comparar con normalize (lowercase + NFD sin tildes + trim), NUNCA regex parcial. Si se agrega un termino al diccionario 6M, agregarlo tambien a GENERIC_LABELS.

```javascript
const GENERIC_LABELS = ['machine','maquina','man','mano de obra','material','material (indirectos)','materiales','method','metodo','metodo de fabricacion','measurement','medicion','environment','medio ambiente','ambiente'];
function normalize(s){return (s||'').toString().trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');}
```

### SQL de auditoria (correr antes de cada entrega PPAP)

```sql
WITH amfe AS (SELECT amfe_number, data::jsonb as d FROM amfe_documents)
SELECT amfe_number, op->>'operationNumber' op_num, we->>'type' type, we->>'name' we_name, fn->>'functionDescription' fn_desc
FROM amfe, jsonb_array_elements(d->'operations') op, jsonb_array_elements(op->'workElements') we, jsonb_array_elements(we->'functions') fn
WHERE LOWER(TRIM(unaccent(COALESCE(we->>'name','')))) IN ('machine','maquina','man','mano de obra','material','material (indirectos)','method','metodo','metodo de fabricacion','measurement','medicion','environment','medio ambiente')
   OR LOWER(TRIM(unaccent(COALESCE(fn->>'functionDescription','')))) IN ('machine','maquina','man','mano de obra','material','material (indirectos)','method','metodo','metodo de fabricacion','measurement','medicion','environment','medio ambiente');
```
(Sin extension `unaccent`: filtrar en JS post-query.)

## 3. Jerarquia de fuentes para WE.name — vectores de test

| Caso | Input | Esperado |
|---|---|---|
| 1 | OP RECEPCION, type=Machine, otros AMFEs tienen "Autoelevador" | paso 1 → "Autoelevador" |
| 2 | OP COSTURA, type=Man | rol canonico → "Operador de Produccion" |
| 3 | OP ENFUNDADO manual, type=Machine, sin match en ningun AMFE | paso 8 → omitir WE (mover failures al primer WE valido) |
| 4 | OP MYLAR, type=Machine, sin info en biblioteca | paso 7 → TBD |
| 5 | OP nueva, type=Material, info en HO preliminar xlsx | paso 5 → copiar de HO |

Placeholders invalidos en WE.name (todos CRITICAL): `"Proceso Op 10"`, `"Maquina"` (type traducido), `"Proceso Op 60"` en OP 50 (foreign opNumber post-renumeracion). Validos: `"Máquina de coser"`, `"Inyectora de PUR"`, `"Hilo VW 50106"`.

## 4. Tabla keyword→OP valida (deteccion de fallas mal alocadas)

Normalize NFD + lowercase + trim sobre `failure.description`; si matchea keyword y su OP actual NO esta en la columna valida → CRITICAL MISALLOCATED, bloquea renumeracion:

| Keyword | OPs validas (nombre contiene) |
|---|---|
| costura / puntada / atraque / hilo | COSTURA* |
| corte / cuchilla / vinilo corte | CORTE* |
| inyeccion / PUR / PU / isocianato / poliol / ratio A:B | INYECCION*, PU*, ESPUMADO* |
| embalaje / etiqueta producto terminado | EMBALAJE* |
| recepcion / materia prima / proveedor MP | RECEPCION* |
| varilla / asta funda / vinilo reten | VARILLA*, INSERCION* |
| funda / enfundar / pliegue funda | ENFUNDADO*, TAPIZADO* |
| mylar / plantilla forma | MYLAR*, CONTROL FORMA* |
| troquelado / espuma troquelada | TROQUELADO* |
| reproceso / retrabajo | REPROCESO* |

## 5. Workflow completo de renumeracion segura

```bash
node scripts/_auditWePlaceholdersAndAllocation.mjs > tmp/audit-pre.json   # 1. auditar ANTES
# 2. si hay CRITICAL: reasignar failures primero (dry-run → review → --apply)
# 3. recien entonces renumerar (dry-run → review → --apply)
node scripts/_auditWePlaceholdersAndAllocation.mjs > tmp/audit-post.json  # 4. re-auditar
# 5. verificar que summary.critical no aumento; limpiar WE.name con "Op N" viejos
```
Anti-patrones: renumerar y despues limpiar; confiar solo en runWithValidation (valida estructura, no contenido); asumir que 2 OPs con mismo WE.type son intercambiables; find&replace en WE.name sin leer las causas.

## 6. Formato canonico applicableParts (variantes L0-L3)

```
APC DELANTERO
L0  2HC.881.901    RL1  | PVC Titan Black
L1  2HC.881.901.A  GFV  | FABRIC Jacquard Black
L2  2HC.881.901.B  GEV  | PVC Andino Gray
L3  2HC.881.901.C  EFG  | PVC Dark Slate
```
Reglas: PN con puntos cada 3 digitos; sufijos .A/.B/.C = L1/L2/L3; codigo color 3 letras; material separado con ` | `; separador entre lineas `\n`; primera linea = producto en MAYUSCULAS. Otros canonicos: APC TRASERO CENTRAL 2HC.885.900 (L1 EIF, L2/L3 SIY), APC TRASERO LATERAL 2HC.885.901 (L1 GFU, L2 GEQ, L3 DZS). Tabla `products` (balanceo): 1 fila por variante, `codigo` = `<PN>.<var> <COLOR>`, `descripcion` = `<PRODUCTO> L<N> - <Material>`.
Anti-patrones: todo en una linea, "L0, L1, L2, L3" sin PNs, PN sin puntos.

## 7. Diferencias Headrest Front vs Rear (no flaggear como bug)

- **HF-PAT**: EPP (espuma rigida) + varilla; el EPP se inserta en el enfundado (OP50); 16 OPs con sub-pasos de espumado desglosados (OP60 PRECINTO, OP61 BOLSA, OP62 CIERRE MOLDE).
- **HRC/HRO-PAT**: solo varilla, sin EPP; van directo a OP50 INYECCION DE PU; 14 OPs.
- Variantes L0 no tienen costura vista (Costura Vista aplica solo L1/L2/L3) — se documenta con restriccion en el nombre de la OP, no con docs separados.
- SI alinear: severidades de fallas comunes (costura, rebaba, puntadas) calibradas distinto entre los 3 — eso es copy-paste mal.

## 8. Redaccion — ejemplos de simplificacion (decision Fak)

| Mal (verboso/Claude) | Bien (Barack) |
|---|---|
| "Retirar el sistema de alimentacion sin dejar rebaba residual ni bebedero visible en el punto de inyeccion" | "Cortar la colada sin dejar marca en la pieza" |
| "Volumen de inyeccion demasiado bajo (dosificacion corta) respecto al tamano de pieza" | "Dosificacion corta" |
| "Dossier de parametros validado + panel de la inyectora con alarmas configuradas por zona" | "Dossier + alarmas en panel" |
| "Proveer superficie estable y bien iluminada para el control visual y dimensional" | "Mesa de control con buena luz" |

## 9. Campos de AmfeCause (referencia)

- `characteristicNumber`: secuencial dentro de la OP ("1","2","3"), se reinicia por OP; vincula con `ControlPlanItem.characteristicNumber`.
- `specialChar`: "CC" | "SC" | "" — override manual tiene prioridad sobre calculo.
- `filterCode`: campo libre para filtrado/agrupacion, no participa de AP ni generacion CP.
