/**
 * Extract AMFE (FMEA) Armrest & IP PADs data from Excel files and save as JSON.
 *
 * Reads AMFE Excel files from the server, extracts header metadata from
 * "Caratula" and structured FMEA rows from the main data sheet, then writes
 * JSON files to backups/amfe_armrest_excel/ and backups/amfe_ip_pads_excel/.
 */

import { createRequire } from "module";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx-js-style");

// ── Configuration ───────────────────────────────────────────────────────────
const PROJECT_ROOT = "C:\\Users\\FacundoS-PC\\dev\\BarackMercosul";

const FILES = [
  {
    path: "//SERVER/compartido/BARACK/CALIDAD/DOCUMENTACION SGC/PPAP CLIENTES/VW/VW427-1LA_K-PATAGONIA/Armrest Rear/1-APQP/22- FMEA de proceso/AMFE - Apb Tra Rev.1 - Patagonia.xlsx",
    outputDir: join(PROJECT_ROOT, "backups", "amfe_armrest_excel"),
    outputName: "amfe_armrest_rear",
    label: "Armrest Rear",
    dataSheetName: "ARMREST REAR L3",
  },
  {
    path: "//SERVER/compartido/BARACK/CALIDAD/DOCUMENTACION SGC/PPAP CLIENTES/VW/VW427-1LA_K-PATAGONIA/IP PADs/APQP/22- FMEA de proceso/PATAGONIA_TRIM ASM-UPR WRAPPING_AMFE-Rev.1_Preliminar.xlsx",
    outputDir: join(PROJECT_ROOT, "backups", "amfe_ip_pads_excel"),
    outputName: "amfe_ip_pads",
    label: "IP PADs (TRIM ASM-UPR WRAPPING)",
    dataSheetName: "TRIM ASM-UPR WRAPPING",
  },
];

// ── AMFE column mapping (row 11 in the spreadsheet = index 11 in 0-based) ──
const AMFE_COLUMNS = {
  0: "siguienteNivelSuperior",         // 1-SIGUIENTE NIVEL SUPERIOR (SISTEMA)
  1: "elementoFoco",                    // 2-ELEMENTO FOCO (ELEMENTO DEL SISTEMA)
  2: "siguienteNivelInferior",          // 3-SIGUIENTE NIVEL INFERIOR O TIPO DE CARACTERISTICA
  3: "funcionNivelSuperior",            // 1-FUNCION Y REQUERIMIENTOS (nivel superior)
  4: "funcionElementoFoco",             // 2-ELEMENTO FOCO-FUNCION Y REQUERIMIENTO
  5: "funcionNivelInferior",            // 3-PROXIMO NIVEL MAS BAJO DE FUNCION
  6: "efectoFalla",                     // EFECTO DE LA FALLA (EF)
  7: "modoFalla",                       // MODOS DE FALLAS (FM)
  8: "causaFalla",                      // CAUSA DE LA FALLA (FC)
  9: "severidad",                       // SEVERIDAD
  10: "controlPreventivo",              // CONTROLES PREVENTIVOS CORRIENTES (PC)
  11: "ocurrencia",                     // OCURRENCIA
  12: "controlDetectivo",               // CONTROLES DETECTIVOS CORRIENTES
  13: "deteccion",                      // DETECCION
  14: "apDfmea",                        // AP DFMEA
  15: "filterCode",                     // Filter Code (Opcional)
  16: "accionPreventiva",               // ACCION PREVENTIVA
  17: "accionDetectiva",                // ACCION DETECTIVA
  18: "responsable",                    // NOMBRE DE LA PERSONA RESPONSABLE
  19: "fechaObjetivo",                  // FECHA OBJETIVO DE TERMINACION
  20: "estatus",                        // ESTATUS
  21: "accionTomada",                   // ACCION TOMADA
  22: "fechaTerminacion",              // FECHA DE TERMINACION
  23: "severidadOptimizada",           // SEVERIDAD (optimizacion)
  24: "ocurrenciaOptimizada",          // OCURRENCIA (optimizacion)
  25: "deteccionOptimizada",           // DETECCION (optimizacion)
  26: "apDfmeaOptimizado",            // AP DFMEA (optimizacion)
  27: "observaciones",                 // OBSERVACIONES
};

const HEADER_ROW_INDEX = 11; // 0-based index of the header row
const DATA_START_ROW = 12;   // first potential data row after header

