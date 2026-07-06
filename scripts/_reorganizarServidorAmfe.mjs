/**
 * _reorganizarServidorAmfe.mjs — Renombra los AMFEs vigentes a convencion consistente.
 *
 * Fase 6. Renombra IN-PLACE cada archivo vigente (el que apunta amfe_registry.server_path)
 * a `AMFE <codigo> - <producto> - Rev.<rev>.xlsx`, dentro de su misma carpeta. NO mueve
 * entre carpetas (ya estan ordenadas por cliente/producto) y NUNCA borra ni sobrescribe.
 * Los archivos de 1.ORGANIZAR se listan aparte para revision manual (no se tocan).
 *
 * Rev del nombre = la que trae el ARCHIVO actual (no rev_actual del registro, que puede
 * venir del listado y no coincidir). Se marca la discrepancia en el CSV.
 *
 * Uso:
 *   # dry-run (default): imprime plan + escribe reports/plan_reorganizacion.csv
 *   node scripts/_reorganizarServidorAmfe.mjs --dump reports/registry_reorg_dump.json
 *   # aplicar (renombra de verdad, con log de rollback):
 *   node scripts/_reorganizarServidorAmfe.mjs --dump reports/registry_reorg_dump.json --apply
 *
 * El dump es un JSON array de filas de amfe_registry (snake_case) con al menos
 * amfe_code, producto, rev_actual, estado, server_path, tipo.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { RUTA_BASE_AMFE } from './_lib/serverPaths.mjs';

// ─── CLI ─────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const dumpIdx = argv.indexOf('--dump');
const DUMP = dumpIdx >= 0 ? argv[dumpIdx + 1] : null;
if (!DUMP || !existsSync(DUMP)) {
    console.error('Falta --dump <registry.json> (array de filas de amfe_registry).');
    process.exit(1);
}
const INVENTARIO = 'reports/inventario_amfe.json';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const ascii = (s) => sinAcentos(s).replace(/[^a-zA-Z0-9 _().-]/g, '').replace(/\s+/g, ' ').trim();

/** Extrae la rev del nombre del archivo (letra o numero). Igual heuristica que el inventario. */
function revDeArchivo(nombre) {
    let m = nombre.match(/\bREV(?:ISION)?[\s._-]*0*(\d{1,2})\b/i);
    if (m) return String(Number(m[1]));
    m = nombre.match(/\bREV[\s._-]*\.?\s*([A-Z])(?![A-Za-z])/i);
    if (m) return m[1].toUpperCase();
    m = nombre.match(/REV([A-Z])\b/i);
    if (m) return m[1].toUpperCase();
    return '';
}

/** Nombre destino canonico. */
function nombreCanonico(code, producto, rev) {
    const prod = ascii(producto).slice(0, 60).trim();
    const revTxt = rev ? ` - Rev.${rev}` : '';
    return `AMFE ${code} - ${prod}${revTxt}.xlsx`;
}

const CSV_ESC = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// ─── Datos ───────────────────────────────────────────────────────────────────

const registry = JSON.parse(readFileSync(DUMP, 'utf8'));
const inventario = existsSync(INVENTARIO) ? JSON.parse(readFileSync(INVENTARIO, 'utf8')) : { archivos: [] };

// ─── Plan de renombrados ─────────────────────────────────────────────────────

const plan = [];
for (const r of registry) {
    const serverPath = r.server_path || '';
    if (!serverPath) continue;
    const carpetaRel = dirname(serverPath);
    const actual = basename(serverPath);
    if (extname(actual).toLowerCase() !== '.xlsx' && extname(actual).toLowerCase() !== '.xls') continue;

    const revArchivo = revDeArchivo(actual);
    const rev = revArchivo || (r.rev_actual || '');
    const destino = nombreCanonico(r.amfe_code, r.producto, rev);

    const discrepancia = revArchivo && r.rev_actual && revArchivo !== String(r.rev_actual)
        ? `rev archivo=${revArchivo} vs registro=${r.rev_actual}` : '';

    plan.push({
        code: r.amfe_code,
        estado: r.estado || '',
        carpetaRel,
        actual,
        destino,
        accion: actual === destino ? 'OK (ya canonico)' : 'RENOMBRAR',
        revArchivo, revRegistro: r.rev_actual || '', discrepancia,
    });
}

// Archivos en 1.ORGANIZAR (solo reporte, no se tocan)
const quilombo = (inventario.archivos || []).filter(a => a.esExcel && a.enQuilombo).map(a => a.rel);

// ─── Salidas ─────────────────────────────────────────────────────────────────

mkdirSync('reports', { recursive: true });
const renombrar = plan.filter(p => p.accion === 'RENOMBRAR');
const okYa = plan.filter(p => p.accion !== 'RENOMBRAR');

const csv = ['amfe_code,estado,carpeta,desde,hacia,rev_archivo,rev_registro,discrepancia'];
for (const p of plan) {
    csv.push([p.code, p.estado, p.carpetaRel, p.actual, p.destino, p.revArchivo, p.revRegistro, p.discrepancia].map(CSV_ESC).join(','));
}
writeFileSync('reports/plan_reorganizacion.csv', csv.join('\n'));

console.info('═══ PLAN DE REORGANIZACION (renombrado in-place) ═══');
console.info(`Total con server_path: ${plan.length} | a renombrar: ${renombrar.length} | ya canonicos: ${okYa.length}`);
console.info(`Discrepancias rev archivo/registro: ${plan.filter(p => p.discrepancia).length}`);
console.info(`Archivos en 1.ORGANIZAR (revision manual, NO se tocan): ${quilombo.length}`);
console.info('\nEjemplos de renombrado:');
renombrar.slice(0, 12).forEach(p => console.info(`  [${p.code}] ${p.actual}\n        → ${p.destino}${p.discrepancia ? '  (⚠ ' + p.discrepancia + ')' : ''}`));
console.info(`\nCSV completo: reports/plan_reorganizacion.csv`);

if (!APPLY) {
    console.info('\n→ DRY-RUN. No se renombro nada. Revisá el CSV y corré con --apply cuando esté OK.');
    process.exit(0);
}

// ─── APPLY: renombrar con log de rollback ────────────────────────────────────

const rollback = [];
let hechos = 0, saltados = 0;
for (const p of renombrar) {
    const desdeAbs = join(RUTA_BASE_AMFE, p.carpetaRel, p.actual);
    const haciaAbs = join(RUTA_BASE_AMFE, p.carpetaRel, p.destino);
    if (!existsSync(desdeAbs)) { console.warn(`SALTADO [${p.code}]: no existe ${desdeAbs}`); saltados++; continue; }
    if (existsSync(haciaAbs)) { console.warn(`SALTADO [${p.code}]: destino ya existe ${haciaAbs}`); saltados++; continue; }
    renameSync(desdeAbs, haciaAbs);
    rollback.push({ op: 'rename', from: haciaAbs, to: desdeAbs }); // invertido para deshacer
    hechos++;
}
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const logPath = `reports/reorganizacion_${ts}.json`;
writeFileSync(logPath, JSON.stringify({ fecha: new Date().toISOString(), hechos, saltados, rollback }, null, 2));
console.info(`\n✅ Renombrados: ${hechos} | saltados: ${saltados}. Log de rollback: ${logPath}`);
console.info('   Para deshacer: node scripts/_deshacerReorganizacion.mjs ' + logPath);
console.info('   Ahora regenerá el Listado y actualizá server_path en el registry.');
