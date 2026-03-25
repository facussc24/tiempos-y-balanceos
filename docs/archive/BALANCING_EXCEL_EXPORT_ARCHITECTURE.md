# Balancing Excel Export — Architecture Design

**Date:** 2026-03-05
**Status:** Design (pre-implementation)
**Replaces:** `utils/excel.ts` → `exportToExcel()` (engineering) + `exportProductionExcel()` (shop floor)
**Reference files:** "TIEMPOS POR ESTACION.xlsx" (multi-station) + "ESTACIONES COMPARTIDAS.xlsx" (shared station analysis)

---

## 1. FILE STRUCTURE

### New files to create

```
modules/
  balancing/
    balancingExcelExport.ts        # Main export orchestrator + "TIEMPOS POR ESTACION" builder
    balancingExcelStyles.ts        # Shared style constants (reusable across sheets)
    balancingExcelFormulas.ts      # Formula template builders (cell references)
    balancingExcelChartData.ts     # Pre-compute chart data tables for Excel charting
    sharedStationExcelExport.ts    # "ESTACIONES COMPARTIDAS" multi-sheet builder
    sharedStationCalc.ts           # Pure calculation engine for shared station analysis

__tests__/
  modules/
    balancing/
      balancingExcelExport.test.ts
      balancingExcelFormulas.test.ts
      sharedStationExcelExport.test.ts
      sharedStationCalc.test.ts
```

### Files to modify

```
modules/balancing/BalancingChart.tsx   # Add export button to chart card actions
modules/LineBalancing.tsx              # Wire export handler, pass data to BalancingChart
utils/excel.ts                        # KEEP as-is (backward compat), but mark old exports as @deprecated
```

### Files NOT to create (reuse existing)

- `utils/sanitizeCellValue.ts` — already exists, import directly
- `utils/filenameSanitization.ts` — already exists
- `utils/excel.ts` → `downloadWorkbook()` — reuse the browser-safe Blob download
- `src/assets/barack_logo.png` — for logo embedding (see Section 8)

---

## 2. EXPORT MODES

### Mode A: "Tiempos por Estacion" (single-product / single-sector view)
- **One sheet per sector** (or one sheet for entire project if no sectors defined)
- Sheet name = sector name (e.g., "Tapizado APB Trasero P703")
- Layout matches reference file 1: header section + operations table + chart data + summary

### Mode B: "Estaciones Compartidas" (shared station analysis)
- **One sheet per product/sector** (like "APB P21", "Top Roll P703")
- **One extra sheet** "Estacion Compartida" with cross-product calculations
- Only available when: multiple sectors have `shiftOverride` set, OR user explicitly selects 2+ products to compare

### Mode C: Legacy "Engineering" + "Production" (keep existing)
- `exportToExcel()` and `exportProductionExcel()` in `utils/excel.ts` remain unchanged
- Mark with `@deprecated` JSDoc pointing to new module

---

## 3. DATA MAPPING: ProjectData → Excel Sections

### 3.1 HEADER SECTION (rows 4-13 in reference)

| Excel Field | Source in ProjectData | Formula/Logic |
|---|---|---|
| Title | `meta.name` | `"TIEMPOS Y BALANCEO - " + meta.name.toUpperCase()` |
| Fecha | `meta.date` | Direct value |
| Vehiculo | `meta.name` | Direct value (user names products as vehicle names) |
| CLIENTE | `meta.client` | Direct value |
| PART NAME | `meta.name` | Direct value |
| PART No | `meta.project ?? meta.version` | Direct value |
| P/Day (demand) | `meta.dailyDemand` | Direct value |
| OEE | `meta.manualOEE` (global) or `sector.targetOee` (per-sector) | Decimal 0-1 |
| Turnos de Trabajo | `meta.activeShifts` or `sector.shiftOverride.activeShifts` | Integer 1-3 |
| Sin Flex (demand with 0 flex) | `meta.dailyDemand` | Same as P/Day (no flex concept in app) |
| Shift start/end/break | `shifts[i].startTime`, `shifts[i].endTime`, `shifts[i].breaks` | Time format "HH:mm" |
| T. Disp. per shift | calculated | `=calculateShiftNetMinutes(shift)` |
| T.T (Takt Time) per station | calculated | Formula: `=(T.Disp * 60) / Demand` |
| TT-OEE per station | calculated | Formula: `=T.T * OEE` |
| T R&R per station | from stationData | `effectiveTime / replicas` (real cycle time per station) |
| Necesidad (pzs/h) | calculated | Formula: `=3600 / T.T` |
| Nec.+OEE | calculated | Formula: `=Necesidad / OEE` |
| Observadas (pzs/h) | calculated | Formula: `=3600 / T.R&R` |

