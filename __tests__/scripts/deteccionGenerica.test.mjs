/**
 * DETECCION_GENERICA — el control de deteccion de una causa no dice CON QUE se detecta.
 *
 * Fak, 10/10/2026: "los detectivos del amfe no coinciden con los del plan de control o los amfes
 * de hoy tienen controles medio inventados o genericos". Medido el 11/10/2026 sobre los 21 AMFE
 * vivos: 1.269 de 2.080 causas detectan con un control generico («Visual» 138
 * veces, «Control visual del operario» 99, «Inspección visual» 62).
 *
 * Lo que estos tests protegen:
 *  - el aviso es el MISMO criterio del gate 8 del plan de control (una sola fuente:
 *    planControlCanon.data.json via controlCanon.mjs), para que AMFE y plan no digan cosas distintas;
 *  - avisa, nunca bloquea: no es CRITICAL y no frena un --apply ni el export;
 *  - no llama «visual generico» a un sensor, una alarma, un ensayo o un certificado (eso el
 *    catalogo todavia no lo tiene y va a otra bolsa), ni a la ausencia declarada («Sin ...»).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAmfeDoc, esDeteccionGenerica, CRITICAL_TYPES } from '../../scripts/_lib/amfeValidator.mjs';
import { clasificarControl, instrumentoDe, esIdentificable, CANON } from '../../scripts/_lib/controlCanon.mjs';
import * as planAmfe from '../../scripts/_lib/planControlAmfe.mjs';
import { medirAmfe } from '../../scripts/_medirDeteccionGenerica.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const AMFE_161 = JSON.parse(fs.readFileSync(path.join(AQUI, '..', 'fixtures', 'planControl', 'amfe161_recorte.json'), 'utf8'));

/** AMFE minimo valido con un solo control de deteccion, para aislar el check. */
function docConDeteccion(detectionControl, detection = 8) {
    return {
        operations: [{
            opNumber: '40', operationNumber: '40', name: 'COSTURA UNION', operationName: 'COSTURA UNION',
            focusElementFunction: 'Funcion Interna: a / Funcion del Cliente: b / Funcion del Usuario Final: c',
            operationFunction: 'Unir los componentes con costura',
            workElements: [{
                name: 'Maquina de coser', type: 'Machine',
                functions: [{
                    description: 'Coser segun especificacion', functionDescription: 'Coser segun especificacion',
                    failures: [{
                        description: 'Costura descosida', severity: 6,
                        effectLocal: 'Retrabajo', effectNextLevel: 'Reclamo', effectEndUser: 'Aspecto',
                        causes: [{
                            cause: 'Tension de hilo incorrecta', description: 'Tension de hilo incorrecta',
                            preventionControl: 'Regulacion de tension con fijacion de hilo',
                            detectionControl, occurrence: 4, detection, ap: 'M', actionPriority: 'M',
                        }],
                    }],
                }],
            }],
        }],
    };
}
const avisos = (control, d) => validateAmfeDoc(docConDeteccion(control, d), 'X', 'T').all.filter((i) => i.type === 'DETECCION_GENERICA');