// ── Helper: Extract Caratula (cover page) metadata ──────────────────────────
function extractCaratula(ws) {
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const meta = {};

  // Row 0: title
  if (raw[0]) meta.titulo = clean(raw[0][0]);

  // Row 1: provider info
  if (raw[1]) {
    for (let c = 0; c < raw[1].length; c++) {
      const val = clean(raw[1][c]);
      if (val) {
        // Parse "KEY : VALUE" style entries
        const match = val.match(/^(.+?)\s*:\s*(.+)$/);
        if (match) {
          meta[normalizeKey(match[1])] = match[2].trim();
        }
      }
    }
  }

  // Row 3: description/code
  if (raw[3]) {
    const val = clean(raw[3][0]);
    if (val) {
      const match = val.match(/^(.+?)\s*:\s*(.+)$/);
      if (match) {
        meta[normalizeKey(match[1])] = match[2].trim();
      } else {
        meta.descripcion = val;
      }
    }
  }

  // Rows 5-9: key-value pairs and revision table header
  for (let r = 5; r < Math.min(raw.length, 10); r++) {
    if (!raw[r]) continue;
    for (let c = 0; c < raw[r].length; c++) {
      const val = clean(raw[r][c]);
      if (val) {
        // Check if it's a key: value pattern
        const match = val.match(/^(.+?)\s*:\s*$/);
        if (match && c + 1 < raw[r].length) {
          const nextVal = clean(raw[r][c + 1]);
          if (nextVal) {
            meta[normalizeKey(match[1])] = nextVal;
          }
        }
      }
    }
  }

  // Extract revision table (rows 8+)
  const revisions = [];
  for (let r = 8; r < raw.length; r++) {
    if (!raw[r]) continue;
    const rowData = raw[r].filter(v => v !== "" && v !== null && v !== undefined);
    if (rowData.length === 0) continue;
    // Skip if this looks like a header row
    const firstVal = clean(raw[r][0]);
    if (firstVal === "FECHA" || firstVal === "REVISIONES") continue;
    // Check if it has a date-like value in first column
    if (raw[r][0] !== "" && raw[r][0] !== null && raw[r][0] !== undefined) {
      revisions.push({
        fecha: clean(raw[r][0]),
        itemCambiado: clean(raw[r][1]),
        detalles: clean(raw[r][2]),
        fechaPsw: clean(raw[r][3]),
        modifico: clean(raw[r][4]),
      });
    }
    // Stop after a few empty rows
    if (r > 20) break;
  }
  if (revisions.length > 0) meta.revisiones = revisions;

  return meta;
}

// ── Helper: Extract AMFE header metadata (rows 3-9 of data sheet) ───────────
function extractAmfeHeader(ws) {
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const header = {};

  // These files use merged cells — key-value pairs sit at even columns
  // col 2=label, col 4=value, col 6=label, col 8=value, col 10=label, col 12=value

  // Row 3: organization, tema, N° AMFE
  if (raw[3]) {
    header.organizacion = clean(raw[3][4]);
    header.tema = clean(raw[3][8]);
    header.numeroAmfe = clean(raw[3][12]);
  }

  // Row 5: plant, fecha inicio, responsable diseño
  if (raw[5]) {
    header.planta = clean(raw[5][4]);
    header.fechaInicioAmfe = clean(raw[5][8]);
    header.responsableDiseno = clean(raw[5][12]);
  }

  // Row 7: cliente, fecha revision, confidencialidad
  if (raw[7]) {
    header.cliente = clean(raw[7][4]);
    header.fechaRevisionAmfe = clean(raw[7][8]);
    header.confidencialidad = clean(raw[7][12]);
  }

  // Row 9: modelo/año, equipo multifuncional
  if (raw[9]) {
    header.modeloAno = clean(raw[9][4]);
    const team = [];
    for (let c = 6; c < raw[9].length; c++) {
      const val = clean(raw[9][c]);
      if (val && val !== "EQUIPO MULTIFUNCIONAL") team.push(val);
    }
    header.equipoMultifuncional = team;
  }

  return header;
}