### 3.2 OPERATIONS TABLE (rows 14-27 in reference)

Each row = one Task from `data.tasks` that is assigned to a station.

| Excel Column | Source | Notes |
|---|---|---|
| HO | sector name | From `sectors.find(s => s.id === task.sectorId)?.name` |
| Sector | sector name | Same as HO (the reference file uses "Tapizado" for both) |
| OPERADOR | station assignment | `"OPER." + stationId` |
| OP# | `task.id` | Direct value (e.g., "OP10", "OP20") |
| DESCRIPCION | `task.description` | Direct value |
| Measurements 1-10 | `task.times[0..9]` | Raw time measurements (null → empty cell) |
| prom.TO | `task.averageTime` | Formula: `=AVERAGE(measurements)` but only non-ignored indices |
| J.A (rating factor) | `task.ratingFactor / 100` | E.g., 1.00, 1.10, 0.90. Reference shows decimal. |
| T.O (standard time) | `task.standardTime` | Formula: `=prom.TO * J.A` (or `=prom.TO * J.A * (1+fatigue)`) |
| OPERATOR ASSIGNED columns | assignment matrix | One column per station. `=IF(station_matches, T.O, 0)` |

**Handling variable measurements:** `task.times` array can have 1-30+ entries. The reference shows 10 measurement columns. Strategy:
- Default: 10 measurement columns (like reference)
- If max measurements across all tasks > 10: extend to `maxMeasurements` columns
- If `task.times.length < columns`: empty cells
- Ignored indices (`task.ignoredTimeIndices`): strikethrough formatting or omit from AVERAGE formula

### 3.3 CHART DATA TABLES (rows 57-74 in reference)

Two separate data tables placed below the operations area, used for Excel chart creation:

**Table 1: Pzs/Hora por Estacion**

| Estacion | Observadas (pzs/h) | Necesidad | Necesidad+OEE |
|---|---|---|---|
| Est.1 | `=3600/T.R&R_1` | `=3600/T.T` | `=Necesidad/OEE` |

**Table 2: Tiempos por Estacion**

| Estacion | T.R&R (seg) | Takt Cliente | Takt Objetivo |
|---|---|---|---|
| Est.1 | T.R&R value | nominalSeconds | effectiveSeconds |

### 3.4 SUMMARY TABLE "RESUMEN" (rows 29-39 in reference)

| Field | Source | Formula/Logic |
|---|---|---|
| Demanda | `meta.dailyDemand` | Direct: `"960 und/dia"` |
| Takt Cliente | nominalSeconds | `=(availableMinutes * 60) / demand` |
| Takt Objetivo (OEE X%) | effectiveSeconds | `=TaktCliente * OEE` |
| TCR (Ciclo Real) | realCycleTime | `=MAX(T.R&R per station)` (bottleneck) |
| Carga Linea | efficiency | `=SUM(all T.R&R) / (numStations * TaktCliente) * 100` |
| Dotacion | totalHeadcount | `=SUM(replicas per station)` + note about parallel ops |
| OEE / FF | `meta.manualOEE` / fatigue | `"85% / 10%"` |
| Cuello Botella | max station | Station with highest T.R&R |
| Margen vs TT Obj. | calculated | `=TaktObjetivo - TCR` |
| Estado | calculated | `FACTIBLE` if all stations <= TaktObjetivo, else `NO FACTIBLE` |

---

## 4. FORMULA TEMPLATES

