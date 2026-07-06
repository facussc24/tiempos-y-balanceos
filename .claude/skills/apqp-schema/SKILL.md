---
name: apqp-schema
description: Estructura de datos APQP en Supabase — schemas JSON de amfe_documents, cp_documents, ho_documents, pfd_documents. Tablas de soporte (products, product_families). Patron de actualizacion de datos JSONB. Usar cuando se leen, modifican o escriben datos en tablas APQP, cuando se crean scripts .mjs que tocan Supabase, o cuando se trabaja con repositorios.
user-invocable: false
---

# Supabase — Estructura de Datos APQP

## Tablas principales de documentos

Todos los documentos APQP guardan sus datos en una columna `data` de tipo JSONB. La estructura es:

```
amfe_documents    → data: { header: {...}, operations: [...] }
cp_documents      → data: { header: {...}, items: [...] }
ho_documents      → data: { header: {...}, sheets: [...] }
pfd_documents     → data: { header: {...}, steps: [...] }
```

## Estructura JSON del AMFE (amfe_documents.data)

```jsonc
{
  "header": {
    "companyName", "scope", "partNumber", "applicableParts",
    "responsibleEngineer", "coreTeam", "preparedBy", "approvedBy",
    "amfeDate", "revisionLevel", "revisionDate"
  },
  "operations": [
    {
      "id": "uuid",
      "operationNumber": "10",      // STRING, ordenar con parseInt()
      "operationName": "RECEPCION DE MATERIA PRIMA",
      "linkedPfdStepId": "uuid",
      "workElements": [
        {
          "id": "uuid",
          "description": "...",
          "functions": [
            {
              "id": "uuid",
              "description": "...",
              "failures": [
                {
                  "id": "uuid",
                  "description": "modo de falla",
                  "effectLocal": "...",
                  "effectNextLevel": "...",    // OBLIGATORIO (3 niveles VDA)
                  "effectEndUser": "...",      // OBLIGATORIO
                  "causes": [
                    {
                      "id": "uuid",
                      "description": "causa",
                      "severity": 7,           // 1-10
                      "occurrence": 4,         // 1-10
                      "detection": 6,          // 1-10
                      "actionPriority": "M",   // "H", "M", "L"
                      "preventionControl": "...",
                      "detectionControl": "...",
                      "preventionAction": "...",  // OBLIGATORIO si AP=H
                      "detectionAction": "...",
                      "responsible": "Carlos Baptista (Ingeniería)",
                      "targetDate": "2026-07-01",
                      "status": "Pendiente"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## Estructura JSON del Plan de Control (cp_documents.data)

```jsonc
{
  "header": {
    "partName", "partNumber", "applicableParts",
    "companyName", "customerName",
    "coreTeam": "Carlos Baptista (Ingeniería), Manuel Meszaros (Calidad), Marianna Vera (Producción)",
    "preparedBy": "Facundo Santoro",
    "approvedBy": "Carlos Baptista",
    "customerApproval": "",         // Campo ÚNICO (no separar ing/cal)
    "revisionLevel", "revisionDate"
  },
  "items": [
    {
      "id": "uuid",
      "processStepNumber": "10",    // STRING, ordenar con parseInt()
      "processStepName": "RECEPCION DE MATERIA PRIMA",
      "machineTool": "N/A",         // NUNCA poner "Visual" acá — eso es método
      "characteristic": "Flamabilidad del material",
      "classification": "CC",       // "CC", "SC", o "" (vacío = estándar)
      "specification": "Según TL 1010 VW",  // NUNCA "Conforme a especificación" genérico
      "evaluationTechnique": "Certificado de laboratorio",
      "sampleSize": "1 muestra",
      "sampleFrequency": "Por entrega",
      "controlMethod": "Inspección documental de certificado",
      "reactionPlanOwner": "Inspector de Calidad",  // SIEMPRE rol, nunca nombre de persona
      "reactionPlan": "Segregar lote, notificar s/ P-09/I",
      "amfeCauseIds": ["uuid"],     // Vínculo con causas del AMFE
      "linkedAmfeOperationId": "uuid"
    }
  ]
}
```

## Estructura JSON de Hoja de Operaciones (ho_documents.data)

```jsonc
{
  "header": {
    "documentNumber": "I-IN-002.4-R01",
    "partDescription", "hoNumber": "HO-10",  // Formato "HO-{opNumber}"
    "preparedBy": "Facundo Santoro",
    "approvedBy": "Carlos Baptista"
  },
  "sheets": [
    {
      "id": "uuid",
      "hoNumber": "HO-10",
      "operationNumber": "10",
      "operationName": "RECEPCION DE MATERIA PRIMA",
      "linkedCpOperationNumber": "10",
      "steps": [                    // Pasos TWI (Training Within Industry)
        {
          "id": "uuid",
          "stepNumber": 1,
          "description": "Verificar documentación del proveedor",
          "keyPoints": [            // Puntos clave ★
            { "text": "Comparar remito con orden de compra", "symbol": "★" }
          ],
          "reasons": ["Asegurar trazabilidad del lote"]
        }
      ],
      "qcItems": [                  // Ciclo de control (viene del CP)
        {
          "id": "uuid",
          "cpItemId": "uuid",       // Vínculo 1:1 con CP item
          "characteristic": "Flamabilidad",
          "controlMethod": "Certificado de laboratorio",
          "frequency": "Por entrega",
          "responsible": "Inspector de Calidad",  // DEBE coincidir con CP
          "specification": "Según TL 1010 VW",
          "reactionPlan": "Segregar lote s/ P-09/I"
        }
      ],
      "ppe": ["anteojos", "guantes", "zapatos"],  // EPP por operación
      "visualAids": []
    }
  ]
}
```

## Estructura JSON del PFD (pfd_documents.data)

```jsonc
{
  "header": { "partName", "partNumber", "companyName" },
  "steps": [
    {
      "id": "uuid",
      "stepNumber": "10",
      "name": "RECEPCION DE MATERIA PRIMA",
      "type": "operation",  // "operation", "inspection", "transport", "storage", "decision"
      "linkedAmfeOperationId": "uuid"
    }
  ]
}
```

## Tabla `projects` (Tiempos y Balanceos — OJO: NO es JSONB)

`projects.data` es **TEXT** (JSON stringificado), NO jsonb. La app hace `JSON.stringify(data)`
al guardar y `JSON.parse` al leer — OPUESTO a `amfe_documents` (jsonb directo). En scripts .mjs:
si escribís `.update({ data: objeto })` con el objeto crudo, la app leería mal. Guardar
`data: JSON.stringify(objeto)` y verificar `typeof JSON.parse(row.data) === 'object'`.
RLS = authenticated (anon → `[]`). Acceso sin `.env.local`: MCP Supabase, o token de la app
(el navegador logueado descarga un archivo con `SB_ACCESS_TOKEN`; supabase-js maneja mal el
JWT ES256 desde Node → usar fetch REST directo). Detalle: memoria `project-registro-tiempos-inyeccion`.

Estructura de `data` (ProjectData, ver `types/project.ts`):
- `meta`: { name, date, client, project, version, engineer, dailyDemand, activeShifts,
  manualOEE (0..1), useManualOEE, useSectorOEE, configuredStations, `reservationPct?` (0..1), ... }
- `shifts[]`: { id, name, startTime, endTime, `length` (min BRUTOS), breaks[]{duration} } — el
  adapter Gate 3 lee `s.length` menos breaks. Turnos estándar Barack = 21,5 h netas/día
  (T1 540-60=480 · T2 480-45=435 · T3 420-45=375 min).
- `sectors[]`, `tasks[]`, `assignments[]{taskId,stationId}`, `stationConfigs[]{id,replicas,oeeTarget}`.

### Task de inyección (para Gate 3 VW / capacidad)
Un molde = 1 task `executionMode:'injection'`:
- `times: [ciclo_molde × 5]` ← el CICLO COMPLETO del molde (todas las cavidades salen en 1 golpe).
- `cycleQuantity: cavidades` ← `utils/graph.ts:142` normaliza `times[]` dividiendo por esto → por-pieza.
- `averageTime = standardTime = ciclo/cavidades` (por pieza).
- `injectionParams: { optimalCavities, realCycle: ciclo/cav, pInyectionTime: 0, pCuringTime: ciclo,
  injectionMode:'batch', cavityMode:'manual', productionVolume: golpes }`.

**INVARIANTE Gate 3**: `cycleTimeSec = ciclo de molde = realCycle × cavidades` (NO por-pieza; si no,
capacidad inflada ×cavidades — bug 0aaf86e, test `gate3_cavity_export.test.ts`). Horas-máquina =
`golpes × ciclo / 3600` (independiente de cavidades). Piezas/día = `golpes × cavidades`.
**Prensa COMPARTIDA**: `meta.reservationPct` = parte del tiempo de máquina que usa el molde
(reservas de una prensa suman ≤1; si suman >1 la prensa no alcanza). Export VW por-pieza:
`scripts/_lib/patagoniaInjectionProjects.mjs` + `scripts/_exportPatagoniaGate3All.mjs`
(`--vw-original` = formato alemán/inglés + logo VW; `--data-file` = genera offline).

## Tablas de soporte

```
products                    → id, nombre, descripcion, part_number
product_families            → id, name, description, linea_code, linea_name, active
product_family_members      → family_id, product_id, is_primary (M:N)
customer_lines              → id, name, customer_id
```

## Cómo actualizar datos en Supabase eficientemente

Para actualizar campos DENTRO del JSON `data`, usar el patrón:

```javascript
// 1. Leer el documento completo
const { data: doc } = await supabase
  .from('cp_documents')
  .select('id, data')
  .eq('id', docId)
  .single();

// 2. Modificar el objeto JavaScript
const updatedData = { ...doc.data };
updatedData.items = updatedData.items.map(item => {
  if (item.processStepNumber === '10') {
    return { ...item, reactionPlanOwner: 'Inspector de Calidad' };
  }
  return item;
});

// 3. Guardar el documento completo
await supabase
  .from('cp_documents')
  .update({ data: updatedData })
  .eq('id', docId);
```

Para documentos grandes (>100KB), usar `updateDocDirect()` del helper si existe.
