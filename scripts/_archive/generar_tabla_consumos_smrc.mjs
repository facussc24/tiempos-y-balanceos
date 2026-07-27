import ExcelJS from 'exceljs';

const outPath = `C:\\Users\\facun\\OneDrive\\Escritorio\\Actualziar consumos en arb de smrc\\Tabla_Consumos_SMRC_ARB_Normalizada.xlsx`;

const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet('Consumos SMRC ARB');

ws.columns = [
  { header: 'Producto', key: 'producto', width: 32 },
  { header: 'Código Producto Terminado (ARB)', key: 'codigo_conjunto', width: 35 },
  { header: 'Código Insumo', key: 'codigo_insumo', width: 28 },
  { header: 'Descripción Insumo', key: 'desc_insumo', width: 48 },
  { header: 'Valor PDF (Crudo)', key: 'consumo_pdf_str', width: 20 },
  { header: 'U.M. ARB', key: 'um_arb', width: 12 },
  { header: 'VALOR CORRECTO A CARGAR EN ARB', key: 'consumo_arb', width: 32 },
  { header: 'Detalle de Conversión / Regla', key: 'observaciones', width: 45 },
];

const DENSITY_ADH = 0.875; // g/cm3 for Fenoclor ADFA15 / REGV0.6

const data = [];

// Helper for P21 APB
function addP21Apb(variante, codConjunto, codHilo, descHilo, cantHilo) {
  const isSinCostura = !codHilo;
  const viniloCons = isSinCostura ? 0.09 : 0.103;

  data.push({ producto: `APB P21 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: '00240410-03 / 00240436-03', desc_insumo: 'INSERTO PLASTICO RH / LH (abastecido por cliente)', consumo_pdf_str: '1 UN', um_arb: 'UNI', consumo_arb: 1, observaciones: 'Abastecido por cliente (Costo $0)' });
  data.push({ producto: `APB P21 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: '630140ZN65277I', desc_insumo: 'Vinilo KROYCAR ZINA MISTRAL PIP 6T', consumo_pdf_str: `${viniloCons} ML`, um_arb: 'ML', consumo_arb: viniloCons, observaciones: 'Vinilo según tizada' });

  if (codHilo) {
    data.push({ producto: `APB P21 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: codHilo, desc_insumo: descHilo, consumo_pdf_str: `${cantHilo} KG`, um_arb: 'KGS', consumo_arb: cantHilo, observaciones: 'Hilo decorativo' });
    data.push({ producto: `APB P21 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: 'GM30W-49990', desc_insumo: 'HILO UNION 030 W4999 NEGRO (Bilevich)', consumo_pdf_str: '0.0003641 KG', um_arb: 'KGS', consumo_arb: 0.0003641, observaciones: 'Hilo de unión Negro' });
  }

  const adhLts = Number((15 / 1000 / DENSITY_ADH).toFixed(5)); // 0.01714 LTS
  const retLts = Number((0.5 / 1000 / DENSITY_ADH).toFixed(5)); // 0.00057 LTS

  data.push({ producto: `APB P21 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: 'AD - ADFA15', desc_insumo: 'ADHESIVO FA (Fenoclor)', consumo_pdf_str: '15 g', um_arb: 'LTS', consumo_arb: adhLts, observaciones: 'Convertido con densidad real 0.875 g/cm3' });
  data.push({ producto: `APB P21 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: 'AD - REGV0.6', desc_insumo: 'RETICULANTE GV (Fenoclor)', consumo_pdf_str: '0.5 g', um_arb: 'LTS', consumo_arb: retLts, observaciones: 'Convertido con densidad real 0.875 g/cm3' });
  data.push({ producto: `APB P21 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: 'ET-SATO-100X60', desc_insumo: 'ETIQUETA TERMICA 100X60 IMPRESORA SATO', consumo_pdf_str: '0.05 UN', um_arb: 'UNI', consumo_arb: 0.05, observaciones: '1 etiqueta por caja de 20 pzas' });
  data.push({ producto: `APB P21 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: 'ET-SATO-50X20', desc_insumo: 'ETIQUETA AUTOADHESIVA 50x20 mm', consumo_pdf_str: '1.05 UN', um_arb: 'UNI', consumo_arb: 1.05, observaciones: 'Etiqueta por pieza + merma' });
  data.push({ producto: `APB P21 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: 'PPBL - 4A', desc_insumo: 'PRIMER PR-PPBL4A', consumo_pdf_str: '0.00428 LTS', um_arb: 'LTS', consumo_arb: 0.00428, observaciones: 'Primer 4A' });
  data.push({ producto: `APB P21 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: 'PPBL - 4B', desc_insumo: 'PRIMER POLIPROPILENO PPBL4"B"', consumo_pdf_str: '0.000165 LTS', um_arb: 'LTS', consumo_arb: 0.000165, observaciones: 'Primer 4B' });
}

