---
name: amfe-export-oficial
description: Exportar un AMFE Barack a Excel oficial CORRECTO (hoja Caratula formato I-AC-005.3, modos de falla secuenciales, rev vigente en rojo, aprobadores globales). Usar SIEMPRE al exportar/generar un AMFE a Excel para el pendrive o el cliente, o al construir el header de un AMFE nuevo. Evita los 3 errores recurrentes: carátula vacía, FM fuera de secuencia, revisiones mal formateadas.
---

# Export AMFE → Excel oficial (formulario I-AC-005.3)

Incidente fuente 2026-06-25 (AMFE 128/129 Amarok): entregué Excel con carátula VACÍA, modos de falla salteados (1,3,4,5,2) y revisiones inyectadas en la hoja de datos. Fak: "así no me podés entregar un AMFE". Esta skill codifica el estándar para que no se repita.

## 0. Usar `buildAmfeOficialWorkbook` — NO armar la carátula a mano (2026-07-03)

El export oficial se genera con **`buildAmfeOficialWorkbook(doc, { revisions, status })`** (`modules/amfe/amfeExcelExport.ts`). Produce un workbook de 2 hojas — **`Caratula` + `AMFE`** — igual que los AMFEs oficiales reales de Barack (ej. AMFE 150 Patagonia). Incluye:
- Hoja **Caratula** (`buildCaratulaSheet`, `modules/amfe/amfeCaratulaSheet.ts`): bloque de identificación, EQUIPO MULTIFUNCIONAL, tabla **REVISIONES** y FIRMAS DE APROBACIÓN. El **nivel de revisión vigente va EN ROJO** (I-IN-002). El título lleva sufijo **" PRELIMINAR"** cuando `status !== 'approved'`.
- Guard `assertAmfeExportable(doc)` (llamado adentro): **ABORTA (throw)** si alguna causa tiene S (del failure) / O / D vacío. Envolver la llamada en try/catch.
- `revisions` acepta cualquiera de los shapes históricos (`normalizeRevisions` lo tolera): `{rev,date,description,modifiedBy}`, legacy `{date,reason,revisedBy,description}`, o el `historial` del registry. Pasar el string/array crudo, no hace falta parsear.
- La carátula lee el header con **aliases tolerados** (`team` **o** `coreTeam`, `client` **o** `customerName`, `organization` **o** `companyName`, `revision`/`revisionLevel`/`rev`), así que la data live vieja también renderiza.

Los scripts `scripts/_exportOficial.ts` (159/160) y `scripts/_exportAmfeAmarok.ts` (128/129) ya usan esta función. NO reintroducir la inyección manual de revisiones en la hoja de datos.

## 1. Header — nombres de campo canónicos (al CONSTRUIR un AMFE)

Al construir el header de un AMFE nuevo, usar estos nombres canónicos. La carátula tolera aliases al LEER, pero conviene escribir los canónicos:

| Celda carátula | Campo header |
|---|---|
| AMFE Nro. | `amfeNumber` |
| Confidencialidad | `confidentiality` (ej. "Confidencial") |
| Organizacion | `organization` ("BARACK MERCOSUL") |
| Cliente | `client` |
| Ubicacion | `location` (ej. "PLANTA HURLINGHAM") |
| Nro. Pieza | `partNumber` |
| Responsable | `responsible` |
| Resp. Proceso | `processResponsible` |
| Equipo | `team` **(string, NO `coreTeam`)** |
| Modelo / Año | `modelYear` |
| Fecha Inicio | `startDate` (DD/MM/YYYY) |
| Fecha Rev. | `revDate` (DD/MM/YYYY) |
| Revision | `revision` (NO `revisionLevel`) |
| Aprobado por | `approvedBy` |
| Alcance | `scope` |
| Asunto | `subject` |
| Piezas Aplicables | `applicableParts` |

**Nota:** la hoja Caratula (`buildCaratulaSheet`) ya tolera `coreTeam` (array) además de `team`, y `client`/`customerName`, `organization`/`companyName`, `revision`/`revisionLevel`. El export compacto viejo de la hoja AMFE (`buildMetadataRows`) sí lee solo el nombre canónico. Header de referencia que SÍ funciona: AMFE 159 en Supabase (`data->header`).

