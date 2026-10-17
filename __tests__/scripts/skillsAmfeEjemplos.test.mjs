/**
 * skillsAmfeEjemplos — lo que una skill de AMFE enseña como BIEN pasa por el mismo validador que el AMFE (tanda 12,
 * 17/10/2026).
 *
 * POR QUE: el ejemplo canonico de funcion de amfe-domain §1 decia «Gap & Flush fuera de spec», y
 * `ENGLISH_RANDOM_TERMS` (CRITICAL; Fak 19/08/2026: "no puedo enviar amfes con palabras asi... queda obvio que los
 * hiciste vos") lo frena en el documento (la sigla «S&R» que estaba al lado no esta en la lista: no la ve). Una skill que enseña lo que el gate rechaza produce el rechazo. Se miran
 * solo los ejemplos que la skill da como buenos: los bloques de codigo del §1 de amfe-domain y la columna «Bien» de
 * sus tablas; los «Mal» quedan afuera a proposito.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { scanForbidden } from '../../scripts/_lib/forbiddenContent.mjs';

const SKILLS = path.join(process.cwd(), '.claude', 'skills');
const leer = (s) => fs.readFileSync(path.join(SKILLS, s, 'SKILL.md'), 'utf8');

/** Texto de los bloques ``` de una seccion (desde el titulo `## N.` hasta el siguiente `## `). */
function bloquesDeSeccion(md, numero) {
    const ini = md.search(new RegExp(`^## ${numero}\\.`, 'm'));
    if (ini < 0) return [];
    const resto = md.slice(ini + 3);
    const fin = resto.search(/^## /m);
    const seccion = fin < 0 ? resto : resto.slice(0, fin);
    return [...seccion.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((m) => m[1]);
}

/** Celdas de la columna «Bien» de las tablas markdown cuyo encabezado la tiene. */
function columnaBien(md) {
    const out = [];
    const lineas = md.split('\n');
    for (let i = 0; i < lineas.length; i++) {
        const cab = lineas[i].split('|').map((c) => c.trim());
        const k = cab.findIndex((c) => /^Bien\b/i.test(c));
        if (k < 0 || !/^\|?\s*-/.test(lineas[i + 1] ?? '')) continue;
        for (let j = i + 2; j < lineas.length && lineas[j].trim().startsWith('|'); j++) {
            out.push(lineas[j].split('|').map((c) => c.trim())[k] ?? '');
        }
    }
    return out.filter(Boolean);
}

describe('los ejemplos BIEN de las skills de AMFE pasan el validador del AMFE', () => {
    const domain = leer('amfe-domain');
    it('amfe-domain §1: los niveles de funcion canonicos no llevan vocabulario prohibido', () => {
        const bloques = bloquesDeSeccion(domain, 1);
        expect(bloques.length).toBeGreaterThan(0);
        for (const b of bloques) expect(scanForbidden(b).forbidden, b.slice(0, 80)).toEqual([]);
    });
    it('amfe-domain: la columna «Bien» de las tablas no lleva vocabulario prohibido', () => {
        const bien = columnaBien(domain);
        expect(bien.length).toBeGreaterThan(0);
        for (const t of bien) expect(scanForbidden(t).forbidden, t).toEqual([]);
    });
    it('el control da ROJO con el ejemplo viejo (antes del 17/10/2026)', () => {
        const viejo = 'Función del Cliente: Permitir ensamble en panel de puerta sin interferencia ni Gap & Flush fuera de spec';
        expect(scanForbidden(viejo).forbidden.map((f) => f.term)).toEqual(expect.arrayContaining(['gap & flush']));
    });
});
