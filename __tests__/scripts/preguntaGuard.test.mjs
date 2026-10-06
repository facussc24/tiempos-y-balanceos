/**
 * pregunta-guard — que pregunta a Fak se frena y cual sale. Las dos direcciones, con preguntas REALES
 * (textuales de los transcripts del 05 y 06/10/2026 y de septiembre).
 *
 * Origen: Fak, 06/10/2026, "no deberias hacerme tantas preguntas, deberias saber que hacer... investigalo
 * para que no vuelva a suceder". Medido sobre las 81 llamadas a AskUserQuestion del 01/09 al 06/10: el
 * control frena 18 de las 35 que Fak rechazo y ninguna de las 24 que el contrato de autonomia manda hacer.
 * Lo caro de este control es el VERDE: si frenara una confirmacion, saldria un mail o una emision sin su OK.
 *
 * Correr:  npx vitest run --pool=threads __tests__/scripts/preguntaGuard.test.mjs
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { evaluarPregunta, evaluarUna, mensajeDeBloqueo } from '../../scripts/_lib/preguntaGuard.mjs';

const RAIZ = process.cwd();
const HOOK = path.join(RAIZ, '.claude', 'hooks', 'pregunta-guard.sh');
const q = (question, etiquetas, header = '') => ({ question, header, multiSelect: false, options: etiquetas.map((label) => ({ label, description: '' })) });
const hook = (payload, stdin) => {
    const r = spawnSync('bash', [HOOK], { input: stdin ?? JSON.stringify(payload), encoding: 'utf8', cwd: RAIZ });
    return { exit: r.status, out: r.stdout ?? '', err: r.stderr ?? '' };
};

// ── Las que Fak rechazo o contesto eligiendo siempre lo recomendado
const QUE_MAS = q('Lo que ya tengo: la lista de las otras diferencias del IP Pad contra el Insert y el Armrest. ¿Qué más unifico en esta misma revisión?',
    ['Nada más por ahora', 'Control de adhesivado al 70', 'Recepción como el Insert', 'Almacenamientos con número'], 'Resto IP Pad');
const OTROS_DOS = q('Lo que ya tengo: el Apoyacabezas (152) con el corte en 9 pasos y el Top Roll (155) sin el control de pieza inyectada dibujado. ¿Los unifico también?',
    ['Después, en otra tanda (Recomendado)', 'Sí, ahora'], 'Otros dos');
const NUMERO_120 = q('El TROQUELADO DE CINTA (sector Conversión de Cinta) necesita una decena propia. ¿Qué número le pongo?',
    ['120, sin renumerar nada (Recomendado)', 'Renumerar desde el 60', 'Otro'], 'Numeración');
const CODIGOS = q('¿Cómo armo los 4 códigos del semielaborado plástico + PU + cinta?',
    ['Nuevos INY-APB, 3 niveles (Recomendado)', 'Usar los CC-INY-APB de PCP', 'Meter el PU en el INY-APB actual'], 'Códigos');
const POR_DONDE = q('¿Por dónde arranco, las hojas de proceso o el flujograma?', ['Hojas de proceso', 'Flujograma'], 'Orden');
const QUE_ARRANCO = q('Tengo tres frentes abiertos. ¿Qué arranco ahora?', ['Armrest', 'Hojas de grampas', 'Mails pendientes'], 'Prioridad');

// ── Las que el contrato de autonomia manda confirmar: salen SIEMPRE
const EMITIR = q('Los dos flujogramas (Insert 154 Rev.D e IP Pad 157 Rev.C) están abiertos en PDF. Emitirlos es: el dibujo nuevo a Gestión Ingeniería, el PDF al casillero 20 de cada legajo y las filas 59 y 62 del listado maestro. ¿Los emito?',
    ['Sí, emitilos', 'Primero los miro'], 'Flujogramas');
const MAIL = q('El mail de difusión del cambio de BOM está en Borradores, con el texto de arriba y los dos PDF. ¿Lo envío?', ['Sí, envialo', 'Lo mando yo', 'Esperar'], 'Mail difusión');
const ARB = q('Lo que ya tengo: la tabla de carga del Armrest. Para cargarla en el arb necesito tu OK y el arb abierto con tu usuario. ¿La cargo?',
    ['Sí, cargala', 'Primero cambio algo', 'Después'], 'Carga arb');
const SUPABASE = q('Lo que ya tengo: la propuesta de arriba para el AMFE 161. Lo escribo en Supabase con backup y prueba en seco antes. ¿Avanzo así?',
    ['Sí, avanzá así', 'Sí, y con SC', 'Cambio algo'], 'AMFE');
const MODO_PLAN = q('Pedís "modo plan" a mano en 36 de 77 sesiones. ¿Lo dejo fijo para que toda sesión arranque en modo plan?', ['Sí, fijo (Recomendado)', 'No'], 'Modo plan');
// ── Lo que solo Fak sabe: sale, sin recomendacion
const CINTA = q('La cinta que se troquela en Conversión de Cinta, ¿es el Tesa 52110 (2 tiras de 20 × 2 cm por pieza)?', ['Sí, es el Tesa 52110', 'No, es otra'], 'Cinta');
const MOLDES = q('¿Cuántos moldes de PU hay hoy para el apoyabrazo de puerta?', ['2', '4', 'Otro'], 'Moldes');

describe('pregunta-guard — la logica', () => {
    describe('ROJO: no sale', () => {
        it.each([
            ['A', '¿Los unifico también? con una opcion recomendada (06/10/2026)', OTROS_DOS],
            ['A', '¿Qué número le pongo? con "120 (Recomendado)" (05/10/2026)', NUMERO_120],
            ['A', '¿Cómo armo los 4 códigos? con "(Recomendado)" (05/10/2026)', CODIGOS],
            ['B', '¿Qué más unifico en esta misma revisión? (06/10/2026)', QUE_MAS],
            ['B', '¿Por dónde arranco? (21/09/2026)', POR_DONDE],
            ['B', '¿Qué arranco ahora? (03/09/2026)', QUE_ARRANCO],
        ])('regla %s — %s', (regla, _nombre, pregunta) => {
            const r = evaluarPregunta({ questions: [pregunta] });
            expect(r.bloquea).toBe(true);
            expect(r.hallazgos[0].regla).toBe(regla);
        });

        it('una llamada con tres preguntas se frena si UNA no pasa, y dice cual', () => {
            const r = evaluarPregunta({ questions: [EMITIR, QUE_MAS, CINTA] });
            expect(r.bloquea).toBe(true);
            expect(r.hallazgos).toHaveLength(1);
            expect(mensajeDeBloqueo(r.hallazgos)).toMatch(/Qué más unifico/);
        });
    });

    describe('VERDE: sale', () => {
        it.each([
            ['emitir un flujograma', EMITIR],
            ['mandar un mail', MAIL],
            ['cargar en el arb', ARB],
            ['escribir en Supabase', SUPABASE],
            ['la configuracion de Claude, aunque traiga recomendacion', MODO_PLAN],
            ['un dato que solo Fak tiene (la cinta)', CINTA],
            ['un dato de planta (cuantos moldes)', MOLDES],
        ])('%s', (_nombre, pregunta) => {
            expect(evaluarUna(pregunta)).toBeNull();
            expect(evaluarPregunta({ questions: [pregunta] }).bloquea).toBe(false);
        });

        it('lo que no se puede leer no se frena', () => {
            expect(evaluarPregunta(undefined).bloquea).toBe(false);
            expect(evaluarPregunta({ questions: 'roto' }).bloquea).toBe(false);
            expect(evaluarPregunta({ questions: [{}] }).bloquea).toBe(false);
        });
    });

    it('todos los patrones del canon compilan y ninguno esta vacio', () => {
        const canon = JSON.parse(fs.readFileSync(path.join(RAIZ, 'scripts', '_lib', 'preguntaCanon.data.json'), 'utf8'));
        for (const grupo of ['confirmable', 'recomendada', 'menu']) {
            expect(canon[grupo].patrones.length).toBeGreaterThan(0);
            for (const p of canon[grupo].patrones) {
                expect(p.trim().length, `${grupo}: patron vacio`).toBeGreaterThan(1);
                expect(() => new RegExp(p, 'i')).not.toThrow();
            }
        }
    });
});

describe('pregunta-guard.sh — el hook, como lo llama Claude Code', () => {
    it('ROJO: exit 2 y el motivo por stderr', () => {
        const r = hook({ tool_name: 'AskUserQuestion', tool_input: { questions: [NUMERO_120, QUE_MAS] } });
        expect(r.exit).toBe(2);
        expect(r.err).toMatch(/PREGUNTA-GUARD: esta pregunta no sale/);
        expect(r.err).toMatch(/\[A\]/);
        expect(r.err).toMatch(/\[B\]/);
        expect(r.out).toBe('');
    });

    it('VERDE: exit 0 y el recordatorio por additionalContext', () => {
        const r = hook({ tool_name: 'AskUserQuestion', tool_input: { questions: [EMITIR, MAIL] } });
        expect(r.exit).toBe(0);
        const ctx = JSON.parse(r.out).hookSpecificOutput;
        expect(ctx.hookEventName).toBe('PreToolUse');
        expect(ctx.additionalContext).toMatch(/PREGUNTA-GUARD/);
        expect(ctx.additionalContext).toMatch(/Lo que ya tengo/);
    });

    it('VERDE: un payload ilegible deja pasar (exit 0)', () => {
        expect(hook(null, '{roto').exit).toBe(0);
        expect(hook(null, '').exit).toBe(0);
    });
});
