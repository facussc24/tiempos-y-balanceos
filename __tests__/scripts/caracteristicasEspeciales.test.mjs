/**
 * Caracteristicas especiales — el bloqueo que pidio Fak el 11/09/2026.
 *
 * Ese dia llame "error" a que dos causas de "Rotura del vinilo en la zona de la costura"
 * (S7 O3, con "riesgo de seguridad" en el efecto) perdieran su D/TLD, comparando contra un
 * backup en vez de mirar S y O. Fak: *"estas tirando como al azar... es un error gravisimo
 * que debemos corregir para siempre"*. Y el gate de entonces lo dejaba pasar: la palabra
 * "seguridad" en el texto EXIMIA a la critica de tener S >= 9.
 *
 * Estos tests prueban el bloqueo en las dos direcciones (regla
 * `un_control_se_audita_en_las_dos_direcciones`), con el caso real como fixture:
 *   - el validador (.mjs) frena como CRITICAL la sigla que S y O no sostienen;
 *   - la fuente unica (JSON) dice lo que tiene que decir y la leen todos;
 *   - la regla always-on, el nucleo post-compact y CLAUDE.md la nombran.
 * El guard PreToolUse se prueba en guardianes.test.mjs y el hook UserPromptSubmit en
 * hooksVarios.test.mjs.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
    validateAmfeDoc, CRITICAL_TYPES,
    nivelDeSigla, nivelPorCriterio, esSinMarca, normalizarSigla, CARACTERISTICAS_ESPECIALES,
} from '../../scripts/_lib/amfeValidator.mjs';

const RAIZ = process.cwd();
const canon = JSON.parse(fs.readFileSync(path.join(RAIZ, 'core/amfe/caracteristicasEspeciales.data.json'), 'utf8'));

/** AMFE minimo con una causa. La S vive en el modo de falla (regla severidadDelModoDeFalla). */
function doc({ s, o = 3, d = 6, sigla = '', efecto = 'Pieza con defecto visible en el habitaculo', ap } = {}) {
    const apCalc = ap ?? 'M';
    return {
        operations: [{
            opNumber: '40', operationNumber: '40',
            name: 'COSTURA', operationName: 'COSTURA',
            focusElementFunction: 'Funcion Interna: unir el vinilo / Funcion del Cliente: montar sin defectos / Funcion del Usuario Final: aspecto y durabilidad',
            operationFunction: 'Coser el vinilo conforme a la hoja de operacion',
            workElements: [{
                name: 'Maquina de coser', type: 'Machine',
                functions: [{
                    description: 'Aportar tension de hilo estable',
                    functionDescription: 'Aportar tension de hilo estable',
                    failures: [{
                        description: 'Rotura del vinilo en la zona de la costura',
                        severity: s,
                        effectLocal: 'Scrap de la pieza',
                        effectNextLevel: 'Faltante en la linea del cliente',
                        effectEndUser: efecto,
                        causes: [{
                            description: 'Tension de hilo excesiva', cause: 'Tension de hilo excesiva',
                            preventionControl: 'Hoja de parametros validada',
                            detectionControl: 'Autocontrol visual 100% en estacion',
                            occurrence: o, detection: d, ap: apCalc, actionPriority: apCalc, specialChar: sigla,
                            optimizationAction: apCalc === 'H' ? 'Pendiente definicion equipo APQP' : '',
                        }],
                    }],
                }],
            }],
        }],
    };
}

const corre = (args) => validateAmfeDoc(doc(args), 'Armrest', 'AMFE-TEST');
const criticos = (args, t) => corre(args).critical.filter(i => i.type === t);
const avisos = (args, t) => corre(args).warning.filter(i => i.type === t);
const ninguno = (args) => {
    const r = corre(args);
    return [...r.critical, ...r.warning].filter(i => ['CAUSE_CC_LOW_SEVERITY', 'CAUSE_SC_FUERA_DE_REGLA', 'SIGLA_DESCONOCIDA'].includes(i.type));
};

