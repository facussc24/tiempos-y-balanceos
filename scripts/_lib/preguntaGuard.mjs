/**
 * preguntaGuard.mjs — una PAUSA antes de que una pregunta de opciones le llegue a Fak. Lo llama
 * `.claude/hooks/pregunta-guard.sh` (PreToolUse, matcher AskUserQuestion) con el JSON del hook por stdin.
 *
 *   exit 2 + motivo por stderr  -> la pregunta vuelve a Claude para que la repiense
 *   exit 0 + additionalContext  -> la pregunta sale, con el recordatorio de siempre
 *
 * POR QUE FRENA (06/10/2026). Fak: "no deberias hacerme tantas preguntas, deberias saber que hacer...
 * investigalo para que no vuelva a suceder". Medido en los transcripts del 01/09 al 06/10: 81 llamadas,
 * 35 rechazadas por el. El recordatorio que este hook daba desde el 04/09 llegaba DESPUES de que la
 * pregunta ya estaba escrita (60 de 60 veces) y no cambio la proporcion (8 de 20 antes, 27 de 61 despues).
 * Frenar una vez es la unica forma de que el criterio llegue ANTES.
 *
 * EL CHEQUEO FRENA, NO DECIDE. La primera version (misma tarde) le decia a Claude "ya decidiste, hace la
 * recomendada". La auditoria independiente la tumbo: un filtro por palabras no distingue una confirmacion
 * del contrato de una pregunta de mas (frenaba 104 de 105 confirmaciones escritas de forma natural que no
 * nombraban el sistema: "¿Regenero el plan de control?", "¿Les pongo CC?", "¿Le paso el plano a Cozzuol?"),
 * y en un tercio de las reales que frenaba Fak habia contestado algo DISTINTO de lo recomendado. Por eso
 * el mensaje no manda hacer nada: devuelve la pregunta con los dos caminos y la salida para cada uno.
 *
 * QUE DISPARA LA PAUSA (patrones en `preguntaCanon.data.json`):
 *   A. una opcion marcada "(Recomendado)" / "(Recommended)";
 *   B. forma de menu de alcance o de como seguir ("¿que mas unifico?", "¿por donde arranco?").
 * Una pregunta que en su texto nombra lo que el contrato manda confirmar (mail, emitir, Supabase, arb...)
 * pasa directo: es un atajo para no pausar lo obvio, NO una lista completa de lo que se confirma.
 * COMO SE SALE: si era trabajo propio y reversible, no se pregunta; si habia que preguntarlo, se vuelve a
 * preguntar con la ruta y el archivo, sin la marca de recomendada y sin forma de menu, y pasa.
 *
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

const DOS_CAMINOS = [
    'Esto es una pausa, no una orden: el control mira la FORMA de la pregunta y no sabe que se esta decidiendo. Elegi vos:',
    '  1) Si lo que se decide es trabajo TUYO y REVERSIBLE (un nombre, un numero que fija una convencion, un orden, un formato, por',
    '     donde seguir): no preguntes. Hace lo que el criterio escrito indica y decile a Fak en un renglon que elegiste y por que.',
    '  2) Si toca algo que se le confirma — mandar o reenviar un mail, emitir, guardar o mover en el servidor, el legajo o un listado',
    '     maestro, escribir en Supabase (corregir, regenerar, propagar, migrar, restaurar), cargar o dar de baja en el arb, borrar o',
    '     pisar un archivo, asignar CC/SC, una dependencia, sacar una funcion, apagar un control, algo de otra persona, la primera vez',
    '     de algo — o es un dato que SOLO Fak tiene: VOLVE A PREGUNTARLO, con la ruta y el archivo concretos ("esto va aca, ¿esta',
    '     bien?"), sin la marca de recomendada y sin forma de menu. Asi pasa. En la duda entre 1 y 2, es 2.',
    'Fak, 06/10/2026: "no deberias hacerme tantas preguntas, deberias saber que hacer". Y 21/09/2026: "si es tu primera vez haciendo',
    'algo preguntame antes". Las dos valen.',
].join('\n');

/** Una pregunta de la llamada -> null si sale, o { regla, motivo } si se pausa. */
export function evaluarUna(q) {
    const texto = `${q?.question ?? ''} ${q?.header ?? ''}`;
    if (CONFIRMABLE.test(texto)) return null;
    const corta = String(q?.question ?? '').slice(0, 110);
    const etiquetas = (q?.options ?? []).map((o) => String(o?.label ?? ''));
    if (etiquetas.some((e) => RECOMENDADA.test(e))) {
        return { regla: 'A', motivo: `"${corta}" trae una opcion recomendada: ya tenes una posicion tomada.` };
    }
    if (MENU.test(texto)) {
        return { regla: 'B', motivo: `"${corta}" tiene forma de menu de alcance o de como seguir.` };
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
    return ['PREGUNTA-GUARD: repensa esta pregunta antes de que le llegue a Fak.',
        ...hallazgos.map((h) => `  [${h.regla}] ${h.motivo}`),
        DOS_CAMINOS,
    ].join('\n');
}

const esCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esCli) {
    let crudo = '';
    try { crudo = fs.readFileSync(0, 'utf8'); } catch { /* sin stdin */ }
    let entrada = null;
    try { entrada = JSON.parse(crudo.replace(/^﻿/, '')); } catch { /* payload ilegible: deja pasar */ }
    const r = evaluarPregunta(entrada?.tool_input);
    if (r.bloquea) {
        process.stderr.write(mensajeDeBloqueo(r.hallazgos) + '\n');
        process.exit(2);
    }
    const aviso = entrada ? RECORDATORIO : `[PREGUNTA-GUARD] OJO: no pude leer la pregunta (payload ilegible), sale sin revisar. ${RECORDATORIO}`;
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: aviso } }) + '\n');
    process.exit(0);
}
