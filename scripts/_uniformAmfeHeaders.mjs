/**
 * _uniformAmfeHeaders.mjs — Limpiar headers de los 12 AMFEs Barack Mercosul
 *
 * Aplica merge no-destructivo de campos comunes a TODOS los AMFEs:
 *  - organization, companyName: BARACK MERCOSUL
 *  - location: PLANTA HURLINGHAM
 *  - coreTeam (array): Carlos Baptista, Manuel Meszaros, Marianna Vera
 *  - elaboratedBy / reviewedBy / preparedBy / approvedBy / plantApproval
 *  - responsibleEngineer / processResponsible: Carlos Baptista
 *  - confidentiality: Confidencial
 *
 * Casos especiales:
 *  - VWA-PAT-IPPADS-001: cambia responsible Leonardo Lattanzi -> Carlos Baptista
 *    (preserva originalAuthor para trazabilidad)
 *  - 150 (legacy): refactor a estructura moderna pero preserva preparedBy=Paulo Centurion
 *  - AMFE-1, AMFE-2: sincroniza columnas metadata vacias con header JSON
 *
 * NO se tocan: client, partNumber, subject, scope, applicableParts, rev,
 *              amfeDate, revDate, startDate, modelYear.
 *
 * NO modifica data.operations — solo data.header. NO requiere validator gate
 * (validator solo audita operations[]).
 *
 * Run:   node scripts/_uniformAmfeHeaders.mjs              (dry-run)
 *        node scripts/_uniformAmfeHeaders.mjs --apply      (commit)
 */

import { connectSupabase, readAmfe, saveAmfe } from './_lib/amfeIo.mjs';
import { parseSafeArgs, logChange, finish } from './_lib/dryRunGuard.mjs';

const STANDARD = {
    organization: 'BARACK MERCOSUL',
    companyName: 'BARACK MERCOSUL',
    location: 'PLANTA HURLINGHAM',
    coreTeam: [
        'Carlos Baptista (Ingenieria)',
        'Manuel Meszaros (Calidad)',
        'Marianna Vera (Produccion)',
    ],
    elaboratedBy: 'Carlos Baptista',
    preparedBy: 'Facundo Santoro',
    reviewedBy: 'Carlos Baptista',
    approvedBy: 'Gonzalo Cal',
    plantApproval: 'Gonzalo Cal',
    responsibleEngineer: 'Carlos Baptista',
    processResponsible: 'Carlos Baptista',
    confidentiality: 'Confidencial',
};

// Campos que NUNCA tocamos
const PRESERVED_KEYS = new Set([
    'client', 'customerName', 'partNumber', 'subject', 'scope', 'applicableParts',
    'rev', 'revisionLevel', 'amfeDate', 'revDate', 'revisionDate', 'startDate',
    'modelYear', 'amfeNumber', 'projectCode',
]);

function isEmpty(v) {
    if (v === null || v === undefined) return true;
    if (typeof v === 'string' && v.trim() === '') return true;
    if (Array.isArray(v) && v.length === 0) return true;
    return false;
}

function mergeStandard(header, options = {}) {
    const changes = [];
    for (const [key, std] of Object.entries(STANDARD)) {
        if (PRESERVED_KEYS.has(key)) continue;
        if (options.skip && options.skip.has(key)) continue;
        const current = header[key];
        if (isEmpty(current)) {
            header[key] = Array.isArray(std) ? [...std] : std;
            changes.push(`+${key}=${JSON.stringify(header[key]).slice(0, 50)}`);
        } else if (Array.isArray(std) && Array.isArray(current)) {
            // Si el current es un array distinto del estandar, mantenerlo (puede ser intencional)
        }
    }
    return changes;
}

const TARGETS = [
    { amfeNumber: 'VWA-PAT-IPPADS-001', special: 'ipPadResponsible' },
    { amfeNumber: 'AMFE-HF-PAT' },
    { amfeNumber: 'AMFE-HRC-PAT' },
    { amfeNumber: 'AMFE-HRO-PAT' },
    { amfeNumber: 'AMFE-INS-PAT' },
    { amfeNumber: 'AMFE-ARM-PAT' },
    { amfeNumber: 'AMFE-TR-PAT' },
    { amfeNumber: 'AMFE-1' },
    { amfeNumber: 'AMFE-2' },
    { amfeNumber: 'AMFE-MAESTRO-INY-001' },
    { amfeNumber: 'AMFE-MAESTRO-LOG-REC-001' },
    { amfeNumber: '150', special: 'legacyRefactor' },
];