describe('CAUSE_CC_LOW_SEVERITY — una critica exige S 9 o 10, sin excepciones por palabras', () => {
    it('ROJO, el caso real del 11/09: D/TLD con S7 O3 y "riesgo de seguridad" en el efecto es CRITICAL', () => {
        // Hasta el 11/09 "seguridad" en el texto eximia y esto pasaba en silencio.
        const r = criticos({ s: 7, o: 3, sigla: 'D/TLD', efecto: 'Riesgo de seguridad para el usuario por rotura del vinilo' }, 'CAUSE_CC_LOW_SEVERITY');
        expect(r).toHaveLength(1);
        expect(r[0].detail).toMatch(/S=7/);
        expect(r[0].detail).toMatch(/sin excepciones/);
    });

    it('ROJO: "flamabilidad TL 1010" en el efecto tampoco exime — si es legal, la S tiene que ser 9', () => {
        expect(criticos({ s: 6, o: 3, sigla: 'CC', efecto: 'Riesgo de flamabilidad TL 1010 en cabina' }, 'CAUSE_CC_LOW_SEVERITY')).toHaveLength(1);
        expect(criticos({ s: 8, o: 5, sigla: '▽', efecto: 'Interferencia con el airbag, incumplimiento legal' }, 'CAUSE_CC_LOW_SEVERITY')).toHaveLength(1);
    });

    it('VERDE: D/TLD, CC, ▽ y TLD con S 9 o 10 pasan, con cualquier O', () => {
        for (const sigla of ['D/TLD', 'CC', '▽', '∇', 'TLD', 'D/TLD 2']) {
            expect(ninguno({ s: 9, o: 3, sigla, ap: 'H' }), sigla).toHaveLength(0);
            expect(ninguno({ s: 10, o: 1, d: 1, sigla, ap: 'M' }), sigla).toHaveLength(0);
        }
    });

    it('es CRITICAL (bloquea --apply y el export), no un aviso', () => {
        expect(CRITICAL_TYPES.has('CAUSE_CC_LOW_SEVERITY')).toBe(true);
        expect(avisos({ s: 7, o: 3, sigla: 'D/TLD' }, 'CAUSE_CC_LOW_SEVERITY')).toHaveLength(0);
    });
});

describe('CAUSE_SC_FUERA_DE_REGLA — una significativa exige S 5 a 8 Y O >= 4 (I-AC-005 punto 5)', () => {
    it('ROJO: SC con S8 O2 (AMFE 158 OP 110) y con S7 O2 (AMFE 162 OP 80) son CRITICAL', () => {
        expect(criticos({ s: 8, o: 2, sigla: 'SC' }, 'CAUSE_SC_FUERA_DE_REGLA')).toHaveLength(1);
        expect(criticos({ s: 7, o: 2, sigla: 'SC' }, 'CAUSE_SC_FUERA_DE_REGLA')).toHaveLength(1);
    });

    it('ROJO: SC con S 9 no es SC (es critica) y SC con S 4 tampoco entra', () => {
        expect(criticos({ s: 9, o: 5, sigla: 'SC', ap: 'H' }, 'CAUSE_SC_FUERA_DE_REGLA')).toHaveLength(1);
        expect(criticos({ s: 4, o: 8, sigla: 'CS' }, 'CAUSE_SC_FUERA_DE_REGLA')).toHaveLength(1);
    });

    it('VERDE: SC con S5 O4, S8 O10 y "SC 3" numerada pasan', () => {
        expect(ninguno({ s: 5, o: 4, d: 7, sigla: 'SC', ap: 'M' })).toHaveLength(0);
        expect(ninguno({ s: 8, o: 10, d: 4, sigla: 'SC', ap: 'H' })).toHaveLength(0);
        expect(ninguno({ s: 7, o: 5, d: 6, sigla: 'SC 3', ap: 'H' })).toHaveLength(0);
        expect(ninguno({ s: 6, o: 6, d: 6, sigla: 'CS', ap: 'H' })).toHaveLength(0);
    });

    it('VERDE: sin O no se juzga la regla (eso ya lo frena CAUSE_MISSING_SOD)', () => {
        expect(criticos({ s: 7, o: null, sigla: 'SC' }, 'CAUSE_SC_FUERA_DE_REGLA')).toHaveLength(0);
    });

    it('la S que manda es la del modo de falla, no una S fantasma en la causa', () => {
        const d = doc({ s: 7, o: 5, sigla: 'SC', ap: 'H' });
        d.operations[0].workElements[0].functions[0].failures[0].causes[0].severity = 3;
        const r = validateAmfeDoc(d, 'Armrest', 'AMFE-TEST');
        expect(r.critical.filter(i => i.type === 'CAUSE_SC_FUERA_DE_REGLA')).toHaveLength(0);
    });

    it('es CRITICAL y CAUSE_SC_LOW_SEVERITY (el "S<7" viejo) ya no existe', () => {
        expect(CRITICAL_TYPES.has('CAUSE_SC_FUERA_DE_REGLA')).toBe(true);
        expect(CRITICAL_TYPES.has('CAUSE_SC_LOW_SEVERITY')).toBe(false);
        const src = fs.readFileSync(path.join(RAIZ, 'scripts/_lib/amfeValidator.mjs'), 'utf8');
        expect(src).not.toMatch(/type:\s*'CAUSE_SC_LOW_SEVERITY'/);
        expect(src).not.toMatch(/FLAMABILITY_LEGAL_KEYWORDS/);
    });
});

