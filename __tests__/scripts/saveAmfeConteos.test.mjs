/**
 * Test de que `saveAmfe()` mantiene sincronizados `operation_count` y `cause_count`.
 *
 * Esas dos columnas son DERIVADAS del JSON, y hasta el 31/08/2026 ningun camino de escritura
 * las mantenia: quedaban con el valor de la primera carga. Lo encontro el agente auditor
 * despues de podar 6 causas en cada apoyacabezas — `cause_count` seguia diciendo 184/178/175
 * cuando el real era 178/172/169 — y en la misma pasada aparecieron dos documentos que esa
 * tanda no habia tocado y tambien estaban desfasados (el 150 y el Top Roll, este con 29 de
 * diferencia). O sea: el agujero venia de antes y de cualquier script, no de uno solo.
 *
 * Sin este test, el arreglo se puede revertir y nadie se entera hasta la proxima auditoria:
 * un conteo mal no rompe nada visible, solo miente.
 *
 * El stub de Supabase implementa lo minimo que saveAmfe usa: `.from().update().eq()` para
 * escribir y `.from().select().eq().single()` para el round-trip de verificacion.
 */
import { describe, it, expect } from 'vitest';
import { saveAmfe, countAmfeStats } from '../../scripts/_lib/amfeIo.mjs';

/** AMFE minimo con la cantidad de operaciones y causas que se le pidan. */
function docCon(nOps, nCausasPorOp) {
    return {
        header: { rev: 'A' },
        operations: Array.from({ length: nOps }, (_, i) => ({
            opNumber: String((i + 1) * 10), operationNumber: String((i + 1) * 10),
            name: `OPERACION ${i + 1}`, operationName: `OPERACION ${i + 1}`,
            workElements: [{
                name: 'Vinilo PVC', type: 'Material',
                functions: [{
                    description: 'Aportar el vinilo conforme', functionDescription: 'Aportar el vinilo conforme',
                    failures: [{
                        description: 'Material fuera de norma', severity: 6,
                        effectLocal: 'Scrap', effectNextLevel: 'Para linea', effectEndUser: 'Riesgo',
                        causes: Array.from({ length: nCausasPorOp }, (_, c) => ({
                            cause: `Causa ${c + 1}`, description: `Causa ${c + 1}`,
                            preventionControl: 'Certificado del proveedor (P-14)',
                            detectionControl: 'Inspeccion visual 100%',
                            occurrence: 4, detection: 7, ap: 'M', actionPriority: 'M',
                        })),
                    }],
                }],
            }],
        })),
    };
}

/** Stub de Supabase que captura el payload del update y devuelve el doc para el round-trip. */
function stubSupabase() {
    const capturado = {};
    return {
        capturado,
        from() {
            return {
                update(payload) {
                    Object.assign(capturado, payload);
                    return { eq: async () => ({ error: null }) };
                },
                select() {
                    return {
                        eq() {
                            return { single: async () => ({ data: { data: capturado.data }, error: null }) };
                        },
                    };
                },
            };
        },
    };
}

describe('saveAmfe mantiene los conteos de la fila', () => {
    it('escribe operation_count y cause_count calculados del documento', async () => {
        const sb = stubSupabase();
        const doc = docCon(3, 4);            // 3 operaciones, 4 causas cada una = 12
        await saveAmfe(sb, 'id-1', doc);

        expect(sb.capturado.operation_count).toBe(3);
        expect(sb.capturado.cause_count).toBe(12);
        expect(sb.capturado.operation_count).toBe(countAmfeStats(doc).opCount);
        expect(sb.capturado.cause_count).toBe(countAmfeStats(doc).causeCount);
    });

    it('los baja cuando el documento perdio causas — el caso que fallaba', async () => {
        // Es lo que paso al podar el bloque de marcado: el documento perdio 6 causas y la
        // columna se quedo con el numero viejo.
        const sb = stubSupabase();
        await saveAmfe(sb, 'id-1', docCon(2, 5));      // 10 causas
        expect(sb.capturado.cause_count).toBe(10);

        await saveAmfe(sb, 'id-1', docCon(2, 2));      // ahora 4
        expect(sb.capturado.cause_count).toBe(4);
    });

    it('sigue guardando data como string y actualizando updated_at', async () => {
        const sb = stubSupabase();
        await saveAmfe(sb, 'id-1', docCon(1, 1));
        expect(typeof sb.capturado.data).toBe('string');
        expect(sb.capturado.updated_at).toBeTruthy();
    });

    it('extraFields sigue pudiendo pisar lo que el helper pone', async () => {
        const sb = stubSupabase();
        await saveAmfe(sb, 'id-1', docCon(2, 3), { extraFields: { cause_count: 99 } });
        expect(sb.capturado.cause_count).toBe(99);
    });
});