addP21Apb('CUERO sin costura', 'RH: 0238889-06-NHZD / LH: 0238890-06-NHZD', null, null, null);
addP21Apb('HILO NARANJA', 'RH: 0249975-03-NHZD / LH: 0249976-03-NHZD', 'BX92EX-12124E', 'HILO COATS Neophil TEX92 631YJ (NARANJA)', 0.0009);
addP21Apb('HILO VERDE', 'RH: 0252631-02-NHZD / LH: 0252632-02-NHZD', 'FX284-12125E', 'HILO COATS Neophil TEX92 (VERDE)', 0.00045);
addP21Apb('HILO AZUL', 'RH: 0251841-01-NHZD / LH: 0251837-01-NHZD', 'NEO-630YJ-TEX92', 'HILO COATS Neophil TEX92 630YJ (AZUL)', 0.0009);

// Helper for P703 APB
function addP703Apb(variante, codConjunto, codSustrato, descSustrato, esTrasero, conCostura) {
  const vMatVal = esTrasero ? 0.089 : 0.079;
  const fitimVal = esTrasero ? 0.025 : 0.05;
  const adhG = esTrasero ? 17 : 15;
  const retG = esTrasero ? 0.68 : 0.6;

  const adhLts = Number((adhG / 1000 / DENSITY_ADH).toFixed(5));
  const retLts = Number((retG / 1000 / DENSITY_ADH).toFixed(5));

  data.push({ producto: `APB P703 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: codSustrato, desc_insumo: descSustrato, consumo_pdf_str: '1 UNID', um_arb: 'UNI', consumo_arb: 1, observaciones: 'Sustrato inyectado' });
  data.push({ producto: `APB P703 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: '124.602.0228-1', desc_insumo: 'VINILO SANSUY SANFOAM PREMIUM III CL100', consumo_pdf_str: `${vMatVal} MTL`, um_arb: 'ML', consumo_arb: vMatVal, observaciones: 'Vinilo según tizada' });
  data.push({ producto: `APB P703 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: '3M-HB004040869', desc_insumo: 'Fitimpress TR AC 50G FITIM RL 1170m x 10', consumo_pdf_str: `${fitimVal} ROLL`, um_arb: 'UNI', consumo_arb: fitimVal, observaciones: 'Cinta doble faz Fitimpress' });
  data.push({ producto: `APB P703 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: 'AD - ADFA15', desc_insumo: 'ADHESIVO FA (Fenoclor)', consumo_pdf_str: `${adhG} g`, um_arb: 'LTS', consumo_arb: adhLts, observaciones: 'Convertido con densidad real 0.875 g/cm3' });
  data.push({ producto: `APB P703 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: 'AD - REGV0.6', desc_insumo: 'RETICULANTE GV (Fenoclor)', consumo_pdf_str: `${retG} g`, um_arb: 'LTS', consumo_arb: retLts, observaciones: 'Convertido con densidad real 0.875 g/cm3' });

  if (conCostura) {
    data.push({ producto: `APB P703 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: 'BX138A-1530E', desc_insumo: 'HILO VISTA URBEN GREY TEX 181- 20/3 (P703)', consumo_pdf_str: '0.005 KG', um_arb: 'KGS', consumo_arb: 0.005, observaciones: 'Hilo vista Urben Grey' });
  }

  data.push({ producto: `APB P703 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: 'BX69-11527E', desc_insumo: 'HILO UNION NEGRO TEX 70 - 40/3 (P703)', consumo_pdf_str: '0.006 KG', um_arb: 'KGS', consumo_arb: 0.006, observaciones: 'Hilo unión Negro' });
  data.push({ producto: `APB P703 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: 'ES-P-60-4-01', desc_insumo: 'PLACA DE ESPUMA PU 60 KG/M3 ESP 4 MM 0.5', consumo_pdf_str: '0.0125 UN', um_arb: 'UNI', consumo_arb: 0.0125, observaciones: 'Placa espuma PU 60kg/m3' });
  data.push({ producto: `APB P703 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: 'ET-SATO-100X60', desc_insumo: 'ETIQUETA TERMICA 100X60 IMPRESORA SATO', consumo_pdf_str: '0.0333 UN', um_arb: 'UNI', consumo_arb: 0.0333, observaciones: '1 por caja de 30 pzas' });
  data.push({ producto: `APB P703 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: 'ET-SATO-50X20', desc_insumo: 'ETIQUETA AUTOADHESIVA', consumo_pdf_str: '2 UN', um_arb: 'UNI', consumo_arb: 2, observaciones: '2 por pieza' });

  if (!esTrasero) {
    data.push({ producto: `APB P703 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: 'HDPE-1.5-2X1', desc_insumo: 'PLACA HDPE ESPESOR 1.5 MM 2X1 MTS', consumo_pdf_str: '0.035625 KG', um_arb: 'KGS', consumo_arb: 0.035625, observaciones: 'Placa HDPE' });
  }
}

addP703Apb('DEL IZQ - sin costura', '0247647-04-FZHE', '00247647-03-FZH', 'SUSTRATO PLASTICO APB DEL IZQ', false, false);
addP703Apb('DEL DER - sin costura', '0247608-04-FZHE', '00247648-03-FZH', 'SUSTRATO PLASTICO APB DEL DER', false, false);
addP703Apb('DEL IZQ - con costura', '0247609-04-FZHE', '00247647-03-FZH', 'SUSTRATO PLASTICO APB DEL IZQ', false, true);
addP703Apb('DEL DER - con costura', '0247610-04-FZHE', '00247648-03-FZH', 'SUSTRATO PLASTICO APB DEL DER', false, true);

addP703Apb('TRAS IZQ - sin costura', '0247611-04-FZHE', '00247674-03-FZH', 'SUSTRATO PLASTICO APB TRAS IZQ', true, false);
addP703Apb('TRAS DER - sin costura', '0247612-04-FZHE', '00247673-03-FZH', 'SUSTRATO PLASITCO APB TRAS DER', true, false);
addP703Apb('TRAS IZQ - con costura', '0247613-04-FZHE', '00247674-03-FZH', 'SUSTRATO PLASTICO APB TRAS IZQ', true, true);
addP703Apb('TRAS DER - con costura', '0247614-04-FZHE', '00247673-03-FZH', 'SUSTRATO PLASITCO APB TRAS DER', true, true);

// Helper for P703 Top Roll
function addP703TopRoll(variante, codConjunto, codSustrato, descSustrato) {
  const adhLts = Number((25 / 1000 / DENSITY_ADH).toFixed(5)); // 0.02857 LTS
  const retLts = Number((1.0 / 1000 / DENSITY_ADH).toFixed(5)); // 0.00114 LTS

  data.push({ producto: `Top Roll P703 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: codSustrato, desc_insumo: descSustrato, consumo_pdf_str: '1 UN', um_arb: 'UNI', consumo_arb: 1, observaciones: 'Sustrato inyectado' });
  data.push({ producto: `Top Roll P703 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: '124.602.0228-1', desc_insumo: 'VINILO SANSUY SANFOAM PREMIUM III CL100', consumo_pdf_str: '0.133 MTL', um_arb: 'ML', consumo_arb: 0.133, observaciones: 'Vinilo tizada Top Roll' });
  data.push({ producto: `Top Roll P703 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: 'AD - ADFA15', desc_insumo: 'ADHESIVO FA (Fenoclor)', consumo_pdf_str: '25 g', um_arb: 'LTS', consumo_arb: adhLts, observaciones: 'Convertido con densidad real 0.875 g/cm3' });
  data.push({ producto: `Top Roll P703 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: 'AD - REGV0.6', desc_insumo: 'RETICULANTE GV (Fenoclor)', consumo_pdf_str: '1 g', um_arb: 'LTS', consumo_arb: retLts, observaciones: 'Convertido con densidad real 0.875 g/cm3' });
  data.push({ producto: `Top Roll P703 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: 'ET-SATO-100X60', desc_insumo: 'ETIQUETA TERMICA 100X60 IMPRESORA SATO', consumo_pdf_str: '0.02 UN', um_arb: 'UNI', consumo_arb: 0.02, observaciones: '1 por caja de 50 pzas' });
  data.push({ producto: `Top Roll P703 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: 'ET-SATO-50X20', desc_insumo: 'ETIQUETA AUTOADHESIVA', consumo_pdf_str: '2 UN', um_arb: 'UNI', consumo_arb: 2, observaciones: '2 por pieza' });
  data.push({ producto: `Top Roll P703 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: 'PPBL - 4A', desc_insumo: 'PRIMER PR-PPBL4A', consumo_pdf_str: '0.0058 LTS', um_arb: 'LTS', consumo_arb: 0.0058, observaciones: 'Primer 4A Top Roll' });
  data.push({ producto: `Top Roll P703 — ${variante}`, codigo_conjunto: codConjunto, codigo_insumo: 'PPBL - 4B', desc_insumo: 'PRIMER POLIPROPILENO PPBL4"B"', consumo_pdf_str: '0.00026 LTS', um_arb: 'LTS', consumo_arb: 0.00026, observaciones: 'Primer 4B Top Roll' });
}

addP703TopRoll('DEL IZQ (LH)', '0247615-03-FZHE', '00247640-03-FZH', 'PLASTICO TOP ROLL IZQUIERDO');
addP703TopRoll('DEL DER (RH)', '0247616-03-FZHE', '00247641-03-FZH', 'PLASTICO TOP ROLL DERECHO');

// Add rows & styling
data.forEach(item => {
  const row = ws.addRow(item);
  row.eachCell((cell, colNumber) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'D9D9D9' } },
      left: { style: 'thin', color: { argb: 'D9D9D9' } },
      bottom: { style: 'thin', color: { argb: 'D9D9D9' } },
      right: { style: 'thin', color: { argb: 'D9D9D9' } },
    };
    if (colNumber === 7) {
      cell.alignment = { horizontal: 'right' };
      cell.numFmt = '#,##0.00000';
    }
  });
});

// Style Header
const headerRow = ws.getRow(1);
headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
headerRow.fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: '1F4E79' },
};
headerRow.height = 25;
headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

await wb.xlsx.writeFile(outPath);
console.log(`Planilla generada con densidad real 0.875 g/cm3: ${outPath} (${data.length} filas)`);