describe('SIGLA_DESCONOCIDA — lo que ninguna fuente reconoce no se adivina, se reporta', () => {
    it('ROJO: W, Wichtig, PV2005 y Clave son CRITICAL', () => {
        for (const sigla of ['W', 'Wichtig', 'WICHTIG', 'PV2005', 'Clave', 'YC']) {
            const r = criticos({ s: 7, o: 5, sigla, ap: 'H' }, 'SIGLA_DESCONOCIDA');
            expect(r, sigla).toHaveLength(1);
            expect(r[0].detail).toContain(sigla);
        }
        expect(CRITICAL_TYPES.has('SIGLA_DESCONOCIDA')).toBe(true);
    });

    it('VERDE: vacio, guion, raya, N/A, OS y HI no son desconocidas', () => {
        for (const sigla of ['', '-', '—', 'N/A', 'OS', 'HI']) {
            expect(criticos({ s: 7, o: 3, sigla }, 'SIGLA_DESCONOCIDA'), JSON.stringify(sigla)).toHaveLength(0);
        }
    });

    it('CAUSE_S9_SIN_CC sigue siendo WARNING: la candidata se muestra, asignarla es de Fak', () => {
        expect(CRITICAL_TYPES.has('CAUSE_S9_SIN_CC')).toBe(false);
        expect(avisos({ s: 9, o: 3, sigla: '', ap: 'H' }, 'CAUSE_S9_SIN_CC')).toHaveLength(1);
    });
});