// ── Helper: Extract AMFE rows ───────────────────────────────────────────────
function extractAmfeRows(ws) {
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  // Find last non-empty row
  let lastRow = 0;
  for (let r = raw.length - 1; r >= 0; r--) {
    if (raw[r] && raw[r].some((v) => v !== "" && v !== null && v !== undefined)) {
      lastRow = r;
      break;
    }
  }

  // Extract header labels for reference
  const headerLabels = {};
  if (raw[HEADER_ROW_INDEX]) {
    for (let c = 0; c < raw[HEADER_ROW_INDEX].length; c++) {
      const val = clean(raw[HEADER_ROW_INDEX][c]);
      if (val) headerLabels[c] = val;
    }
  }

  // Extract data rows - keep all rows from DATA_START_ROW to lastRow
  const rows = [];
  for (let r = DATA_START_ROW; r <= lastRow; r++) {
    const srcRow = raw[r];
    if (!srcRow) continue;

    // Check if row has any content
    const hasContent = srcRow.some((v) => v !== "" && v !== null && v !== undefined);
    if (!hasContent) continue;

    const record = { _rowIndex: r + 1 }; // 1-based row number for reference

    // Map known columns
    for (const [colStr, fieldName] of Object.entries(AMFE_COLUMNS)) {
      const col = parseInt(colStr, 10);
      if (col < srcRow.length) {
        const val = srcRow[col];
        if (val !== "" && val !== null && val !== undefined) {
          record[fieldName] = typeof val === "string" ? val.trim() : val;
        }
      }
    }

    // Also capture any extra columns beyond 27
    for (let c = 28; c < srcRow.length; c++) {
      const val = srcRow[c];
      if (val !== "" && val !== null && val !== undefined) {
        record[`col${c}`] = typeof val === "string" ? val.trim() : val;
      }
    }

    // Only add if we have meaningful data (more than just _rowIndex)
    if (Object.keys(record).length > 1) {
      rows.push(record);
    }
  }

  return { headerLabels, rows, totalRawRows: lastRow + 1 };
}

// ── Helper: Also get full raw data as arrays (all sheets) ───────────────────
function extractRawSheets(wb) {
  const sheets = {};
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    // Trim trailing empty rows
    let lastRow = 0;
    for (let r = raw.length - 1; r >= 0; r--) {
      if (raw[r] && raw[r].some((v) => v !== "" && v !== null && v !== undefined)) {
        lastRow = r;
        break;
      }
    }
    sheets[name] = raw.slice(0, lastRow + 1);
  }
  return sheets;
}

// ── Utilities ───────────────────────────────────────────────────────────────
function clean(val) {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

function normalizeKey(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

// ── Main ────────────────────────────────────────────────────────────────────
console.log("=== AMFE Armrest & IP PADs Data Extraction ===\n");

for (const file of FILES) {
  console.log(`Processing: ${file.label} ...`);
  console.log(`  Reading: ${file.path}`);

  // Create output directory
  mkdirSync(file.outputDir, { recursive: true });

  const wb = XLSX.readFile(file.path);
  console.log(`  Sheets found: ${wb.SheetNames.join(", ")}`);

  // 1) Extract caratula
  const caratula = wb.Sheets["Caratula"]
    ? extractCaratula(wb.Sheets["Caratula"])
    : {};

  // 2) Extract AMFE header metadata from the data sheet
  const dataSheet = wb.Sheets[file.dataSheetName];
  const amfeHeader = dataSheet ? extractAmfeHeader(dataSheet) : {};

  // 3) Extract structured AMFE rows
  const amfeData = dataSheet
    ? extractAmfeRows(dataSheet)
    : { headerLabels: {}, rows: [], totalRawRows: 0 };

  // 4) Extract raw sheet data (all sheets as arrays)
  const rawSheets = extractRawSheets(wb);

  // 5) Build output
  const output = {
    _meta: {
      sourceFile: file.path.split("/").pop(),
      label: file.label,
      dataSheetName: file.dataSheetName,
      extractedAt: new Date().toISOString(),
      sheetsFound: wb.SheetNames,
    },
    caratula,
    amfeHeader,
    amfe: {
      headerLabels: amfeData.headerLabels,
      columnMapping: AMFE_COLUMNS,
      totalRawRows: amfeData.totalRawRows,
      dataRowCount: amfeData.rows.length,
      rows: amfeData.rows,
    },
  };

  // Save structured JSON
  const structuredPath = join(file.outputDir, `${file.outputName}.json`);
  writeFileSync(structuredPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`  Saved structured data: ${structuredPath}`);
  console.log(`    - Caratula fields: ${Object.keys(caratula).length}`);
  console.log(`    - AMFE header fields: ${Object.keys(amfeHeader).length}`);
  console.log(`    - AMFE data rows: ${amfeData.rows.length} (from ${amfeData.totalRawRows} raw rows)`);

  // Save raw sheets JSON (all sheets as arrays for full fidelity)
  const rawPath = join(file.outputDir, `${file.outputName}_raw.json`);
  writeFileSync(rawPath, JSON.stringify(rawSheets, null, 2), "utf-8");
  console.log(`  Saved raw sheet data: ${rawPath}`);
  for (const [sheetName, sheetData] of Object.entries(rawSheets)) {
    console.log(`    - Sheet "${sheetName}": ${sheetData.length} rows`);
  }

  console.log("");
}

console.log("=== Extraction complete ===");
console.log("Output directories:");
for (const file of FILES) {
  console.log(`  ${file.outputDir}`);
}
