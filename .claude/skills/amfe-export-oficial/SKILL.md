---
name: amfe-export-oficial
description: Exportar un AMFE de Barack a Excel oficial («el AMFE en Excel», «para el pendrive»): hoja Caratula I-AC-005.3, modos de falla secuenciales, rev vigente en rojo, aprobadores y firmas. Usar SIEMPRE al exportar un AMFE para el cliente o el pendrive, o al armar el header de un AMFE nuevo. Evita carátula vacía, FM fuera de secuencia y revisiones mal hechas.
---

# Export AMFE → Excel oficial (formulario I-AC-005.3)

Incidente fuente 2026-06-25 (AMFE 128/129 Amarok): entregué Excel con carátula VACÍA, modos de falla salteados (1,3,4,5,2) y revisiones inyectadas en la hoja de datos. Fak: "así no me podés entregar un AMFE". Esta skill codifica el estándar para que no se repita.

<!-- paso0:inicio -->
**Paso 0 — qué formato se usa, antes de armar nada** (detalle en `docs/FORMATO_CASA.md`). En este orden: (1) si hay **formulario oficial del SGC** para esto, se usa ese; (2) si el **cliente tiene plantilla propia** (VW, BeOn, SMRC), se clona la suya; (3) si un **compañero ya usa un formato** para esto (Leo, Carlos, Gamboa) o hay uno en `FORMATOS GENERAL`, se copia ese; (4) recién ahí, el **formato de la casa** (`scripts/_lib/tema.json`). Y dos modos que no se mezclan: **corregir el archivo de otro** lleva color propio y «ANTES: …» en cada celda tocada (06/10); **rearmarlo entero** va limpio, sin amarillo ni notas (15/10). Antes de mostrarlo: `python scripts/revisar.py <archivo>`.
<!-- paso0:fin -->

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
- **`approvedBy` = "Carlos Baptista"** (Ingeniería). **`plantApproval` = "Gonzalo Cal"** (Planta) — campos DISTINTOS.
- `preparedBy`/`elaboratedBy` = "Facundo Santoro".
- `processResponsible` = el responsable de proceso del producto (project-specific, ej. "Paulo Centurión" para Amarok).
- `approvedBy` y `reviewedBy` NUNCA la misma persona (regla `control-plan.md`).

> **Gonzalo Cal firma HO, no AMFE** (`product-map`; `approvedBy` = Ingeniería por
> `control-plan.md`). La evidencia son los AMFE reales hechos a mano más recientes (105 y 107,
> oct/nov 2025), cuyo equipo dice `Paulo Centurión - INGENIERIA | Manuel Meszaros - CALIDAD |
> Cristina Rabago - SEGURIDAD E HIGIENE`. **Al 03/08/2026 quedaban 11 documentos en Supabase con
> `approvedBy = 'Gonzalo Cal'` — contarlos de nuevo antes de citar el número**: corregirlos
> requiere OK de Fak (ver `scripts/_pendiente_amfe150_supabase.sql`).

**Los casilleros de firma van VACÍOS.** El formulario I-AC-005.3 real deja INGENIERIA /
CALIDAD / CLIENTE en blanco para firma manuscrita (ver AMFE 131 y 144 en el servidor). El
generador ya no imprime ningún nombre adentro: los nombres viven en EQUIPO MULTIFUNCIONAL.

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
- **El export oficial de cualquier AMFE:** `npx tsx scripts/_exportAmfeOficial.ts --amfe <numero> --out <carpeta>`.
  Tiene los gates de `amfe.md`: no exporta sin marcador `.audit-cliente/<amfe>.json` de menos de
  7 dias (`/auditoria-cliente`; `--sin-auditoria` solo para trabajo interno) ni con metadatos de
  redaccion en el log de revisiones (`scanRevisionMeta()`).
- `scripts/_buildAmfeBarack.mjs` — construye doc con header canónico + FM secuencial + O/D.
- `scripts/_exportOficial.ts` (159/160) y `scripts/_exportAmfeAmarok.ts` (128/129) — exports
  puntuales anteriores: usan `buildAmfeOficialWorkbook` pero **no** tienen el gate de auditoria.
  Amarok corre con `SUPABASE_SERVICE_ROLE_KEY=... VITE_SUPABASE_URL=... npx tsx`.