All formulas use **relative cell references** computed at generation time. The module will NOT hardcode row/column numbers; instead, it will track cursor position and build formulas dynamically.

### Formula builder pattern (in `balancingExcelFormulas.ts`)

```
Interface CellRef {
  col: number;   // 0-based column index
  row: number;   // 0-based row index
}

function colLetter(col: number): string    // 0 → "A", 25 → "Z", 26 → "AA"
function cellAddr(ref: CellRef): string    // { col: 0, row: 4 } → "A5"
function rangeAddr(start: CellRef, end: CellRef): string  // "B15:K15"
```

### Key formulas to preserve

```
// Takt Time
=({availableMinutesCell}*60)/{demandCell}

// Takt with OEE
={taktCell}*{oeeCell}

// Average Time (excluding ignored indices)
=AVERAGE({validTimeCells})    // Only non-null, non-ignored cells

// Standard Time
={avgTimeCell}*{ratingFactorCell}*(1+{fatigueCell})

// Pieces per Hour
=3600/{cycleTimeCell}

// Need + OEE
={needCell}/{oeeCell}

// Station cycle time (with replicas)
=SUMPRODUCT(assignmentRange)/{replicasCell}

// Line efficiency
=SUM({allStationTimes})/({numStations}*{taktCell})*100

// Operator assignment matrix (one formula per cell in the grid)
=IF({stationHeaderCell}=CONCATENATE({operatorCell},{opCell}),{stdTimeCell},0)
```

### Formula safety
- All user-input text goes through `sanitizeCellValue()` (existing util)
- Formulas are set via `{ f: "formula_string" }` in xlsx-js-style cell objects
- Circular references are impossible by design (all formulas are acyclic)

---

## 5. SHEET LAYOUT SPECIFICATION

### 5.1 "Tiempos por Estacion" sheet layout

```
        A   B   C   D   E   F   G...P  Q   R   S...       (variable cols)
    +---+---+---+---+---+---+------+---+---+------+---+
 1  |                                                  |   (blank row)
 2  |                                                  |   (blank row)
 3  |                                                  |   (blank row)
 4  | TITLE (merged across all cols)          | TURNOS |
 5  | Fecha: ...  | DATOS DE TIEMPOS          | 1 2 3  |
 6  | Vehiculo    | Sector | Est.1..Est.N headers      |
 7  | CLIENTE     | P/Day  | T.T per station   | Shift |
 8  | Sin Flex    |        | TT-OEE per station| times |
 9  | OEE         |        | T R&R per station |       |
10  | PART NAME   |        | DATOS POR PZS/HORA|       |
11  |             | Turnos | Necesidad per stn  | Break |
12  | PART No     | T.T    | Nec+OEE per stn   | T.Dis |
13  |             | TT-OEE | Observadas per stn |       |
    +---+---+---+---+---+---+------+---+---+------+---+
14  | HO|Sec|OPER|OP#|DESC| M1..M10 |prom|JA|TO|St1..StN|
15  | data rows...                                      |
 .  | ...                                               |
N   | last operation                                    |
    +---+---+---+---+---+---+------+---+---+------+---+
N+2 | CHART DATA: "GRAFICO DE TIEMPOS Y BALANCEOS"     |
    +---+---+---+---+---+---+------+---+---+------+---+
N+4 | RESUMEN table (2 columns: label + value)          |
    +---+---+---+---+---+---+------+---+---+------+---+
N+20| CHART DATA TABLE 1: Pzs/Hora                     |
    +---+---+---+---+---+---+------+---+---+------+---+
N+30| CHART DATA TABLE 2: Tiempos                      |
    +---+---+---+---+---+---+------+---+---+------+---+
```

### Column width strategy

| Range | Purpose | Width (wch) |
|---|---|---|
| A | HO (sector) | 12 |
| B | Sector | 12 |
| C | OPERADOR | 12 |
| D | OP# | 10 |
| E | DESCRIPCION | 35 |
| F..O (10 cols) | Measurements | 8 each |
| P | prom.TO | 10 |
| Q | J.A | 8 |
| R | T.O | 10 |
| S..S+N-1 | Station assignment cols | 10 each |

