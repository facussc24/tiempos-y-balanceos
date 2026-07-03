/**
 * Fix Script — Assign componentMaterial to CP reception (OP 10) items
 *
 * Strategy:
 *   1. Load all CP documents + their linked AMFE documents
 *   2. From AMFE OP 10 work elements (type="Material"), extract the material list
 *   3. For each CP reception item with empty componentMaterial:
 *      a) Match characteristic text to specific materials via keyword rules
 *      b) For generic process items, use the "main material" from the product family
 *
 * USO:
 *   node scripts/fixCpMaterials.mjs              # dry-run (default)
 *   node scripts/fixCpMaterials.mjs --apply      # apply changes
 *   node scripts/fixCpMaterials.mjs --dry-run    # explicit dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// ─── Config ────────────────────────────────────────────────────────────
const APPLY = process.argv.includes('--apply');
const DRY_RUN = !APPLY;
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envText = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
    envText.split('\n')
        .filter(l => l.includes('=') && !l.startsWith('#'))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// Auth
const { error: authErr } = await supabase.auth.signInWithPassword({
    email: env.VITE_AUTO_LOGIN_EMAIL,
    password: env.VITE_AUTO_LOGIN_PASSWORD,
});
if (authErr) { console.error('Auth failed:', authErr.message); process.exit(1); }
console.log('OK Authenticated');
if (DRY_RUN) console.log('DRY RUN MODE — no changes will be saved\n');
else console.log('APPLY MODE — changes WILL be saved\n');

// ─── Helpers ───────────────────────────────────────────────────────────
function isReception(processStepNumber) {
    const n = parseInt(String(processStepNumber).replace(/^OP\s*/i, '').trim(), 10);
    return Number.isFinite(n) && n <= 10;
}

function lower(s) { return (s || '').toLowerCase(); }

// ─── Product family detection → main material name ────────────────────
// These are the "canonical" material names per product family, used as the
// main/default material for generic items. Derived from existing assigned materials.
const FAMILY_MAIN_MATERIAL = {
    INSERT:                 'PVC/Vinilo TL 520 94K',
    ARMREST_DOOR_PANEL:     'PVC/Vinilo',
    TOP_ROLL:               'PVC/Vinilo TL 520 94K',
    HEADREST_FRONT:         'PVC/Vinilo',
    HEADREST_REAR_CEN:      'PVC/Vinilo',
    HEADREST_REAR_OUT:      'PVC/Vinilo',
    TELAS_PLANAS:           'Tela PES 110 + TNT PP 30 Blanco',
    TELAS_TERMOFORMADAS:    'Tela termoformable',
};

function detectFamily(projectName) {
    const pn = (projectName || '').toUpperCase();
    if (pn.includes('INSERT')) return 'INSERT';
    if (pn.includes('ARMREST')) return 'ARMREST_DOOR_PANEL';
    if (pn.includes('TOP_ROLL') || pn.includes('TOP ROLL')) return 'TOP_ROLL';
    if (pn.includes('HEADREST_FRONT') || pn.includes('HEADREST FRONT')) return 'HEADREST_FRONT';
    if (pn.includes('HEADREST_REAR_CEN') || pn.includes('REAR_CEN') || pn.includes('REAR CENTER')) return 'HEADREST_REAR_CEN';
    if (pn.includes('HEADREST_REAR_OUT') || pn.includes('REAR_OUT') || pn.includes('REAR OUTER')) return 'HEADREST_REAR_OUT';
    if (pn.includes('TELAS_PLANAS') || pn.includes('PLANAS')) return 'TELAS_PLANAS';
    if (pn.includes('TELAS_TERMOFORMADAS') || pn.includes('TERMOFORMAD')) return 'TELAS_TERMOFORMADAS';
    return null;
}

// ─── Load documents ────────────────────────────────────────────────────
console.log('=== Loading documents ===');

const { data: cpDocs, error: cpErr } = await supabase
    .from('cp_documents')
    .select('id, project_name, part_number, part_name, linked_amfe_id, linked_amfe_project, data');
