/**
 * Extract AMFE (FMEA) Headrest data from Excel files and save as JSON.
 *
 * Reads three AMFE Excel files (Central, Delantero, Lateral) from the server,
 * extracts header metadata from "Caratula" and structured FMEA rows from
 * "Apoyacabezas", then writes JSON files to backups/amfe_headrest/.
 */

import { createRequire } from "module";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx-js-style");

// ── Configuration ───────────────────────────────────────────────────────────
const BASE_DIR =
  "//SERVER/compartido/BARACK/CALIDAD/DOCUMENTACION SGC/PPAP CLIENTES/VW/VW427-1LA_K-PATAGONIA/Headrest/Apqp/22- FMEA de proceso";

const FILES = [
  {
    path: join(BASE_DIR, "AMFE - Apoyacabezas Central Preliminar Rev.1 - Patagonia.xlsx"),
    outputName: "amfe_central",
    label: "Central",
  },
  {
    path: join(BASE_DIR, "AMFE - Apoyacabezas delantero Preliminar Rev.1 - Patagonia.xlsx"),
    outputName: "amfe_delantero",
    label: "Delantero",
  },
  {
    path: join(BASE_DIR, "AMFE - Apoyacabezas Lateral Preliminar Rev.1 - Patagonia.xlsx"),
    outputName: "amfe_lateral",
    label: "Lateral",
  },
];

const OUTPUT_DIR = join("C:\\Users\\FacundoS-PC\\dev\\BarackMercosul", "backups", "amfe_headrest");
mkdirSync(OUTPUT_DIR, { recursive: true });

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

  // Row 1: title
  if (raw[1]) meta.titulo = clean(raw[1][0]);

  // Rows 3,5,7,9 contain key-value pairs in specific columns
  const kvRows = [3, 5, 7, 9];
  for (const r of kvRows) {
    if (!raw[r]) continue;
    for (let c = 0; c < raw[r].length - 1; c += 2) {
      const key = clean(raw[r][c]);
      const val = clean(raw[r][c + 1]);
      if (key) {
        meta[normalizeKey(key)] = val;
      }
    }
  }

  return meta;
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
console.log("=== AMFE Headrest Data Extraction ===\n");

for (const file of FILES) {
  console.log(`Processing: ${file.label} ...`);
  console.log(`  Reading: ${file.path}`);

  const wb = XLSX.readFile(file.path);
  console.log(`  Sheets found: ${wb.SheetNames.join(", ")}`);

  // 1) Extract structured data
  const caratula = wb.Sheets["Caratula"]
    ? extractCaratula(wb.Sheets["Caratula"])
    : {};

  const amfeSheet = wb.Sheets["Apoyacabezas"];
  const amfeData = amfeSheet ? extractAmfeRows(amfeSheet) : { headerLabels: {}, rows: [], totalRawRows: 0 };

  // 2) Extract raw sheet data (all sheets as arrays)
  const rawSheets = extractRawSheets(wb);

  // 3) Build output
  const output = {
    _meta: {
      sourceFile: file.path.split("/").pop(),
      label: file.label,
      extractedAt: new Date().toISOString(),
      sheetsFound: wb.SheetNames,
    },
    caratula,
    amfe: {
      headerLabels: amfeData.headerLabels,
      columnMapping: AMFE_COLUMNS,
      totalRawRows: amfeData.totalRawRows,
      dataRowCount: amfeData.rows.length,
      rows: amfeData.rows,
    },
  };

  // Save structured JSON
  const structuredPath = join(OUTPUT_DIR, `${file.outputName}.json`);
  writeFileSync(structuredPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`  Saved structured data: ${structuredPath}`);
  console.log(`    - Caratula fields: ${Object.keys(caratula).length}`);
  console.log(`    - AMFE data rows: ${amfeData.rows.length} (from ${amfeData.totalRawRows} raw rows)`);

  // Save raw sheets JSON (all sheets as arrays for full fidelity)
  const rawPath = join(OUTPUT_DIR, `${file.outputName}_raw.json`);
  writeFileSync(rawPath, JSON.stringify(rawSheets, null, 2), "utf-8");
  console.log(`  Saved raw sheet data: ${rawPath}`);
  for (const [sheetName, sheetData] of Object.entries(rawSheets)) {
    console.log(`    - Sheet "${sheetName}": ${sheetData.length} rows`);
  }

  console.log("");
}

console.log("=== Extraction complete ===");
console.log(`Output directory: ${OUTPUT_DIR}`);
