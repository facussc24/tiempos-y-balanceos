/**
 * preguntaGuard.mjs — que AskUserQuestion NO sale hacia Fak. Lo llama `.claude/hooks/pregunta-guard.sh`
 * (PreToolUse, matcher AskUserQuestion) con el JSON del hook por stdin.
 *
 *   exit 2 + motivo por stderr  -> la pregunta se frena y el motivo vuelve a Claude
 *   exit 0 + additionalContext  -> la pregunta sale, con el recordatorio de siempre
 *
 * POR QUE BLOQUEA (06/10/2026). Fak: "no deberias hacerme tantas preguntas, deberias saber que hacer...
 * investigalo para que no vuelva a suceder". Medido en los transcripts del 01/09 al 06/10: 81 llamadas,
 * 35 rechazadas por el. El recordatorio que este hook daba desde el 05/09 llega DESPUES de que la
 * pregunta ya esta escrita (60 de 60 veces) y no cambio la proporcion (8 de 20 antes, 27 de 61 despues).
 *
 * QUE FRENA, y solo eso (patrones en `preguntaCanon.data.json`):
 *   A. una opcion "(Recomendado)" en algo que el contrato de autonomia NO manda confirmar: si hay
 *      recomendacion, hay decision — se hace y se dice por que;
 *   B. un menu de alcance o de como seguir ("¿que mas unifico?", "¿por donde arranco?").
 * QUE NO FRENA NUNCA: lo que el contrato manda confirmar (mandar un mail, emitir, Supabase, el arb, un
 * listado maestro, el legajo o el servidor, borrar, la primera vez) y lo que solo Fak sabe, que va sin
 * recomendacion. Tampoco frena si no puede leer la pregunta: un control que no entiende deja pasar y avisa.
 *
 * Se evalua pregunta por pregunta: una llamada con tres preguntas sale si las tres pasan.
 * Tests en las dos direcciones, con preguntas reales: `__tests__/scripts/preguntaGuard.test.mjs`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const CANON = JSON.parse(fs.readFileSync(path.join(AQUI, 'preguntaCanon.data.json'), 'utf8'));
const re = (grupo) => new RegExp(CANON[grupo].patrones.join('|'), 'i');
const CONFIRMABLE = re('confirmable');
const RECOMENDADA = re('recomendada');
const MENU = re('menu');

export const RECORDATORIO = '[PREGUNTA-GUARD] Antes de preguntarle a Fak: ¿esto lo contesta un archivo, un mail '
    + '(python scripts/_mails.py --buscar), un transcript, el Escritorio o el propio repo? Si no lo buscaste, buscalo primero. '
    + "Si igual hace falta preguntar, la pregunta lleva un renglon 'Lo que ya tengo:' con lo que encontraste y por que no alcanza. "
    + 'Un OK para hacer mi propio trabajo no se pide: la respuesta es SI, se hace y se reporta. SI se pregunta, con la ruta y el '
    + 'archivo concretos, lo que el contrato de autonomia manda confirmar: escribir en Supabase, un listado maestro, emitir o dejar '
    + 'algo en el SGC o el legajo, lo que hago por PRIMERA VEZ, mandar un mail, cerrar el arb. Y lo que SOLO Fak puede contestar '
    + '(una decision suya, un dato de planta que no esta escrito), sin opcion recomendada.';

const QUE_SI = 'Se le confirma a Fak, con la ruta y el archivo: mandar un mail, emitir o dejar algo en el servidor, el legajo o un '
    + 'listado maestro, escribir en Supabase, cargar o borrar en el arb, borrar, y lo que se hace por primera vez. Y se le pregunta lo '
    + 'que SOLO el sabe (un dato de planta que ningun documento tiene, una decision suya), sin opcion recomendada.';

/** Una pregunta de la llamada -> null si sale, o { regla, motivo } si se frena. */
export function evaluarUna(q) {
    const texto = `${q?.question ?? ''} ${q?.header ?? ''}`;
    if (CONFIRMABLE.test(texto)) return null;
    const etiquetas = (q?.options ?? []).map((o) => String(o?.label ?? ''));
    if (etiquetas.some((e) => RECOMENDADA.test(e))) {
        return {
            regla: 'A',
            motivo: `"${String(q.question).slice(0, 110)}" trae una opcion recomendada y no es algo que haya que confirmar: `
                + 'ya decidiste. Hace la recomendada y decile a Fak en un renglon que elegiste y por que.',
        };
    }
    if (MENU.test(texto)) {
        return {
            regla: 'B',
            motivo: `"${String(q.question).slice(0, 110)}" es un menu de alcance o de como seguir: se hace lo que Fak pidio con el `
                + 'criterio ya escrito (skill, regla, hermanos) y lo demas se le nombra en un renglon, sin opciones.',
        };
    }
    return null;
}

/** tool_input de AskUserQuestion -> { bloquea, hallazgos[] }. Lo que no se puede leer no se frena. */
export function evaluarPregunta(toolInput) {
    const preguntas = Array.isArray(toolInput?.questions) ? toolInput.questions : [];
    const hallazgos = preguntas.map(evaluarUna).filter(Boolean);
    return { bloquea: hallazgos.length > 0, hallazgos };
}

export function mensajeDeBloqueo(hallazgos) {
    return ['PREGUNTA-GUARD: esta pregunta no sale hacia Fak.',
        ...hallazgos.map((h) => `  [${h.regla}] ${h.motivo}`),
        QUE_SI,
        'Fak, 06/10/2026: "no deberias hacerme tantas preguntas, deberias saber que hacer". Medido: rechazo 35 de 81 preguntas en cinco semanas.',
    ].join('\n');
}

const esCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esCli) {
    let crudo = '';
    try { crudo = fs.readFileSync(0, 'utf8'); } catch { /* sin stdin */ }
    let entrada = null;
    try { entrada = JSON.parse(crudo); } catch { /* payload ilegible: deja pasar */ }
    const r = evaluarPregunta(entrada?.tool_input);
    if (r.bloquea) {
        process.stderr.write(mensajeDeBloqueo(r.hallazgos) + '\n');
        process.exit(2);
    }
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: RECORDATORIO } }) + '\n');
    process.exit(0);
}