**Dynamic column count:** `5 (fixed) + maxMeasurements + 3 (prom/JA/TO) + numStations`

For the reference file: 5 + 10 + 3 + 5 = 23 columns (fits well). For 50 stations: 5 + 10 + 3 + 50 = 68 columns (still valid Excel, just wide).

### 5.2 "Estaciones Compartidas" sheet layout

**Per-product sheets** follow the same layout as 5.1 but simplified (single station per product).

**"Estacion Compartida" sheet:**

```
        A           B           C           D           E
    +----------+----------+----------+----------+----------+
 1  | ESTACION COMPARTIDA: {stationName}                    |
 2  |                                                       |
 3  | Per-piece comparison table                            |
 4  | Pieza     | TCR (seg) | Takt (seg) | Demanda | Turnos|
 5  | Piece A   | 21.78     | 48.00      | 600     | 1     |
 6  | Piece B   | 35.64     | 30.00      | 960     | 2     |
    +----------+----------+----------+----------+----------+
 8  | CALCULO DE TURNOS NECESARIOS                          |
 9  | Tiempo Bruto Requerido:  {sum(TCR * demand)} min      |
10  | Req. c/OEE:  {bruto / OEE} min                        |
11  |                                                       |
12  | Disponibilidad por turnos:                            |
13  | 1 Turno | {shift1_min} min | {fits? SI/NO}           |
14  | 2 Turnos| {shift1+2_min} min | {fits? SI/NO}         |
15  | 3 Turnos| {shift1+2+3_min} min | {fits? SI/NO}       |
16  |                                                       |
17  | RESULTADO: {N} TURNOS necesarios                      |
18  | Sobrante: {surplus} min                               |
19  |                                                       |
20  | Distribucion por turno:                               |
21  | Turno 1 | {min}/{capacity} = {pct}%                   |
22  | Turno 2 | {min}/{capacity} = {pct}%                   |
23  | Turno 3 | {min}/{capacity} = {pct}%                   |
    +----------+----------+----------+----------+----------+
```

---

## 6. HANDLING VARIABLE-SIZE CONTENT

### Stations (1-50)
- Header section: station columns expand rightward (Est.1 through Est.N)
- Operations table: assignment matrix columns expand rightward
- Chart data tables: one row per station
- Cell merges in header adjust to total column count

### Operations (1-100+)
- Operations table rows grow downward
- All subsequent sections (charts, summary, data tables) shift down accordingly
- Row cursor tracked via `let currentRow = headerEndRow + 1`

### Measurements per task (1-30)
- Default 10 columns
- If any task has >10 valid measurements: `maxMeasurements = Math.max(...tasks.map(t => t.times.filter(x => x !== null).length))`
- Cap at 30 columns (practical limit for readability)

### Sectors (1-10)
- **Mode A (per-sector sheets):** One sheet per sector, each sheet self-contained
- **Single-sector project:** One sheet named after the project
- Sheet names sanitized: max 31 chars, no `[]:*?/\` characters

### Multi-model products
- If `meta.activeModels` exists and has >1 model, show model-specific times in an additional section
- This maps to the "ESTACIONES COMPARTIDAS" use case

---

## 7. SHARED STATION ANALYSIS DESIGN

### When does the user need this?

The "Estaciones Compartidas" analysis is needed when:
1. **Multiple products share the same physical workstation** — common in flexible manufacturing cells
2. **Per-sector shift overrides are different** — Sector A runs 1 shift, Sector B runs 2 shifts, but they share a station
3. **Capacity planning** — determining how many shifts a shared station needs to serve total demand

### Relationship to sector shift overrides

The `Sector.shiftOverride` feature directly enables this analysis:
- Each sector/product has its own `activeShifts` count
- When two sectors share a station, the station must run enough shifts to serve BOTH demands
- The "Estaciones Compartidas" calculation determines: `requiredShifts = ceil(totalRequiredMinutes / perShiftAvailableMinutes)`

### Data model for shared station analysis

```typescript
interface SharedStationInput {
  stationName: string;
  products: Array<{
    name: string;           // Product/sector name
    sectorId: string;       // Links to Sector in ProjectData
    demand: number;         // Daily demand for this product
    cycleTime: number;      // Real cycle time (TCR) for this product at this station
    taktTime: number;       // Takt time for this product (sector-specific)
    activeShifts: number;   // Shifts this product needs (from sector.shiftOverride)
    oee: number;            // OEE for this sector
  }>;
  shifts: Shift[];          // Global shift definitions (with breaks)
}
```

### Calculation engine (`sharedStationCalc.ts`)

```
Pure functions (no React, no side effects):

