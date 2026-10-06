/**
 * pregunta-guard — que pregunta a Fak se PAUSA para repensarla y cual sale directo. Las dos direcciones,
 * con preguntas REALES (textuales de los transcripts del 05 y 06/10/2026 y de septiembre).
 *
 * Origen: Fak, 06/10/2026, "no deberias hacerme tantas preguntas, deberias saber que hacer... investigalo
 * para que no vuelva a suceder". Medido sobre las 81 llamadas a AskUserQuestion del 01/09 al 06/10/2026
 * (35 rechazadas por el): este canon pausa 27 — 16 de las 35 rechazadas, 10 que contesto sin queja y 1
 * confirmacion de contrato que venia con "(Recommended)".
 *
 * EL CONTROL FRENA, NO DECIDE. La primera version mandaba "ya decidiste, hace la recomendada" y la
 * auditoria independiente de esa misma tarde la tumbo: frenaba 104 de 105 confirmaciones del contrato
 * escritas de forma natural, y en un tercio de las reales Fak habia contestado otra cosa. Por eso lo
 * que aca se prueba como ROJO es la pausa, y lo que NO puede pasar nunca es que el mensaje ordene hacer.
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

// ── Las que Fak rechazo, o que eran decision propia
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
const EN_INGLES = q('¿Cómo ordeno las carpetas de la tarea?', ['Por fecha (Recommended)', 'Por cliente'], 'Orden');

// ── Las que nombran lo que se confirma: salen directo
const EMITIR = q('Los dos flujogramas (Insert 154 Rev.D e IP Pad 157 Rev.C) están abiertos en PDF. Emitirlos es: el dibujo nuevo a Gestión Ingeniería, el PDF al casillero 20 de cada legajo y las filas 59 y 62 del listado maestro. ¿Los emito?',
    ['Sí, emitilos', 'Primero los miro'], 'Flujogramas');
const MAIL = q('El mail de difusión del cambio de BOM está en Borradores, con el texto de arriba y los dos PDF. ¿Lo envío?', ['Sí, envialo', 'Lo mando yo', 'Esperar'], 'Mail difusión');
const ARB = q('Lo que ya tengo: la tabla de carga del Armrest. Para cargarla en el arb necesito tu OK y el arb abierto con tu usuario. ¿La cargo?',
    ['Sí, cargala', 'Primero cambio algo', 'Después'], 'Carga arb');
const SUPABASE = q('Lo que ya tengo: la propuesta de arriba para el AMFE 161. Lo escribo en Supabase con backup y prueba en seco antes. ¿Avanzo así?',
    ['Sí, avanzá así', 'Sí, y con SC', 'Cambio algo'], 'AMFE');
const MODO_PLAN = q('Pedís "modo plan" a mano en 36 de 77 sesiones. ¿Lo dejo fijo para que toda sesión arranque en modo plan?', ['Sí, fijo (Recomendado)', 'No'], 'Modo plan');
// ── Lo que solo Fak sabe, o una confirmacion sin marca de recomendada: sale
const CINTA = q('La cinta que se troquela en Conversión de Cinta, ¿es el Tesa 52110 (2 tiras de 20 × 2 cm por pieza)?', ['Sí, es el Tesa 52110', 'No, es otra'], 'Cinta');
const MOLDES = q('¿Cuántos moldes de PU hay hoy para el apoyabrazo de puerta?', ['2', '4', 'Otro'], 'Moldes');
const APLICO = q('Son 12 correcciones de severidad en el AMFE del Top Roll, con el antes y el después en la tabla de arriba. ¿Las aplico?', ['Sí, aplicalas', 'No'], 'AMFE');
// ── Confirmaciones del contrato que NO nombran el sistema y venian con recomendada (auditoria 06/10)
const REGENERAR = q('¿Regenero el plan de control desde el AMFE?', ['Sí, regenerarlo (Recomendado)', 'No'], 'Plan de control');
const SIGLA = q('Hay 3 causas con S=9 sin sigla. ¿Les pongo CC?', ['Sí, CC (Recomendado)', 'No'], 'Siglas');
const COZZUOL = q('¿Le paso el plano a Cozzuol?', ['Sí, hoy (Recomendado)', 'Esperar'], 'Plano');
// Sin ninguna palabra del atajo `confirmable`: pasa SOLO por ir sin la marca (con "cargado" en el texto pasaba igual con la marca puesta).
const TEXTO_REGENERAR = 'El plan de control del Insert se regenera desde el AMFE 158 y reemplaza al que está hoy. ¿Está bien?';
const REGENERAR_BIEN = q(TEXTO_REGENERAR, ['Sí, regenerarlo', 'No'], 'Plan de control');
const REGENERAR_CON_MARCA = q(TEXTO_REGENERAR, ['Sí, regenerarlo (Recomendado)', 'No'], 'Plan de control');

describe('pregunta-guard — la logica', () => {
    describe('ROJO: se pausa', () => {
        it.each([
            ['A', '¿Los unifico también? con una opcion recomendada (06/10/2026)', OTROS_DOS],
            ['A', '¿Qué número le pongo? con "120 (Recomendado)" — Fak contesto OTRA cosa (05/10/2026)', NUMERO_120],
            ['A', '¿Cómo armo los 4 códigos? con "(Recomendado)" (05/10/2026)', CODIGOS],
            ['A', 'la marca en ingles, "(Recommended)"', EN_INGLES],
            ['B', '¿Qué más unifico en esta misma revisión? (06/10/2026)', QUE_MAS],
            ['B', '¿Por dónde arranco? (21/09/2026)', POR_DONDE],
            ['B', '¿Qué arranco ahora? (03/09/2026)', QUE_ARRANCO],
        ])('regla %s — %s', (regla, _nombre, pregunta) => {
            const r = evaluarPregunta({ questions: [pregunta] });
            expect(r.bloquea).toBe(true);
            expect(r.hallazgos[0].regla).toBe(regla);
        });

        it('una llamada con tres preguntas se pausa si UNA no pasa, y dice cual', () => {
            const r = evaluarPregunta({ questions: [EMITIR, QUE_MAS, CINTA] });
            expect(r.bloquea).toBe(true);
            expect(r.hallazgos).toHaveLength(1);
            expect(mensajeDeBloqueo(r.hallazgos)).toMatch(/Qué más unifico/);
        });

        it('"emit" no se cuela por "semiterminado" ni por "remito"', () => {
            expect(evaluarUna(q('¿Dejo la etiqueta en el semiterminado?', ['Sí (Recomendado)', 'No']))?.regla).toBe('A');
            expect(evaluarUna(q('¿Anoto el remito en la planilla?', ['Sí (Recomendado)', 'No']))?.regla).toBe('A');
        });
    });

    describe('EL MENSAJE NO ORDENA HACER (lo que tumbo a la primera version)', () => {
        it.each([
            ['regenerar el plan de control', REGENERAR],
            ['asignar CC', SIGLA],
            ['pasarle un plano a un externo', COZZUOL],
            ['un menu de alcance (regla B)', QUE_MAS],
        ])('una pregunta pausada (%s) recibe los dos caminos, y el renglon del motivo no manda nada', (_n, pregunta) => {
            const r = evaluarPregunta({ questions: [pregunta] });
            expect(r.bloquea).toBe(true);
            const m = mensajeDeBloqueo(r.hallazgos);
            expect(m).not.toMatch(/ya decidiste|posicion tomada|hac[eé] la recomendada|no es algo que haya que confirmar/i);
            // el renglon [A] / [B] describe que disparo la pausa: no puede traer un verbo de hacer
            const motivos = m.split('\n').filter((l) => /^\s*\[[AB]\]/.test(l));
            expect(motivos.length).toBeGreaterThan(0);
            for (const l of motivos) expect(l).not.toMatch(/hac[eé]|ejecut|se hace|no preguntes|sin opciones/i);
            // y los dos caminos van siempre, condicionados
            expect(m).toMatch(/pausa, no una orden/);
            expect(m).toMatch(/1\) Si lo que se decide es trabajo TUYO y REVERSIBLE/);
            expect(m).toMatch(/2\) Si toca algo que se le confirma/);
            expect(m).toMatch(/VOLVE A PREGUNTARLO/);
            expect(m).toMatch(/Supabase/);
            expect(m).toMatch(/CC\/SC/);
            expect(m).toMatch(/En la duda entre 1 y 2, es 2/);
        });

        it('el motivo cita QUE disparo la pausa: la etiqueta marcada o el fragmento de menu', () => {
            expect(evaluarUna(REGENERAR).motivo).toMatch(/Sí, regenerarlo \(Recomendado\)/);
            expect(evaluarUna(QUE_MAS).motivo).toMatch(/por "¿Qué más"/);
        });

        it('la misma confirmacion pasa SOLO por ir sin la marca: con la marca se pausa, sin ella sale', () => {
            expect(evaluarUna(REGENERAR_CON_MARCA)?.regla).toBe('A');
            expect(evaluarUna(REGENERAR_BIEN)).toBeNull();
        });

        it('la palabra "recomendado" suelta en una opcion no es la marca', () => {
            const p = q('¿Le contesto a Novax con el consumo corregido?', ['Sí, con el consumo recomendado por Pablo Gamboa (0,2526)', 'No']);
            expect(evaluarUna(p)).toBeNull();
        });
    });

    describe('VERDE: sale directo', () => {
        it.each([
            ['emitir un flujograma', EMITIR],
            ['mandar un mail', MAIL],
            ['cargar en el arb', ARB],
            ['escribir en Supabase', SUPABASE],
            ['la configuracion de Claude, aunque traiga recomendacion', MODO_PLAN],
            ['un dato que solo Fak tiene (la cinta)', CINTA],
            ['un dato de planta (cuantos moldes)', MOLDES],
            ['"¿Las aplico?" sin marca de recomendada: la forma natural de una confirmacion', APLICO],
        ])('%s', (_nombre, pregunta) => {
            expect(evaluarUna(pregunta)).toBeNull();
            expect(evaluarPregunta({ questions: [pregunta] }).bloquea).toBe(false);
        });

        it('"¿Avanzo?", "¿Sigo?" y "¿Lo aplico ahora?" sin recomendada no se pausan', () => {
            for (const t of ['¿Avanzo?', '¿Sigo?', '¿Lo aplico ahora?']) {
                expect(evaluarUna(q(`Con el diff de arriba. ${t}`, ['Sí', 'No'])), t).toBeNull();
            }
        });

        it('"¿Qué hago con…?" sin marca no se pausa: suele ser un archivo o un dato de otro', () => {
            expect(evaluarUna(q('¿Qué hago con el archivo de Pablo que está en la carpeta vieja?', ['Dejarlo', 'Pasarlo a la carpeta nueva']))).toBeNull();
        });

        it('el encabezado tambien cuenta para el atajo de lo que se confirma', () => {
            const conMarca = ['Sí, hoy (Recomendado)', 'Esperar'];
            expect(evaluarUna(q('¿Sale hoy?', conMarca, 'Otra cosa'))?.regla).toBe('A');
            expect(evaluarUna(q('¿Sale hoy?', conMarca, 'Mail difusión'))).toBeNull();
        });

        it('lo que no se puede leer no se frena', () => {
            expect(evaluarPregunta(undefined).bloquea).toBe(false);
            expect(evaluarPregunta({ questions: 'roto' }).bloquea).toBe(false);
            expect(evaluarPregunta({ questions: [{}] }).bloquea).toBe(false);
        });
    });

    it('todos los patrones del canon compilan, no estan vacios y ninguno coincide con el texto vacio', () => {
        const crudo = fs.readFileSync(path.join(RAIZ, 'scripts', '_lib', 'preguntaCanon.data.json'), 'utf8');
        // un "\b" de JSON es un retroceso, no un borde de palabra: el patron tiene que traer "\\b" (se mira abajo, patron por patron)
        const canon = JSON.parse(crudo);
        for (const grupo of ['confirmable', 'recomendada', 'menu']) {
            expect(canon[grupo].patrones.length).toBeGreaterThan(0);
            for (const p of canon[grupo].patrones) {
                expect(p.trim().length, `${grupo}: patron vacio`).toBeGreaterThan(1);
                expect(/[\u0008]/.test(p), `${grupo}: "${p}" trae un retroceso en vez de \\b`).toBe(false);
                expect(new RegExp(p, 'i').test(''), `${grupo}: "${p}" coincide con el vacio`).toBe(false);
            }
        }
    });
});

describe('pregunta-guard.sh — el hook, como lo llama Claude Code', () => {
    it('ROJO: exit 2 y el motivo por stderr, sin nada por stdout', () => {
        const r = hook({ tool_name: 'AskUserQuestion', tool_input: { questions: [NUMERO_120, QUE_MAS] } });
        expect(r.exit).toBe(2);
        expect(r.err).toMatch(/PREGUNTA-GUARD: repensa esta pregunta/);
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

    it('VERDE: un payload ilegible deja pasar (exit 0) y lo DICE', () => {
        for (const stdin of ['{roto', '']) {
            const r = hook(null, stdin);
            expect(r.exit).toBe(0);
            expect(JSON.parse(r.out).hookSpecificOutput.additionalContext).toMatch(/no pude leer la pregunta/);
        }
    });
});