if (cpErr) { console.error('CP load error:', cpErr.message); process.exit(1); }

const { data: amfeDocs, error: amfeErr } = await supabase
    .from('amfe_documents')
    .select('id, project_name, part_number, data');
if (amfeErr) { console.error('AMFE load error:', amfeErr.message); process.exit(1); }

console.log(`Loaded: ${cpDocs.length} CPs, ${amfeDocs.length} AMFEs`);

// Parse JSON data
for (const doc of [...cpDocs, ...amfeDocs]) {
    if (typeof doc.data === 'string') doc.data = JSON.parse(doc.data);
}

// Build AMFE lookup maps
const amfeById = new Map();
const amfeByProject = new Map();
for (const amfe of amfeDocs) {
    amfeById.set(amfe.id, amfe);
    if (amfe.project_name) amfeByProject.set(amfe.project_name, amfe);
}

function findAmfeForCp(cpDoc) {
    if (cpDoc.linked_amfe_id) {
        const match = amfeById.get(cpDoc.linked_amfe_id);
        if (match) return match;
    }
    if (cpDoc.linked_amfe_project) {
        const match = amfeByProject.get(cpDoc.linked_amfe_project);
        if (match) return match;
    }
    if (cpDoc.project_name) {
        const match = amfeByProject.get(cpDoc.project_name);
        if (match) return match;
    }
    return null;
}

// ─── Extract materials from AMFE reception work elements ──────────────
function extractMaterialsFromAmfe(amfeDoc) {
    const operations = amfeDoc.data?.operations || [];
    const materials = [];

    for (const op of operations) {
        // AMFE uses opNumber field like "OP 10", "OP 5"
        const rawOpNum = op.opNumber || op.operationNumber || '';
        const opNum = parseInt(String(rawOpNum).replace(/^OP\s*/i, '').trim(), 10);
        if (!Number.isFinite(opNum) || opNum > 10) continue;

        // Only extract from WE type="Material"
        for (const we of (op.workElements || [])) {
            if (we.type !== 'Material') continue;
            const weName = (we.name || we.description || '').trim();
            if (!weName) continue;

            // Material WE names can be:
            // - "Tela termoformable / Refuerzos / Hilos / Aplix" (slash-separated)
            // - "Tela PES 110 + TNT PP 30 Blanco / Hilo Caiman ..." (slash-separated, + inside names)
            // - "Vinilo, sustrato, adhesivo, insertos, hilo" (comma-separated)
            // - "Sustrato plastico, espuma PU, recubrimiento (cuero/vinilo/tela), hilo, varilla metalica"
            //   Note: parens can contain slashes — don't split inside parens

            // First try: split by " / " (space-slash-space) which is the structured format
            if (weName.includes(' / ')) {
                const parts = weName.split(/\s*\/\s*/);
                for (const p of parts) {
                    const cleaned = p.trim();
                    if (cleaned) materials.push(cleaned);
                }
            }
            // Second try: split by comma
            else if (weName.includes(',')) {
                const parts = weName.split(/\s*,\s*/);
                for (const p of parts) {
                    const cleaned = p.trim();
                    if (cleaned) materials.push(cleaned);
                }
            }
            // Single material name
            else {
                materials.push(weName);
            }
        }
    }
    return materials;
}

// ─── Material matching ─────────────────────────────────────────────────

/**
 * Given a CP item's characteristic text and the list of materials from the AMFE,
 * determine which material this CP item refers to.
 *
 * Returns { material: string, rule: string } or { material: '', rule: 'no-match' }
 */
