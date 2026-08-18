/**
 * _verificarNumeracion.mjs — la numeracion del AMFE contra la del FLUJOGRAMA.
 *
 * POR QUE EXISTE
 * El 02/07/2026 L. Lattanzi freno la carga de Patagonia en BeOn con el mail
 * "Condiciones que rompen trazabilidad Flujograma - AMFE - Instruccion de trabajo".
 * Las dos primeras condiciones eran de numeracion. Este script es el chequeo que
 * hace que eso no se pueda volver a escapar sin que nos enteremos.
 *
 * REGLA QUE APLICA
 * La numeracion la manda el FLUJOGRAMA (orden APQP: flujograma -> AMFE -> Plan de
 * Control). Asi que el esperado sale del flujograma y el AMFE es el que se compara.
 * Las secuencias viven en `_lib/numeracionPatagonia.data.json`, cada una con su
 * fuente. Si un flujograma todavia no esta cerrado, su secuencia es `null` y el
 * script lo reporta como NO VERIFICABLE en vez de inventar un esperado.
 *
 * ES READ-ONLY. No escribe en Supabase ni en ningun lado.
 *
 * Uso:  node scripts/_verificarNumeracion.mjs
 *       node scripts/_verificarNumeracion.mjs --amfe AMFE-TR-PAT
 *
 * Sale con codigo 1 si algun AMFE verificable diverge, para poder encadenarlo.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { connectSupabase, parseData } from './_lib/amfeIo.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const CANON = JSON.parse(readFileSync(join(AQUI, '_lib', 'numeracionPatagonia.data.json'), 'utf8'));

const filtro = (() => {
    const i = process.argv.indexOf('--amfe');
    return i >= 0 ? process.argv[i + 1] : null;
})();

/**
 * Los numeros de operacion que el AMFE CUBRE — no solo los que numera.
 *
 * Criterio de Fak (18/08/2026, "opcion C"): el flujograma DESGLOSA lo que el AMFE AGRUPA,
 * y eso esta bien mientras el AMFE lo DECLARE. Una fila que dice `"OP 20-27 CORTE DE
 * VINILO"` cubre las ocho operaciones de corte del flujograma; una que dice
 * `"OP 30 / 32-34 COSTURA UNION"` cubre la 30 y las 32 a 34.
 *
 * Sin leer ese rango, el chequeo le exigiria al AMFE una fila por cada paso del flujograma
 * y la convencion de la casa quedaria marcada como error para siempre. Con el rango leido,
 * declararlo SIRVE: es la diferencia entre agrupar y desalinearse.
 */
const RANGO_RE = /\bOPS?\.?\s+([\d\s\-/,]+?)\s+[A-ZÁÉÍÓÚÑ]/i;

function cubiertosPorNombre(nombre) {
    const m = RANGO_RE.exec(String(nombre || ''));
    if (!m) return [];
    const out = [];
    for (const parte of m[1].split(/[/,]/)) {
        const rango = parte.trim().match(/^(\d+)\s*-\s*(\d+)$/);
        if (rango) {
            const [, a, b] = rango.map(Number);
            for (let n = a; n <= b; n++) out.push(String(n));
        } else if (/^\d+$/.test(parte.trim())) {
            out.push(parte.trim());
        }
    }
    return out;
}

function numerosDe(doc) {
    const out = [];
    for (const o of doc.operations || []) {
        const n = String(o.opNumber ?? o.operationNumber ?? '').trim();
        if (n) out.push(n);
        out.push(...cubiertosPorNombre(o.name ?? o.operationName));
    }
    return [...new Set(out)];
}

const sb = await connectSupabase();
const { data: rows, error } = await sb
    .from('amfe_documents').select('id, amfe_number, data, updated_at')
    .like('project_name', 'VWA/PATAGONIA%');
if (error) throw error;

const porNumero = new Map(rows.map(r => [r.amfe_number, r]));

let divergentes = 0, verificados = 0, pendientes = 0;
const pendienteDe = [];

for (const [clave, canon] of Object.entries(CANON.documentos)) {
    if (filtro && filtro !== clave) continue;

    const row = porNumero.get(clave);
    console.log(`\n─── ${canon.producto}  ·  AMFE ${canon.amfe || clave}  ·  flujograma ${canon.flujograma.id} rev ${canon.flujograma.revVigente}`);

    // Un AMFE cuenta UNA vez aunque tenga varios problemas: el total de abajo dice
    // cuantos DOCUMENTOS estan mal, no cuantos hallazgos hay.
    let esteDiverge = false;

    if (!row) {
        console.log('   ⚠️  no encontre este AMFE en Supabase. Reviso la clave del canon.');
        divergentes++;
        continue;
    }

    const enAmfe = numerosDe(parseData(row.data));

    // Duplicados: esto siempre se puede chequear, haya flujograma o no.
    const dup = enAmfe.filter((v, i) => enAmfe.indexOf(v) !== i);
    if (dup.length) {
        console.log(`   🔴 numeros de operacion DUPLICADOS en el AMFE: ${[...new Set(dup)].join(', ')}`);
        esteDiverge = true;
    }

    if (!canon.secuencia) {
        if (esteDiverge) divergentes++;
        pendientes++;
        pendienteDe.push(canon.producto);
        console.log(`   ⏳ NO VERIFICABLE: el flujograma ${canon.flujograma.id} todavia no esta cerrado.`);
        console.log(`      AMFE hoy: ${enAmfe.join(' · ')}`);
        if (canon.nota) console.log(`      nota: ${canon.nota}`);
        continue;
    }

    verificados++;
    const esperado = canon.secuencia.map(String);
    const faltan = esperado.filter(n => !enAmfe.includes(n));
    const sobran = enAmfe.filter(n => !esperado.includes(n));

    if (!faltan.length && !sobran.length && !dup.length) {
        console.log(`   ✅ cierra: ${enAmfe.length} operaciones, misma numeracion que el flujograma.`);
    } else {
        if (faltan.length) console.log(`   🔴 el flujograma las declara y el AMFE no las tiene: ${faltan.join(', ')}`);
        if (sobran.length) console.log(`   🔴 el AMFE las tiene y el flujograma no las declara: ${sobran.join(', ')}`);
        if (faltan.length || sobran.length) esteDiverge = true;
    }
    if (esteDiverge) divergentes++;
    if (canon.nota) console.log(`      nota: ${canon.nota}`);
}

console.log(`\n${'─'.repeat(78)}`);
console.log(`verificados: ${verificados}   ·   divergentes: ${divergentes}   ·   pendientes de flujograma: ${pendientes}`);
if (pendienteDe.length) console.log(`esperando flujograma cerrado: ${pendienteDe.join(', ')}`);
console.log(`fuente de los esperados: _lib/numeracionPatagonia.data.json (${CANON._fecha})`);

process.exit(divergentes ? 1 : 0);
