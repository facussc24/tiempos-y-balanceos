/**
 * Planilla general para dirección — CADENCIA Y DISPONIBILIDAD DE MÁQUINA
 * Inyección Patagonia (pedido Carlos Baptista 07/07/2026).
 *
 * Hoja 1 "Capacidad 350 pzs-modelo": escenario 350 piezas/día de CADA MODELO
 *   (código de pieza). Cada molde de door panel produce 2 modelos (der+izq,
 *   2 cavidades c/u); los IP producen 1 modelo (2 cavidades iguales).
 *   → golpes/día = piezas requeridas totales / cavidades del molde.
 *   Parámetros editables (piezas/modelo, OEE, disponible, cambio de molde):
 *   todas las celdas de cálculo son FÓRMULAS que los referencian.
 *
 * Hoja 2 "Ritmo relevado en planta": referencia con los golpes/día relevados
 *   en la planilla de piso (06/07/2026), mismo modelo de cálculo.
 *
 * Modelo de horas (una sola convención, transparente por capas):
 *   horas necesarias = horas teóricas de producción / OEE + cambios de molde
 *   (el cambio de molde es parada planificada fija: el OEE no le aplica).
 *
 * Códigos por molde: hoja "Sustratos inyectados" del listado oficial
 *   "Listado general Códigos Patagonia vinilos - hilos.xlsx" (servidor Y:).
 *   La asociación Bracket = refuerzos Top Roll es la única consistente con
 *   ese listado (18 códigos ↔ 10 moldes) — confirmar código exacto con Ingeniería.
 *
 * Uso: node scripts/_exportPlanillaCadenciaInyeccion.mjs [outDir]
 */
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { PATAGONIA_MOLDS, OEE } from './_lib/patagoniaInjectionProjects.mjs';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx-js-style');

const HORAS_DISPONIBLES = 21.5; // T1 8h + T2 7,25h + T3 6,25h netas
const CAMBIO_MOLDE_MIN = 60;
const PIEZAS_POR_MODELO = 350; // input editable del escenario Carlos

// Modelos (códigos de pieza) por molde — listado oficial de ingeniería.
const MOLD_CODES = {
  ip_high: ['2HC.858.417.C'],
  ip_low: ['2HC.858.417.B'],
  top_roll_del: ['INY-TRL0001-V1 (der)', 'INY-TRL0003-V1 (izq)'],
  top_roll_tras: ['INY-TRL0005-V1 (der)', 'INY-TRL0007-V1 (izq)'],
  inserto_del: ['INY-INS0001-V1 (der)', 'INY-INS0002-V1 (izq)'],
  inserto_tras: ['INY-INS0003-V1 (der)', 'INY-INS0004-V1 (izq)'],
  apb_del: ['INY-APB0001-V1 (der)', 'INY-APB0002-V1 (izq)'],
  apb_tras: ['INY-APB0003-V1 (der)', 'INY-APB0004-V1 (izq)'],
  bracket_del: ['INY-TRL0002-V1 (ref. der)', 'INY-TRL0004-V1 (ref. izq)'],
  bracket_tras: ['INY-TRL0006-V1 (ref. der)', 'INY-TRL0008-V1 (ref. izq)'],
};

// ---------- estilos ----------
const AZUL = '1F4E79', GRIS = 'D9D9D9', AMARILLO = 'FFF2CC';
const st = {
  titulo: { font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: AZUL } }, alignment: { horizontal: 'center', vertical: 'center' } },
  subtitulo: { font: { italic: true, sz: 10, color: { rgb: '404040' } }, alignment: { horizontal: 'center' } },
  paramLabel: { font: { bold: true, sz: 10 }, alignment: { horizontal: 'right' } },
  paramInput: { font: { bold: true, sz: 11 }, fill: { fgColor: { rgb: AMARILLO } }, border: bordeFino(), alignment: { horizontal: 'center' } },
  header: { font: { bold: true, sz: 9, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: AZUL } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: bordeFino() },
  celda: { font: { sz: 10 }, border: bordeFino(), alignment: { horizontal: 'center', vertical: 'center' } },
  celdaIzq: { font: { sz: 10 }, border: bordeFino(), alignment: { horizontal: 'left', vertical: 'center', wrapText: true } },
  bloqueLabel: { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: GRIS } }, border: bordeFino(), alignment: { horizontal: 'left' } },
  bloqueVal: { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: GRIS } }, border: bordeFino(), alignment: { horizontal: 'center' } },
  nota: { font: { sz: 9, color: { rgb: '595959' } }, alignment: { horizontal: 'left' } },
  notaTitulo: { font: { bold: true, sz: 10 } },
};
function bordeFino() {
  const b = { style: 'thin', color: { rgb: 'BFBFBF' } };
  return { top: b, bottom: b, left: b, right: b };
}