- Oficializar una revisión (bump + snapshot + export + copia a Y: + listado): `scripts/_oficializarRevision.ts`.
- Cargar a Supabase sin `.env.local`: service key por env var (ver `reference_amfe_xlsx_importer` en memoria).

## Enforcement (gate, no solo checklist)

`assertAmfeExportable(doc)` (en `amfeExcelExport.ts`, llamado dentro de `buildAmfeOficialWorkbook`) **ABORTA (throw)** si alguna causa tiene S (del failure) / O / D vacío. Así es imposible escribir al pendrive/cliente un AMFE incompleto. Incidente fuente: se entregó un export PREMATURO (antes de completar O/D) y Fak vio celdas vacías — "jamás algo puede estar vacío... no puede volver a suceder".

**La carátula del ARCHIVO** (tanda 12, 17/10/2026): `_exportAmfeOficial.ts` relee el `.xlsx` escrito y sale con
FALLO si un rótulo del bloque de identificación (organización, tema, N° de AMFE, planta, fechas de inicio y de
revisión, responsable del proceso, cliente, modelo-año, nivel de revisión) quedó sin valor
(`scripts/_lib/caratulaVacia.mjs`, test `__tests__/scripts/caratulaVacia.test.ts`). Es el error que dio origen a esta
skill (25/06) y LECCIONES 03-08/09: se abre el archivo que quedó, no el script. Medido el 17/10 sobre los 9 AMFE
exportados en `exports/`: 9 con la carátula llena, ninguno frenaría. Los exports puntuales viejos
(`_exportOficial.ts`, `_exportAmfeAmarok.ts`) no lo tienen.

## Checklist antes de entregar un Excel de AMFE
- [ ] **Lo que ya le marcaron a un AMFE**: `node scripts/_observaciones.mjs --antes-de-mandar AMFE` (libro de
      observaciones recibidas, tanda 13): lo que sale «A MANO» no lo caza ningún control y se mira uno por uno.
- [ ] Hoja **Caratula** presente y **primera** (workbook = `Caratula`, `AMFE`).
- [ ] Carátula con TODOS los campos llenos (abrir el .xlsx y mirar el bloque de identificación; con
      `_exportAmfeOficial.ts` lo frena `caratulaVacia.mjs` sobre el archivo releído).
- [ ] Si el Excel va a imprimirse o al cliente: la caratula lleva el margen y el area de
      impresion que acomodo Fak (`B2:M29`). `buildAmfeOficialWorkbook` no los pone; hoy lo hace
      el molde `scripts/_archive/2026-09-23-ppap-p21-naranja/armar_final.py` (skill `ppap-motherson` §4).
- [ ] Nivel de revisión vigente en ROJO; título con " PRELIMINAR" solo si el doc no está approved.
- [ ] FM numerados 1,2,3,…N sin saltos en cada operación.
- [ ] Tabla REVISIONES con hitos A→N y columna MODIFICO.
- [ ] Responsable = Carlos Baptista, Aprobado por = Carlos Baptista (Ingeniería); Gonzalo Cal solo en `plantApproval`.
- [ ] Casilleros de firma (INGENIERIA / CALIDAD / CLIENTE) **sin nombre impreso**.
- [ ] Fecha de inicio y de revisión NO vacías (si lo están, el dato existe con otro nombre:
      `amfeDate` / `revisionDate` — ver `HEADER_ALIASES` en `amfeCaratulaSheet.ts`).
- [ ] Fechas en DD/MM/YYYY y con el día correcto (bug de zona horaria corregido 2026-08-03).
- [ ] 0 causas sin S/O/D (validar con `amfeValidator`).
- [ ] Controles de detección genéricos **mirados antes de exportar** (no frena el export):
      `node scripts/_medirDeteccionGenerica.mjs --amfe <número>` lista las causas cuyo control no
      nombra un instrumento del catálogo (aviso `DETECCION_GENERICA`). El control se escribe con
      instrumento + frecuencia, como en el plan de control; «actual» = implementado y con papel.
      Si es solo visual queda así y se revisa la D (`amfe.md` §13); no se completa un instrumento que nadie
      confirmó (`amfe.md` §6).
