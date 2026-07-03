/**
 * Extract PWA TELAS unified AMFE & Flujograma Excel files from server.
 *
 * Reads three files:
 *   - AMFE y Flujograma unificado - TELAS.xlsx (original)
 *   - AMFE y Flujograma unificado - TELAS REV 02.xlsx
 *   - AMFE y Flujograma unificado - TELAS REV 03.xlsx
 *
 * For each file:
 *   1. Lists all sheet names
 *   2. Extracts all data from each sheet (raw arrays)
 *   3. Attempts structured extraction of AMFE data
 *   4. Saves structured JSON + raw JSON
 *
 * Output: backups/pwa_amfe_unificado/
 */

import { createRequire } from "module";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx-js-style");

// ── Configuration ───────────────────────────────────────────────────────────
const BASE_DIR =
  "//SERVER/compartido/BARACK/CALIDAD/DOCUMENTACION SGC/PPAP CLIENTES/PWA/AMFE Y FLUJOGRAMA UNIFICADO/Obsoleto";

const FILES = [
  {
    path: join(BASE_DIR, "AMFE y Flujograma unificado - TELAS.xlsx"),
    outputName: "telas_original",
    label: "TELAS Original (sin revision)",
  },
  {
    path: join(BASE_DIR, "AMFE y Flujograma unificado - TELAS REV 02.xlsx"),
    outputName: "telas_rev02",
    label: "TELAS REV 02",
  },
  {
    path: join(BASE_DIR, "AMFE y Flujograma unificado - TELAS REV 03.xlsx"),
    outputName: "telas_rev03",
    label: "TELAS REV 03",
  },
];

const OUTPUT_DIR = join("C:\\Users\\FacundoS-PC\\dev\\BarackMercosul", "backups", "pwa_amfe_unificado");
mkdirSync(OUTPUT_DIR, { recursive: true });

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

// ── Helper: Extract raw sheet data (all sheets as arrays) ───────────────────
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

// ── Helper: Extract Caratula (cover page) metadata ──────────────────────────
function extractCaratula(ws) {
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const meta = {};

  // Capture all rows with content to understand the layout
  for (let r = 0; r < Math.min(raw.length, 30); r++) {
    if (!raw[r]) continue;
    const rowContent = raw[r].filter((v) => v !== "" && v !== null && v !== undefined);
    if (rowContent.length > 0) {
      // Try to extract key-value pairs
      for (let c = 0; c < raw[r].length - 1; c++) {
        const key = clean(raw[r][c]);
        const val = clean(raw[r][c + 1]);
        if (key && key.length > 2 && key.length < 80) {
          meta[normalizeKey(key)] = val;
        }
      }
    }
  }

  return meta;
}

// ── Helper: Detect AMFE header row ──────────────────────────────────────────
function detectHeaderRow(raw) {
  // Look for a row containing typical AMFE header keywords
  const keywords = [
    "modo de falla", "efecto", "severidad", "ocurrencia", "deteccion",
    "causa", "control", "falla", "modo", "severity",
    "failure mode", "effect", "occurrence", "detection",
    "elemento", "funcion", "requerimiento"
  ];

  for (let r = 0; r < Math.min(raw.length, 30); r++) {
    if (!raw[r]) continue;
    const rowText = raw[r].map((v) => clean(v).toLowerCase()).join(" ");
    const matchCount = keywords.filter((kw) => rowText.includes(kw)).length;
    if (matchCount >= 3) {
      return r;
    }
  }
  return -1;
}

