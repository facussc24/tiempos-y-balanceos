/**
 * Extract structured AMFE data from PWA TELAS unified files.
 *
 * These files use classic AIAG-3 AMFE format (NPR, not AP VDA).
 * Each sheet contains BOTH a flujograma (cols 0-10) and an AMFE (cols 11-29).
 * Plus a product/parts table (cols 31-41) with operation applicability.
 *
 * Layout per sheet:
 *   Row 50 (0-based): AMFE header row
 *   Row 51+: AMFE data rows
 *   Cols 31-34: Sector, Codigo, Denominacion, Fecha
 *   Cols 35-41: Operation applicability matrix (Corte y costura only)
 *
 * AMFE columns (AIAG-3 format):
 *   c11: PROCESO / OPERACION
 *   c12: FALLA POTENCIAL
 *   c13: EFECTO DE FALLA POTENCIAL
 *   c14: ITEM
 *   c15: SEVERIDAD
 *   c16: CLASIFICACION
 *   c17: CAUSA POTENCIAL DE FALLA
 *   c18: OCURRENCIA
 *   c19: CONTROLES PREVENTIVOS
 *   c20: CONTROLES DE DETECCION
 *   c21: DETECCION
 *   c22: NPR (RPN = S * O * D)
 *   c23: ACCIONES RECOMENDADAS
 *   c24: RESPONS. Y PLAZOS PREVISTOS
 *   c25: ACCIONES TOMADAS
 *   c26: SEVERIDAD (post-action)
 *   c27: OCURRENCIA (post-action)
 *   c28: DETECCION (post-action)
 *   c29: NPR (post-action)
 */

import { createRequire } from "module";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx-js-style");

const BASE_DIR =
  "//SERVER/compartido/BARACK/CALIDAD/DOCUMENTACION SGC/PPAP CLIENTES/PWA/AMFE Y FLUJOGRAMA UNIFICADO/Obsoleto";

const OUTPUT_DIR = join("C:\\Users\\FacundoS-PC\\dev\\BarackMercosul", "backups", "pwa_amfe_unificado");
mkdirSync(OUTPUT_DIR, { recursive: true });