async function main() {
    const { apply } = parseSafeArgs();
    const sb = await connectSupabase();

    // Lookup id por amfe_number
    const { data: rows, error } = await sb.from('amfe_documents')
        .select('id, amfe_number, organization, responsible, start_date, last_revision_date');
    if (error) throw error;
    const byNum = Object.fromEntries(rows.map(r => [r.amfe_number, r]));

    for (const target of TARGETS) {
        const meta = byNum[target.amfeNumber];
        if (!meta) {
            console.log(`SKIP ${target.amfeNumber}: no encontrado`);
            continue;
        }

        const { doc } = await readAmfe(sb, meta.id);
        if (!doc.header) doc.header = {};
        const header = doc.header;

        const changes = [];
        const extraFields = {};

        // Caso especial: IP PAD — cambiar responsible Lattanzi -> Carlos
        if (target.special === 'ipPadResponsible') {
            if (header.responsible && /lattanzi/i.test(header.responsible)) {
                if (!header.originalAuthor) {
                    header.originalAuthor = header.responsible;
                    changes.push(`+originalAuthor=${header.responsible}`);
                }
                header.responsible = 'Carlos Baptista';
                changes.push(`responsible: Lattanzi -> Carlos Baptista`);
            }
            if (header.processResponsible && /lattanzi/i.test(header.processResponsible)) {
                header.processResponsible = 'Carlos Baptista';
                changes.push(`processResponsible: Lattanzi -> Carlos Baptista`);
            }
        }

        // Caso especial: AMFE 150 legacy — convertir coreTeam string -> array
        if (target.special === 'legacyRefactor') {
            if (typeof header.coreTeam === 'string') {
                const original = header.coreTeam;
                header._coreTeamLegacy = original;  // preservar
                header.coreTeam = [...STANDARD.coreTeam];  // estandar moderno
                changes.push(`coreTeam: string -> array (preservado en _coreTeamLegacy)`);
            }
            // 150 mantiene preparedBy=Paulo Centurion (su autor original)
            if (!header.preparedBy && header.responsibleEngineer) {
                header.preparedBy = header.responsibleEngineer;
                changes.push(`+preparedBy=${header.preparedBy}`);
            }
        }

        // Merge estandar (no destructivo)
        // Para AMFE 150, NO tocar preparedBy ni responsibleEngineer (Paulo es su autor)
        const skipForLegacy = target.special === 'legacyRefactor'
            ? new Set(['preparedBy', 'responsibleEngineer', 'processResponsible'])
            : null;
        const mergeChanges = mergeStandard(header, { skip: skipForLegacy });
        changes.push(...mergeChanges);

        // Sincronizar columnas metadata si vacias
        if (isEmpty(meta.organization) && header.organization) {
            extraFields.organization = header.organization;
            changes.push(`metadata.organization sync from header: ${header.organization}`);
        }
        if (isEmpty(meta.responsible) && (header.elaboratedBy || header.responsible)) {
            extraFields.responsible = header.elaboratedBy || header.responsible;
            changes.push(`metadata.responsible sync from header: ${extraFields.responsible}`);
        }
        // Fechas: solo si metadata esta vacia, copiar de header (manteniendo formato)
        if (isEmpty(meta.start_date) && (header.startDate || header.amfeDate)) {
            const raw = header.startDate || header.amfeDate;
            // Si formato DD/MM/YYYY, convertir a YYYY-MM-DD
            const m = String(raw).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            extraFields.start_date = m ? `${m[3]}-${m[2]}-${m[1]}` : raw;
            changes.push(`metadata.start_date sync: ${extraFields.start_date}`);
        }
        if (isEmpty(meta.last_revision_date) && (header.revDate || header.revisionDate)) {
            const raw = header.revDate || header.revisionDate;
            const m = String(raw).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            extraFields.last_revision_date = m ? `${m[3]}-${m[2]}-${m[1]}` : raw;
            changes.push(`metadata.last_revision_date sync: ${extraFields.last_revision_date}`);
        }

        if (changes.length === 0) {
            console.log(`[${target.amfeNumber}] sin cambios necesarios`);
            continue;
        }

        logChange(apply, `[${target.amfeNumber}] ${changes.length} cambios`, {
            cambios: changes.join(' | '),
        });

        if (apply) {
            await saveAmfe(sb, meta.id, doc, {
                expectedAmfeNumber: target.amfeNumber,
                extraFields: Object.keys(extraFields).length > 0 ? extraFields : undefined,
            });
        }
    }

    finish(apply);
}

main().catch(e => { console.error(e); process.exit(1); });
