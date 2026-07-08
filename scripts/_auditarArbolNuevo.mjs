/**
 * _auditarArbolNuevo.mjs — Auditoria determinística del arbol nuevo antes del swap.
 *
 * Verifica integridad total antes de poner el arbol nuevo en produccion:
 *  1. Completeness: cada AMFE vigente del registro existe en el arbol nuevo (ruta esperada).
 *  2. Legacy integrity: los NO regenerados son byte-identicos al origen (md5).
 *  3. Regenerados: abren, tienen hojas [Caratula, AMFE], Caratula con el N° de AMFE.
 *  4. Obsoletos: la cuenta por AMFE coincide con el OBSOLETO de origen.
 *  5. Arbol viejo intacto: mismo conteo que el backup.
 *  6. Sin carpetas AMFE vacias ni vigentes duplicados.
 *
 * Solo lectura. Uso: node scripts/_auditarArbolNuevo.mjs --dump reports/registry_reorg_dump.json
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import XLSX from 'xlsx-js-style';
import { RUTA_BASE_AMFE, CARPETA_OBSOLETO } from './_lib/serverPaths.mjs';

const dumpIdx = process.argv.indexOf('--dump');
const DUMP = dumpIdx >= 0 ? process.argv[dumpIdx + 1] : null;
if (!DUMP || !existsSync(DUMP)) { console.error('Falta --dump'); process.exit(1); }

const NUEVO = join(RUTA_BASE_AMFE, 'AMFES DE PROCESO_NUEVO');
const VIEJO = join(RUTA_BASE_AMFE, 'AMFES DE PROCESO');
// El backup es una copia del arbol "13. ..." completo; comparo la MISMA subcarpeta.
const BACKUP = 'Y:\\Ingenieria\\Documentacion Gestion Ingenieria\\_BACKUP_AMFE_2026-07-08\\AMFES DE PROCESO';
// Codigos regenerados con caratula (no byte-identicos al origen):
const REGENERADOS = new Set(['128','129','149','150','151','153','155','157','158','159','160','161','162','163']);

const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const ascii = (s) => sinAcentos(s).replace(/[^a-zA-Z0-9 _().-]/g, '').replace(/\s+/g, ' ').trim();
function revDeArchivo(n) {
    let m = n.match(/\bREV(?:ISION)?[\s._-]*0*(\d{1,2})\b/i); if (m) return String(Number(m[1]));
    m = n.match(/\bREV[\s._-]*\.?\s*([A-Z])(?![A-Za-z])/i); if (m) return m[1].toUpperCase();
    m = n.match(/REV([A-Z])\b/i); if (m) return m[1].toUpperCase(); return '';
}
const revLetra = (ra, rr) => /^[A-Z]$/i.test(ra) ? ra.toUpperCase() : String(rr || '').toUpperCase();
function derivar(sp) { const s = sp.split('\\'); const mid = s.slice(2, -1); return { cliente: s[1], proyecto: mid.length >= 2 ? mid[0] : '' }; }
const md5 = (p) => createHash('md5').update(readFileSync(p)).digest('hex');
function contarArchivos(dir) { let n = 0; const w = (d) => { if (!existsSync(d)) return; for (const e of readdirSync(d)) { const f = join(d, e); if (statSync(f).isDirectory()) w(f); else if (!e.startsWith('~$')) n++; } }; w(dir); return n; }
function listarObsoletos(carpetaProducto) {
    const out = []; const w = (d) => { if (!existsSync(d)) return; for (const e of readdirSync(d)) { const f = join(d, e); if (statSync(f).isDirectory()) w(f); else if (!e.startsWith('~$') && !e.toLowerCase().endsWith('.lnk')) out.push(f); } };
    w(join(carpetaProducto, CARPETA_OBSOLETO)); return out;
}

const registry = JSON.parse(readFileSync(DUMP, 'utf8'));
const problemas = [];
let okVigentes = 0, okLegacy = 0, okRegen = 0, okObs = 0;

for (const r of registry) {
    const sp = r.server_path || ''; if (!sp) continue;
    const { cliente, proyecto } = derivar(sp);
    const rev = revLetra(revDeArchivo(basename(sp)), r.rev_actual);
    const prod = ascii(r.producto).slice(0, 50).trim() || `AMFE ${r.amfe_code}`;
    const relDir = [cliente, proyecto, `${r.amfe_code} - ${prod}`].filter(Boolean).join('\\');
    const nombre = `AMFE ${r.amfe_code} - ${prod}${rev ? ` - Rev.${rev}` : ''}.xlsx`;
    const destAbs = join(NUEVO, relDir, nombre);
    const srcAbs = join(RUTA_BASE_AMFE, sp);

    // 1. Completeness
    if (!existsSync(destAbs)) { problemas.push(`[${r.amfe_code}] FALTA vigente en nuevo: ${relDir}\\${nombre}`); continue; }
    okVigentes++;

    // 2/3. Integridad
    if (REGENERADOS.has(String(r.amfe_code))) {
        try {
            const wb = XLSX.readFile(destAbs);
            if (!wb.SheetNames.includes('Caratula') || !wb.SheetNames.includes('AMFE'))
                problemas.push(`[${r.amfe_code}] regenerado SIN hojas Caratula/AMFE: ${wb.SheetNames.join(',')}`);
            else {
                const car = XLSX.utils.sheet_to_json(wb.Sheets['Caratula'], { header: 1, defval: '' }).flat().join(' ');
                if (!car.includes(String(r.amfe_code))) problemas.push(`[${r.amfe_code}] Caratula no menciona el N° de AMFE`);
                else okRegen++;
            }
        } catch (e) { problemas.push(`[${r.amfe_code}] regenerado no abre: ${e.message}`); }
    } else {
        if (!existsSync(srcAbs)) problemas.push(`[${r.amfe_code}] no existe el origen para verificar hash: ${srcAbs}`);
        else if (md5(srcAbs) !== md5(destAbs)) problemas.push(`[${r.amfe_code}] legacy NO byte-identico al origen`);
        else okLegacy++;
    }

    // 4. Obsoletos
    const srcObs = listarObsoletos(dirname(srcAbs)).length;
    const dstObs = listarObsoletos(join(NUEVO, relDir)).length;
    if (srcObs !== dstObs) problemas.push(`[${r.amfe_code}] obsoletos difieren: origen ${srcObs} vs nuevo ${dstObs}`);
    else okObs++;
}

// 6. Sin vigentes duplicados / carpetas vacias (una carpeta AMFE = 1 archivo en su raiz)
const walkAmfeDirs = (dir, depth = 0) => {
    for (const e of readdirSync(dir)) {
        const f = join(dir, e); if (!statSync(f).isDirectory()) continue;
        if (/^\d+ - |^AMFE-/.test(e)) {
            const rootFiles = readdirSync(f).filter(x => !statSync(join(f, x)).isDirectory() && !x.startsWith('~$'));
            if (rootFiles.length === 0) problemas.push(`Carpeta AMFE vacia: ${e}`);
            if (rootFiles.length > 1) problemas.push(`Carpeta AMFE con ${rootFiles.length} vigentes (duplicado?): ${e} -> ${rootFiles.join(' | ')}`);
        } else if (depth < 3) walkAmfeDirs(f, depth + 1);
    }
};
walkAmfeDirs(NUEVO);

// 5. Arbol viejo intacto vs backup
const nViejo = contarArchivos(VIEJO), nBackup = contarArchivos(BACKUP);

console.info('═══ AUDITORIA DEL ARBOL NUEVO ═══');
console.info(`1. Vigentes presentes: ${okVigentes}/${registry.filter(r => r.server_path).length}`);
console.info(`2. Legacy byte-identicos: ${okLegacy}`);
console.info(`3. Regenerados validos (Caratula+AMFE+N°): ${okRegen}/${REGENERADOS.size}`);
console.info(`4. Obsoletos coincidentes: ${okObs}`);
console.info(`5. Arbol viejo: ${nViejo} archivos | backup: ${nBackup} archivos ${nViejo === nBackup ? '(OK, intacto)' : '(⚠ DIFIEREN)'}`);
console.info('');
if (problemas.length === 0) {
    console.info('✅ AUDITORIA LIMPIA — 0 problemas. El arbol nuevo es integro y esta listo para el swap.');
    process.exit(0);
} else {
    console.info(`❌ ${problemas.length} PROBLEMA(S) — NO hacer el swap hasta resolverlos:`);
    problemas.forEach(p => console.info('  ' + p));
    process.exit(1);
}
