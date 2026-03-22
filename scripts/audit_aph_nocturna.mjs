#!/usr/bin/env node
/**
 * Audit AP=H causes from Supabase AMFE documents
 * Reads all AMFE docs, parses data JSON, extracts all causes with AP=H,
 * verifies correctness against AIAG-VDA 2019 AP table.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Read .env.local
const envPath = resolve('C:/dev/BarackMercosul/.env.local');
const envContent = readFileSync(envPath, 'utf-8');
function getEnv(key) {
    const match = envContent.match(new RegExp(`^${key}=(.+)$`, 'm'));
    if (!match) throw new Error(`Missing ${key}`);
    return match[1].trim();
}

const supabase = createClient(
    getEnv('VITE_SUPABASE_URL'),
    getEnv('VITE_SUPABASE_ANON_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } }
);

// Login
const { error: authErr } = await supabase.auth.signInWithPassword({
    email: getEnv('VITE_AUTO_LOGIN_EMAIL'),
    password: getEnv('VITE_AUTO_LOGIN_PASSWORD'),
});
if (authErr) throw new Error('Auth failed: ' + authErr.message);

// Build AP table (exact replica of apTable.ts)
function buildAPTable() {
    const table = Array.from({ length: 11 }, () =>
        Array.from({ length: 11 }, () => Array(11).fill('L'))
    );
    // S=10
    for (let o = 1; o <= 10; o++) for (let d = 1; d <= 10; d++) {
        if (o <= 2 && d <= 2) table[10][o][d] = 'M';
        else if (o === 1 && d <= 3) table[10][o][d] = 'M';
        else table[10][o][d] = 'H';
    }
    // S=9
    for (let o = 1; o <= 10; o++) for (let d = 1; d <= 10; d++) {
        if (o <= 2 && d <= 3) table[9][o][d] = 'M';
        else if (o <= 3 && d <= 2) table[9][o][d] = 'M';
        else table[9][o][d] = 'H';
    }
    // S=8
    for (let o = 1; o <= 10; o++) for (let d = 1; d <= 10; d++) {
        if (o <= 2 && d <= 3) table[8][o][d] = 'L';
        else if (o <= 3 && d <= 4) table[8][o][d] = 'M';
        else if (o <= 4 && d <= 3) table[8][o][d] = 'M';
        else if (o >= 7 || d >= 7) table[8][o][d] = 'H';
        else table[8][o][d] = 'M';
    }
    // S=7
    for (let o = 1; o <= 10; o++) for (let d = 1; d <= 10; d++) {
        if (o <= 2 && d <= 3) table[7][o][d] = 'L';
        else if (o <= 3 && d <= 5) table[7][o][d] = 'L';
        else if (o <= 5 && d <= 3) table[7][o][d] = 'L';
        else if (o >= 8 || d >= 8) table[7][o][d] = 'H';
        else if (o >= 6 && d >= 6) table[7][o][d] = 'H';
        else table[7][o][d] = 'M';
    }
    // S=6
    for (let o = 1; o <= 10; o++) for (let d = 1; d <= 10; d++) {
        if (o <= 3 && d <= 5) table[6][o][d] = 'L';
        else if (o <= 5 && d <= 3) table[6][o][d] = 'L';
        else if (o >= 8 && d >= 8) table[6][o][d] = 'H';
        else if (o >= 9 || d >= 9) table[6][o][d] = 'H';
        else if (o >= 7 && d >= 7) table[6][o][d] = 'H';
        else table[6][o][d] = 'M';
    }
    // S=5
    for (let o = 1; o <= 10; o++) for (let d = 1; d <= 10; d++) {
        if (o <= 4 && d <= 5) table[5][o][d] = 'L';
        else if (o <= 5 && d <= 4) table[5][o][d] = 'L';
        else if (o >= 8 && d >= 8) table[5][o][d] = 'H';
        else if (o >= 9 && d >= 6) table[5][o][d] = 'H';
        else if (o >= 6 && d >= 9) table[5][o][d] = 'H';
        else table[5][o][d] = 'M';
    }
    // S=4
    for (let o = 1; o <= 10; o++) for (let d = 1; d <= 10; d++) {
        if (o <= 5 && d <= 6) table[4][o][d] = 'L';
        else if (o <= 6 && d <= 5) table[4][o][d] = 'L';
        else if (o >= 9 && d >= 9) table[4][o][d] = 'H';
        else table[4][o][d] = 'M';
    }
    // S=3
    for (let o = 1; o <= 10; o++) for (let d = 1; d <= 10; d++) {
        if (o >= 10 && d >= 10) table[3][o][d] = 'M';
        else if (o >= 9 && d >= 9) table[3][o][d] = 'M';
        else table[3][o][d] = 'L';
    }
    // S=2
    for (let o = 1; o <= 10; o++) for (let d = 1; d <= 10; d++) {
        if (o >= 10 && d >= 10) table[2][o][d] = 'M';
        else table[2][o][d] = 'L';
    }
    return table;
}

const apTable = buildAPTable();
function calcAP(s, o, d) {
    if (isNaN(s) || isNaN(o) || isNaN(d)) return '';
    const sInt = Math.round(s);
    const oInt = Math.round(o);
    const dInt = Math.round(d);
    if (sInt < 1 || sInt > 10 || oInt < 1 || oInt > 10 || dInt < 1 || dInt > 10) return '';
    return apTable[sInt][oInt][dInt];
}

// Query AMFE documents
const { data: rows, error: qErr } = await supabase.rpc('exec_sql_read', {
    query: 'SELECT id, amfe_number, project_name, data, ap_h_count FROM amfe_documents ORDER BY amfe_number',
    params: []
});
if (qErr) throw new Error('Query failed: ' + qErr.message);

const docs = rows || [];
console.error('Found ' + docs.length + ' AMFE documents');

let totalCauses = 0;
let totalApH = 0;
let aphCorrect = 0;
let aphInflated = 0;
let aphNoAction = 0;
let aphLowSeverity = 0;
let aphIncompleteSOD = 0;

const causesWithoutAction = [];
const inflatedCauses = [];
const lowSeverityCauses = [];
const summaryByDoc = [];

for (const doc of docs) {
    let docData;
    try {
        docData = JSON.parse(doc.data);
    } catch {
        console.error('  Failed to parse data for ' + doc.amfe_number);
        continue;
    }

    const operations = docData.operations || [];
    let docApH = 0;
    let docApHCorrect = 0;
    let docApHInflated = 0;
    let docApHNoAction = 0;

    for (const op of operations) {
        for (const we of (op.workElements || [])) {
            for (const fn of (we.functions || [])) {
                for (const fail of (fn.failures || [])) {
                    const severity = Number(fail.severity);

                    for (const cause of (fail.causes || [])) {
                        totalCauses++;
                        const ap = String(cause.ap || '').toUpperCase();
                        if (ap !== 'H') continue;

                        totalApH++;
                        docApH++;

                        const o = Number(cause.occurrence);
                        const d = Number(cause.detection);

                        // Check if S/O/D are all filled
                        if (!Number.isFinite(severity) || !Number.isFinite(o) || !Number.isFinite(d)) {
                            aphIncompleteSOD++;
                        }

                        // Verify AP calculation
                        const expectedAP = calcAP(severity, o, d);
                        if (expectedAP === 'H') {
                            aphCorrect++;
                            docApHCorrect++;
                        } else if (expectedAP === '') {
                            // incomplete data - already counted
                        } else {
                            aphInflated++;
                            docApHInflated++;
                            inflatedCauses.push({
                                amfe: doc.amfe_number,
                                project: doc.project_name,
                                op: op.opNumber + ' ' + op.name,
                                cause: (cause.cause || '').substring(0, 80),
                                s: severity, o, d,
                                expected: expectedAP,
                                actual: 'H'
                            });
                        }

                        // Check severity <= 4 with AP=H
                        if (Number.isFinite(severity) && severity <= 4) {
                            aphLowSeverity++;
                            lowSeverityCauses.push({
                                amfe: doc.amfe_number,
                                project: doc.project_name,
                                op: op.opNumber + ' ' + op.name,
                                cause: (cause.cause || '').substring(0, 80),
                                s: severity, o, d
                            });
                        }

                        // Check corrective action
                        const hasPreventionAction = cause.preventionAction && cause.preventionAction.trim() !== '';
                        const hasDetectionAction = cause.detectionAction && cause.detectionAction.trim() !== '';
                        if (!hasPreventionAction && !hasDetectionAction) {
                            aphNoAction++;
                            docApHNoAction++;
                            causesWithoutAction.push({
                                amfe: doc.amfe_number,
                                project: doc.project_name,
                                op: op.opNumber + ' ' + op.name,
                                cause: (cause.cause || '').substring(0, 80),
                                s: severity, o, d
                            });
                        }
                    }
                }
            }
        }
    }

    if (docApH > 0) {
        summaryByDoc.push({
            amfe: doc.amfe_number,
            project: doc.project_name,
            apH: docApH,
            correct: docApHCorrect,
            inflated: docApHInflated,
            noAction: docApHNoAction,
            dbApHCount: doc.ap_h_count
        });
    }
}

// Output JSON
console.log(JSON.stringify({
    totalDocs: docs.length,
    totalCauses,
    totalApH,
    aphCorrect,
    aphInflated,
    aphNoAction,
    aphLowSeverity,
    aphIncompleteSOD,
    causesWithoutAction,
    inflatedCauses,
    lowSeverityCauses,
    summaryByDoc
}, null, 2));

await supabase.auth.signOut();
