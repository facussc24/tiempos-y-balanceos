---
name: amfe-export-oficial
description: Exportar un AMFE Barack a Excel oficial CORRECTO (carátula completa, modos de falla secuenciales, hoja Revisiones aparte, aprobadores globales). Usar SIEMPRE al exportar/generar un AMFE a Excel para el pendrive o el cliente, o al construir el header de un AMFE nuevo. Evita los 3 errores recurrentes: carátula vacía, FM fuera de secuencia, revisiones mal formateadas.
---

# Export AMFE → Excel oficial (formulario I-AC-005.3)

Incidente fuente 2026-06-25 (AMFE 128/129 Amarok): entregué Excel con carátula VACÍA, modos de falla salteados (1,3,4,5,2) y revisiones inyectadas en la hoja de datos. Fak: "así no me podés entregar un AMFE". Esta skill codifica el estándar para que no se repita.

## 1. Carátula — nombres de campo EXACTOS que lee el export

`buildAmfeCompletoWorkbook` (`modules/amfe/amfeExcelExport.ts`, fn `buildMetadataRows`) lee estos campos del `doc.header`. **Si usás otro nombre, la celda sale VACÍA.** Lista canónica (verificada líneas 291-299):

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

**Errores típicos:** usar `revisionLevel` en vez de `revision`, `revisionDate` en vez de `revDate`, `coreTeam` (array) en vez de `team` (string), y omitir `location`/`modelYear`/`confidentiality`/`processResponsible`. Header de referencia que SÍ funciona: AMFE 159 en Supabase (`data->header`).

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

## 4. Revisiones = HOJA APARTE "Revisiones" (no inyectar en la hoja de datos)

Columnas: **Rev | Fecha | Responsable | Descripción del cambio**. Si no se sabe el responsable, poner "-". El historial son hitos A→G (no el log diario), alineados al Plan de Control (mismas fechas/nivel; ver `feedback_amfe_revisiones_vs_pc`). El último hito: "Revisión general alineada al Plan de Control rev X".

## 5. Scripts de referencia (Amarok 2026-06-25)
- `scripts/_buildAmfeBarack.mjs` — construye doc con header canónico + FM secuencial + O/D.
- `scripts/_exportAmfeAmarok.ts` — `buildAmfeCompletoWorkbook` + hoja Revisiones → pendrive. Correr con `SUPABASE_SERVICE_ROLE_KEY=... VITE_SUPABASE_URL=... npx tsx`.
- Cargar a Supabase sin `.env.local`: service key por env var (ver `reference_amfe_xlsx_importer` en memoria).

## Enforcement (gate, no solo checklist)

`scripts/_exportAmfeAmarok.ts` tiene un **guard que ABORTA el export** si alguna causa tiene `severity`/`occurrence`/`detection` vacío (null o ""). Así es imposible escribir al pendrive/cliente un AMFE incompleto. Incidente fuente: se entregó un primer export PREMATURO (antes de completar O/D) y Fak vio celdas vacías — "jamás algo puede estar vacío... no puede volver a suceder". Todo export nuevo debe replicar este guard.

## Checklist antes de entregar un Excel de AMFE
- [ ] Carátula con TODOS los campos llenos (abrir el .xlsx y mirar filas 2-9).
- [ ] FM numerados 1,2,3,…N sin saltos en cada operación.
- [ ] Hoja "Revisiones" presente con columna Responsable.
- [ ] Responsable = Carlos Baptista, Aprobado por = Gonzalo Cal.
- [ ] 0 causas sin S/O/D (validar con `amfeValidator`).
