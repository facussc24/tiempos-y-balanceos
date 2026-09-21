/**
 * apqpClienteGuard.test.mjs — los dos sentidos del apqp-cliente-guard.
 *
 * Un gate que no puede dar VERDE esta tan roto como el que no puede dar ROJO, asi que cada
 * caso en rojo tiene su gemelo en verde. Los casos ROJOS son los que ocurrieron de verdad el
 * 21/09/2026; los VERDES son lo que Fak dejo explicitamente autorizado ese mismo dia.
 *
 * Correr:  node scripts/_lib/apqpClienteGuard.test.mjs
 */
import { GUARDIANES } from './guardianes.mjs';

const PAQUETE = 'Y:\\BARACK\\CALIDAD\\DOCUMENTACION SGC\\PPAP CLIENTES\\REYDEL-SMRC\\APB P21\\P21 SSRT-MY2026 HILO NARANJA\\APQP\\31-Aprobacion de piezas de Produccion(PPAP)\\PPAP_00257327-01-NHZD_328\\05 - Process Flow & Standar Work';
const LEGAJO = 'Y:\\BARACK\\CALIDAD\\DOCUMENTACION SGC\\PPAP CLIENTES\\REYDEL-SMRC\\APB P21\\P21 SSRT-MY2026 HILO NARANJA\\APQP';
const LISTADO = 'Y:\\Ingenieria\\Documentacion Gestion Ingenieria\\13. Analisis del modo de falla y sus efectos ( I-AC-005.3)\\1. LISTADO DE AMFES\\Listado_Maestro_AMFE.xlsx';

/** ctx minimo, con la forma que arma parsear() cuando el JSON del hook se leyo bien. */
const ctx = (tool, { cmd = '', file = '' } = {}) => ({
  ok: true,
  toolL: tool.toLowerCase(),
  cmd6: cmd,
  fileL: file,
  body6: '',
  raw: '',
  rescate: { tool: tool.toLowerCase(), cmd, file, content: '' },
});

const casos = [
  // ───────────────────────────── ROJO: tiene que bloquear
  ['ROJO', 'Write directo adentro del paquete del cliente',
    ctx('Write', { file: `${PAQUETE}\\FLUJOGRAMA 159.pdf` })],
  ['ROJO', 'cp hacia el paquete del cliente',
    ctx('Bash', { cmd: `cp /c/tmp/f.pdf "${PAQUETE}\\FLUJOGRAMA 159.pdf"` })],
  ['ROJO', 'Copy-Item hacia el paquete del cliente',
    ctx('PowerShell', { cmd: `Copy-Item f.pdf "${PAQUETE}\\f.pdf"` })],
  ['ROJO', 'Write directo sobre un listado maestro',
    ctx('Write', { file: LISTADO })],
  ['ROJO', 'script de alta en un listado maestro con --apply',
    ctx('Bash', { cmd: 'py -3 scripts/_registrarAmfe173.py --apply' })],
  ['ROJO', 'el otro script de alta, con --apply',
    ctx('Bash', { cmd: 'py -3 scripts/_registrarFlujograma159.py --apply' })],

  // ───────────────────────────── VERDE: tiene que dejar pasar
  ['VERDE', 'el plano del cliente en su casillero del legajo (autorizado por Fak)',
    ctx('Bash', { cmd: `cp plano.pdf "${LEGAJO}\\6-Planos de la pieza\\RP-00238891.pdf"` })],
  ['VERDE', 'el flujograma en el casillero 20 del legajo',
    ctx('Bash', { cmd: `cp f.pdf "${LEGAJO}\\20- Flujograma de proceso\\FLUJOGRAMA 159.pdf"` })],
  ['VERDE', 'SACAR un archivo del paquete del cliente',
    ctx('Bash', { cmd: `rm -f "${PAQUETE}\\FLUJOGRAMA 159.pdf"` })],
  ['VERDE', 'el mismo script de alta, en DRY-RUN',
    ctx('Bash', { cmd: 'py -3 scripts/_registrarAmfe173.py' })],
  ['VERDE', 'LEER el listado maestro',
    ctx('Bash', { cmd: `py -3 -c "from openpyxl import load_workbook; load_workbook(r'${LISTADO}')"` })],
  ['VERDE', 'listar la carpeta del paquete del cliente',
    ctx('Bash', { cmd: `ls -la "${PAQUETE}"` })],
  ['VERDE', 'un Write cualquiera del repo',
    ctx('Write', { file: 'C:\\Dev\\BarackMercosul\\scripts\\_algo.mjs' })],
  ['VERDE', 'la propia regla que nombra las carpetas',
    ctx('Write', { file: 'C:\\Dev\\BarackMercosul\\.claude\\rules\\autonomy-contract.md' })],
];

let ok = 0;
const fallos = [];
for (const [esperado, titulo, c] of casos) {
  const r = GUARDIANES['apqp-cliente-guard'](c, { env: {} });
  const bloqueo = r && r.tipo === 'bloqueo';
  const dio = bloqueo ? 'ROJO' : 'VERDE';
  if (dio === esperado) { ok++; console.log(`  ok   ${esperado.padEnd(5)} ${titulo}`); }
  else { fallos.push(`${titulo}: esperaba ${esperado} y dio ${dio}`); console.log(`  FALLA ${esperado.padEnd(5)} ${titulo}  -> dio ${dio}`); }
}

console.log(`\n${ok}/${casos.length} casos`);
if (fallos.length) {
  console.error('\nFALLAS:\n  ' + fallos.join('\n  '));
  process.exit(1);
}
const rojos = casos.filter((c) => c[0] === 'ROJO').length;
console.log(`El gate puede dar rojo (${rojos} casos) y puede dar verde (${casos.length - rojos}).`);
