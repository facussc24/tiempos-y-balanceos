/**
 * _construirArbolAmfe.mjs — Construye el arbol de AMFEs NUEVO al lado del viejo (por COPIA).
 *
 * NO destructivo: copia cada AMFE vigente + sus OBSOLETOs a una estructura limpia
 *   AMFES DE PROCESO_NUEVO\<CLIENTE>\<PROYECTO>\<nro> - <PRODUCTO>\
 *       AMFE <nro> - <producto> - Rev.<LETRA>.xlsx     (vigente, nombre canonico)
 *       OBSOLETO\ ...revisiones viejas (nombre original)...
 * El arbol viejo queda intacto. El reemplazo final es un paso aparte, con OK de Fak.
 *
 * CLIENTE/PROYECTO se derivan de la ruta actual (server_path), que ya encodea la
 * jerarquia cliente\proyecto\producto. Rev del nombre migra a letras (decision Fak).
 *
 * Uso:
 *   node scripts/_construirArbolAmfe.mjs --dump reports/registry_reorg_dump.json          (dry-run + CSV)
 *   node scripts/_construirArbolAmfe.mjs --dump reports/registry_reorg_dump.json --apply   (copia de verdad)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { RUTA_BASE_AMFE, CARPETA_OBSOLETO } from './_lib/serverPaths.mjs';

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const dumpIdx = argv.indexOf('--dump');
const DUMP = dumpIdx >= 0 ? argv[dumpIdx + 1] : null;
if (!DUMP || !existsSync(DUMP)) { console.error('Falta --dump <registry.json>'); process.exit(1); }

const DEST_ROOT = join(RUTA_BASE_AMFE, 'AMFES DE PROCESO_NUEVO');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const ascii = (s) => sinAcentos(s).replace(/[^a-zA-Z0-9 _().-]/g, '').replace(/\s+/g, ' ').trim();

function revDeArchivo(nombre) {
    let m = nombre.match(/\bREV(?:ISION)?[\s._-]*0*(\d{1,2})\b/i);
    if (m) return String(Number(m[1]));
    m = nombre.match(/\bREV[\s._-]*\.?\s*([A-Z])(?![A-Za-z])/i);
    if (m) return m[1].toUpperCase();
    m = nombre.match(/REV([A-Z])\b/i);
    if (m) return m[1].toUpperCase();
    return '';
}

/** Migra la rev a letra: archivo-letra → esa; archivo-numero/vacio → letra del registro. */
function revLetra(revArchivo, revRegistro) {
    if (/^[A-Z]$/i.test(revArchivo)) return revArchivo.toUpperCase();
    return String(revRegistro || '').toUpperCase();
}

/**
 * Deriva { cliente, proyecto } de la ruta actual.
 * server_path = "AMFES DE PROCESO\<CLIENTE>\<...middle...>\<file>".
 *  - >=2 segmentos middle → proyecto = primero (el resto colapsa en la carpeta numerada).
 *  - 1 segmento middle    → sin proyecto (ese middle es la carpeta de producto).
 */
function derivarClienteProyecto(serverPath) {
    const segs = serverPath.split('\\');
    const cliente = segs[1] || 'SIN_CLIENTE';
    const middle = segs.slice(2, -1); // entre cliente y archivo
    const proyecto = middle.length >= 2 ? middle[0] : '';
    return { cliente, proyecto };
}

/** Lista recursiva de archivos bajo una carpeta OBSOLETO (si existe). */
function listarObsoletos(carpetaProducto) {
    const obsDir = join(carpetaProducto, CARPETA_OBSOLETO);
    const out = [];
    const walk = (dir) => {
        if (!existsSync(dir)) return;
        for (const e of readdirSync(dir)) {
            const full = join(dir, e);
            if (statSync(full).isDirectory()) walk(full);
            else if (!e.startsWith('~$') && !e.toLowerCase().endsWith('.lnk')) out.push(full);
        }
    };
    walk(obsDir);
    return out;
}

const CSV_ESC = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

