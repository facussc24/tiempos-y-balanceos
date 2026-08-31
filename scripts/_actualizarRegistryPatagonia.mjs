/**
 * _actualizarRegistryPatagonia.mjs — pone el catalogo `amfe_registry` al dia con lo que
 * realmente hay, ANTES de regenerar el Listado Maestro del servidor.
 *
 * POR QUE ESTE ORDEN
 * `_generarListadoMaestro.mjs` reescribe la hoja "Listado AMFE" ENTERA desde el catalogo.
 * Todo lo que este solo en el Excel y no en el catalogo se pierde, y todo lo que el catalogo
 * tenga desactualizado pisa lo bueno. Al 31/08/2026 habia dos desfasajes:
 *
 *   1. El AMFE 172 (ductos) NO ESTA en el catalogo. Se agrego a mano al Excel el 24/08.
 *      Regenerar sin cargarlo primero lo BORRA del listado maestro de la empresa.
 *   2. El 161 y el 162 figuran "Borrador" con fecha 2026-03-14, y el 151/153/155 con fecha
 *      2025-03-25 — o sea, vencidos. Los tres apoyacabezas se revisaron el 18/08/2026 y el
 *      161/162 el 20/08/2026; esas son las fechas que llevan sus caratulas.
 *
 * De donde sale cada dato: la caratula del propio documento en Supabase (`header.rev` y
 * `header.date`) y las carpetas reales del maestro, relevadas en el servidor. Nada inferido.
 *
 * `amfe_registry` es metadata del indice, no toca `amfe_documents.data`, asi que no pasa por
 * runWithValidation (mismo criterio que `_importListadoMaestro.mjs`).
 *
 * Dry-run por defecto; --apply escribe.
 */
import { readFileSync } from 'fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { parseSafeArgs } from './_lib/dryRunGuard.mjs';

const { apply: APLICAR } = parseSafeArgs();

const BASE = 'AMFES DE PROCESO';

/** Alta: el 172, que existe como documento y como carpeta pero no esta en el catalogo. */
const ALTA = {
    amfe_code: '172',
    tipo: 'proceso',
    producto: 'INSONOS / DUCTOS DE CALEFACCION',
    part_number: 'MP8137 / MP8146 / MP8147 / MP8148 / MP8149 / MP8150 / MP8151',
    cliente: 'COZZUOL',
    proyecto: 'PATAGONIA',
    planta: '',
    estado: 'En revision',
    propietario: 'C.BAPTISTA',
    equipo: '',
    fecha_creacion: '2026-08-24',
    rev_actual: 'A',
    fecha_ultima_rev: '2026-08-24',
    proxima_revision: '2027-08-24',
    server_path: `${BASE}\\COZZUOL\\172 - INSONOS DUCTOS DE CALEFACCION\\AMFE 172 - INSONOS DUCTOS DE CALEFACCION - Rev.A.xlsx`,
    document_id: '6447d299-96fe-42fc-a1fe-cc4a45d3e720',
    historial: '[]',
    notas: 'Emitido el 24/08/2026. Legajo del cliente en PPAP CLIENTES\\COZZUOL\\00_VW427-1LA_K-PATAGONIA',
};

/** Correcciones: fecha de revision y estado que declara la caratula de cada documento. */
const CORRECCIONES = {
    '151': { estado: 'En revision', rev_actual: 'A', fecha_ultima_rev: '2026-08-18', proxima_revision: '2027-08-18' },
    '153': { estado: 'En revision', rev_actual: 'A', fecha_ultima_rev: '2026-08-18', proxima_revision: '2027-08-18' },
    '155': { estado: 'En revision', rev_actual: 'A', fecha_ultima_rev: '2026-08-18', proxima_revision: '2027-08-18' },
    '161': {
        estado: 'En revision', rev_actual: 'A', fecha_ultima_rev: '2026-08-20', proxima_revision: '2027-08-20',
        propietario: 'C.BAPTISTA', part_number: 'N 231',
        server_path: `${BASE}\\NOVAX\\PATAGONIA\\161 - ARMREST DOOR PANEL\\AMFE 161 - ARMREST DOOR PANEL - Rev.A.xlsx`,
    },
    // El part_number del 162 NO se toca: el catalogo tiene los numeros VW
    // (2GJ.868.087 / 2GJ.868.088) y la caratula del documento lista cuatro codigos Novax
    // (N 216 / N 256 / N 285 / N 315) contra dos en applicableParts. Esa contradiccion esta
    // abierta desde el 22/08 y la resuelve el equipo; pisar un dato real con otro dato en
    // duda no la cierra, solo pierde el primero.
    '162': {
        estado: 'En revision', rev_actual: 'A', fecha_ultima_rev: '2026-08-20', proxima_revision: '2027-08-20',
        propietario: 'C.BAPTISTA',
        server_path: `${BASE}\\NOVAX\\PATAGONIA\\162 - TOP ROLL\\AMFE 162 - TOP ROLL - Rev.A.xlsx`,
    },
};

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const auth = await sb.auth.signInWithPassword({
    email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (auth.error) { console.error('auth:', auth.error.message); process.exit(1); }

const { data: filas, error } = await sb.from('amfe_registry').select('*');
if (error) { console.error(error.message); process.exit(1); }
const porCodigo = new Map(filas.map(f => [String(f.amfe_code), f]));

let acciones = 0;

// ─── Alta del 172 ────────────────────────────────────────────────────────────
if (porCodigo.has(ALTA.amfe_code)) {
    console.log(`  El ${ALTA.amfe_code} ya esta en el catalogo — no se duplica.`);
} else {
    console.log(`\n  ALTA ${ALTA.amfe_code} — ${ALTA.producto}`);
    console.log(`     cliente ${ALTA.cliente} · proyecto ${ALTA.proyecto} · ${ALTA.estado} · rev ${ALTA.rev_actual} · ${ALTA.fecha_ultima_rev}`);
    console.log(`     ${ALTA.server_path}`);
    acciones++;
    if (APLICAR) {
        const { error: e } = await sb.from('amfe_registry').insert({
            id: randomUUID(), ...ALTA, created_by: 'script:_actualizarRegistryPatagonia', updated_by: 'script:_actualizarRegistryPatagonia',
        });
        if (e) { console.error(`  alta ${ALTA.amfe_code}: ${e.message}`); process.exit(1); }
    }
}

// ─── Correcciones ────────────────────────────────────────────────────────────
for (const [codigo, cambios] of Object.entries(CORRECCIONES)) {
    const fila = porCodigo.get(codigo);
    if (!fila) { console.error(`  ${codigo}: no esta en el catalogo — abortar, no lo doy de alta a ciegas`); process.exit(1); }
    const diff = Object.entries(cambios).filter(([k, v]) => String(fila[k] ?? '') !== String(v));
    if (!diff.length) { console.log(`  ${codigo}: ya esta al dia.`); continue; }
    console.log(`\n  ${codigo} — ${fila.producto}`);
    for (const [k, v] of diff) console.log(`     ${k}: ${JSON.stringify(fila[k])} -> ${JSON.stringify(v)}`);
    acciones++;
    if (APLICAR) {
        const { error: e } = await sb.from('amfe_registry')
            .update({ ...cambios, updated_by: 'script:_actualizarRegistryPatagonia', updated_at: new Date().toISOString() })
            .eq('id', fila.id);
        if (e) { console.error(`  ${codigo}: ${e.message}`); process.exit(1); }
    }
}

console.log(`\n${APLICAR ? 'Aplicadas' : 'Simuladas'} ${acciones} acciones.`);
if (!APLICAR && acciones) console.log('Si se ve bien, volve a correr con --apply.');