calculateSharedStationRequirements(input: SharedStationInput):
  1. For each product: grossMinutes = (demand * cycleTimeSeconds) / 60
  2. totalGrossMinutes = SUM(all products)
  3. totalRequiredWithOEE = totalGrossMinutes / minOEE
  4. For shifts 1..3: availableMinutes = SUM(netMinutes for shift 1..N)
  5. requiredShifts = first N where availableMinutes[N] >= totalRequiredWithOEE
  6. surplus = availableMinutes[requiredShifts] - totalRequiredWithOEE
  7. Per-shift distribution: allocate demand proportionally across shifts
```

### How the user triggers it

Two entry points:

1. **From the LineBalancing module** — when sectors with `shiftOverride` exist and tasks from different sectors share the same station number, show a button "Analizar Estacion Compartida"
2. **From the Executive Summary** — a new "Exportar Estaciones Compartidas" button when multi-sector analysis detects shared-station scenarios

---

## 8. LOGO EMBEDDING

### Current state
- `src/assets/barack_logo.png` exists as a static asset
- `AppHeader.tsx` imports it: `import barackLogo from './src/assets/barack_logo.png'`
- HO Excel export uses `ExcelJS` (not `xlsx-js-style`) for image embedding via `getLogoBase64()` from `src/assets/ppe/ppeBase64.ts`

### Strategy for balancing export

**Option A (recommended): Use `xlsx-js-style` without images.**
- `xlsx-js-style` does NOT support image embedding (it's a SheetJS Community fork)
- The reference file has the logo in the header area, but this is a cosmetic feature
- Instead: place "BARACK MERCOSUL" text in the header with large bold font
- This matches the pattern used by `amfeExcelExport.ts`, `pfdExcelExport.ts`, and `controlPlanExcelExport.ts` (none embed images)

**Option B (if logo is mandatory): Use `ExcelJS` like `hoExcelExport.ts`.**
- Import `ExcelJS` instead of `xlsx-js-style`
- Use `worksheet.addImage()` with base64 data
- Tradeoff: ExcelJS is heavier but supports images, rich formatting
- The HO module already has this pattern working

**Recommendation:** Start with Option A (text-only header with xlsx-js-style). If the user specifically requests the logo, migrate to ExcelJS for this module only. Both libraries are already in `package.json`.

---

## 9. STYLE CONSTANTS (`balancingExcelStyles.ts`)

Reuse the existing pattern from AMFE/PFD/CP exports (Arial font, thin borders, standard Excel palette).

```
BORDER: thin black on all 4 sides (matches all existing exports)

Styles:
  title:       Bold, sz 14, Arial, center, no border (main title)
  subtitle:    Bold, sz 11, Arial, center (section headers)
  metaLabel:   Bold, sz 9, Arial, fill #F2F2F2, border (labels like "CLIENTE:")
  metaValue:   sz 9, Arial, border (values like "SMRC/Ford")
  colHeader:   Bold, sz 8, Arial, fill #4472C4 (blue), white text, center, wrap, border
  dataCell:    sz 8, Arial, border, vertical top, wrap
  dataCenter:  sz 8, Arial, border, center
  numberCell:  sz 8, Arial, border, center, numFmt "0.00"
  timeCell:    sz 8, Arial, border, center, numFmt "0.000" (for seconds with decimals)
  pctCell:     sz 8, Arial, border, center, numFmt "0.00%"
  summaryLabel: Bold, sz 10, Arial, fill #E8E8E8, border
  summaryValue: Bold, sz 10, Arial, border, center
  feasible:    Bold, sz 10, Arial, fill #C6EFCE (green), color #006100
  notFeasible: Bold, sz 10, Arial, fill #FFC7CE (red), color #9C0006
  chartTitle:  Bold, sz 12, Arial, fill #4472C4, white text
  turnShift:   sz 8, Arial, fill #FFF2CC (light yellow), border, center
