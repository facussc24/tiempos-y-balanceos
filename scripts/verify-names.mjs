#!/usr/bin/env node
/**
 * Verify all team name fields across AMFE, CP, HO, PFD documents in Supabase.
 * Reports unique values for each field and flags any empty ones.
 */
import { initSupabase, selectSql, close } from './supabaseHelper.mjs';

await initSupabase();

console.log('\n=== VERIFICATION: Unique team name values in Supabase ===\n');

// --- AMFE ---
const amfes = await selectSql('SELECT id, amfe_number, responsible, data FROM amfe_documents');
console.log(`\n--- AMFE (${amfes.length} docs) ---`);

const amfeFields = { responsible_col: new Set(), responsible_hdr: new Set(), processResponsible: new Set(), team: new Set(), approvedBy: new Set() };
const amfeEmpty = [];

for (const row of amfes) {
    const doc = JSON.parse(row.data);
    const h = doc.header || {};
    amfeFields.responsible_col.add(row.responsible || '(EMPTY)');
    amfeFields.responsible_hdr.add(h.responsible || '(EMPTY)');
    amfeFields.processResponsible.add(h.processResponsible || '(EMPTY)');
    amfeFields.team.add(h.team || '(EMPTY)');
    amfeFields.approvedBy.add(h.approvedBy || '(EMPTY)');

    const empties = [];
    if (!h.responsible) empties.push('responsible');
    if (!h.processResponsible) empties.push('processResponsible');
    if (!h.team) empties.push('team');
    if (!h.approvedBy) empties.push('approvedBy');
    if (empties.length) amfeEmpty.push(`  ${row.amfe_number}: ${empties.join(', ')}`);
}

for (const [field, vals] of Object.entries(amfeFields)) {
    console.log(`  ${field}: ${[...vals].join(' | ')}`);
}
if (amfeEmpty.length) {
    console.log(`  EMPTY FIELDS:\n${amfeEmpty.join('\n')}`);
} else {
    console.log('  No empty fields!');
}

// --- CP ---
const cps = await selectSql('SELECT id, control_plan_number, project_name, responsible, data FROM cp_documents');
console.log(`\n--- CP (${cps.length} docs) ---`);

const cpFields = { responsible_col: new Set(), responsible_hdr: new Set(), approvedBy: new Set(), coreTeam: new Set() };
const cpEmpty = [];

for (const row of cps) {
    const doc = JSON.parse(row.data);
    const h = doc.header || {};
    cpFields.responsible_col.add(row.responsible || '(EMPTY)');
    cpFields.responsible_hdr.add(h.responsible || '(EMPTY)');
    cpFields.approvedBy.add(h.approvedBy || '(EMPTY)');
    cpFields.coreTeam.add(h.coreTeam || '(EMPTY)');

    const empties = [];
    if (!h.responsible) empties.push('responsible');
    if (!h.approvedBy) empties.push('approvedBy');
    if (!h.coreTeam) empties.push('coreTeam');
    if (empties.length) cpEmpty.push(`  ${row.control_plan_number || row.project_name}: ${empties.join(', ')}`);
}

for (const [field, vals] of Object.entries(cpFields)) {
    console.log(`  ${field}: ${[...vals].join(' | ')}`);
}
if (cpEmpty.length) {
    console.log(`  EMPTY FIELDS:\n${cpEmpty.join('\n')}`);
} else {
    console.log('  No empty fields!');
}

// --- HO ---
const hos = await selectSql('SELECT id, part_description, data FROM ho_documents');
console.log(`\n--- HO (${hos.length} docs) ---`);

const hoFields = { preparedBy: new Set(), approvedBy: new Set() };
const hoEmpty = [];
let totalSheets = 0;

for (const row of hos) {
    const doc = JSON.parse(row.data);
    for (const sheet of (doc.sheets || [])) {
        totalSheets++;
        hoFields.preparedBy.add(sheet.preparedBy || '(EMPTY)');
        hoFields.approvedBy.add(sheet.approvedBy || '(EMPTY)');

        const empties = [];
        if (!sheet.preparedBy) empties.push('preparedBy');
        if (!sheet.approvedBy) empties.push('approvedBy');
        if (empties.length) hoEmpty.push(`  ${row.part_description} / ${sheet.operationName || sheet.id}: ${empties.join(', ')}`);
    }
}

console.log(`  Total sheets: ${totalSheets}`);
for (const [field, vals] of Object.entries(hoFields)) {
    console.log(`  ${field}: ${[...vals].join(' | ')}`);
}
if (hoEmpty.length) {
    console.log(`  EMPTY FIELDS (${hoEmpty.length} sheets):\n${hoEmpty.slice(0, 5).join('\n')}${hoEmpty.length > 5 ? `\n  ...and ${hoEmpty.length - 5} more` : ''}`);
} else {
    console.log('  No empty fields!');
}

// --- PFD ---
const pfds = await selectSql('SELECT id, part_name, data FROM pfd_documents');
console.log(`\n--- PFD (${pfds.length} docs) ---`);

const pfdFields = { preparedBy: new Set(), approvedBy: new Set(), coreTeam: new Set(), keyContact: new Set() };
const pfdEmpty = [];

for (const row of pfds) {
    const doc = JSON.parse(row.data);
    const h = doc.header || {};
    pfdFields.preparedBy.add(h.preparedBy || '(EMPTY)');
    pfdFields.approvedBy.add(h.approvedBy || '(EMPTY)');
    pfdFields.coreTeam.add(h.coreTeam || '(EMPTY)');
    pfdFields.keyContact.add(h.keyContact || '(EMPTY)');

    const empties = [];
    if (!h.preparedBy) empties.push('preparedBy');
    if (!h.approvedBy) empties.push('approvedBy');
    if (!h.coreTeam) empties.push('coreTeam');
    if (!h.keyContact) empties.push('keyContact');
    if (empties.length) pfdEmpty.push(`  ${row.part_name}: ${empties.join(', ')}`);
}

for (const [field, vals] of Object.entries(pfdFields)) {
    console.log(`  ${field}: ${[...vals].join(' | ')}`);
}
if (pfdEmpty.length) {
    console.log(`  EMPTY FIELDS:\n${pfdEmpty.join('\n')}`);
} else {
    console.log('  No empty fields!');
}

console.log('\n=== VERIFICATION COMPLETE ===\n');

close();