// helpers de celda
const s = (v, style) => ({ v, t: 's', s: style });
const n = (v, style, z) => ({ v, t: 'n', s: style, ...(z ? { z } : {}) });
const f = (formula, style, z) => ({ f: formula, t: 'n', s: style, ...(z ? { z } : {}) });

function nombreCorto(m) { return m.name.replace(/^Inyección /, ''); }

// ---------- HOJA 1: escenario 350 piezas por modelo ----------
function hoja1() {
  const ws = {};
  const molds1200 = PATAGONIA_MOLDS.filter(m => m.machine === '1200T');
  const molds750 = PATAGONIA_MOLDS.filter(m => m.machine === '750T');

  ws['A1'] = s('PLANILLA GENERAL — CADENCIA Y DISPONIBILIDAD DE MÁQUINA · INYECCIÓN PATAGONIA', st.titulo);
  ws['A2'] = s('Escenario: 350 piezas/día de cada modelo (18 códigos, 10 moldes, 2 prensas) · Barack Mercosul Hurlingham · 07/07/2026', st.subtitulo);

  // parámetros editables
  ws['B3'] = s('Piezas/día por modelo:', st.paramLabel); ws['C3'] = n(PIEZAS_POR_MODELO, st.paramInput, '0');
  ws['D3'] = s('OEE:', st.paramLabel); ws['E3'] = n(OEE, st.paramInput, '0%');
  ws['F3'] = s('Disponible (h/día):', st.paramLabel); ws['G3'] = n(HORAS_DISPONIBLES, st.paramInput, '0.00');
  ws['H3'] = s('Cambio de molde (min):', st.paramLabel); ws['I3'] = n(CAMBIO_MOLDE_MIN, st.paramInput, '0');

  const headers = ['Prensa', 'Molde', 'Modelos que produce (códigos)', 'Modelos\nx molde', 'Cavidades', 'Ciclo\n(seg)',
    'Cadencia\n(golpes/h)', 'Cadencia\n(piezas/h)', 'Piezas/día\nrequeridas', 'Golpes/día\nnecesarios', 'Horas\nteóricas', 'Horas\ncon OEE'];
  headers.forEach((h, i) => { ws[XLSX.utils.encode_cell({ r: 4, c: i })] = s(h, st.header); });

  const filaMolde = (m, r) => {
    const codes = MOLD_CODES[m.key];
    ws[`A${r}`] = s(m.machine, st.celda);
    ws[`B${r}`] = s(nombreCorto(m), st.celdaIzq);
    ws[`C${r}`] = s(codes.join('  +  '), st.celdaIzq);
    ws[`D${r}`] = n(codes.length, st.celda, '0');
    ws[`E${r}`] = n(m.cav, st.celda, '0');
    ws[`F${r}`] = n(m.cycle, st.celda, '0');
    ws[`G${r}`] = f(`3600/F${r}`, st.celda, '0.0');
    ws[`H${r}`] = f(`G${r}*E${r}`, st.celda, '0.0');
    ws[`I${r}`] = f(`D${r}*$C$3`, st.celda, '0');
    ws[`J${r}`] = f(`I${r}/E${r}`, st.celda, '0');
    ws[`K${r}`] = f(`J${r}*F${r}/3600`, st.celda, '0.00');
    ws[`L${r}`] = f(`K${r}/$E$3`, st.celda, '0.00');
  };

  const bloque = (prensa, rIni, rFinMoldes, rBloque, nMoldes) => {
    const filas = [
      [`${prensa} — Producción (horas con OEE)`, `SUM(L${rIni}:L${rFinMoldes})`],
      [`${prensa} — Cambios de molde (${nMoldes} moldes × 60 min)`, `${nMoldes}*$I$3/60`],
      [`${prensa} — TOTAL necesario / día`, `L${rBloque}+L${rBloque + 1}`],
      [`${prensa} — Disponible / día`, `$G$3`],
      [`${prensa} — Utilización`, `L${rBloque + 2}/L${rBloque + 3}`],
      [`${prensa} — Saldo de horas (+ sobra / − falta)`, `L${rBloque + 3}-L${rBloque + 2}`],
    ];
    filas.forEach(([label, formula], i) => {
      const r = rBloque + i;
      ws[`B${r}`] = s(label, st.bloqueLabel);
      const z = label.includes('Utilización') ? '0.0%' : '0.00';
      ws[`L${r}`] = f(formula, st.bloqueVal, z);
    });
  };

  molds1200.forEach((m, i) => filaMolde(m, 6 + i));      // filas 6-9
  bloque('1200T', 6, 9, 10, 4);                           // filas 10-15
  molds750.forEach((m, i) => filaMolde(m, 17 + i));       // filas 17-22
  bloque('750T', 17, 22, 23, 6);                          // filas 23-28

  // supuestos y notas
  ws['A30'] = s('SUPUESTOS Y NOTAS', st.notaTitulo);
  const notas = [
    'Disponible 21,5 h netas/día por prensa: T1 8,00 h + T2 7,25 h + T3 6,25 h (3 turnos, 5 días/semana).',
    'OEE 85 % = supuesto (sin estudio de campo). El cambio de molde (60 min por molde y por día) es parada planificada: NO está dentro del OEE y se suma aparte.',
    'Cavidades: cada golpe de un molde de door panel saca 2 piezas derechas + 2 izquierdas (2 modelos). Los moldes de IP sacan 2 piezas iguales del mismo código.',
    'Golpes/día necesarios = piezas requeridas totales del molde ÷ cavidades. Con 350 pzs/modelo, todos los moldes necesitan 175 golpes/día.',
    'Códigos según "Listado general Códigos Patagonia vinilos - hilos.xlsx" (hoja Sustratos inyectados). Los moldes Bracket producen los refuerzos del Top Roll (INY-TRL0002/4/6/8) — asociación a confirmar con Ingeniería; no cambia la cuenta de capacidad.',
    'Semáforo de Utilización: verde < 90 % · amarillo 90–100 % · rojo > 100 %. Celdas amarillas = parámetros editables (todo recalcula).',
  ];
  notas.forEach((t, i) => { ws[`A${31 + i}`] = s(`• ${t}`, st.nota); });

  ws['!ref'] = 'A1:L37';
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } },
  ];
  ws['!cols'] = [{ wch: 8 }, { wch: 34 }, { wch: 48 }, { wch: 9 }, { wch: 9 }, { wch: 7 },
    { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 9 }, { wch: 10 }];
  ws['!rows'] = [{ hpt: 24 }, { hpt: 14 }, { hpt: 18 }, {}, { hpt: 30 }];
  return ws;
}