function matchMaterial(item, amfeMaterials, mainMaterial) {
    const prodChar = lower(item.productCharacteristic);
    const procChar = lower(item.processCharacteristic);
    const specText = lower(item.specification);
    const allText = `${prodChar} ${procChar} ${specText}`;

    // ──────────────────────────────────────────────────────────────────
    // SPECIFIC material keyword matching
    // ──────────────────────────────────────────────────────────────────

    // Hilo (thread)
    if (/hilo|costura|cabos|dtex|torsi[oó]n/i.test(allText)) {
        const threadMats = amfeMaterials.filter(m => /hilo/i.test(m));
        if (threadMats.length === 1) return { material: threadMats[0], rule: 'keyword-hilo' };
        if (threadMats.length > 1) {
            for (const tm of threadMats) {
                if (lower(tm).includes('caim') && allText.includes('caim')) return { material: tm, rule: 'keyword-hilo-caiman' };
                if (lower(tm).includes('textur') && allText.includes('textur')) return { material: tm, rule: 'keyword-hilo-textur' };
            }
            return { material: threadMats[0], rule: 'keyword-hilo-first' };
        }
        return { material: 'Hilo', rule: 'keyword-hilo-generic' };
    }

    // Aplix / Velcro
    if (/aplix|velcro/i.test(allText)) {
        const aplixMats = amfeMaterials.filter(m => /aplix|velcro/i.test(m));
        if (aplixMats.length > 0) return { material: aplixMats[0], rule: 'keyword-aplix' };
        return { material: 'Aplix', rule: 'keyword-aplix-generic' };
    }

    // Refuerzo (reinforcement)
    if (/refuerzo/i.test(allText)) {
        const refMats = amfeMaterials.filter(m => /refuerzo/i.test(m));
        if (refMats.length > 0) return { material: refMats[0], rule: 'keyword-refuerzo' };
        return { material: 'Refuerzo', rule: 'keyword-refuerzo-generic' };
    }

    // Adhesivo / Cinta / SikaMelt
    if (/adhesiv|sikamelt|sika|cinta\s*tessa|cinta\s*tesa|hotmelt/i.test(allText)) {
        const adhMats = amfeMaterials.filter(m => /adhesiv|sika|cinta|tessa|tesa|hotmelt/i.test(m));
        if (adhMats.length > 0) return { material: adhMats[0], rule: 'keyword-adhesivo' };
        return { material: 'Adhesivo', rule: 'keyword-adhesivo-generic' };
    }

    // Varilla de acero (steel rod)
    if (/varilla|barra.*acero/i.test(allText)) {
        const steelMats = amfeMaterials.filter(m => /varilla|acero|steel/i.test(m));
        if (steelMats.length > 0) return { material: steelMats[0], rule: 'keyword-varilla' };
        return { material: 'Varilla acero', rule: 'keyword-varilla-generic' };
    }

    // PVC / Vinilo
    if (/pvc|vinilo|vinyl/i.test(allText)) {
        const pvcMats = amfeMaterials.filter(m => /pvc|vinilo|vinyl|cuero/i.test(m));
        if (pvcMats.length > 0) return { material: pvcMats[0], rule: 'keyword-pvc' };
        return { material: 'PVC/Vinilo', rule: 'keyword-pvc-generic' };
    }

    // Espuma / Foam / PUR
    if (/espuma|foam|pur\b/i.test(allText)) {
        const foamMats = amfeMaterials.filter(m => /espuma|foam|pur\b/i.test(m));
        if (foamMats.length > 0) return { material: foamMats[0], rule: 'keyword-espuma' };
        return { material: 'Espuma PUR', rule: 'keyword-espuma-generic' };
    }

    // PC/ABS / Cycoloy / sustrato plastico
    if (/pc\/?abs|cycoloy|sustrato\s*pl[aá]stico/i.test(allText)) {
        const plasticMats = amfeMaterials.filter(m => /pc.*abs|cycoloy|sustrato/i.test(m));
        if (plasticMats.length > 0) return { material: plasticMats[0], rule: 'keyword-plastic' };
        return { material: '', rule: 'no-match' };
    }

    // TPO / Bilaminate
    if (/tpo|bilaminate/i.test(allText)) {
        const tpoMats = amfeMaterials.filter(m => /tpo|bilaminate/i.test(m));
        if (tpoMats.length > 0) return { material: tpoMats[0], rule: 'keyword-tpo' };
        return { material: 'TPO Bilaminate', rule: 'keyword-tpo-generic' };
    }

    // ──────────────────────────────────────────────────────────────────
    // CHARACTERISTIC-BASED matching (prodChar has identifiable keywords)
    // ──────────────────────────────────────────────────────────────────

    // Flamabilidad / combustion → main material (the flammability test covers it)
    if (/flamab|combusti|tl\s*1010|inflamab/i.test(allText)) {
        if (mainMaterial) return { material: mainMaterial, rule: 'char-flamabilidad' };
        return { material: '', rule: 'no-match' };
    }

    // Gramaje → fabric/tela material
    if (/gramaje|g\/m[²2]/i.test(allText)) {
        const fabricMats = amfeMaterials.filter(m => /tela|tejido|textil|pes\s|tnt\s|jacquard|termoform/i.test(m));
        if (fabricMats.length > 0) return { material: fabricMats[0], rule: 'char-gramaje' };
        if (mainMaterial) return { material: mainMaterial, rule: 'char-gramaje-main' };
        return { material: '', rule: 'no-match' };
    }

    // Densidad → espuma/foam
    if (/densidad/i.test(allText)) {
        const foamMats = amfeMaterials.filter(m => /espuma|foam|pur\b/i.test(m));
        if (foamMats.length > 0) return { material: foamMats[0], rule: 'char-densidad' };
        return { material: 'Espuma PUR', rule: 'char-densidad-generic' };
    }

    // Peso → espuma (typically foam weight check)
    if (/peso\b/i.test(prodChar)) {
        const foamMats = amfeMaterials.filter(m => /espuma|foam|pur\b/i.test(m));
        if (foamMats.length > 0) return { material: foamMats[0], rule: 'char-peso' };
        return { material: '', rule: 'no-match' };
    }

    // Estado del material → main material
    if (/estado\s*(del\s*)?material/i.test(allText)) {
        if (mainMaterial) return { material: mainMaterial, rule: 'char-estado' };
        return { material: '', rule: 'no-match' };
    }

    // Identificacion de lote/material → main material
    if (/identificaci[oó]n\s*(del?\s*)?(material|lote)/i.test(allText)) {
        if (mainMaterial) return { material: mainMaterial, rule: 'char-identificacion' };
        return { material: '', rule: 'no-match' };
    }

    // Color de componente → main material
    if (/color/i.test(prodChar) && !/vinilo|pvc/i.test(allText)) {
        if (mainMaterial) return { material: mainMaterial, rule: 'char-color' };
        return { material: '', rule: 'no-match' };
    }

    // Ensamblar componente con color equivocado → main material
    if (/ensamblar.*color|color.*equivocado/i.test(allText)) {
        if (mainMaterial) return { material: mainMaterial, rule: 'char-color-equivocado' };
        return { material: '', rule: 'no-match' };
    }

    // ──────────────────────────────────────────────────────────────────
    // GENERIC items: documentation, contamination, damage, etc.
    // These apply to ALL materials → assign main material
    // ──────────────────────────────────────────────────────────────────

    // Falta de documentacion / trazabilidad
    if (/falta.*document|trazabilidad|remito|certificado/i.test(allText)) {
        if (mainMaterial) return { material: mainMaterial, rule: 'generic-documentacion' };
        return { material: '', rule: 'no-match' };
    }

    // Contaminacion / suciedad
    if (/contaminaci[oó]n|suciedad/i.test(allText)) {
        if (mainMaterial) return { material: mainMaterial, rule: 'generic-contaminacion' };
        return { material: '', rule: 'no-match' };
    }

    // Material golpeado / danado
    if (/golpead|da[nñ]ad|transporte/i.test(allText)) {
        if (mainMaterial) return { material: mainMaterial, rule: 'generic-danio' };
        return { material: '', rule: 'no-match' };
    }

    // Mala estiba / embalaje
    if (/estiba|embalaje\s*inadecuad/i.test(allText)) {
        if (mainMaterial) return { material: mainMaterial, rule: 'generic-estiba' };
        return { material: '', rule: 'no-match' };
    }

    // Manipulacion incorrecta
    if (/manipulaci[oó]n/i.test(allText)) {
        if (mainMaterial) return { material: mainMaterial, rule: 'generic-manipulacion' };
        return { material: '', rule: 'no-match' };
    }

    // Almacenaje inadecuado
    if (/almacenaje|almacenamiento/i.test(allText)) {
        if (mainMaterial) return { material: mainMaterial, rule: 'generic-almacenaje' };
        return { material: '', rule: 'no-match' };
    }

    // Proveedor-related (tolerancias, trazabilidad, etc.)
    if (/proveedor/i.test(allText)) {
        if (mainMaterial) return { material: mainMaterial, rule: 'generic-proveedor' };
        return { material: '', rule: 'no-match' };
    }

    // Error en orden de compra / ficha tecnica
    if (/orden\s*de\s*compra|ficha\s*t[eé]cnica/i.test(allText)) {
        if (mainMaterial) return { material: mainMaterial, rule: 'generic-orden-compra' };
        return { material: '', rule: 'no-match' };
    }

    // Ambiente sucio
    if (/ambiente\s*sucio/i.test(allText)) {
        if (mainMaterial) return { material: mainMaterial, rule: 'generic-ambiente' };
        return { material: '', rule: 'no-match' };
    }

    // Sistema ARB
    if (/sistema\s*arb|arb\b/i.test(allText)) {
        if (mainMaterial) return { material: mainMaterial, rule: 'generic-arb' };
        return { material: '', rule: 'no-match' };
    }

    // Procesos administrativos
    if (/administrativ|proceso.*deficiente/i.test(allText)) {
        if (mainMaterial) return { material: mainMaterial, rule: 'generic-admin' };
        return { material: '', rule: 'no-match' };
    }

    // Iluminacion
    if (/iluminaci[oó]n/i.test(allText)) {
        if (mainMaterial) return { material: mainMaterial, rule: 'generic-iluminacion' };
        return { material: '', rule: 'no-match' };
    }

    // Condiciones ambientales
    if (/condiciones\s*ambiental/i.test(allText)) {
        if (mainMaterial) return { material: mainMaterial, rule: 'generic-condiciones' };
        return { material: '', rule: 'no-match' };
    }

    // Inspeccion visual / omision de verificacion
    if (/inspecci[oó]n\s*visual|verificaci[oó]n|omisi[oó]n/i.test(allText)) {
        if (mainMaterial) return { material: mainMaterial, rule: 'generic-inspeccion' };
        return { material: '', rule: 'no-match' };
    }

    // Autocontrol visual general
    if (/autocontrol\s*visual/i.test(allText)) {
        if (mainMaterial) return { material: mainMaterial, rule: 'generic-autocontrol' };
        return { material: '', rule: 'no-match' };
    }

    // ── No match → leave empty ──
    return { material: '', rule: 'no-match' };
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN: Assign componentMaterial to CP reception items
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== Assigning componentMaterial to CP reception items ===');

const stats = {
    totalReceptionItems: 0,
    alreadyAssigned: 0,
    assigned: 0,
    leftEmpty: 0,
    noAmfe: 0,
    nonReception: 0,
    byProduct: {},
    byRule: {},
};

const changedCpIds = new Set();

for (const cpDoc of cpDocs) {
    const productName = cpDoc.project_name || cpDoc.part_name || cpDoc.part_number || 'Unknown';
    const items = cpDoc.data?.items || [];
    const amfeDoc = findAmfeForCp(cpDoc);
    const family = detectFamily(productName);
    const mainMaterial = family ? (FAMILY_MAIN_MATERIAL[family] || '') : '';

    let amfeMaterials = [];
    if (amfeDoc) {
        amfeMaterials = extractMaterialsFromAmfe(amfeDoc);
    }

    const productStats = {
        totalReception: 0,
        alreadyAssigned: 0,
        assigned: 0,
        leftEmpty: 0,
        noAmfe: !amfeDoc,
        family: family || '?',
        amfeMaterials: amfeMaterials.join(' / '),
        mainMaterial,
    };

    console.log(`\n--- ${productName} [${family || 'UNKNOWN'}] ---`);
    if (!amfeDoc) {
        console.log(`  WARNING: No linked AMFE found`);
    } else {
        console.log(`  AMFE: ${amfeDoc.project_name || amfeDoc.id}`);
        console.log(`  AMFE OP 10 materials: ${amfeMaterials.length > 0 ? amfeMaterials.join(' / ') : '(none found)'}`);
    }
    console.log(`  Main material: ${mainMaterial || '(none)'}`);

    for (const item of items) {
        if (!isReception(item.processStepNumber)) {
            stats.nonReception++;
            continue;
        }

        stats.totalReceptionItems++;
        productStats.totalReception++;

        // Already has material assigned
        if (item.componentMaterial && item.componentMaterial.trim()) {
            stats.alreadyAssigned++;
            productStats.alreadyAssigned++;
            continue;
        }

        // Try to match
        const { material, rule } = matchMaterial(item, amfeMaterials, mainMaterial);
        stats.byRule[rule] = (stats.byRule[rule] || 0) + 1;

        if (material) {
            const charPreview = (item.productCharacteristic || item.processCharacteristic || '').slice(0, 60);
            console.log(`  ASSIGN: OP ${item.processStepNumber} "${charPreview}" -> "${material}" [${rule}]`);
            item.componentMaterial = material;
            stats.assigned++;
            productStats.assigned++;
            changedCpIds.add(cpDoc.id);
        } else {
            const charPreview = (item.productCharacteristic || item.processCharacteristic || '').slice(0, 60);
            console.log(`  EMPTY:  OP ${item.processStepNumber} "${charPreview}" -> (no match) [${rule}]`);
            stats.leftEmpty++;
            productStats.leftEmpty++;
        }
    }

    stats.byProduct[productName] = productStats;
}

// ═══════════════════════════════════════════════════════════════════════
// SAVE
// ═════════��═════════════════════════════════════════════════════════════
console.log('\n=== Saving ===');

if (DRY_RUN) {
    console.log('  DRY RUN — no changes saved');
    console.log(`  Would update ${changedCpIds.size} CP documents`);
} else {
    let savedCount = 0;
    let errorCount = 0;

    for (const doc of cpDocs) {
        if (!changedCpIds.has(doc.id)) continue;

        const { error } = await supabase
            .from('cp_documents')
            .update({ data: doc.data })
            .eq('id', doc.id);
        if (error) {
            console.error(`  ERROR saving CP ${doc.project_name}: ${error.message}`);
            errorCount++;
        } else {
            savedCount++;
        }
    }

    console.log(`  ${savedCount} documents saved${errorCount > 0 ? `, ${errorCount} errors` : ''}`);
}

// ═══════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════
console.log('\n=== Summary ===');
console.log(`  Total reception items: ${stats.totalReceptionItems}`);
console.log(`  Already assigned: ${stats.alreadyAssigned}`);
console.log(`  Newly assigned: ${stats.assigned}`);
console.log(`  Left empty (no match): ${stats.leftEmpty}`);
console.log(`  Non-reception items (skipped): ${stats.nonReception}`);

console.log('\n=== By Product ===');
for (const [prod, s] of Object.entries(stats.byProduct)) {
    const flag = s.noAmfe ? ' [NO AMFE]' : '';
    console.log(`  ${prod} [${s.family}]${flag}:`);
    console.log(`    Reception: ${s.totalReception} | Already: ${s.alreadyAssigned} | Assigned: ${s.assigned} | Empty: ${s.leftEmpty}`);
    console.log(`    Main material: ${s.mainMaterial || '(none)'}`);
    if (s.amfeMaterials) {
        console.log(`    AMFE materials: ${s.amfeMaterials}`);
    }
}

console.log('\n=== By Rule ===');
for (const [rule, count] of Object.entries(stats.byRule).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${rule}: ${count}`);
}

console.log(`\n${DRY_RUN ? 'DRY RUN completed (no changes saved)' : 'Fix completed successfully'}`);
process.exit(0);
