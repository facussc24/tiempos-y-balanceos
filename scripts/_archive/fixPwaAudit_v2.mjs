/**
 * Fix: PWA Audit 2026-04-06 v2 — Based on actual Supabase data
 * USO: node scripts/fixPwaAudit_v2.mjs [--apply] [--phase=N]
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';

const DRY_RUN = !process.argv.includes('--apply');
const PH = (() => { const a = process.argv.find(x => x.startsWith('--phase=')); return a ? parseInt(a.split('=')[1]) : 0; })();
if (DRY_RUN) console.log('DRY RUN — use --apply to save.\n');

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await sb.auth.signInWithPassword({ email: env.VITE_AUTO_LOGIN_EMAIL, password: env.VITE_AUTO_LOGIN_PASSWORD });
console.log('Auth OK\n');

function calcAP(s, o, d) {
    if (isNaN(s) || isNaN(o) || isNaN(d)) return '';
    s = Math.round(s); o = Math.round(o); d = Math.round(d);
    if (s < 1 || s > 10 || o < 1 || o > 10 || d < 1 || d > 10) return '';
    if (s <= 1) return 'L';
    if (s <= 3) return (o >= 8 && d >= 5) ? 'M' : 'L';
    if (s <= 6) { if (o >= 8) return d >= 5 ? 'H' : 'M'; if (o >= 6) return d >= 2 ? 'M' : 'L'; if (o >= 4) return d >= 7 ? 'M' : 'L'; return 'L'; }
    if (s <= 8) { if (o >= 8) return 'H'; if (o >= 6) return d >= 2 ? 'H' : 'M'; if (o >= 4) return d >= 7 ? 'H' : 'M'; if (o >= 2) return d >= 5 ? 'M' : 'L'; return 'L'; }
    if (o >= 6) return 'H'; if (o >= 4) return d >= 2 ? 'H' : 'M';
    if (o >= 2) { if (d >= 7) return 'H'; if (d >= 5) return 'M'; return 'L'; }
    return 'L';
}

function opN(s) { return parseInt(String(s).replace(/[^0-9]/g, '') || '999'); }

// Load
const { data: AA } = await sb.from('amfe_documents').select('id,project_name,part_number,data');
const { data: CC } = await sb.from('cp_documents').select('id,project_name,part_number,part_name,data');
const { data: HH } = await sb.from('ho_documents').select('id,part_number,part_description,linked_amfe_project,data');
const { data: PP } = await sb.from('pfd_documents').select('id,part_number,data');
for (const d of [...AA, ...CC, ...HH, ...PP]) if (typeof d.data === 'string') d.data = JSON.parse(d.data);

const aP = AA.find(d => (d.project_name || '').toLowerCase().includes('plana'));
const aT = AA.find(d => (d.project_name || '').toLowerCase().includes('termoformad'));
const cP = CC.find(d => (d.project_name || '').toLowerCase().includes('plana'));
const cT = CC.find(d => (d.project_name || '').toLowerCase().includes('termoformad'));
const hP = HH.find(d => (d.linked_amfe_project || '').toLowerCase().includes('plana'));
const hT = HH.find(d => (d.linked_amfe_project || '').toLowerCase().includes('termoformad'));
const pP = PP.find(d => (d.part_number || '') === '21-9463');
const pT = PP.find(d => (d.part_number || '').includes('TBD-TT'));

for (const [k, v] of Object.entries({ aP, aT, cP, cT, hP, hT, pP, pT })) console.log(`${k}: ${v ? 'OK' : 'MISS'}`);
if (!aP || !aT) { console.error('Missing AMFE'); process.exit(1); }

const S = { p1: 0, p2: 0, p4: 0, p5: 0, p6: 0, p7: 0 };

// P1: Flamabilidad CC Termo
if (!PH || PH === 1) {
    console.log('\n=== P1: Flamab CC Termo ===');
    for (const op of (aT.data.operations || []))
        for (const we of (op.workElements || []))
            for (const fn of (we.functions || []))
                for (const f of (fn.failures || [])) {
                    const d = (f.description || '').toLowerCase();
                    if (!d.includes('flamab') && !d.includes('combusti')) continue;
                    if (f.severity !== 10) { console.log(`  ${op.opNumber}: S "${f.severity}" -> 10`); f.severity = 10; S.p1++; }
                    for (const c of (f.causes || [])) {
                        if (c.specialChar !== 'CC') { console.log(`    CC set`); c.specialChar = 'CC'; S.p1++; }
                        const o = Number(c.occurrence), det = Number(c.detection);
                        if (o && det) { const ap = calcAP(10, o, det); if (c.ap !== ap) c.ap = ap; }
                    }
                }
    if (cT) for (const it of (cT.data.items || [])) {
        const ch = (it.characteristic || it.productCharacteristic || '').toLowerCase();
        if ((ch.includes('flamab') || ch.includes('combusti')) && it.classification !== 'CC') {
            console.log(`  CP: "${it.characteristic}" -> CC`); it.classification = 'CC'; S.p1++;
        }
    }
    console.log(`  -> ${S.p1} changes`);
}

// P2: Flamab CC Planas
if (!PH || PH === 2) {
    console.log('\n=== P2: Flamab CC Planas ===');
    let found = false;
    for (const op of (aP.data.operations || []))
        for (const we of (op.workElements || []))
            for (const fn of (we.functions || []))
                for (const f of (fn.failures || [])) {
                    const d = (f.description || '').toLowerCase();
                    if (!d.includes('flamab') && !d.includes('combusti')) continue;
                    found = true;
                    if (f.severity !== 10) { f.severity = 10; S.p2++; console.log(`  ${op.opNumber}: S -> 10`); }
                    for (const c of (f.causes || [])) if (c.specialChar !== 'CC') { c.specialChar = 'CC'; S.p2++; console.log(`    CC set`); }
                }
    if (!found) console.log('  !! No flamab FM in Planas AMFE. Fak: agregar?');
    if (cP) for (const it of (cP.data.items || [])) {
        const ch = (it.characteristic || it.productCharacteristic || '').toLowerCase();
        if ((ch.includes('flamab') || ch.includes('combusti')) && it.classification !== 'CC') {
            console.log(`  CP: -> CC`); it.classification = 'CC'; S.p2++;
        }
    }
    console.log(`  -> ${S.p2} changes`);
}

// P3: Status check
if (!PH || PH === 3) {
    console.log('\n=== P3: Planas AMFE status ===');
    for (const op of (aP.data.operations || [])) {
        const fc = (op.workElements || []).reduce((a, w) => a + (w.functions || []).reduce((b, f) => b + (f.failures || []).length, 0), 0);
        console.log(`  ${op.opNumber} "${op.name}" WE="${op.workElements?.[0]?.name?.substring(0, 40) || '-'}" ${fc}FM`);
    }
    console.log('  OK - no changes needed');
}

// P4: Names
if (!PH || PH === 4) {
    console.log('\n=== P4: Names ===');
    function std(n) {
        if (!n) return n; const l = n.toLowerCase().trim();
        if (/^recepci[oó]n/.test(l) && !l.includes('punzonado') && !l.includes('bi-comp')) return 'RECEPCION DE MATERIA PRIMA';
        if (l.includes('control final')) return 'CONTROL FINAL DE CALIDAD';
        if (/^embalaje/.test(l)) return 'EMBALAJE';
        return n;
    }
    for (const [lb, am] of [['P', aP], ['T', aT]])
        for (const op of (am.data.operations || [])) {
            const n = std(op.name); if (n !== op.name) { console.log(`  AMFE${lb} ${op.opNumber}: "${op.name}"->"${n}"`); op.name = n; S.p4++; }
        }
    for (const [lb, cp] of [['P', cP], ['T', cT]]) {
        if (!cp) continue;
        for (const it of (cp.data.items || [])) {
            const n = std(it.processStepName); if (n && n !== it.processStepName) { console.log(`  CP${lb} ${it.processStepNumber}: ->"${n}"`); it.processStepName = n; S.p4++; }
        }
    }
    for (const [lb, ho] of [['P', hP], ['T', hT]]) {
        if (!ho) continue;
        for (const sh of (ho.data.sheets || [])) {
            const n = std(sh.operationName); if (n && n !== sh.operationName) { console.log(`  HO${lb} ${sh.operationNumber}: ->"${n}"`); sh.operationName = n; S.p4++; }
        }
    }
    for (const [lb, pf] of [['P', pP], ['T', pT]]) {
        if (!pf) continue;
        for (const st of (pf.data.steps || [])) {
            const n = std(st.name); if (n && n !== st.name) { console.log(`  PFD${lb} ${st.stepNumber}: ->"${n}"`); st.name = n; S.p4++; }
        }
    }
    console.log(`  -> ${S.p4} fixes`);
}

// P5: Missing ops Termo
if (!PH || PH === 5) {
    console.log('\n=== P5: Missing ops Termo ===');
    const ex = new Set((aT.data.operations || []).map(o => o.opNumber));
    const ms = [
        { op: 'OP 11', nm: 'RETRABAJO DE PIEZA (APLIX)', we: 'Operador de retrabajo', fn: 'Retrabajar pieza con aplix defectuoso' },
        { op: 'OP 61', nm: 'RETRABAJO SOLDADURA', we: 'Operador de retrabajo', fn: 'Retrabajar pieza con soldadura defectuosa' },
    ];
    for (const m of ms) {
        if (ex.has(m.op)) { console.log(`  ${m.op} exists`); continue; }
        aT.data.operations.push({
            id: randomUUID(), opNumber: m.op, name: m.nm, focusElementFunction: '', operationFunction: '',
            workElements: [{
                id: randomUUID(), type: 'Man', name: m.we, functions: [{
                    id: randomUUID(), description: m.fn, requirements: '',
                    failures: [{
                        id: randomUUID(), description: 'TBD — Pendiente definicion con equipo APQP',
                        effectLocal: 'TBD', effectNextLevel: 'TBD', effectEndUser: 'TBD', severity: '',
                        causes: [{
                            id: randomUUID(), cause: 'TBD', preventionControl: '', detectionControl: '',
                            occurrence: '', detection: '', ap: '', characteristicNumber: '', specialChar: '', filterCode: '',
                            preventionAction: '', detectionAction: '', responsible: '', targetDate: '', status: '',
                            actionTaken: '', completionDate: '', severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '', observations: '',
                        }],
                    }],
                }],
            }],
        });
        S.p5++; console.log(`  + ${m.op}: ${m.nm}`);
    }
    aT.data.operations.sort((a, b) => opN(a.opNumber) - opN(b.opNumber));
    console.log(`  -> ${S.p5} added`);
}

// P6: EPP
if (!PH || PH === 6) {
    console.log('\n=== P6: EPP ===');
    const E = {
        recepcion: ['zapatos de seguridad', 'guantes'], preparacion: ['anteojos', 'guantes'],
        corte: ['guantes anticorte', 'anteojos'], costura: ['proteccion auditiva', 'anteojos'],
        colocado: ['anteojos', 'guantes'], pegado: ['anteojos', 'guantes'],
        troquelado: ['guantes anticorte', 'anteojos'], termoformado: ['guantes termicos', 'anteojos'],
        soldadura: ['anteojos', 'guantes'], control: ['anteojos'], embalaje: ['zapatos de seguridad', 'guantes'],
        retrabajo: ['anteojos', 'guantes'], aplicacion: ['anteojos', 'guantes'], mylar: ['anteojos'],
    };
    function gE(n) { const l = (n || '').toLowerCase(); for (const [k, v] of Object.entries(E)) if (l.includes(k)) return v; return ['anteojos']; }
    for (const [lb, ho] of [['P', hP], ['T', hT]]) {
        if (!ho) { console.log(`  ${lb}: no HO`); continue; }
        for (const sh of (ho.data.sheets || [])) {
            if ((sh.ppe || []).length > 0) continue;
            sh.ppe = gE(sh.operationName);
            S.p6++;
            console.log(`  + ${lb} ${sh.operationNumber} "${sh.operationName}": ${sh.ppe.join(', ')}`);
        }
    }
    console.log(`  -> ${S.p6} sheets`);
}

// P7: QC items
if (!PH || PH === 7) {
    console.log('\n=== P7: QC items Planas ===');
    if (!hP || !cP) { console.log('  skip'); }
    else {
        const cI = cP.data.items || [];
        const LAB = ['laboratorio', 'metrolog', 'audit'];
        for (const sh of (hP.data.sheets || [])) {
            const ids = new Set((sh.qcItems || []).map(q => q.cpItemId));
            const m = cI.filter(c => c.processStepNumber === sh.operationNumber && !ids.has(c.id)
                && !LAB.some(k => (c.reactionPlanOwner || '').toLowerCase().includes(k)));
            if (!m.length) continue;
            sh.qcItems = sh.qcItems || [];
            for (const c of m) {
                sh.qcItems.push({
                    id: randomUUID(), cpItemId: c.id,
                    characteristic: c.characteristic || c.productCharacteristic || c.processCharacteristic || 'TBD',
                    controlMethod: c.evaluationTechnique || c.controlMethod || 'TBD',
                    frequency: c.sampleFrequency || 'TBD', responsible: c.reactionPlanOwner || 'Operador de produccion',
                    specification: c.specification || 'TBD', reactionPlan: c.reactionPlan || 'Segregar pieza s/ P-09/I',
                });
                S.p7++; console.log(`  + ${sh.operationNumber}: "${c.characteristic || c.productCharacteristic || 'TBD'}"`);
            }
        }
    }
    console.log(`  -> ${S.p7} linked`);
}

// SAVE
const tot = Object.values(S).reduce((a, b) => a + b, 0);
console.log(`\n=== TOTAL: ${tot} changes ===`);
if (DRY_RUN) { console.log('DRY RUN. Use --apply.'); }
else if (tot === 0) { console.log('Nothing to save.'); }
else {
    console.log('Saving...');
    let ok = 0;
    for (const [t, d, l] of [
        ['amfe_documents', aP, 'AMFE-P'], ['amfe_documents', aT, 'AMFE-T'],
        ['cp_documents', cP, 'CP-P'], ['cp_documents', cT, 'CP-T'],
        ['ho_documents', hP, 'HO-P'], ['ho_documents', hT, 'HO-T'],
        ['pfd_documents', pP, 'PFD-P'], ['pfd_documents', pT, 'PFD-T'],
    ]) {
        if (!d) continue;
        const { error } = await sb.from(t).update({ data: d.data }).eq('id', d.id);
        if (error) console.error(`  X ${l}: ${error.message}`); else { console.log(`  OK ${l}`); ok++; }
    }
    console.log(`${ok} saved.`);
}

console.log('\nPENDIENTES FAK:');
console.log('A. Part number Planas: 21-8909/21-9463/21-6567');
console.log('B. Cantidades: agujeros 40vs17, aplix 35vs9, pzs/medio 50vs25');
console.log('C. Temp horno Termo: 100/150/200C');
console.log('D. Planas OP 15 y clips/dots vigentes?');
console.log('E. Gramajes Termo actuales');
console.log('F. Norma flamabilidad PWA (NO TL 1010)');
console.log('G. Planas no tiene FM flamabilidad — agregar?');
process.exit(0);