// ─── Plan ────────────────────────────────────────────────────────────────────

const registry = JSON.parse(readFileSync(DUMP, 'utf8'));
const plan = [];
for (const r of registry) {
    const sp = r.server_path || '';
    if (!sp) continue;
    const { cliente, proyecto } = derivarClienteProyecto(sp);
    const rev = revLetra(revDeArchivo(basename(sp)), r.rev_actual);
    const prod = ascii(r.producto).slice(0, 50).trim() || `AMFE ${r.amfe_code}`;
    const carpetaAmfe = `${r.amfe_code} - ${prod}`;
    const relDestDir = [cliente, proyecto, carpetaAmfe].filter(Boolean).join('\\');
    const nombreCanonico = `AMFE ${r.amfe_code} - ${prod}${rev ? ` - Rev.${rev}` : ''}.xlsx`;

    const srcVigenteAbs = join(RUTA_BASE_AMFE, sp);
    const srcProductoDir = dirname(srcVigenteAbs);
    const obsoletos = listarObsoletos(srcProductoDir);

    plan.push({
        code: r.amfe_code, cliente, proyecto, carpetaAmfe,
        relDestDir, nombreCanonico,
        srcVigenteAbs, existeVigente: existsSync(srcVigenteAbs),
        obsoletos, cargado: !!r.document_id,
    });
}

// ─── Salidas ─────────────────────────────────────────────────────────────────

mkdirSync('reports', { recursive: true });
const csv = ['amfe_code,cliente,proyecto,carpeta_amfe,archivo_nuevo,obsoletos,existe_vigente'];
for (const p of plan) {
    csv.push([p.code, p.cliente, p.proyecto, p.carpetaAmfe, p.nombreCanonico, p.obsoletos.length, p.existeVigente].map(CSV_ESC).join(','));
}
writeFileSync('reports/plan_arbol_nuevo.csv', csv.join('\n'));

console.info('═══ ARBOL NUEVO DE AMFEs (por copia) ═══');
console.info(`Destino: ${DEST_ROOT}`);
console.info(`AMFEs a copiar: ${plan.length} | vigentes que existen: ${plan.filter(p => p.existeVigente).length}`);
console.info(`Total obsoletos a copiar: ${plan.reduce((a, p) => a + p.obsoletos.length, 0)}`);
console.info(`Faltan en disco (revisar): ${plan.filter(p => !p.existeVigente).map(p => p.code).join(', ') || 'ninguno'}`);
console.info('\nEjemplos de estructura nueva:');
plan.slice(0, 14).forEach(p => console.info(`  ${p.relDestDir}\\\n     ${p.nombreCanonico}  (+${p.obsoletos.length} obsoletos)`));
console.info(`\nCSV: reports/plan_arbol_nuevo.csv`);

if (!APPLY) {
    console.info('\n→ DRY-RUN. No se copió nada. Corré con --apply para construir el árbol nuevo (no toca el viejo).');
    process.exit(0);
}

// ─── APPLY: copiar ───────────────────────────────────────────────────────────

let vigentes = 0, obs = 0, saltados = 0;
for (const p of plan) {
    const destDir = join(DEST_ROOT, p.relDestDir);
    mkdirSync(destDir, { recursive: true });
    if (p.existeVigente) {
        copyFileSync(p.srcVigenteAbs, join(destDir, p.nombreCanonico));
        vigentes++;
    } else { console.warn(`SIN VIGENTE [${p.code}]: ${p.srcVigenteAbs}`); saltados++; }
    if (p.obsoletos.length) {
        const obsDir = join(destDir, CARPETA_OBSOLETO);
        mkdirSync(obsDir, { recursive: true });
        for (const o of p.obsoletos) { copyFileSync(o, join(obsDir, basename(o))); obs++; }
    }
}
console.info(`\n✅ Copiados: ${vigentes} vigentes + ${obs} obsoletos | sin vigente: ${saltados}.`);
console.info('   El árbol viejo quedó intacto. Revisá AMFES DE PROCESO_NUEVO y avisá para el reemplazo final.');