// ── Helper: Extract AMFE-like data from any sheet ───────────────────────────
function extractAmfeData(ws, sheetName) {
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  // Find header row
  const headerRowIdx = detectHeaderRow(raw);

  if (headerRowIdx < 0) {
    return {
      sheetName,
      headerDetected: false,
      headerLabels: {},
      rows: [],
      totalRawRows: raw.length,
    };
  }

  // Extract header labels
  const headerLabels = {};
  for (let c = 0; c < raw[headerRowIdx].length; c++) {
    const val = clean(raw[headerRowIdx][c]);
    if (val) headerLabels[c] = val;
  }

  // Also check if there's a sub-header row (row after header)
  const subHeaderLabels = {};
  if (raw[headerRowIdx + 1]) {
    for (let c = 0; c < raw[headerRowIdx + 1].length; c++) {
      const val = clean(raw[headerRowIdx + 1][c]);
      if (val) subHeaderLabels[c] = val;
    }
  }

  // Find last non-empty row
  let lastRow = 0;
  for (let r = raw.length - 1; r >= 0; r--) {
    if (raw[r] && raw[r].some((v) => v !== "" && v !== null && v !== undefined)) {
      lastRow = r;
      break;
    }
  }

  // Determine data start (skip header + potential sub-header rows)
  let dataStart = headerRowIdx + 1;
  // If sub-header row looks like another header, skip it
  const subRowText = raw[dataStart] ? raw[dataStart].map((v) => clean(v).toLowerCase()).join(" ") : "";
  const headerKeywords = ["nivel", "sistema", "funcion", "tipo", "requerimiento"];
  if (headerKeywords.some((kw) => subRowText.includes(kw))) {
    dataStart++;
  }

  // Extract data rows
  const rows = [];
  for (let r = dataStart; r <= lastRow; r++) {
    const srcRow = raw[r];
    if (!srcRow) continue;

    const hasContent = srcRow.some((v) => v !== "" && v !== null && v !== undefined);
    if (!hasContent) continue;

    const record = { _rowIndex: r + 1 }; // 1-based

    for (let c = 0; c < srcRow.length; c++) {
      const val = srcRow[c];
      if (val !== "" && val !== null && val !== undefined) {
        const headerKey = headerLabels[c]
          ? normalizeKey(headerLabels[c])
          : `col_${c}`;
        record[headerKey] = typeof val === "string" ? val.trim() : val;
      }
    }

    if (Object.keys(record).length > 1) {
      rows.push(record);
    }
  }

  return {
    sheetName,
    headerDetected: true,
    headerRowIndex: headerRowIdx + 1, // 1-based
    headerLabels,
    subHeaderLabels,
    dataStartRow: dataStart + 1, // 1-based
    dataRowCount: rows.length,
    totalRawRows: raw.length,
    rows,
  };
}

// ── Helper: Scan for specific data patterns ─────────────────────────────────
function scanForKeyData(rawSheets) {
  const findings = {
    partNumbers: new Set(),
    operations: [],
    materials: new Set(),
    temperatureReferences: [],
    flamabilidadReferences: [],
    allKeywords: {
      plana: [],
      termoformada: [],
      costura: [],
      corte: [],
      temperatura: [],
      flamabilidad: [],
      tl_1010: [],
      pwa: [],
    },
  };

  for (const [sheetName, rows] of Object.entries(rawSheets)) {
    for (let r = 0; r < rows.length; r++) {
      if (!rows[r]) continue;
      for (let c = 0; c < rows[r].length; c++) {
        const val = clean(rows[r][c]).toLowerCase();
        if (!val) continue;

        // Part numbers (patterns like XX-XXXX, XXXXXXX, etc.)
        const partMatch = clean(rows[r][c]).match(/\b(\d{2}-\d{4}[\w]*|\d{7,})\b/g);
        if (partMatch) {
          partMatch.forEach((p) => findings.partNumbers.add(p));
        }

        // Operations (numbered steps typically)
        if (/^(op\s*\.?\s*\d+|\d{2,3}\s*[-–]\s)/i.test(clean(rows[r][c]))) {
          findings.operations.push({
            sheet: sheetName,
            row: r + 1,
            col: c,
            value: clean(rows[r][c]),
          });
        }

        // Materials
        if (val.includes("material") || val.includes("tela") || val.includes("hilo") || val.includes("sustrato") || val.includes("foam") || val.includes("espuma")) {
          findings.materials.add(clean(rows[r][c]));
        }

        // Temperature
        if (val.includes("temperatura") || val.includes("°c") || val.includes("grados")) {
          findings.temperatureReferences.push({
            sheet: sheetName,
            row: r + 1,
            col: c,
            value: clean(rows[r][c]),
          });
        }

        // Flamabilidad
        if (val.includes("flamab") || val.includes("tl 1010") || val.includes("tl1010") || val.includes("ignicion") || val.includes("combustion")) {
          findings.flamabilidadReferences.push({
            sheet: sheetName,
            row: r + 1,
            col: c,
            value: clean(rows[r][c]),
          });
        }

        // Keyword scanning
        for (const [keyword, arr] of Object.entries(findings.allKeywords)) {
          if (val.includes(keyword.replace(/_/g, " "))) {
            arr.push({
              sheet: sheetName,
              row: r + 1,
              col: c,
              value: clean(rows[r][c]).substring(0, 200),
            });
          }
        }
      }
    }
  }

  // Convert Sets to arrays for JSON serialization
  findings.partNumbers = [...findings.partNumbers];
  findings.materials = [...findings.materials];

  return findings;
}

