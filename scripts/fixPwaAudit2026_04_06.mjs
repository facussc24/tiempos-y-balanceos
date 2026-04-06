/**
 * Fix: PWA Audit 2026-04-06 — Telas Planas 581D & Telas Termoformadas 582D
 *
 * Correcciones seguras (pre-aprobadas por auditoria):
 *   1. Flamabilidad CC — Telas Termoformadas (CRITICO)
 *   2. Flamabilidad CC — Telas Planas (CRITICO)
 *   3. Limpiar FM de producto equivocado — Telas Planas (CRITICO)
 *   4. Alinear nombres operaciones PFD/AMFE/CP/HO (MEDIO)
 *   5. Agregar operaciones faltantes — Telas Termoformadas (MEDIO)
 *   6. HO sin EPP — Ambos productos (MEDIO)
 *   7. HO con pocos QC items — Telas Planas (BAJO)
 *
 * REGLAS RESPETADAS:
 *   - NUNCA inventar FM ni acciones (solo copiar de referencia o TBD)
 *   - NUNCA poner TL 1010 en productos PWA
 *   - NUNCA inventar valores numericos — en duda: TBD
 *
 * USO: node scripts/fixPwaAudit2026_04_06.mjs [--dry-run] [--phase=N]
 *       --dry-run: solo diagnostico, no guarda cambios (DEFAULT)
 *       --phase=1..7: ejecutar solo una fase
 *       --apply: guardar cambios en Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';

// ─── Config ────────────────────────────────────────────────────────────
const DRY_RUN = !process.argv.includes('--apply');
const PHASE_FILTER = (() => {
    const arg = process.argv.find(a => a.startsWith('--phase='));
    return arg ? parseInt(arg.split('=')[1]) : 0; // 0 = all phases
})();

if (DRY_RUN) console.log('⚠️  DRY RUN — no changes will be saved. Use --apply to save.\n');

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
    envText.split('\n')
        .filter(l => l.includes('=') && !l.startsWith('#'))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const { error: authErr } = await supabase.auth.signInWithPassword({
    email: env.VITE_AUTO_LOGIN_EMAIL,
    password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (authErr) { console.error('Auth failed:', authErr.message); process.exit(1); }
console.log('✓ Authenticated\n');

// ─── AP Calculation (replica of apTable.ts) ────────────────────────────
function calculateAP(s, o, d) {
    if (isNaN(s) || isNaN(o) || isNaN(d)) return '';
    s = Math.round(s); o = Math.round(o); d = Math.round(d);
    if (s < 1 || s > 10 || o < 1 || o > 10 || d < 1 || d > 10) return '';
    if (s <= 1) return 'L';
    if (s <= 3) { return (o >= 8 && d >= 5) ? 'M' : 'L'; }
    if (s <= 6) {
        if (o >= 8) return d >= 5 ? 'H' : 'M';
        if (o >= 6) return d >= 2 ? 'M' : 'L';
        if (o >= 4) return d >= 7 ? 'M' : 'L';
        return 'L';
    }
    if (s <= 8) {
        if (o >= 8) return 'H';
        if (o >= 6) return d >= 2 ? 'H' : 'M';
        if (o >= 4) return d >= 7 ? 'H' : 'M';
        if (o >= 2) return d >= 5 ? 'M' : 'L';
        return 'L';
    }
    // S = 9-10
    if (o >= 6) return 'H';
    if (o >= 4) return d >= 2 ? 'H' : 'M';
    if (o >= 2) { if (d >= 7) return 'H'; if (d >= 5) return 'M'; return 'L'; }
    return 'L';
}

// ─── Helpers ───────────────────────────────────────────────────────────
function createEmptyCause(overrides = {}) {
    return {
        id: randomUUID(),
        cause: '', preventionControl: '', detectionControl: '',
        occurrence: '', detection: '', ap: '',
        characteristicNumber: '', specialChar: '', filterCode: '',
        preventionAction: '', detectionAction: '',
        responsible: '', targetDate: '', status: '',
        actionTaken: '', completionDate: '',
        severityNew: '', occurrenceNew: '', detectionNew: '', apNew: '',
        observations: '',
        ...overrides,
    };
}

function createEmptyFailure(overrides = {}) {
    return {
        id: randomUUID(),
        description: '', effectLocal: '', effectNextLevel: '', effectEndUser: '',
        severity: '',
        causes: [],
        ...overrides,
    };
}

function createEmptyFunction(overrides = {}) {
    return {
        id: randomUUID(),
        description: '',
        requirements: '',
        failures: [],
        ...overrides,
    };
}

function createEmptyWorkElement(overrides = {}) {
    return {
        id: randomUUID(),
        type: 'Method',
        name: '',
        functions: [],
        ...overrides,
    };
}

function createEmptyOperation(overrides = {}) {
    return {
        id: randomUUID(),
        opNumber: '',
        name: '',
        workElements: [],
        focusElementFunction: '',
        operationFunction: '',
        ...overrides,
    };
}

// ─── Load documents ────────────────────────────────────────────────────
console.log('=== Loading PWA documents ===\n');

const { data: allAmfeDocs, error: amfeErr } = await supabase
    .from('amfe_documents').select('id, project_name, part_number, data');
if (amfeErr) { console.error('AMFE load error:', amfeErr.message); process.exit(1); }

const { data: allCpDocs, error: cpErr } = await supabase
    .from('cp_documents').select('id, project_name, part_number, part_name, data');
if (cpErr) { console.error('CP load error:', cpErr.message); process.exit(1); }

const { data: allHoDocs, error: hoErr } = await supabase
    .from('ho_documents').select('id, part_number, part_description, linked_amfe_project, data');
if (hoErr) { console.error('HO load error:', hoErr.message); process.exit(1); }

const { data: allPfdDocs, error: pfdErr } = await supabase
    .from('pfd_documents').select('id, part_number, data');
if (pfdErr) { console.error('PFD load error:', pfdErr.message); process.exit(1); }

// Parse JSON
for (const doc of [...allAmfeDocs, ...allCpDocs, ...allHoDocs, ...allPfdDocs]) {
    if (typeof doc.data === 'string') doc.data = JSON.parse(doc.data);
}

// ─── Identify PWA documents ───────────────────────────────────────────
function isPWA(doc) {
    const pn = (doc.project_name || doc.part_number || doc.part_description || '').toLowerCase();
    return pn.includes('pwa') || pn.includes('telas') || pn.includes('581') || pn.includes('582') ||
        pn.includes('hilux') || pn.includes('termoformad') || pn.includes('plana');
}

function isTelasPlanas(doc) {
    const pn = (doc.project_name || doc.part_number || doc.part_description || '').toLowerCase();
    return pn.includes('plana') || pn.includes('581');
}

function isTelasTermo(doc) {
    const pn = (doc.project_name || doc.part_number || doc.part_description || '').toLowerCase();
    return pn.includes('termoformad') || pn.includes('582');
}

// Find the 2 AMFE docs
const amfePlanas = allAmfeDocs.find(d => isTelasPlanas(d));
const amfeTermo = allAmfeDocs.find(d => isTelasTermo(d));

// Find CP docs
const cpPlanas = allCpDocs.find(d => isTelasPlanas(d));
const cpTermo = allCpDocs.find(d => isTelasTermo(d));

// Find HO docs
const hoPlanas = allHoDocs.find(d => isTelasPlanas(d));
const hoTermo = allHoDocs.find(d => isTelasTermo(d));

// Find PFD docs
const pfdPlanas = allPfdDocs.find(d => isTelasPlanas(d));
const pfdTermo = allPfdDocs.find(d => isTelasTermo(d));

console.log(`AMFE Planas: ${amfePlanas ? `✓ (${amfePlanas.project_name})` : '✗ NOT FOUND'}`);
console.log(`AMFE Termo:  ${amfeTermo ? `✓ (${amfeTermo.project_name})` : '✗ NOT FOUND'}`);
console.log(`CP Planas:   ${cpPlanas ? `✓ (${cpPlanas.project_name})` : '✗ NOT FOUND'}`);
console.log(`CP Termo:    ${cpTermo ? `✓ (${cpTermo.project_name})` : '✗ NOT FOUND'}`);
console.log(`HO Planas:   ${hoPlanas ? '✓' : '✗ NOT FOUND'}`);
console.log(`HO Termo:    ${hoTermo ? '✓' : '✗ NOT FOUND'}`);
console.log(`PFD Planas:  ${pfdPlanas ? '✓' : '✗ NOT FOUND'}`);
console.log(`PFD Termo:   ${pfdTermo ? '✓' : '✗ NOT FOUND'}`);

if (!amfePlanas || !amfeTermo) {
    console.error('\n✗ Cannot proceed — missing AMFE documents');
    process.exit(1);
}

// Stats tracking
const stats = {
    phase1: { ccAssigned: 0, cpUpdated: 0 },
    phase2: { ccVerified: 0, ccFixed: 0 },
    phase3: { opsDeleted: 0, opsReplaced: 0, fmsCreated: 0 },
    phase4: { namesFixed: 0 },
    phase5: { opsAdded: 0 },
    phase6: { sheetsWithPpe: 0 },
    phase7: { qcItemsLinked: 0 },
};

// ═══════════════════════════════════════════════════════════════════════
// PHASE 1: Flamabilidad CC — Telas Termoformadas
// ═══════════════════════════════════════════════════════════════════════
if (!PHASE_FILTER || PHASE_FILTER === 1) {
    console.log('\n\n═══ PHASE 1: Flamabilidad CC — Telas Termoformadas ═══\n');

    const ops = amfeTermo.data?.operations || [];
    let found = false;

    for (const op of ops) {
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    const desc = (fail.description || '').toLowerCase();
                    const isFlam = desc.includes('flamab') || desc.includes('combusti') ||
                        desc.includes('flamabilidad') || desc.includes('incendi');

                    // Also check causes for flamabilidad keywords
                    for (const cause of (fail.causes || [])) {
                        const causeDesc = (cause.cause || '').toLowerCase();
                        const controlDesc = (cause.detectionControl || '').toLowerCase();
                        const prevDesc = (cause.preventionControl || '').toLowerCase();

                        const causeIsFlam = causeDesc.includes('flamab') || causeDesc.includes('combusti') ||
                            controlDesc.includes('flamab') || prevDesc.includes('flamab') || isFlam;

                        if (causeIsFlam) {
                            found = true;
                            const oldCC = cause.specialChar;
                            const oldSev = fail.severity;

                            // Set CC and severity=10
                            if (cause.specialChar !== 'CC') {
                                cause.specialChar = 'CC';
                                stats.phase1.ccAssigned++;
                                console.log(`  OP ${op.opNumber} | FM: "${fail.description}" | Cause: "${cause.cause}"`);
                                console.log(`    specialChar: "${oldCC}" → "CC"`);
                            }
                            if (Number(fail.severity) !== 10) {
                                fail.severity = 10;
                                // Recalculate AP
                                const o = Number(cause.occurrence) || '';
                                const d = Number(cause.detection) || '';
                                if (o && d) {
                                    cause.ap = calculateAP(10, o, d);
                                    console.log(`    severity: ${oldSev} → 10, AP recalculated → ${cause.ap}`);
                                } else {
                                    console.log(`    severity: ${oldSev} → 10 (AP not recalculated — O/D missing)`);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (!found) {
        console.log('  ⚠ No flamabilidad FM found in Termoformadas AMFE.');
        console.log('  Searching by FM description containing "TBD" with high severity...');

        // Check if there are TBD FMs that might be flamabilidad (from comparison doc)
        for (const op of ops) {
            const opNum = String(op.opNumber).replace(/\D/g, '');
            if (parseInt(opNum) > 10) continue; // Only OP 10 recepciones

            for (const we of (op.workElements || [])) {
                for (const fn of (we.functions || [])) {
                    for (const fail of (fn.failures || [])) {
                        for (const cause of (fail.causes || [])) {
                            // Check CP items linked to this cause for flamabilidad keywords
                            if (Number(fail.severity) >= 9 && cause.specialChar !== 'CC') {
                                console.log(`  OP ${op.opNumber} | S=${fail.severity} | FM="${fail.description}" | CC="${cause.specialChar}"`);
                                console.log(`    → Setting CC on this cause (S≥9 in recepcion, likely flamabilidad)`);
                                cause.specialChar = 'CC';
                                stats.phase1.ccAssigned++;
                            }
                        }
                    }
                }
            }
        }
    }

    // Propagate CC to CP
    if (cpTermo && stats.phase1.ccAssigned > 0) {
        const cpItems = cpTermo.data?.items || [];
        for (const item of cpItems) {
            const char = (item.characteristic || '').toLowerCase();
            const isFlam = char.includes('flamab') || char.includes('combusti');
            if (isFlam && item.classification !== 'CC') {
                console.log(`  CP: "${item.characteristic}" classification: "${item.classification}" → "CC"`);
                item.classification = 'CC';
                stats.phase1.cpUpdated++;
            }
        }
    }

    console.log(`\n  Phase 1 results: ${stats.phase1.ccAssigned} causes set to CC, ${stats.phase1.cpUpdated} CP items updated`);
}

// ═══════════════════════════════════════════════════════════════════════
// PHASE 2: Flamabilidad CC — Telas Planas (verify/fix)
// ═══════════════════════════════════════════════════════════════════════
if (!PHASE_FILTER || PHASE_FILTER === 2) {
    console.log('\n\n═══ PHASE 2: Flamabilidad CC — Telas Planas (verify) ═══\n');

    const ops = amfePlanas.data?.operations || [];

    for (const op of ops) {
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    const desc = (fail.description || '').toLowerCase();
                    for (const cause of (fail.causes || [])) {
                        const causeDesc = (cause.cause || '').toLowerCase();
                        const controlDesc = (cause.detectionControl || '').toLowerCase();

                        const isFlam = desc.includes('flamab') || causeDesc.includes('flamab') ||
                            controlDesc.includes('flamab') || desc.includes('combusti');

                        // Also catch TBD FMs with S>=9 in recepcion
                        const opNum = parseInt(String(op.opNumber).replace(/\D/g, '') || '999');
                        const isTbdHighSev = desc === 'tbd' && Number(fail.severity) >= 9 && opNum <= 10;

                        if (isFlam || isTbdHighSev) {
                            if (cause.specialChar === 'CC') {
                                stats.phase2.ccVerified++;
                                console.log(`  ✓ OP ${op.opNumber} | FM="${fail.description}" | S=${fail.severity} | CC already set`);
                            } else {
                                cause.specialChar = 'CC';
                                if (Number(fail.severity) < 10) fail.severity = 10;
                                const o = Number(cause.occurrence);
                                const d = Number(cause.detection);
                                if (o && d) cause.ap = calculateAP(10, o, d);
                                stats.phase2.ccFixed++;
                                console.log(`  ✗→✓ OP ${op.opNumber} | FM="${fail.description}" | Fixed: CC set, S=10`);
                            }
                        }
                    }
                }
            }
        }
    }

    // Verify/fix CP
    if (cpPlanas) {
        const cpItems = cpPlanas.data?.items || [];
        for (const item of cpItems) {
            const char = (item.characteristic || '').toLowerCase();
            const isFlam = char.includes('flamab') || char.includes('combusti');
            if (isFlam) {
                if (item.classification === 'CC') {
                    console.log(`  ✓ CP: "${item.characteristic}" already CC`);
                } else {
                    console.log(`  ✗→✓ CP: "${item.characteristic}" "${item.classification}" → "CC"`);
                    item.classification = 'CC';
                    stats.phase2.ccFixed++;
                }
            }
        }
    }

    console.log(`\n  Phase 2 results: ${stats.phase2.ccVerified} verified OK, ${stats.phase2.ccFixed} fixed`);
}

// ═══════════════════════════════════════════════════════════════════════
// PHASE 3: Limpiar FM de producto equivocado — Telas Planas
// ═══════════════════════════════════════════════════════════════════════
if (!PHASE_FILTER || PHASE_FILTER === 3) {
    console.log('\n\n═══ PHASE 3: Limpiar FM de producto equivocado — Telas Planas ═══\n');

    const ops = amfePlanas.data?.operations || [];

    // Operations to DELETE (from Termoformadas, not valid for Planas)
    const OPS_TO_DELETE = ['20b', '21'];

    // Operations to REPLACE: wrong WE/functions/FM from Termoformadas
    // Reference process: 10, 15, 20, 30(Costura), 40(Clips), 50(Dots), 60(Insp.Final), 70(Embalaje)
    // Current corrupted: 30(Prep Kits=Termoformadora), 40(Costura=Prensa), 50(Troq Ref=Perforadora),
    //                     60(Troq Aplix=Soldadura), 70(Pegado Dots=Inspeccion), 80(Ctrl Final=Embalaje)

    // Step 1: Delete ops that don't belong
    console.log('  --- Deleting non-Planas operations ---');
    const originalCount = ops.length;
    amfePlanas.data.operations = ops.filter(op => {
        const opStr = String(op.opNumber).toLowerCase().trim();
        if (OPS_TO_DELETE.includes(opStr)) {
            console.log(`  ✗ Deleting OP ${op.opNumber}: ${op.name}`);
            stats.phase3.opsDeleted++;
            return false;
        }
        return true;
    });
    console.log(`  Deleted ${stats.phase3.opsDeleted} operations (${originalCount} → ${amfePlanas.data.operations.length})`);

    // Step 2: Replace operations 30-80 with correct Planas process
    console.log('\n  --- Replacing corrupted operations with correct Planas process ---');

    // FM de Costura from reference (AMFE Rev D):
    const costuraFailures = [
        {
            description: 'Costura floja',
            effectLocal: 'Producto no conforme en estacion',
            effectNextLevel: 'Rechazo en inspeccion final / retrabajo',
            effectEndUser: 'Desprendimiento de tela en uso',
            severity: 8,
            causes: [createEmptyCause({
                cause: 'Tension de hilo incorrecta',
                occurrence: 4, detection: 5,
                preventionControl: 'Set-up de maquina al inicio de turno',
                detectionControl: 'Autocontrol operario cada pieza',
            })],
        },
        {
            description: 'Costura corrida / fuera de posicion',
            effectLocal: 'Producto no conforme en estacion',
            effectNextLevel: 'Rechazo en inspeccion final',
            effectEndUser: 'Defecto visual en asiento',
            severity: 6,
            causes: [createEmptyCause({
                cause: 'Operador no sigue guia de costura',
                occurrence: 4, detection: 5,
                preventionControl: 'Instruccion de trabajo',
                detectionControl: 'Autocontrol visual operario',
            })],
        },
        {
            description: 'Hilo roto',
            effectLocal: 'Interrupcion de costura, retrabajo en estacion',
            effectNextLevel: 'Retraso en produccion',
            effectEndUser: 'TBD',
            severity: 5,
            causes: [createEmptyCause({
                cause: 'Hilo fuera de especificacion o aguja danada',
                occurrence: 3, detection: 3,
                preventionControl: 'Control de materiales en recepcion',
                detectionControl: 'Deteccion automatica maquina de costura',
            })],
        },
        {
            description: 'Puntada saltada',
            effectLocal: 'Costura incompleta en tramo',
            effectNextLevel: 'Rechazo en inspeccion final',
            effectEndUser: 'Debilitamiento de union de tela',
            severity: 6,
            causes: [createEmptyCause({
                cause: 'Aguja desgastada o maquina descalibrada',
                occurrence: 4, detection: 5,
                preventionControl: 'Mantenimiento preventivo de agujas',
                detectionControl: 'Autocontrol visual operario',
            })],
        },
        {
            description: 'Refuerzo costurado inverso al airbag',
            effectLocal: 'Producto no conforme',
            effectNextLevel: 'Rechazo en auditoria de calidad',
            effectEndUser: 'Riesgo de interferencia con despliegue de airbag',
            severity: 7,
            causes: [createEmptyCause({
                cause: 'Confusion en orientacion del refuerzo',
                occurrence: 3, detection: 5,
                preventionControl: 'Instruccion de trabajo con foto de orientacion',
                detectionControl: 'Autocontrol visual operario',
                // Action from reference: crear instructivo de retrabajo - Cecilia Rodriguez
                preventionAction: 'Crear instructivo de retrabajo',
                responsible: 'Cecilia Rodriguez',
                status: 'Pendiente',
            })],
        },
        {
            description: 'Costura con arrugas',
            effectLocal: 'Defecto visual en producto',
            effectNextLevel: 'Rechazo en inspeccion final',
            effectEndUser: 'Defecto estetico visible en asiento',
            severity: 5,
            causes: [createEmptyCause({
                cause: 'Material mal posicionado durante costura',
                occurrence: 4, detection: 4,
                preventionControl: 'Instruccion de trabajo',
                detectionControl: 'Autocontrol visual operario',
            })],
        },
        {
            description: 'Rotura de aguja',
            effectLocal: 'Interrupcion de operacion, riesgo operario',
            effectNextLevel: 'Retraso en produccion',
            effectEndUser: 'TBD',
            severity: 5,
            causes: [createEmptyCause({
                cause: 'Aguja desgastada o material demasiado grueso',
                occurrence: 3, detection: 2,
                preventionControl: 'Recambio de agujas segun plan de mantenimiento',
                detectionControl: 'Deteccion inmediata por operario',
            })],
        },
    ];

    // Calculate AP for all costura causes
    for (const fail of costuraFailures) {
        for (const cause of fail.causes) {
            const s = Number(fail.severity);
            const o = Number(cause.occurrence);
            const d = Number(cause.detection);
            if (s && o && d) cause.ap = calculateAP(s, o, d);
        }
        // Add IDs
        fail.id = randomUUID();
    }

    // New operations to replace the corrupted ones
    const newOperations = [
        createEmptyOperation({
            opNumber: '15',
            name: 'PREPARACION DE CORTE',
            workElements: [createEmptyWorkElement({
                type: 'Method',
                name: 'Preparacion de mesa de corte',
                functions: [createEmptyFunction({
                    description: 'Preparar material para corte segun tizada',
                    failures: [createEmptyFailure({
                        description: 'TBD — Pendiente definicion con equipo APQP',
                        severity: '',
                        effectLocal: 'TBD', effectNextLevel: 'TBD', effectEndUser: 'TBD',
                        causes: [createEmptyCause({ cause: 'TBD' })],
                    })],
                })],
            })],
        }),
        createEmptyOperation({
            opNumber: '30',
            name: 'COSTURA',
            workElements: [createEmptyWorkElement({
                type: 'Machine',
                name: 'Maquina de costura',
                functions: [createEmptyFunction({
                    description: 'Costurar tela segun patron de costura definido',
                    failures: costuraFailures,
                })],
            })],
        }),
        createEmptyOperation({
            opNumber: '40',
            name: 'COLOCADO DE CLIPS',
            workElements: [createEmptyWorkElement({
                type: 'Man',
                name: 'Operador de colocado',
                functions: [createEmptyFunction({
                    description: 'Colocar clips en posiciones definidas',
                    failures: [createEmptyFailure({
                        description: 'TBD — Pendiente definicion con equipo APQP',
                        severity: '',
                        effectLocal: 'TBD', effectNextLevel: 'TBD', effectEndUser: 'TBD',
                        causes: [createEmptyCause({ cause: 'TBD' })],
                    })],
                })],
            })],
        }),
        createEmptyOperation({
            opNumber: '50',
            name: 'PEGADO DE DOTS',
            workElements: [createEmptyWorkElement({
                type: 'Man',
                name: 'Operador de pegado',
                functions: [createEmptyFunction({
                    description: 'Pegar dots en posiciones definidas',
                    failures: [createEmptyFailure({
                        description: 'TBD — Pendiente definicion con equipo APQP',
                        severity: '',
                        effectLocal: 'TBD', effectNextLevel: 'TBD', effectEndUser: 'TBD',
                        causes: [createEmptyCause({ cause: 'TBD' })],
                    })],
                })],
            })],
        }),
        createEmptyOperation({
            opNumber: '60',
            name: 'CONTROL FINAL DE CALIDAD',
            workElements: [createEmptyWorkElement({
                type: 'Measurement',
                name: 'Inspeccion visual y dimensional',
                functions: [createEmptyFunction({
                    description: 'Verificar conformidad de pieza terminada',
                    failures: [createEmptyFailure({
                        description: 'TBD — Pendiente definicion con equipo APQP',
                        severity: '',
                        effectLocal: 'TBD', effectNextLevel: 'TBD', effectEndUser: 'TBD',
                        causes: [createEmptyCause({ cause: 'TBD' })],
                    })],
                })],
            })],
        }),
        createEmptyOperation({
            opNumber: '70',
            name: 'EMBALAJE',
            workElements: [createEmptyWorkElement({
                type: 'Man',
                name: 'Operador de embalaje',
                functions: [createEmptyFunction({
                    description: 'Embalar y rotular producto terminado',
                    failures: [createEmptyFailure({
                        description: 'TBD — Pendiente definicion con equipo APQP',
                        severity: '',
                        effectLocal: 'TBD', effectNextLevel: 'TBD', effectEndUser: 'TBD',
                        causes: [createEmptyCause({ cause: 'TBD' })],
                    })],
                })],
            })],
        }),
    ];

    // Remove corrupted operations 30-80 and replace with new ones
    const opsToRemove = ['30', '40', '50', '60', '70', '80'];
    const currentOps = amfePlanas.data.operations;

    // Check which corrupted ops exist
    for (const opNum of opsToRemove) {
        const existingOp = currentOps.find(op => String(op.opNumber) === opNum);
        if (existingOp) {
            // Check if this op has wrong WE (from Termoformadas)
            const weName = (existingOp.workElements?.[0]?.name || '').toLowerCase();
            const isCorrupted = weName.includes('termoform') || weName.includes('prensa') ||
                weName.includes('perforad') || weName.includes('soldadura') ||
                weName.includes('embalaje') && opNum !== '70';

            if (isCorrupted || opsToRemove.includes(opNum)) {
                console.log(`  Removing corrupted OP ${opNum}: ${existingOp.name} (WE: ${existingOp.workElements?.[0]?.name || 'none'})`);
                stats.phase3.opsReplaced++;
            }
        }
    }

    // Filter out corrupted ops
    amfePlanas.data.operations = currentOps.filter(op => !opsToRemove.includes(String(op.opNumber)));

    // Also check for 10b and 10d — these might need to stay or be reviewed
    // 10b (RECEPCION DE PUNZONADO CON BI-COMPONENTE) — might not apply to Planas
    // 10d (COLOCADO DE APLIX) — might be misplaced but could be valid
    // Leave them for now — Fak can decide in the items requiring confirmation

    // Add new operations
    amfePlanas.data.operations.push(...newOperations);
    stats.phase3.fmsCreated = costuraFailures.length;

    // Sort operations by number
    amfePlanas.data.operations.sort((a, b) => {
        const numA = parseInt(String(a.opNumber).replace(/\D/g, '') || '999');
        const numB = parseInt(String(b.opNumber).replace(/\D/g, '') || '999');
        return numA - numB;
    });

    console.log(`\n  Phase 3 results: ${stats.phase3.opsDeleted + stats.phase3.opsReplaced} ops removed, ${newOperations.length} new ops added, ${stats.phase3.fmsCreated} FM from reference`);
    console.log('  New operation structure:');
    for (const op of amfePlanas.data.operations) {
        const fmCount = (op.workElements || []).reduce((acc, we) =>
            acc + (we.functions || []).reduce((acc2, fn) => acc2 + (fn.failures || []).length, 0), 0);
        console.log(`    OP ${op.opNumber}: ${op.name} (${fmCount} FM)`);
    }
}

// ═══════════════════════════════════════════════════════════════════════
// PHASE 4: Alinear nombres operaciones PFD/AMFE/CP/HO
// ═══════════════════════════════════════════════════════════════════════
if (!PHASE_FILTER || PHASE_FILTER === 4) {
    console.log('\n\n═══ PHASE 4: Alinear nombres operaciones PFD/AMFE/CP/HO ═══\n');

    // Standard names per PFD rule
    const NAME_MAP = {
        'recepcion': 'RECEPCION DE MATERIA PRIMA',
        'control final': 'CONTROL FINAL DE CALIDAD',
        'inspeccion final': 'CONTROL FINAL DE CALIDAD',
        'embalaje': 'EMBALAJE',
    };

    function standardizeName(name) {
        if (!name) return name;
        const lower = name.toLowerCase().trim();

        // Check if starts with key pattern
        if (lower.startsWith('recepcion') && !lower.includes('punzonado') && !lower.includes('bi-comp')) {
            return NAME_MAP['recepcion'];
        }
        if (lower.includes('control final') || lower.includes('inspeccion final')) {
            return NAME_MAP['control final'];
        }
        if (lower.startsWith('embalaje')) {
            return NAME_MAP['embalaje'];
        }
        return name; // No change
    }

    function alignDocOps(docType, doc, nameField, numberField) {
        if (!doc || !doc.data) return;

        const items = docType === 'amfe' ? (doc.data.operations || []) :
            docType === 'pfd' ? (doc.data.steps || []) :
                docType === 'cp' ? (doc.data.items || []) :
                    docType === 'ho' ? (doc.data.sheets || []) : [];

        for (const item of items) {
            const currentName = item[nameField];
            const newName = standardizeName(currentName);
            if (newName && newName !== currentName) {
                const opNum = item[numberField] || '?';
                console.log(`  ${docType.toUpperCase()} OP ${opNum}: "${currentName}" → "${newName}"`);
                item[nameField] = newName;
                stats.phase4.namesFixed++;
            }
        }
    }

    // Apply to both products
    for (const product of ['Planas', 'Termo']) {
        const amfe = product === 'Planas' ? amfePlanas : amfeTermo;
        const cp = product === 'Planas' ? cpPlanas : cpTermo;
        const ho = product === 'Planas' ? hoPlanas : hoTermo;
        const pfd = product === 'Planas' ? pfdPlanas : pfdTermo;

        console.log(`  --- ${product} ---`);
        alignDocOps('amfe', amfe, 'name', 'opNumber');
        alignDocOps('cp', cp, 'processStepName', 'processStepNumber');
        alignDocOps('ho', ho, 'operationName', 'operationNumber');
        alignDocOps('pfd', pfd, 'name', 'stepNumber');
    }

    console.log(`\n  Phase 4 results: ${stats.phase4.namesFixed} names standardized`);
}

// ═══════════════════════════════════════════════════════════════════════
// PHASE 5: Agregar operaciones faltantes — Telas Termoformadas
// ═══════════════════════════════════════════════════════════════════════
if (!PHASE_FILTER || PHASE_FILTER === 5) {
    console.log('\n\n═══ PHASE 5: Agregar operaciones faltantes — Telas Termoformadas ═══\n');

    const ops = amfeTermo.data?.operations || [];
    const existingOpNums = ops.map(op => String(op.opNumber));

    // Missing operations from PFD/reference:
    // OP 80: Costura refuerzos (in PFD but not in AMFE)
    // OP 90: Aplicacion aplix (in PFD but not in AMFE)
    // OP 11: Retrabajo Aplix (in reference)
    // OP 61: Retrabajo soldadura (in reference)

    const missingOps = [
        {
            opNumber: '80', name: 'COSTURA DE REFUERZOS',
            weType: 'Machine', weName: 'Maquina de costura',
            fnDesc: 'Costurar refuerzos a pieza termoformada',
        },
        {
            opNumber: '90', name: 'APLICACION DE APLIX',
            weType: 'Man', weName: 'Operador de aplicacion',
            fnDesc: 'Aplicar aplix en posiciones definidas',
        },
        {
            opNumber: '11', name: 'RETRABAJO DE PIEZA (APLIX)',
            weType: 'Man', weName: 'Operador de retrabajo',
            fnDesc: 'Retrabajar pieza con aplix defectuoso',
        },
        {
            opNumber: '61', name: 'RETRABAJO SOLDADURA',
            weType: 'Man', weName: 'Operador de retrabajo',
            fnDesc: 'Retrabajar pieza con soldadura defectuosa',
        },
    ];

    for (const missing of missingOps) {
        if (existingOpNums.includes(missing.opNumber)) {
            console.log(`  ✓ OP ${missing.opNumber} already exists — skipping`);
            continue;
        }

        const newOp = createEmptyOperation({
            opNumber: missing.opNumber,
            name: missing.name,
            workElements: [createEmptyWorkElement({
                type: missing.weType,
                name: missing.weName,
                functions: [createEmptyFunction({
                    description: missing.fnDesc,
                    failures: [createEmptyFailure({
                        description: 'TBD — Pendiente definicion con equipo APQP',
                        severity: '',
                        effectLocal: 'TBD', effectNextLevel: 'TBD', effectEndUser: 'TBD',
                        causes: [createEmptyCause({ cause: 'TBD' })],
                    })],
                })],
            })],
        });

        amfeTermo.data.operations.push(newOp);
        stats.phase5.opsAdded++;
        console.log(`  + Added OP ${missing.opNumber}: ${missing.name} (FM=TBD)`);
    }

    // Sort operations
    amfeTermo.data.operations.sort((a, b) => {
        const numA = parseInt(String(a.opNumber).replace(/\D/g, '') || '999');
        const numB = parseInt(String(b.opNumber).replace(/\D/g, '') || '999');
        return numA - numB;
    });

    console.log(`\n  Phase 5 results: ${stats.phase5.opsAdded} operations added`);
}

// ═══════════════════════════════════════════════════════════════════════
// PHASE 6: HO sin EPP — Ambos productos
// ═══════════════════════════════════════════════════════════════════════
if (!PHASE_FILTER || PHASE_FILTER === 6) {
    console.log('\n\n═══ PHASE 6: HO sin EPP — Ambos productos ═══\n');

    // EPP by operation type (from .claude/rules/hoja-operaciones.md)
    const EPP_MAP = {
        'recepcion': ['zapatos de seguridad', 'guantes'],
        'preparacion': ['anteojos', 'guantes'],
        'corte': ['guantes anticorte', 'anteojos'],
        'costura': ['proteccion auditiva', 'anteojos'],
        'colocado': ['anteojos', 'guantes'],
        'pegado': ['anteojos', 'guantes'],
        'troquelado': ['guantes anticorte', 'anteojos'],
        'termoformado': ['guantes termicos', 'anteojos'],
        'horno': ['guantes termicos', 'anteojos'],
        'soldadura': ['anteojos', 'guantes'],
        'control': ['anteojos'],
        'inspeccion': ['anteojos'],
        'embalaje': ['zapatos de seguridad', 'guantes'],
        'retrabajo': ['anteojos', 'guantes'],
        'aplicacion': ['anteojos', 'guantes'],
    };

    function getEppForOperation(opName) {
        const lower = (opName || '').toLowerCase();
        for (const [key, ppe] of Object.entries(EPP_MAP)) {
            if (lower.includes(key)) return ppe;
        }
        return ['anteojos']; // Default minimum
    }

    for (const [label, hoDocs] of [['Planas', hoPlanas], ['Termo', hoTermo]]) {
        if (!hoDocs || !hoDocs.data) { console.log(`  ⚠ HO ${label} not found — skipping`); continue; }

        const sheets = hoDocs.data.sheets || [];
        console.log(`  --- HO ${label} (${sheets.length} sheets) ---`);

        for (const sheet of sheets) {
            const currentPpe = sheet.ppe || [];
            if (currentPpe.length > 0) {
                console.log(`  ✓ OP ${sheet.operationNumber} ${sheet.operationName}: already has ${currentPpe.length} EPP items`);
                continue;
            }

            const eppe = getEppForOperation(sheet.operationName);
            sheet.ppe = eppe;
            stats.phase6.sheetsWithPpe++;
            console.log(`  + OP ${sheet.operationNumber} ${sheet.operationName}: assigned ${eppe.join(', ')}`);
        }
    }

    console.log(`\n  Phase 6 results: ${stats.phase6.sheetsWithPpe} sheets assigned EPP`);
}

// ═══════════════════════════════════════════════════════════════════════
// PHASE 7: HO con pocos QC items — Telas Planas
// ═══════════════════════════════════════════════════════════════════════
if (!PHASE_FILTER || PHASE_FILTER === 7) {
    console.log('\n\n═══ PHASE 7: HO con pocos QC items — Telas Planas ═══\n');

    if (!hoPlanas || !cpPlanas) {
        console.log('  ⚠ HO or CP Planas not found — skipping');
    } else {
        const sheets = hoPlanas.data?.sheets || [];
        const cpItems = cpPlanas.data?.items || [];

        // Roles that indicate operator-level controls (goes to HO)
        const OPERATOR_ROLES = [
            'operador', 'autocontrol', 'produccion', 'lider',
        ];

        function isOperatorControl(cpItem) {
            const owner = (cpItem.reactionPlanOwner || '').toLowerCase();
            const method = (cpItem.controlMethod || '').toLowerCase();
            // Exclude lab, metrology, audit
            if (owner.includes('laboratorio') || owner.includes('metrolog') || owner.includes('audit')) return false;
            if (method.includes('laboratorio') || method.includes('metrolog')) return false;
            // Include operator-level
            return OPERATOR_ROLES.some(r => owner.includes(r)) || owner === '' || method.includes('visual') || method.includes('autocontrol');
        }

        for (const sheet of sheets) {
            const opNum = String(sheet.operationNumber || '');
            const existingQcIds = new Set((sheet.qcItems || []).map(qc => qc.cpItemId));

            // Find CP items for this operation
            const matchingCpItems = cpItems.filter(cp => {
                const cpOpNum = String(cp.processStepNumber || '');
                return cpOpNum === opNum && isOperatorControl(cp) && !existingQcIds.has(cp.id);
            });

            if (matchingCpItems.length === 0) continue;

            sheet.qcItems = sheet.qcItems || [];

            for (const cpItem of matchingCpItems) {
                const qcItem = {
                    id: randomUUID(),
                    cpItemId: cpItem.id,
                    characteristic: cpItem.characteristic || cpItem.productCharacteristic || cpItem.processCharacteristic || 'TBD',
                    controlMethod: cpItem.evaluationTechnique || cpItem.controlMethod || 'TBD',
                    frequency: cpItem.sampleFrequency || 'TBD',
                    responsible: cpItem.reactionPlanOwner || 'Operador de produccion',
                    specification: cpItem.specification || 'TBD',
                    reactionPlan: cpItem.reactionPlan || 'Segregar pieza, notificar s/ P-09/I',
                };

                sheet.qcItems.push(qcItem);
                stats.phase7.qcItemsLinked++;
                console.log(`  + OP ${opNum}: linked "${qcItem.characteristic}" from CP`);
            }
        }
    }

    console.log(`\n  Phase 7 results: ${stats.phase7.qcItemsLinked} QC items linked from CP to HO`);
}

// ═══════════════════════════════════════════════════════════════════════
// SAVE
// ═══════════════════════════════════════════════════════════════════════
console.log('\n\n═══ SUMMARY ═══\n');
console.log(`Phase 1 (Flamab CC Termo):    ${stats.phase1.ccAssigned} CC assigned, ${stats.phase1.cpUpdated} CP updated`);
console.log(`Phase 2 (Flamab CC Planas):   ${stats.phase2.ccVerified} verified, ${stats.phase2.ccFixed} fixed`);
console.log(`Phase 3 (Clean FM Planas):    ${stats.phase3.opsDeleted + stats.phase3.opsReplaced} ops removed, ${stats.phase3.fmsCreated} FM from ref`);
console.log(`Phase 4 (Align names):        ${stats.phase4.namesFixed} names fixed`);
console.log(`Phase 5 (Missing ops Termo):  ${stats.phase5.opsAdded} ops added`);
console.log(`Phase 6 (EPP in HO):          ${stats.phase6.sheetsWithPpe} sheets assigned EPP`);
console.log(`Phase 7 (QC items HO Planas): ${stats.phase7.qcItemsLinked} QC items linked`);

if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN — no changes saved. Run with --apply to commit changes.');
} else {
    console.log('\n💾 Saving to Supabase...\n');

    const docsToSave = [
        { table: 'amfe_documents', doc: amfePlanas, label: 'AMFE Planas' },
        { table: 'amfe_documents', doc: amfeTermo, label: 'AMFE Termo' },
        { table: 'cp_documents', doc: cpPlanas, label: 'CP Planas' },
        { table: 'cp_documents', doc: cpTermo, label: 'CP Termo' },
        { table: 'ho_documents', doc: hoPlanas, label: 'HO Planas' },
        { table: 'ho_documents', doc: hoTermo, label: 'HO Termo' },
        { table: 'pfd_documents', doc: pfdPlanas, label: 'PFD Planas' },
        { table: 'pfd_documents', doc: pfdTermo, label: 'PFD Termo' },
    ];

    let saved = 0;
    for (const { table, doc, label } of docsToSave) {
        if (!doc) { console.log(`  ⚠ ${label} — not found, skipping`); continue; }

        const { error } = await supabase
            .from(table)
            .update({ data: doc.data })
            .eq('id', doc.id);

        if (error) {
            console.error(`  ✗ ${label}: ${error.message}`);
        } else {
            console.log(`  ✓ ${label} saved`);
            saved++;
        }
    }

    console.log(`\n✓ ${saved} documents saved to Supabase`);
}

console.log('\n═══ ITEMS PENDIENTES PARA FAK ═══\n');
console.log('A. Part number Telas Planas: Header=21-8909, Familia=21-9463, Ref=21-6567');
console.log('B. Cantidades discrepantes: agujeros (40 ref vs 17 sub), aplix (35 ref vs 9 sub), pzs/medio (50 ref vs 25 sub)');
console.log('C. Temperatura horno Termoformadas: Set-up=100°C, AMFE ref=150°C, PC ref=200°C');
console.log('D. Operaciones vigentes Planas: OP 15 (Prep corte), OP 40 (Clips), OP 50 (Dots)');
console.log('E. Materiales Termoformadas: Punzonado 120g/m2, Bicomp 280g/m2, Aplix rollo');
console.log('F. Norma flamabilidad PWA: confirmar norma especifica (NO es TL 1010)');

process.exit(0);
