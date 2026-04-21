/**
 * READ-ONLY inspector: AMFE TOP_ROLL OP 20
 *
 * Lista todos los WEs de OP 20 y reporta el WE "Iluminacion/Ruido" (Environment)
 * con su estructura completa (functions + failures + causes).
 *
 * Ademas busca en OTROS AMFEs un WE similar "Iluminacion" tipo Environment con
 * contenido cargado para usar como fuente de enriquecimiento.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
    envText.split('\n')
        .filter(l => l.includes('=') && !l.startsWith('#'))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({
    email: env.VITE_AUTO_LOGIN_EMAIL,
    password: env.VITE_AUTO_LOGIN_PASSWORD
});

const TOP_ROLL_ID = '78eaa89b-ad0b-4342-9046-ab2e9b14d3b3';

// --- 1) TOP_ROLL OP 20 ---
const { data: tr, error: trErr } = await sb
    .from('amfe_documents')
    .select('id, project_name, amfe_number, data')
    .eq('id', TOP_ROLL_ID)
    .single();

if (trErr || !tr) {
    console.error('Failed to fetch TOP_ROLL:', trErr?.message);
    process.exit(1);
}

const trData = typeof tr.data === 'string' ? JSON.parse(tr.data) : tr.data;
const op20 = (trData.operations || []).find(o => String(o.opNumber ?? o.operationNumber) === '20');

console.log('='.repeat(70));
console.log(`TOP_ROLL: ${tr.project_name} | ${tr.amfe_number}`);
console.log('='.repeat(70));

if (!op20) {
    console.log('OP 20 no encontrada');
    process.exit(0);
}

console.log(`\nOP 20: ${op20.name || op20.operationName}`);
console.log(`Total WEs: ${(op20.workElements || []).length}\n`);

for (const we of (op20.workElements || [])) {
    const fns = Array.isArray(we.functions) ? we.functions : [];
    let totalFailures = 0;
    for (const fn of fns) totalFailures += (fn.failures || []).length;
    console.log(`  [${we.type || '?'}] ${we.name || '(sin nombre)'} — fns:${fns.length} failures:${totalFailures}`);
}

// --- Target WE: Iluminacion / Environment ---
const targetWE = (op20.workElements || []).find(we => {
    const n = (we.name || '').toLowerCase();
    return we.type === 'Environment' && (n.includes('ilumin') || n.includes('ruido') || n.includes('19587'));
});

console.log('\n' + '-'.repeat(70));
console.log('WE TARGET (Iluminacion/Ruido Environment):');
console.log('-'.repeat(70));
if (!targetWE) {
    console.log('NO ENCONTRADO en OP 20');
} else {
    console.log(JSON.stringify(targetWE, null, 2));
}

// --- 2) Buscar hermanos con contenido ---
console.log('\n' + '='.repeat(70));
console.log('BUSQUEDA EN OTROS AMFEs: WE Environment Iluminacion/Ruido con contenido');
console.log('='.repeat(70));

const { data: allAmfes, error: allErr } = await sb
    .from('amfe_documents')
    .select('id, project_name, amfe_number, data')
    .neq('id', TOP_ROLL_ID);

if (allErr) {
    console.error('Failed to fetch others:', allErr.message);
    process.exit(1);
}

const candidates = [];

for (const row of allAmfes || []) {
    let data;
    try {
        data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    } catch { continue; }
    if (!data?.operations) continue;

    for (const op of data.operations) {
        const opNum = String(op.opNumber ?? op.operationNumber ?? '');
        const opName = op.name || op.operationName || '';
        for (const we of (op.workElements || [])) {
            const n = (we.name || '').toLowerCase();
            const matchesName = n.includes('ilumin') || n.includes('ruido') || n.includes('19587');
            const isEnv = we.type === 'Environment';
            if (!isEnv || !matchesName) continue;

            const fns = Array.isArray(we.functions) ? we.functions : [];
            let totalFailures = 0, totalCauses = 0;
            for (const fn of fns) {
                for (const f of (fn.failures || [])) {
                    totalFailures += 1;
                    totalCauses += (f.causes || []).length;
                }
            }

            candidates.push({
                amfeId: row.id,
                project: row.project_name,
                amfeNumber: row.amfe_number,
                opNum,
                opName,
                weName: we.name,
                fns: fns.length,
                failures: totalFailures,
                causes: totalCauses,
                weFull: we,
            });
        }
    }
}

console.log(`\nCandidatos encontrados: ${candidates.length}\n`);
for (const c of candidates) {
    console.log(`  ${c.project} (${c.amfeNumber}) | OP${c.opNum} ${c.opName}`);
    console.log(`    WE: "${c.weName}" — fns:${c.fns} failures:${c.failures} causes:${c.causes}`);
}

// Imprimir detalle del mejor candidato (mas causes)
const sorted = [...candidates].sort((a, b) => b.causes - a.causes || b.failures - a.failures);
const best = sorted[0];
if (best && best.causes > 0) {
    console.log('\n' + '-'.repeat(70));
    console.log(`MEJOR CANDIDATO: ${best.project} OP${best.opNum} — ${best.weName}`);
    console.log('-'.repeat(70));
    console.log(JSON.stringify(best.weFull, null, 2));
} else {
    console.log('\nNinguno tiene contenido completo (todos vacios o sin causas).');
}

// Tambien imprimir cualquier candidato de Inyeccion plastica aunque vacio, para contexto
console.log('\n' + '-'.repeat(70));
console.log('CONTEXTO: todos los AMFEs en familias de inyeccion plastica con WE Environment Iluminacion:');
console.log('-'.repeat(70));
const injectionKeywords = ['insert', 'armrest', 'top_roll', 'top roll', 'ip pad', 'ippad', 'maestro', 'inyec'];
for (const c of candidates) {
    const p = (c.project || '').toLowerCase();
    if (injectionKeywords.some(k => p.includes(k))) {
        console.log(`\n  ${c.project} (${c.amfeNumber}) OP${c.opNum}:`);
        console.log(JSON.stringify(c.weFull, null, 2));
    }
}

process.exit(0);