// ── Main ────────────────────────────────────────────────────────────────────
console.log("=== PWA TELAS AMFE Unificado - Data Extraction ===\n");

for (const file of FILES) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Processing: ${file.label}`);
  console.log(`  File: ${file.path}`);
  console.log(`${"=".repeat(70)}`);

  let wb;
  try {
    wb = XLSX.readFile(file.path);
  } catch (err) {
    console.error(`  ERROR reading file: ${err.message}`);
    continue;
  }

  console.log(`  Sheets found (${wb.SheetNames.length}): ${wb.SheetNames.join(", ")}`);

  // 1) Extract raw sheet data
  const rawSheets = extractRawSheets(wb);

  // Show row counts per sheet
  for (const [name, data] of Object.entries(rawSheets)) {
    const maxCols = data.reduce((max, row) => Math.max(max, row ? row.length : 0), 0);
    console.log(`    Sheet "${name}": ${data.length} rows x ${maxCols} cols`);
  }

  // 2) Extract Caratula if present
  const caratula = {};
  for (const name of wb.SheetNames) {
    if (name.toLowerCase().includes("caratula") || name.toLowerCase().includes("portada")) {
      caratula[name] = extractCaratula(wb.Sheets[name]);
      console.log(`  Caratula "${name}": ${Object.keys(caratula[name]).length} fields`);
    }
  }

  // 3) Extract AMFE structured data from each sheet
  const amfeBySheet = {};
  for (const name of wb.SheetNames) {
    const amfeData = extractAmfeData(wb.Sheets[name], name);
    amfeBySheet[name] = amfeData;
    if (amfeData.headerDetected) {
      console.log(`  AMFE data in "${name}": header at row ${amfeData.headerRowIndex}, ${amfeData.dataRowCount} data rows`);
      // Show header columns
      const headerCols = Object.entries(amfeData.headerLabels).map(([c, v]) => `${c}:${v}`).join(" | ");
      console.log(`    Headers: ${headerCols.substring(0, 200)}...`);
    } else {
      console.log(`  Sheet "${name}": no AMFE header detected`);
    }
  }

  // 4) Scan for key data patterns
  const keyFindings = scanForKeyData(rawSheets);
  console.log(`\n  KEY FINDINGS:`);
  console.log(`    Part numbers: ${keyFindings.partNumbers.join(", ") || "(none)"}`);
  console.log(`    Operations detected: ${keyFindings.operations.length}`);
  console.log(`    Materials: ${keyFindings.materials.size !== undefined ? keyFindings.materials.length : [...keyFindings.materials].length}`);
  console.log(`    Temperature refs: ${keyFindings.temperatureReferences.length}`);
  console.log(`    Flamabilidad refs: ${keyFindings.flamabilidadReferences.length}`);

  // Show first few operations
  if (keyFindings.operations.length > 0) {
    console.log(`    First operations:`);
    keyFindings.operations.slice(0, 10).forEach((op) => {
      console.log(`      Row ${op.row}: ${op.value}`);
    });
  }

  // 5) Build output
  const output = {
    _meta: {
      sourceFile: file.path.split("/").pop(),
      label: file.label,
      extractedAt: new Date().toISOString(),
      sheetsFound: wb.SheetNames,
      sheetDimensions: Object.fromEntries(
        Object.entries(rawSheets).map(([name, data]) => [
          name,
          {
            rows: data.length,
            maxCols: data.reduce((max, row) => Math.max(max, row ? row.length : 0), 0),
          },
        ])
      ),
    },
    caratula,
    amfeBySheet,
    keyFindings,
  };

  // Save structured JSON
  const structuredPath = join(OUTPUT_DIR, `${file.outputName}.json`);
  writeFileSync(structuredPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`\n  Saved structured: ${structuredPath}`);

  // Save raw sheets JSON
  const rawPath = join(OUTPUT_DIR, `${file.outputName}_raw.json`);
  writeFileSync(rawPath, JSON.stringify(rawSheets, null, 2), "utf-8");
  console.log(`  Saved raw: ${rawPath}`);
}

console.log(`\n${"=".repeat(70)}`);
console.log("=== Extraction complete ===");
console.log(`Output directory: ${OUTPUT_DIR}`);