function clean(val) {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

// ── Extract header metadata from AMFE area (rows 45-49) ────────────────────
function extractAmfeHeader(raw) {
  const header = {};

  for (let r = 40; r < Math.min(raw.length, 55); r++) {
    if (!raw[r]) continue;
    for (let c = 0; c < raw[r].length; c++) {
      const v = clean(raw[r][c]);
      if (!v) continue;

      // Parse known header patterns
      if (v.startsWith("PLANTAS Y CLIENTES AFECTADOS:")) header.clientesAfectados = v.replace("PLANTAS Y CLIENTES AFECTADOS:", "").trim();
      if (v.startsWith("RESPONSABLE DEL PROCESO")) header.responsableProceso = v.replace(/RESPONSABLE DEL PROCESO\s*:\s*/, "").trim();
      if (v.startsWith("NOMBRE / N°DE PARTE")) header.nombreParte = v.replace(/NOMBRE \/ N°DE PARTE O PROCESO\s*:\s*/, "").trim();
      if (v.startsWith("FECHA FUM")) header.fechaFum = v.replace(/FECHA FUM\s*:\s*/, "").trim();
      if (v.startsWith("PREPARADO POR")) header.preparadoPor = v.replace(/PREPARADO POR\s*:\s*/, "").trim();
      if (v.startsWith("MODELO/ AÑO")) header.modeloAnio = v.replace(/MODELO\/ AÑO\s*:\s*/, "").trim();
      if (v.startsWith("REV:")) header.revision = v.replace(/REV\s*:\s*/, "").trim();
      if (v.startsWith("FECHA  (ORIG)")) header.fechaOrig = v.replace(/FECHA\s*\(ORIG\)\s*:\s*/, "").trim();
      if (v.startsWith("FECHA (REV)")) header.fechaRev = v.replace(/FECHA\s*\(REV\)\s*:\s*/, "").trim();
      if (v.startsWith("EQUIPO DE TRABAJO")) header.equipoTrabajo = v.replace(/EQUIPO DE TRABAJO\s*:\s*/, "").trim();
    }
  }

  return header;
}

// ── Extract document header (flujograma area, rows 1-8) ────────────────────
function extractDocHeader(raw) {
  const header = {};

  for (let r = 0; r < Math.min(raw.length, 10); r++) {
    if (!raw[r]) continue;
    for (let c = 0; c < raw[r].length; c++) {
      const v = clean(raw[r][c]);
      if (!v) continue;

      if (v.startsWith("Realizó:")) header.realizo = v.replace("Realizó:", "").trim();
      if (v.startsWith("Revisó:")) header.reviso = v.replace("Revisó:", "").trim();
      if (v.startsWith("Aprobó:")) header.aprobo = v.replace("Aprobó:", "").trim();
      if (v.startsWith("Fecha de elaboración:")) header.fechaElaboracion = v.replace("Fecha de elaboración:", "").trim();
      if (v.startsWith("Fecha de revisión:")) header.fechaRevision = v.replace("Fecha de revisión:", "").trim();
      if (v.includes("HOJA")) header.hoja = v;
      if (v.startsWith("Pieza Código:")) header.piezaCodigo = v.replace("Pieza Código:", "").trim();
      if (v.startsWith("Denominación:")) header.denominacion = v.replace("Denominación:", "").trim();
      if (v.startsWith("Cliente:")) header.cliente = v.replace("Cliente:", "").trim();
      if (v.startsWith("NOMBRE DEL PROVEEDOR")) header.proveedor = v.replace(/NOMBRE DEL PROVEEDOR\s*:\s*/, "").trim();
    }
  }

  return header;
}

// ── Extract product table (cols 31-41) ──────────────────────────────────────
function extractProductTable(raw) {
  const products = [];

  // Detect header row for operation names (usually in row 1 or 2)
  let opHeaders = {};
  for (let r = 0; r < Math.min(raw.length, 5); r++) {
    if (!raw[r]) continue;
    for (let c = 35; c < Math.min(raw[r].length, 42); c++) {
      const v = clean(raw[r][c]);
      if (v && v.startsWith("Operacion")) {
        opHeaders[c] = v;
      }
    }
  }

  // Second row might have operation names
  let opNames = {};
  for (let r = 0; r < Math.min(raw.length, 5); r++) {
    if (!raw[r]) continue;
    for (let c = 35; c < Math.min(raw[r].length, 42); c++) {
      const v = clean(raw[r][c]);
      if (v && !v.startsWith("Operacion") && !v.startsWith("Aplica") && !v.startsWith("No aplica")) {
        opNames[c] = v;
      }
    }
  }

  for (let r = 2; r < raw.length; r++) {
    if (!raw[r]) continue;
    const codigo = clean(raw[r][32]);
    if (!codigo || !/^\d{2}-\d{4}/.test(codigo)) continue;

    const product = {
      sector: clean(raw[r][31]),
      codigo,
      denominacion: clean(raw[r][33]),
      fechaEmision: raw[r][34], // Serial date or string
    };

    // Extract operation applicability (cols 35-41)
    const ops = {};
    for (let c = 35; c < Math.min(raw[r].length, 42); c++) {
      const v = clean(raw[r][c]);
      if (v) {
        const opName = opNames[c] || opHeaders[c] || `col_${c}`;
        ops[opName] = v === "Aplica";
      }
    }
    if (Object.keys(ops).length > 0) {
      product.operationApplicability = ops;
    }

    products.push(product);
  }

  return products;
}

// ── Extract AMFE data rows ──────────────────────────────────────────────────
function extractAmfeRows(raw) {
  const AMFE_HEADER_ROW = 50; // 0-based
  const DATA_START = 51;

  // Verify header
  const headerRow = raw[AMFE_HEADER_ROW];
  if (!headerRow || !clean(headerRow[11]).includes("PROCESO")) {
    // Try to find it
    for (let r = 45; r < 55; r++) {
      if (raw[r] && clean(raw[r][11]).includes("PROCESO")) {
        return extractAmfeRowsFrom(raw, r + 1);
      }
    }
    return [];
  }

  return extractAmfeRowsFrom(raw, DATA_START);
}

function extractAmfeRowsFrom(raw, dataStart) {
  const rows = [];
  let currentOperation = "";

  for (let r = dataStart; r < raw.length; r++) {
    if (!raw[r]) continue;
    const hasContent = raw[r].some((v, c) => c >= 11 && c <= 29 && v !== "" && v !== null && v !== undefined);
    if (!hasContent) continue;

    // Operation (col 11) - carries forward if merged
    const opText = clean(raw[r][11]);
    if (opText && opText.startsWith("OP")) {
      currentOperation = opText;
    }

    const record = {
      _rowIndex: r + 1,
      operacion: currentOperation || opText,
      fallaPotencial: clean(raw[r][12]),
      efectoFallaPotencial: clean(raw[r][13]),
      item: clean(raw[r][14]),
      severidad: raw[r][15] !== "" && raw[r][15] !== undefined ? Number(raw[r][15]) : null,
      clasificacion: clean(raw[r][16]),
      causaPotencialFalla: clean(raw[r][17]),
      ocurrencia: raw[r][18] !== "" && raw[r][18] !== undefined ? Number(raw[r][18]) : null,
      controlesPreventivos: clean(raw[r][19]),
      controlesDeteccion: clean(raw[r][20]),
      deteccion: raw[r][21] !== "" && raw[r][21] !== undefined ? Number(raw[r][21]) : null,
      npr: raw[r][22] !== "" && raw[r][22] !== undefined ? Number(raw[r][22]) : null,
      accionesRecomendadas: clean(raw[r][23]),
      responsablesPlazos: clean(raw[r][24]),
      accionesTomadas: clean(raw[r][25]),
      severidadPost: raw[r][26] !== "" && raw[r][26] !== undefined ? Number(raw[r][26]) : null,
      ocurrenciaPost: raw[r][27] !== "" && raw[r][27] !== undefined ? Number(raw[r][27]) : null,
      deteccionPost: raw[r][28] !== "" && raw[r][28] !== undefined ? Number(raw[r][28]) : null,
      nprPost: raw[r][29] !== "" && raw[r][29] !== undefined ? Number(raw[r][29]) : null,
    };

    // Clean nulls
    const cleaned = {};
    for (const [k, v] of Object.entries(record)) {
      if (v !== null && v !== "") {
        cleaned[k] = v;
      }
    }

    if (Object.keys(cleaned).length > 1) {
      rows.push(cleaned);
    }
  }

  return rows;
}

// ── Extract flujograma steps from left side (cols 0-10) ─────────────────────
function extractFlujograma(raw) {
  const steps = [];

  for (let r = 0; r < raw.length; r++) {
    if (!raw[r]) continue;
    for (let c = 0; c <= 10; c++) {
      const v = clean(raw[r][c]);
      if (v && v.length > 5 && !/^(FLUJOGRAMA|Realizó|Revisó|Aprobó|Pieza|Denominación|Cliente|CARACT|HOJA|DESCRIPCION)/.test(v)) {
        steps.push({ row: r + 1, col: c, text: v });
      }
    }
  }

  return steps;
}

// ── Extract "Telas por sector" and "Telas por op" summary sheets ────────────
function extractTelasLookup(raw, hasColZero) {
  if (!raw || raw.length === 0) return [];

  const offset = hasColZero ? 0 : 1;
  const entries = [];

  for (let r = 1; r < raw.length; r++) {
    if (!raw[r]) continue;
    const codigo = clean(raw[r][offset + 1]);
    if (!codigo || !/^\d{2}-\d{4}/.test(codigo)) continue;

    const entry = {
      sector: clean(raw[r][offset]),
      codigo,
      denominacion: clean(raw[r][offset + 1 + 1]),
      fechaEmision: raw[r][offset + 1 + 2],
      operations: {
        recepcion: clean(raw[r][offset + 4]) === "Aplica",
        corte: clean(raw[r][offset + 5]) === "Aplica",
        troquelado: clean(raw[r][offset + 6]) === "Aplica",
        costura: clean(raw[r][offset + 7]) === "Aplica",
        pegadoDotsAplix: clean(raw[r][offset + 8]) === "Aplica",
        colocacionClips: clean(raw[r][offset + 9]) === "Aplica",
        inspeccionFinal: clean(raw[r][offset + 10]) === "Aplica",
        embalaje: clean(raw[r][offset + 11]) === "Aplica",
      },
    };

    entries.push(entry);
  }

  return entries;
}

// ── Main ────────────────────────────────────────────────────────────────────
console.log("=== PWA TELAS AMFE Unificado - Structured Extraction ===\n");

// Process REV 03 (primary)
const filePath = join(BASE_DIR, "AMFE y Flujograma unificado - TELAS REV 03.xlsx");
console.log("Reading:", filePath);

const wb = XLSX.readFile(filePath);
console.log("Sheets:", wb.SheetNames.join(", "));

const amfeSheetNames = ["Corte y pegado de aplix", "Corte sin costura", "Troquelado y costura", "Corte y costura"];
const result = {
  _meta: {
    sourceFile: "AMFE y Flujograma unificado - TELAS REV 03.xlsx",
    extractedAt: new Date().toISOString(),
    format: "AIAG-3 (classic NPR, not VDA AP)",
    client: "PWA",
    sheetsFound: wb.SheetNames,
    description: "Unified AMFE & Process Flow for ALL PWA Telas (Planas) products. Each sheet represents a process family.",
  },
  processTypes: {},
  productCatalog: {
    bySheet: {},
    allPartNumbers: [],
  },
  telasLookup: {},
  summary: {},
};

// Process each AMFE sheet
for (const sheetName of amfeSheetNames) {
  const ws = wb.Sheets[sheetName];
  if (!ws) continue;

  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  console.log(`\n--- ${sheetName} ---`);

  const docHeader = extractDocHeader(raw);
  const amfeHeader = extractAmfeHeader(raw);
  const productTable = extractProductTable(raw);
  const amfeRows = extractAmfeRows(raw);
  const flujograma = extractFlujograma(raw);

  console.log(`  Doc header: ${JSON.stringify(docHeader).substring(0, 100)}...`);
  console.log(`  AMFE header: ${JSON.stringify(amfeHeader).substring(0, 100)}...`);
  console.log(`  Products: ${productTable.length}`);
  console.log(`  AMFE rows: ${amfeRows.length}`);
  console.log(`  Flujograma steps: ${flujograma.length}`);

  // Extract unique operations
  const operations = [...new Set(amfeRows.map((r) => r.operacion).filter(Boolean))];
  console.log(`  Operations: ${operations.join(" | ")}`);

  result.processTypes[sheetName] = {
    docHeader,
    amfeHeader,
    operations,
    amfeRows,
    flujograma,
    amfeRowCount: amfeRows.length,
  };

  result.productCatalog.bySheet[sheetName] = productTable;
}

// Collect all unique part numbers
const allParts = new Set();
for (const [_, products] of Object.entries(result.productCatalog.bySheet)) {
  for (const p of products) {
    allParts.add(p.codigo);
  }
}
result.productCatalog.allPartNumbers = [...allParts].sort();
console.log(`\nTotal unique part numbers: ${result.productCatalog.allPartNumbers.length}`);

// Extract Telas por sector
const sectorSheet = wb.Sheets["Telas por sector"];
if (sectorSheet) {
  const sectorRaw = XLSX.utils.sheet_to_json(sectorSheet, { header: 1, defval: "" });
  result.telasLookup.porSector = extractTelasLookup(sectorRaw, false);
  console.log(`Telas por sector: ${result.telasLookup.porSector.length} entries`);
}

// Extract Telas por op
const opSheet = wb.Sheets["Telas por op"];
if (opSheet) {
  const opRaw = XLSX.utils.sheet_to_json(opSheet, { header: 1, defval: "" });
  result.telasLookup.porOp = extractTelasLookup(opRaw, true);
  console.log(`Telas por op: ${result.telasLookup.porOp.length} entries`);
}

// Build summary
const totalAmfeRows = Object.values(result.processTypes).reduce((sum, pt) => sum + pt.amfeRowCount, 0);
const allOperations = {};
for (const [sheetName, pt] of Object.entries(result.processTypes)) {
  for (const op of pt.operations) {
    if (!allOperations[op]) allOperations[op] = [];
    allOperations[op].push(sheetName);
  }
}

result.summary = {
  totalPartNumbers: result.productCatalog.allPartNumbers.length,
  totalAmfeDataRows: totalAmfeRows,
  processTypeCount: Object.keys(result.processTypes).length,
  processTypes: Object.keys(result.processTypes),
  operationsAcrossSheets: allOperations,
  sevDistribution: {},
  rowsWithActions: 0,
  rowsWithPostActionRatings: 0,
};

// Severity distribution
const sevDist = {};
let withActions = 0;
let withPostRatings = 0;
for (const pt of Object.values(result.processTypes)) {
  for (const row of pt.amfeRows) {
    if (row.severidad) {
      sevDist[row.severidad] = (sevDist[row.severidad] || 0) + 1;
    }
    if (row.accionesRecomendadas || row.accionesTomadas) withActions++;
    if (row.severidadPost || row.nprPost) withPostRatings++;
  }
}
result.summary.sevDistribution = sevDist;
result.summary.rowsWithActions = withActions;
result.summary.rowsWithPostActionRatings = withPostRatings;

// NPR distribution
const nprValues = [];
for (const pt of Object.values(result.processTypes)) {
  for (const row of pt.amfeRows) {
    if (row.npr) nprValues.push(row.npr);
  }
}
result.summary.nprStats = {
  min: Math.min(...nprValues),
  max: Math.max(...nprValues),
  uniqueValues: [...new Set(nprValues)].sort((a, b) => a - b),
  count: nprValues.length,
};

console.log(`\n=== SUMMARY ===`);
console.log(`Total part numbers: ${result.summary.totalPartNumbers}`);
console.log(`Total AMFE data rows: ${result.summary.totalAmfeDataRows}`);
console.log(`Process types: ${result.summary.processTypes.join(", ")}`);
console.log(`Severity distribution: ${JSON.stringify(result.summary.sevDistribution)}`);
console.log(`NPR stats: min=${result.summary.nprStats.min}, max=${result.summary.nprStats.max}`);
console.log(`NPR unique values: ${result.summary.nprStats.uniqueValues.join(", ")}`);
console.log(`Rows with actions: ${result.summary.rowsWithActions}`);
console.log(`Rows with post-action ratings: ${result.summary.rowsWithPostActionRatings}`);

// Save
const outPath = join(OUTPUT_DIR, "telas_rev03_structured.json");
writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");
console.log(`\nSaved: ${outPath}`);

console.log("\n=== Extraction complete ===");