```

---

## 10. UI PLACEMENT

### Primary export button location

**In the `BalancingChart` component** — the chart card already has an `actions` slot in its header. Add an export dropdown there:

```
Card title="Saturacion y Balanceo"
  actions={
    <div className="flex items-center gap-2">
      {existing Takt/Saturation tooltips}
      <ExportDropdown>           <--- NEW
        - Tiempos por Estacion (Excel)
        - Reporte Produccion (Excel)   [legacy exportProductionExcel]
        - Estaciones Compartidas (Excel) [if applicable]
      </ExportDropdown>
    </div>
  }
```

### Secondary location: BalancingMetrics toolbar

Add a `Download` icon button next to the existing optimization/zoning buttons:

```
BalancingMetrics toolbar:
  [N Estaciones] [+] [-] [Optimizar] [Restricciones] [Exportar Excel]   <--- NEW
```

### When to show "Estaciones Compartidas" option

Only visible when:
```typescript
const hasSharedStations = data.sectors?.some(s => s.shiftOverride) &&
  data.sectors.filter(s => data.assignments.some(a => {
    const task = data.tasks.find(t => t.id === a.taskId);
    return task?.sectorId === s.id;
  })).length > 1;
```

### Keyboard shortcut

`Ctrl+Shift+E` — consistent with Excel's own export shortcut pattern.

---

## 11. IMPLEMENTATION PRIORITY ORDER

### Phase 1: Core Export (Mode A) — estimated 3-4 hours
1. `balancingExcelStyles.ts` — style constants
2. `balancingExcelFormulas.ts` — formula builders (colLetter, cellAddr, rangeAddr)
3. `balancingExcelExport.ts` — main orchestrator
   - Header section builder
   - Operations table builder
   - Summary table builder
   - Chart data tables builder
   - Sheet assembly + column widths
4. Tests: formula builders (unit), full export smoke test (snapshot)

### Phase 2: UI Integration — estimated 1-2 hours
5. Modify `BalancingChart.tsx` — add export dropdown
6. Modify `LineBalancing.tsx` — wire export handler
7. Test: click export, verify file downloads

### Phase 3: Shared Station Analysis (Mode B) — estimated 3-4 hours
8. `sharedStationCalc.ts` — pure calculation engine
9. `sharedStationExcelExport.ts` — multi-sheet Excel builder
10. Tests: calculation engine (unit), export smoke test
11. UI: conditional "Estaciones Compartidas" button

### Phase 4: Polish — estimated 1-2 hours
12. Print setup (landscape, A4, fit to page width)
13. Freeze panes (header rows frozen)
14. Number formatting refinement
15. Deprecation notices on old `utils/excel.ts` functions

### Total estimated: 8-12 hours

---

## 12. TESTING STRATEGY

### Unit tests (`balancingExcelFormulas.test.ts`)
- `colLetter()`: 0→"A", 25→"Z", 26→"AA", 701→"ZZ"
- `cellAddr()`: various combinations
- `rangeAddr()`: start < end validation
- Formula template builders: correct cell references for known inputs

### Integration tests (`balancingExcelExport.test.ts`)
- Export with EXAMPLE_PROJECT: verify workbook has correct sheet count
- Export with 1 station: verify single sheet
- Export with 5 stations: verify header section has 5 station columns
- Export with variable measurement counts: verify column count
- Export with sectors: verify one sheet per sector
- Formula cells: verify `cell.f` property contains expected formula string
- Style cells: verify `cell.s` has expected fill/font properties
- Merged cells: verify `ws['!merges']` array
- Column widths: verify `ws['!cols']` array length matches data

### Integration tests (`sharedStationCalc.test.ts`)
- 2 products, 1 shift insufficient, 2 shifts sufficient → returns 2
- 2 products, all shifts sufficient → returns 1
- Edge case: 0 demand → returns 1 shift
- OEE factor: lower OEE → more shifts needed
- Surplus calculation: exact to the minute

### Integration tests (`sharedStationExcelExport.test.ts`)
- Multi-sheet workbook: correct sheet names
- "Estacion Compartida" sheet: SI/NO values in correct cells
- Formula preservation in cross-sheet references

---

## 13. KNOWN CONSTRAINTS AND DECISIONS

### xlsx-js-style limitations
- **No image support** — logo will be text-only (or switch to ExcelJS if required)
- **No chart objects** — cannot embed actual Excel charts. Instead, we provide chart data tables that the user can select to create charts manually in Excel. This matches the reference file approach (the charts in the reference were created manually over the data tables).
- **No conditional formatting rules** — we apply static formatting based on calculated values at export time (e.g., green for FACTIBLE, red for NO FACTIBLE)

### Sector shift override interaction
- When a sector has `shiftOverride.activeShifts`, its Takt time is calculated independently via `calculateSectorTaktTime()`
- The export must show per-sector Takt in the header, not just the global Takt
- Stations belonging to sectors with different shift counts will have different T.T and TT-OEE values in the same sheet

### Multi-model (MMALBP) interaction
- If `meta.activeModels` exists with >1 model, the operations table should show weighted standard times
- `task.modelApplicability` determines which models a task applies to
- The "Estaciones Compartidas" analysis can treat each model as a separate "product"

### Fatigue compensation
- If `meta.fatigueCompensation.enabled`, the T.O formula includes fatigue factor
- Formula: `=prom.TO * J.A * (1 + {fatiguePercent/100})`
- If fatigue is per-task (non-'none' fatigueCategory), use task-specific factor
- Reference file shows "F/F: 10%" — this maps to `fatigueCompensation.globalPercent`

---

## 14. FUNCTION SIGNATURES (API SURFACE)

### Main export function

```typescript
// modules/balancing/balancingExcelExport.ts