// ---------- HOJA 2: ritmo relevado en planta ----------
function hoja2() {
  const ws = {};
  const molds1200 = PATAGONIA_MOLDS.filter(m => m.machine === '1200T');
  const molds750 = PATAGONIA_MOLDS.filter(m => m.machine === '750T');

  ws['A1'] = s('REFERENCIA — RITMO RELEVADO EN PLANTA (planilla de piso, 06/07/2026)', st.titulo);
  ws['A2'] = s('Golpes/día relevados por molde (door panels: 350 golpes = 700 piezas/día de CADA modelo). Escenario distinto al de la hoja anterior.', st.subtitulo);

  ws['B3'] = s('OEE:', st.paramLabel); ws['C3'] = n(OEE, st.paramInput, '0%');
  ws['D3'] = s('Disponible (h/día):', st.paramLabel); ws['E3'] = n(HORAS_DISPONIBLES, st.paramInput, '0.00');
  ws['F3'] = s('Cambio de molde (min):', st.paramLabel); ws['G3'] = n(CAMBIO_MOLDE_MIN, st.paramInput, '0');

  const headers = ['Prensa', 'Molde', 'Golpes/día\nrelevados', 'Cavidades', 'Ciclo\n(seg)', 'Piezas/día\n(golpes×cav)', 'Horas\nteóricas', 'Horas\ncon OEE'];
  headers.forEach((h, i) => { ws[XLSX.utils.encode_cell({ r: 4, c: i })] = s(h, st.header); });

  const filaMolde = (m, r) => {
    ws[`A${r}`] = s(m.machine, st.celda);
    ws[`B${r}`] = s(nombreCorto(m), st.celdaIzq);
    ws[`C${r}`] = n(m.golpes, st.celda, '0');
    ws[`D${r}`] = n(m.cav, st.celda, '0');
    ws[`E${r}`] = n(m.cycle, st.celda, '0');
    ws[`F${r}`] = f(`C${r}*D${r}`, st.celda, '0');
    ws[`G${r}`] = f(`C${r}*E${r}/3600`, st.celda, '0.00');
    ws[`H${r}`] = f(`G${r}/$C$3`, st.celda, '0.00');
  };

  const bloque = (prensa, rIni, rFinMoldes, rBloque, nMoldes) => {
    const filas = [
      [`${prensa} — Producción (horas con OEE)`, `SUM(H${rIni}:H${rFinMoldes})`],
      [`${prensa} — Cambios de molde (${nMoldes} moldes × 60 min)`, `${nMoldes}*$G$3/60`],
      [`${prensa} — TOTAL necesario / día`, `H${rBloque}+H${rBloque + 1}`],
      [`${prensa} — Disponible / día`, `$E$3`],
      [`${prensa} — Utilización`, `H${rBloque + 2}/H${rBloque + 3}`],
      [`${prensa} — Saldo de horas (+ sobra / − falta)`, `H${rBloque + 3}-H${rBloque + 2}`],
    ];
    filas.forEach(([label, formula], i) => {
      const r = rBloque + i;
      ws[`B${r}`] = s(label, st.bloqueLabel);
      const z = label.includes('Utilización') ? '0.0%' : '0.00';
      ws[`H${r}`] = f(formula, st.bloqueVal, z);
    });
  };

  molds1200.forEach((m, i) => filaMolde(m, 6 + i));
  bloque('1200T', 6, 9, 10, 4);
  molds750.forEach((m, i) => filaMolde(m, 17 + i));
  bloque('750T', 17, 22, 23, 6);

  ws['A30'] = s('NOTA', st.notaTitulo);
  ws['A31'] = s('• Los 10 Gate 3 VW entregados miden con el criterio del formulario VW (OEE, sin cambios de molde): 1200T carga 116 %, 750T 156 %. Acá se muestra el modelo completo (OEE + cambios de molde), por eso los porcentajes son mayores.', st.nota);

  ws['!ref'] = 'A1:H32';
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
  ];
  ws['!cols'] = [{ wch: 8 }, { wch: 40 }, { wch: 11 }, { wch: 9 }, { wch: 7 }, { wch: 12 }, { wch: 9 }, { wch: 10 }];
  ws['!rows'] = [{ hpt: 24 }, { hpt: 14 }, { hpt: 18 }, {}, { hpt: 30 }];
  return ws;
}

// ---------- main ----------
const outDir = process.argv[2] || join(homedir(), 'Documents', 'EXPORT_INYECCION_PATAGONIA');
mkdirSync(outDir, { recursive: true });
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, hoja1(), 'Capacidad 350 pzs-modelo');
XLSX.utils.book_append_sheet(wb, hoja2(), 'Ritmo relevado en planta');
const outPath = join(outDir, 'PLANILLA_GENERAL_CADENCIA_DISPONIBILIDAD_INYECCION.xlsx');
XLSX.writeFile(wb, outPath);
console.log(`Planilla generada: ${outPath}`);
console.log('Recordar: abrir/recalcular/guardar en Excel (o COM) para fijar valores + semáforo condicional.');
