---
name: Gate3 export VW adaptado a Barack
description: Patron para exportar proyectos de balanceo al template VW Gate3 Capacity Check customizado para Barack Mercosul (logo, textos ES, sin password, sin DIV/0)
type: reference
---

# Gate3 Capacity Check — export Barack

## Script

`scripts/_exportProjectGate3VW.mjs <projectId>` — lee proyecto de tabla `projects` y genera `~/Documents/CapacityCheck_<nombre>_<version>_OEE<pct>pct.xlsx`.

Validator: `scripts/_validateGate3Export.mjs <path>` — 90+ checks automaticos.

## Stack y limitaciones

- **Leer/escribir celdas y formulas**: `xlsx-populate` (preserva formulas y formato del template).
- **Imagenes**: xlsx-populate NO las soporta → usar `JSZip` para swap `xl/media/image1.jpeg`.
- **Proteccion sin password**: xlsx-populate `sheet.protected(false)` NO funciona. Borrar `<sheetProtection.../>` del XML via JSZip.
  - El hashValue base64 del template contiene `/`, asi que el regex debe ser `<sheetProtection\s[^>]*?\/>` (excluir solo `>`, no `/`).
- **NO reinyectar tags nuevos al XML**. Eso rompia el orden OOXML y Excel mostraba "Reparado" con contenido vacio.

## Template VW — puntos importantes

- Path: `src/assets/templates/gate3_template.xlsx` (133 KB)
- 3 hojas visibles: `CapacitySFN`, `OEE CalculatorSFN`, `DiagramSFN`.
- 5 hojas ocultas: `Tabelle1`, `Observaciones`, `Protocolo_SFN1`, `Acc. certificate PCA1 pre-check`, `Acceptance certificate_PCA2_3`.
- Logo VW: `xl/media/image1.jpeg` (compartido por 3 drawings). Reemplazar el archivo basta.
- Texto aleman "M-BN-L Beschaffung Neue Produktanläufe Lieferantenmanagement" vive en `xl/drawings/drawing1/2/3.xml` (textboxes, no celdas).
- Chart (DiagramSFN): titulo + ejes en `xl/charts/chart1.xml` en `<a:t>` y `<c:v>`.

## Cell map (CapacitySFN)

- Header: labels B5-B9 / I5-I8, valores C5-C9 / J5-J8.
- 12 estaciones en 3 bloques horizontales × 4 bloques verticales:
  - Bloque col 1 (estaciones 1-4): cols B-G
  - Bloque col 2 (estaciones 5-8): cols I-N
  - Bloque col 3 (estaciones 9-12): cols P-U
  - Bloque fila 1 (estaciones 1,5,9): filas 10-18
  - Bloque fila 2 (estaciones 2,6,10): filas 19-27
  - Bloque fila 3 (estaciones 3,7,11): filas 28-36
  - Bloque fila 4 (estaciones 4,8,12): filas 37-45
- Titulo "Station N" en la fila topRow (10, 19, 28, 37), columna nameCol (B/I/P).

## Cell map (OEE CalculatorSFN)

- Header labels: D5-D9 / K5-K8 (no B/I como CapacitySFN).
- 12 estaciones en columnas E..P (una columna por estacion).
- Inputs filas 13-19, outputs filas 20-23 (Disponibilidad, Rendimiento, Calidad, OEE).
- Meta a 100% OEE: fila 16.
- Atribucion VW "R. Hartel K-BN-KA/1": celda B26.

## DIV/0 en estaciones vacias

- **CapacitySFN**: ocultar filas/columnas de bloques no usados (no romper merge del header que usa cols C-G).
- **OEE CalculatorSFN**: NO ocultar columnas (rompe el merge D5:K5 del header). En cambio, envolver formulas output con `IFERROR(formula, "")` en filas 16, 20, 21, 22, 23 × columnas E..P.

## Logo Barack vs espacio VW

- Barack: `src/assets/barack_logo.png` (151×75 PNG RGBA).
- Anchor del template: aspect ~0.73 (casi cuadrado vertical).
- NO modificar `<a:ext>` del pic (el texto al lado en el mismo grupo colisiona).
- Conversion PNG → JPEG via PowerShell + `System.Drawing`: canvas 400×547 (aspect 0.73) con logo centrado y padding blanco.

## Datos del proyecto que hay que respetar

- `partNumber` / `partDesignation`: nombre de la pieza (`meta.name`).
- `project`: codigo del proyecto (`meta.project` o `project_code`) — ej: PATAGONIA, no el nombre de la pieza.
- `supplier`: "Barack Mercosul".
- `location`: "Hurlingham, Buenos Aires, Argentina" (sede unica Barack, Los Arboles 842).
- `date`: `meta.date` (fecha de revision del proyecto), no la de hoy.
- `creator`: vacio (Fak no quiere atribucion).
- `gsisNr` reutilizado como "N° de documento" Barack: `BRK-G3-<id>-<version>`.

## Incidentes pasados

- Inyectar `<sheetProtection>` con regex causaba Excel "Reparado" con hojas vacias. **Solo borrar, nunca reinyectar**.
- Modificar `<a:ext>` del pic empujaba el texto del grupo. **Mantener ext original, usar padding en la imagen**.

## Regla CRITICA: cycleTime en estaciones de inyeccion (2026-04-17)

La formula Gate 3 VW es:
```
pzs/hora = 3600 / cycleTime × cavidades × OEE × reserva × maquinas
```

`cycleTime` es el **tiempo de UN CICLO DE MOLDE COMPLETO**, NO el tiempo por pieza.
`cavidades` es el multiplicador (piezas por molde).

Historia del bug Gate 3 exportando el proyecto 16 (3 versiones antes de dar):

| Version | cycleTime exportado | Pzs/sem (OEE 45%) | Correcto? |
|---|---|---|---|
| v1 | 60.08 s (suma de standardTime de TODAS las tasks de la estacion) | 26.100 | NO |
| v2 | 31.44 s (injectionParams.realCycle — tiempo por pieza) | 49.875 | NO (doble conteo) |
| v3 | 283 s (realCycle × cavidades = molde completo) | 5.541 | **SI** |

**Regla**: para estaciones con task `executionMode === 'injection'`:
```js
cycleTime = injectionParams.realCycle × injectionParams.optimalCavities
```

La app (modulos balanceo, OEE detail) usa bien el ciclo de molde y detecta sobrecarga.
Si el Excel Gate 3 muestra OTRA cosa que el balanceo in-app, **el bug esta en el
adapter**, no en el balanceo.

TODO abierto: `docs/TODO_GATE3_INVESTIGAR.md` — hay que propagar este fix a
`modules/gate3/gate3FromBalancing.ts` (adapter de la UI).

## Guia detallada

`docs/GUIA_GATE3_VW_CAPACITY_CHECK.md` tiene la metodologia completa, formula,
casos (batch vs serial, costura, etc.) y ejemplos numericos. Apta para subir
a NotebookLM como fuente del notebook `apqp-guias-y-conocimiento`.