describe('los helpers .mjs leen la MISMA fuente que la app', () => {
    it('nivelPorCriterio: S 9-10 critica; S 5-8 y O >= 4 significativa; el resto nada', () => {
        expect(nivelPorCriterio(9, 1)).toBe('CRITICA');
        expect(nivelPorCriterio(10, 3)).toBe('CRITICA');
        expect(nivelPorCriterio(7, 4)).toBe('SIGNIFICATIVA');
        expect(nivelPorCriterio(5, 4)).toBe('SIGNIFICATIVA');
        expect(nivelPorCriterio(7, 3)).toBeNull();
        expect(nivelPorCriterio(8, 2)).toBeNull();
        expect(nivelPorCriterio(4, 9)).toBeNull();
        expect(nivelPorCriterio(undefined, 5)).toBeNull();
        expect(nivelPorCriterio(7, undefined)).toBeNull();
    });

    it('nivelDeSigla / esSinMarca / normalizarSigla', () => {
        expect(nivelDeSigla('D/TLD 3')).toBe('CRITICA');
        expect(nivelDeSigla('cs')).toBe('SIGNIFICATIVA');
        expect(nivelDeSigla('OS')).toBe('SEGURIDAD_OPERADOR');
        expect(nivelDeSigla('W')).toBeNull();
        expect(nivelDeSigla('-')).toBeNull();
        expect(esSinMarca('-')).toBe(true);
        expect(esSinMarca('')).toBe(true);
        expect(esSinMarca('SC')).toBe(false);
        expect(normalizarSigla(' sc 12 ')).toBe('SC');
        // "D / TLD" es la misma marca que "D/TLD" (auditor 11/09/2026): los espacios
        // alrededor de la barra son tipeo. Antes caia en SIGLA_DESCONOCIDA, que bloquea.
        expect(normalizarSigla('D / TLD')).toBe('D/TLD');
        expect(nivelDeSigla('D / TLD')).toBe('CRITICA');
        expect(nivelDeSigla('  d / tld 4 ')).toBe('CRITICA');
        // El gate sigue pudiendo dar rojo: una sigla inventada con barra no se reconoce.
        expect(nivelDeSigla('W / WICHTIG')).toBeNull();
    });

    it('el JSON es el que exporta el validador, y dice lo que tiene que decir', () => {
        expect(CARACTERISTICAS_ESPECIALES).toEqual(canon);
        expect(canon.criterio.CRITICA.severidad_min).toBe(9);
        expect(canon.criterio.SIGNIFICATIVA).toMatchObject({ severidad_min: 5, severidad_max: 8, ocurrencia_min: 4 });
        expect(canon.aliases.CRITICA).toEqual(expect.arrayContaining(['CC', 'D/TLD', 'D', 'TLD', '▽', '∇']));
        expect(canon.aliases.SIGNIFICATIVA).toEqual(['SC', 'CS']);
        expect(canon.simbologia.VW).toMatchObject({ CRITICA: 'D/TLD', SIGNIFICATIVA: 'SC' });
        expect(JSON.stringify(canon.aliases)).not.toMatch(/WICHTIG|"W"/);
    });

    it('los disparadores de los dos hooks compilan y el recordatorio dice el criterio entero', () => {
        for (const d of [...canon.guard_disparadores, ...canon.prompt_disparadores]) {
            expect(() => new RegExp(d.regex, 'i'), d.regex).not.toThrow();
            expect(typeof d.que).toBe('string');
        }
        expect(() => new RegExp(canon.guard_excluir_rutas, 'i')).not.toThrow();
        const texto = canon.recordatorio.join('\n');
        expect(texto).toMatch(/S 9 o 10/);
        expect(texto).toMatch(/S 5 a 8 Y O >= 4/);
        expect(texto).toMatch(/UNA sola marca/);
        expect(texto).toMatch(/La W NO existe/);
        expect(texto).toMatch(/NUNCA porque otro documento/);
        expect(texto).toMatch(/caracteristicas-especiales\.md/);
        expect(texto.length).toBeLessThan(2500);   // entra entero como additionalContext
    });
});

describe('la regla always-on, CLAUDE.md y el nucleo post-compact la nombran', () => {
    it('.claude/rules/caracteristicas-especiales.md existe, no tiene paths: (siempre cargada) y trae el criterio con fuentes', () => {
        const regla = fs.readFileSync(path.join(RAIZ, '.claude/rules/caracteristicas-especiales.md'), 'utf8');
        expect(regla).not.toMatch(/^paths:/m);
        expect(regla).toMatch(/9.{0,6}10/);
        expect(regla).toMatch(/O\s*(>=|≥)\s*4/);
        expect(regla).toMatch(/Formel Q/);
        expect(regla).toMatch(/I-AC-005/);
        expect(regla).toMatch(/CAUSE_CC_LOW_SEVERITY/);
        expect(regla).toMatch(/CAUSE_SC_FUERA_DE_REGLA/);
        expect(regla).toMatch(/SIGLA_DESCONOCIDA/);
    });

    it('CLAUDE.md la lista entre las reglas siempre cargadas', () => {
        expect(fs.readFileSync(path.join(RAIZ, 'CLAUDE.md'), 'utf8')).toMatch(/caracteristicas-especiales\.md/);
    });

    it('el nucleo post-compact (session-start-context.sh compact) trae el punto 7 con el criterio', () => {
        const sh = fs.readFileSync(path.join(RAIZ, '.claude/hooks/session-start-context.sh'), 'utf8');
        expect(sh).toMatch(/^7\. Caracteristicas especiales/m);
        expect(sh).toMatch(/caracteristicas-especiales\.md/);
    });
});
