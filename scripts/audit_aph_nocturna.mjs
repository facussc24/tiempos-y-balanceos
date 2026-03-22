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

// AP table — uses shared AIAG-VDA 2019 module
import { calcAP } from './apTableShared.mjs';

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