describe('DETECCION_GENERICA: avisa cuando el control no dice con que se detecta', () => {
    it('rojo: «Inspección visual», «Visual», «Control visual del operario» e «Inspección de calidad» pelados avisan', () => {
        for (const t of ['Inspección visual', 'Visual', 'Control visual del operario', 'Inspección de calidad', 'Inspección visual en línea']) {
            expect(esDeteccionGenerica(t)).toBe(true);
            const a = avisos(t);
            expect(a.length).toBe(1);
            expect(a[0].detail).toMatch(/sin instrumento del catalogo/);
            expect(a[0].detail).toMatch(/y sin frecuencia/);
        }
    });
    it('rojo: con frecuencia o con pieza patron sigue siendo generico (es lo que dice el gate 8): la frecuencia va como dato', () => {
        const a = avisos('Inspección visual 100% + pieza patron');
        expect(a.length).toBe(1);
        expect(a[0].detail).not.toMatch(/y sin frecuencia/);
        expect(esDeteccionGenerica('Visual por lote')).toBe(true);
    });
    it('verde: un control con instrumento del catalogo (con o sin frecuencia) no avisa', () => {
        for (const t of ['Calibre para verificar puntadas', 'Medición con calibre digital por lote', 'Pesaje en balanza por entrega', 'Regla, 1 pieza por lote', 'CON CALIBRE MC167', 'Contra calibre al inicio de turno', 'Visual - plantilla Mylar']) {
            expect(esDeteccionGenerica(t)).toBe(false);
            expect(avisos(t)).toEqual([]);
        }
    });
    it('verde: lo que nombra un medio que el catalogo no tiene (alarma, sensor, panel, ensayo, certificado) NO es «visual generico»: va a otra bolsa', () => {
        const casos = {
            'Alarma de desviacion de caudal con parada automatica': ['ALARMA', 'AUTOMATICO', 'MEDICION_SIN_INSTRUMENTO'],
            'Sensores PT100 en cabezal mezclador con lectura continua de temperatura': ['SENSOR'],
            'Panel de presión + inspección visual 100%': ['PANEL'],
            'Ensayo laboratorio FMVSS 302, 1 pieza por lote': ['ENSAYO'],
            'Verificación de certificado de inflamabilidad del proveedor': ['DOCUMENTAL'],
            'Medicion con luxometro segun el plan de mediciones': ['INSTRUMENTO_SIN_CATALOGAR', 'MEDICION_SIN_INSTRUMENTO'],
        };
        for (const [t, fuera] of Object.entries(casos)) {
            const r = clasificarControl(t);
            expect(r.clase).toBe('fuera_del_catalogo');
            expect(r.fuera).toEqual(fuera);
            expect(avisos(t)).toEqual([]);
        }
        // nombrarlos NO los vuelve instrumentos: para el gate 8 siguen sin ser identificables
        expect(esIdentificable(instrumentoDe('Sensores PT100 en cabezal'))).toBe(false);
    });
    it('verde: la ausencia declarada («Sin ...») y el control vacio no son un control generico (los avisa otro check)', () => {
        expect(clasificarControl('Sin ensayo de adherencia en la serie').clase).toBe('declarado_inexistente');
        expect(clasificarControl('No hay control').clase).toBe('declarado_inexistente');
        expect(clasificarControl('Sinterizado visual').clase).toBe('generico');   // «sin» es palabra entera, no prefijo
        for (const t of ['', '-', '   ']) { expect(clasificarControl(t).clase).toBe('vacio'); expect(esDeteccionGenerica(t)).toBe(false); }
        expect(avisos('Sin control').length).toBe(0);
        expect(validateAmfeDoc(docConDeteccion('', 8), 'X', 'T').all.some((i) => i.type === 'DETECCION_SIN_CONTROL_DECLARADO')).toBe(true);
    });
    it('avisa, no bloquea: es WARNING, no esta entre los tipos criticos y no depende de la D', () => {
        expect(CRITICAL_TYPES.has('DETECCION_GENERICA')).toBe(false);
        const r = validateAmfeDoc(docConDeteccion('Visual', 8), 'X', 'T');
        expect(r.warning.some((i) => i.type === 'DETECCION_GENERICA')).toBe(true);
        expect(r.critical.some((i) => i.type === 'DETECCION_GENERICA')).toBe(false);
        expect(avisos('Visual', 10).length).toBe(1);
        expect(avisos('Visual', 3)[0].detail).toMatch(/D=3/);
    });
});

describe('una sola fuente: el AMFE y el plan de control dicen lo mismo del mismo texto', () => {
    it('el plan usa el mismo catalogo y las mismas funciones (no una copia)', () => {
        expect(planAmfe.CANON).toBe(CANON);
        expect(planAmfe.instrumentoDe).toBe(instrumentoDe);
        expect(planAmfe.esIdentificable).toBe(esIdentificable);
        const validador = fs.readFileSync(path.join(AQUI, '..', '..', 'scripts', '_lib', 'amfeValidator.mjs'), 'utf8');
        expect(validador).toContain("from './controlCanon.mjs'");
        // el catalogo vive en UN archivo: ni el validador ni el plan lo repiten
        for (const f of ['amfeValidator.mjs', 'planControlAmfe.mjs', 'planControlCheck.mjs']) {
            expect(fs.readFileSync(path.join(AQUI, '..', '..', 'scripts', '_lib', f), 'utf8')).not.toMatch(/CALIBRE_DE_CONTROL|camara de flamabilidad/);
        }
    });
    it('sobre el AMFE 161 (171 causas): generico + falta en el catalogo = las 150 que el gate 8 no puede identificar', () => {
        const m = medirAmfe(AMFE_161);
        expect(m.causas).toBe(171);
        expect(m.identificado).toBe(21);
        expect(m.generico + m.fuera_del_catalogo + m.declarado_inexistente + m.vacio).toBe(150);
        expect({ generico: m.generico, fuera: m.fuera_del_catalogo, sinFrecuencia: m.genericoSinFrecuencia }).toEqual({ generico: 127, fuera: 23, sinFrecuencia: 78 });
        const validador = validateAmfeDoc(JSON.parse(JSON.stringify(AMFE_161)), 'APB', '161').warning.filter((i) => i.type === 'DETECCION_GENERICA').length;
        expect(validador).toBe(m.generico);
        // y cada causa generica del validador es una causa que el gate 8 llamaria GENERICO
        for (const d of m.detalle.filter((x) => x.clase === 'generico')) expect(esIdentificable(instrumentoDe(d.control))).toBe(false);
    });
    it('el catalogo no inventa: cada termino fuera del catalogo trae un ejemplo real y ninguno esta tambien como instrumento', () => {
        const instrumentos = CANON.instrumentos.flatMap((i) => i.terminos);
        for (const f of CANON.fuera_del_catalogo) {
            expect(f.ejemplo.length).toBeGreaterThan(5);
            expect(clasificarControl(f.ejemplo).fuera).toContain(f.id);
            for (const t of f.terminos) expect(instrumentos).not.toContain(t);
        }
    });
});
