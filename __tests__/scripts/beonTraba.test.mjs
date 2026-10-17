/**
 * beonTraba — la traba de lectura de BeOn (skill beon §10), probada sobre una ventana simulada (tanda 12, 17/10/2026).
 *
 * POR QUE: en BeOn "Emision de Informe" manda a VW y vale como firma; despues Barack ya no corrige nada (skill §0.2).
 * La traba es lo que deja leer el portal sin que un clic escriba. Hasta hoy era un parrafo reescrito a mano cada vez.
 * ROJO: guardar, finalizar registro, emitir, borrar y el cartel propio de BeOn quedan cortados. VERDE: buscar,
 * paginar, reset, cambiar de pestaña y abrir un informe pasan.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const CODIGO = fs.readFileSync(path.join(process.cwd(), '.claude', 'skills', 'beon', 'traba.js'), 'utf8');

/**
 * Corre el archivo como lo corre javascript_tool, pero con la ventana simulada: sin los comentarios de arriba (un
 * `return` seguido de un salto de linea devuelve undefined) y con `window` como parametro.
 */
const sinComentarios = CODIGO.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n').trim();
const correr = (w) => new Function('window', `return ${sinComentarios}`)(w);

/** Una ventana de BeOn simulada: cada funcion anota lo que se le pidio. */
function ventana() {
    const hecho = [];
    const w = {
        formSubmit: (a) => { hecho.push(`formSubmit:${a}`); return true; },
        formSubmit2: (a) => { hecho.push(`formSubmit2:${a}`); return true; },
        buttonConfirm: (a) => { hecho.push(`buttonConfirm:${a}`); return true; },
        buttonConfirmOk: () => { hecho.push('buttonConfirmOk'); return true; },
        confirm: () => true,
    };
    const resultado = correr(w);
    return { w, hecho, resultado };
}

describe('traba de lectura de BeOn (skill beon §10)', () => {
    it('VERDE: buscar, paginar, reset, cambiar de pestaña y abrir un informe pasan', () => {
        const { w, hecho } = ventana();
        for (const a of ['search', 'nextSearch', 'reset', 'changeCard']) w.formSubmit(a);
        w.formSubmit2('openEmpb[3]');
        expect(hecho).toEqual(['formSubmit:search', 'formSubmit:nextSearch', 'formSubmit:reset', 'formSubmit:changeCard', 'formSubmit2:openEmpb[3]']);
    });
    it('ROJO: guardar, finalizar, emitir, borrar y abrir el anexo para editar quedan cortados y anotados', () => {
        const { w, hecho } = ventana();
        for (const a of ['save', 'finishRegistration', 'sendReport', 'delete', 'openVDAAnlageProduktEntwicklung[2]']) expect(w.formSubmit(a)).toBe(false);
        expect(w.formSubmit2('save')).toBe(false);
        expect(hecho).toEqual([]);
        expect(w.__trabaBeon.cortados).toHaveLength(6);
    });
    it('ROJO: el confirm del navegador y el cartel propio de BeOn devuelven false y no corren', () => {
        const { w, hecho } = ventana();
        expect(w.confirm('¿Seguro?')).toBe(false);
        expect(w.buttonConfirm('deletePruefDoc[0]')).toBe(false);
        expect(w.buttonConfirmOk()).toBe(false);
        expect(hecho).toEqual([]);
        expect(w.__trabaBeon.cortados).toEqual(['confirm: ¿Seguro?', 'buttonConfirm: deletePruefDoc[0]', 'buttonConfirmOk: ']);
    });
    it('pegarla dos veces no la duplica, y avisa', () => {
        const { w } = ventana();
        expect(correr(w)).toMatch(/^traba ya puesta/);
    });
    it('la primera vez devuelve "traba puesta" (lo que ve javascript_tool)', () => {
        expect(ventana().resultado).toBe('traba puesta');
    });
    it('ROJO: en una pagina sin formSubmit ni formSubmit2 NO dice "traba puesta" (auditor de la tanda 12)', () => {
        const w = { confirm: () => true };
        expect(correr(w)).toMatch(/^OJO: NO hay traba/);
        // cuando la pagina termina de cargar, pegarla de nuevo traba de verdad
        const hecho = [];
        w.formSubmit = (a) => { hecho.push(a); return true; };
        expect(correr(w)).toBe('traba puesta');
        expect(w.formSubmit('save')).toBe(false);
        expect(hecho).toEqual([]);
    });
});
