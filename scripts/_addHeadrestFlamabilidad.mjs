/**
 * _addHeadrestFlamabilidad.mjs — Agrega falla flamabilidad TL 1010 VW CC
 * en los 3 Headrest Patagonia, siguiendo el patron exacto de Insert/Armrest.
 *
 * Autorizado por Fak 2026-04-22 despues de verificar en PPAP servidor:
 *   - `17- Caracteristicas Especiales/I-PY-001.7 Listado carac. especiales prod-proc A.pdf`
 *     entry CC3: Inflamabilidad segun TL 1010 aplica a los 3 part numbers:
 *     2HC.881.901 (Front), 2HC.885.900 (Rear Cen), 2HC.885.901 (Rear Out).
 *
 * Replica textualmente el patron de Insert/Armrest (OP recepcion > WE Autoelevador)
 * por consistencia con los hermanos de cabina.
 */
import { randomUUID } from 'crypto';
import { parseSafeArgs, logChange, finish } from './_lib/dryRunGuard.mjs';
import { connectSupabase, readAmfe, saveAmfe, findOperation, normalizeText } from './_lib/amfeIo.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

const TARGETS = [
    { id: '10eaebce-ad87-4035-9343-3e20e4ee0fc9', num: 'AMFE-HF-PAT', label: 'HEADREST_FRONT' },
    { id: 'e9320798-ceaa-4623-97e9-92200b5234b6', num: 'AMFE-HRC-PAT', label: 'HEADREST_REAR_CEN' },
    { id: 'beda6d47-30ae-4d5f-81e0-468be8950014', num: 'AMFE-HRO-PAT', label: 'HEADREST_REAR_OUT' },
];

function buildFlamabilidadFailure() {
    return {
        id: randomUUID(),
        description: 'Material no cumple requisito de flamabilidad TL 1010 VW',
        effectLocal: 'Material no apto para uso',
        effectNextLevel: 'Paro de linea VW por incumplimiento normativo',
        effectEndUser: 'Riesgo de propagacion de fuego en habitaculo',
        severity: 9,
        causes: [{
            id: randomUUID(),
            description: 'Material fuera de especificacion requerida',
            cause: 'Material fuera de especificacion requerida',
            severity: 9,
            occurrence: 2,
            detection: 3,
            actionPriority: 'L',
            ap: 'L',
            preventionControl: 'Certificado de flamabilidad del proveedor segun TL 1010',
            detectionControl: 'Verificacion documental en recepcion',
            specialChar: 'CC',
            characteristicNumber: '',
            preventionAction: '',
            detectionAction: '',
            responsible: '',
            targetDate: '',
            status: '',
            actionTaken: '',
            completionDate: '',
        }],
    };
}

for (const t of TARGETS) {
    const { doc } = await readAmfe(sb, t.id);
    const op10 = findOperation(doc, '10');
    if (!op10) {
        console.warn(`  [SKIP] ${t.label}: no OP 10`);
        continue;
    }

    // Buscar WE Autoelevador (patron Insert/Armrest). Si no existe, crear uno de tipo Machine
    let we = (op10.workElements || []).find(w => normalizeText(w.name).includes('autoelevador'));

    if (!we) {
        we = {
            id: randomUUID(),
            type: 'Machine',
            name: 'Autoelevador',
            functions: [{
                id: randomUUID(),
                description: 'Trasladar materiales recibidos a zona de almacenamiento',
                functionDescription: 'Trasladar materiales recibidos a zona de almacenamiento',
                failures: [],
            }],
        };
        op10.workElements = op10.workElements || [];
        op10.workElements.push(we);
        logChange(apply, `${t.label} OP 10: CREATE WE "Autoelevador" (no existia)`, null);
    }

    // Asegurar function
    if (!we.functions || we.functions.length === 0) {
        we.functions = [{
            id: randomUUID(),
            description: 'Trasladar materiales recibidos a zona de almacenamiento',
            functionDescription: 'Trasladar materiales recibidos a zona de almacenamiento',
            failures: [],
        }];
    }
    const fn = we.functions[0];
    if (!Array.isArray(fn.failures)) fn.failures = [];

    // Chequear si ya existe la falla (idempotencia)
    const exists = fn.failures.some(f => normalizeText(f.description).includes('flamabilidad tl 1010'));
    if (exists) {
        console.log(`  [SKIP] ${t.label}: falla flamabilidad ya existe`);
        continue;
    }

    const newFailure = buildFlamabilidadFailure();
    fn.failures.push(newFailure);
    logChange(apply, `${t.label} OP 10 / Autoelevador: ADD failure "flamabilidad TL 1010 VW" (S=9, CC)`, null);

    if (apply) {
        await saveAmfe(sb, t.id, doc, { expectedAmfeNumber: t.num });
    }
}

finish(apply);