## 2. Aprobadores GLOBALES (decision Fak 2026-06-25)

En TODAS las carátulas de AMFE:
- **`responsible` = "Carlos Baptista"** (responsable / revisó). `reviewedBy` y `responsibleEngineer` también Carlos.
- **`approvedBy` = "Gonzalo Cal"** (aprobó). `plantApproval` también Gonzalo Cal.
- `preparedBy`/`elaboratedBy` = "Facundo Santoro".
- `processResponsible` = el responsable de proceso del producto (project-specific, ej. "Paulo Centurión" para Amarok).
- `approvedBy` y `reviewedBy` NUNCA la misma persona (regla `control-plan.md`).

## 3. Modos de falla SECUENCIALES por operación

El export muestra `failure.description` tal cual (con el "N-" embebido). Si agrupás fallas por Work Element (6M), el orden se saltea (1,3,4,5,2). **Renumerar SIEMPRE 1,2,3,4,5… por operación** en el orden de aparición (WE→función→falla):
```js
let seq = 0;
for (const we of op.workElements) for (const fn of we.functions) for (const f of fn.failures) {
  seq++;
  f.description = `${seq}- ${String(f.description).replace(/^\s*\d+\s*[-).]\s*/, '').trim()}`;
}
```

## 4. Revisiones = tabla REVISIONES dentro de la hoja Caratula

Desde 2026-07-03 las revisiones van en la **tabla REVISIONES de la Caratula** (formato AMFE 150 real: la carátula ES la primera hoja del formato, con el log de cambios — cumple el I-AC-005 "toda modificación se registra en la primera hoja"). Columnas: **REV | FECHA | ITEM CAMBIADO | DETALLES | FECHA PSW | MODIFICO**. La fila cuya REV coincide con la revisión vigente sale en rojo. NO se genera una hoja "Revisiones" aparte (el AMFE 150 real tiene solo `Caratula` + `P-FMEA`). El historial son hitos A→G (no el log diario), alineados al Plan de Control (ver `feedback_amfe_revisiones_vs_pc`).

## 5. Scripts de referencia
- `scripts/_buildAmfeBarack.mjs` — construye doc con header canónico + FM secuencial + O/D.
- `scripts/_exportOficial.ts` (159/160) y `scripts/_exportAmfeAmarok.ts` (128/129) — usan `buildAmfeOficialWorkbook`. Amarok corre con `SUPABASE_SERVICE_ROLE_KEY=... VITE_SUPABASE_URL=... npx tsx`.
- Oficializar una revisión (bump + snapshot + export + copia a Y: + listado): `scripts/_oficializarRevision.ts`.
- Cargar a Supabase sin `.env.local`: service key por env var (ver `reference_amfe_xlsx_importer` en memoria).

## Enforcement (gate, no solo checklist)

`assertAmfeExportable(doc)` (en `amfeExcelExport.ts`, llamado dentro de `buildAmfeOficialWorkbook`) **ABORTA (throw)** si alguna causa tiene S (del failure) / O / D vacío. Así es imposible escribir al pendrive/cliente un AMFE incompleto. Incidente fuente: se entregó un export PREMATURO (antes de completar O/D) y Fak vio celdas vacías — "jamás algo puede estar vacío... no puede volver a suceder".

## Checklist antes de entregar un Excel de AMFE
- [ ] Hoja **Caratula** presente y **primera** (workbook = `Caratula`, `AMFE`).
- [ ] Carátula con TODOS los campos llenos (abrir el .xlsx y mirar el bloque de identificación).
- [ ] Nivel de revisión vigente en ROJO; título con " PRELIMINAR" solo si el doc no está approved.
- [ ] FM numerados 1,2,3,…N sin saltos en cada operación.
- [ ] Tabla REVISIONES con hitos A→N y columna MODIFICO.
- [ ] Responsable = Carlos Baptista, Aprobado por = Gonzalo Cal.
- [ ] 0 causas sin S/O/D (validar con `amfeValidator`).