export interface BalancingExportOptions {
  /** Include chart data tables (default: true) */
  includeChartData?: boolean;
  /** Include summary table (default: true) */
  includeSummary?: boolean;
  /** Max measurement columns (default: 10, max: 30) */
  maxMeasurementCols?: number;
  /** Export mode: per-sector sheets or single sheet */
  sheetMode?: 'per-sector' | 'single';
  /** Custom filename (default: auto-generated from project name) */
  filename?: string;
}

export async function exportBalancingExcel(
  data: ProjectData,
  options?: BalancingExportOptions
): Promise<void>
```

### Shared station export function

```typescript
// modules/balancing/sharedStationExcelExport.ts

export interface SharedStationExportInput {
  /** Products sharing the station */
  products: Array<{
    name: string;
    data: ProjectData;
    sectorId: string;
  }>;
  /** Station identifier */
  stationName: string;
  /** Global shift definitions */
  shifts: Shift[];
}

export async function exportSharedStationExcel(
  input: SharedStationExportInput
): Promise<void>
```

### Calculation engine (pure, testable)

```typescript
// modules/balancing/sharedStationCalc.ts

export interface SharedStationResult {
  requiredShifts: number;           // 1, 2, or 3
  totalGrossMinutes: number;        // Sum of all product requirements
  totalRequiredWithOEE: number;     // Gross / OEE
  availablePerShiftCount: number[]; // [shift1_min, shift1+2_min, shift1+2+3_min]
  fitsPerShiftCount: boolean[];     // [false, false, true] = needs 3 shifts
  surplusMinutes: number;           // Available - Required (for the winning shift count)
  perShiftDistribution: Array<{     // How demand is split across shifts
    shiftNumber: number;
    minutesUsed: number;
    minutesAvailable: number;
    utilizationPercent: number;
  }>;
  perProduct: Array<{               // Per-product breakdown
    name: string;
    grossMinutes: number;
    grossWithOEE: number;
  }>;
}

export function calculateSharedStationRequirements(
  input: SharedStationInput
): SharedStationResult
```
