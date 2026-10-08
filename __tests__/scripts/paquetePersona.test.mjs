/**
 * Tests de `tools/claude-area/persona/armar.mjs` — el paquete "el Claude de Ingenieria para otra persona".
 *
 * POR QUE EXISTE ESTE ARCHIVO
 *
 * 07/10/2026: a la PC de Carlos Baptista se le copiaron las 416 memorias de Facundo tal cual. Su Claude
 * decia que el usuario era Facundo, con su mail, y que Carlos iba siempre en copia. El 08/10 Fak pidio lo
 * mismo para Pedro Ergo, pero que lo reconozca a Pedro. `validarTexto()` es el control que corre sobre TODO
 * lo que sale del paquete y no lo deja armar si queda algo de Facundo; `limpiarTexto()` es lo que lo limpia.
 * Se prueban en las dos direcciones: lo que tiene que frenar frena, y lo que es de la empresa pasa.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validarTexto, limpiarTexto, descripcion, TOPE_INDICE, HERRAMIENTAS } from '../../tools/claude-area/persona/armar.mjs';

const DATOS = JSON.parse(readFileSync(join(__dirname, '..', '..', 'tools', 'claude-area', 'persona', 'memorias.data.json'), 'utf8'));

describe('validarTexto: lo que es de Facundo no sale', () => {
    const frena = [
        ['Fak pidio que se haga asi', 'Fak'],
        ['Fak: *"hacelo"*', 'Fak con dos puntos'],
        ['lo dijo FAK en la reunion', 'FAK'],
        ['mandar a f.santoro@barackmercosul.com', 'su mail'],
        ['C:\\Users\\FacundoS-PC\\BARACK ARGENTINA SRL\\x.xlsx', 'su PC'],
        ['C:/Users/facun/Downloads/a.xlsx', 'su PC vieja'],
        ['Carlos Baptista va como minimo en CC', 'Carlos en copia'],
        ['Carlos siempre en copia', 'Carlos siempre en copia'],
        ['todos los mails van siempre en copia a Calidad', 'copia fija'],
        ['Calidad dijo "hecho con IA"', 'IA'],
        ['no entendi un carajo', 'mala palabra'],
        ['el link ese de mierda', 'mala palabra'],
    ];
    for (const [t, que] of frena) it(`frena: ${que}`, () => { expect(validarTexto(t, 'x.md').length).toBeGreaterThan(0); });

    const pasa = [
        'Facundo Santoro (Ingenieria) lo midio en planta',
        'Realizo F.Santoro / Aprobo G.Cal',
        'SANLEATHER ESP.3,00 S/FORRO',
        'Articulo y Artículo con tilde',
        'la disputa con el proveedor',
        'el mail de Pedro es paergo@barackmercosul.com',
        'Mail a Carlos con copia a Manuel (asunto Upper Trimming)',
        'Fakir no es un nombre de la casa',
    ];
    for (const t of pasa) it(`pasa: ${t}`, () => { expect(validarTexto(t, 'x.md')).toEqual([]); });
});

describe('limpiarTexto: cambia lo de Facundo y deja la cita entera', () => {
    it('Fak pasa a Facundo, tambien "Fak (yo)"', () => {
        const { texto } = limpiarTexto('Fak dijo que si. Fak (yo) hago el 3.', { archivo: 'a.md' });
        expect(texto).toBe('Facundo dijo que si. Facundo hago el 3.');
    });
    it('las malas palabras de una cita se cambian por una neutra y la cita queda', () => {
        const { texto, quitadas } = limpiarTexto('Fak: *"no entendi un carajo"* y *"no quiero notas de mierda ni carpetas"*', { archivo: 'a.md' });
        expect(texto).toBe('Facundo: *"no entendi nada"* y *"no quiero notas ni carpetas"*');
        expect(quitadas).toEqual([]);
    });
    it('"un carajo" partido en dos renglones', () => {
        const { texto } = limpiarTexto('no voy a mandar un\ncarajo el mail', { archivo: 'a.md' });
        expect(texto).toBe('no voy a mandar nada\nel mail');
    });
    it('saca el renglon de como se le contesta a Pedro y los ids de sesion', () => {
        const { texto, quitadas } = limpiarTexto('uno\n**Mail a Pedro Ergo** (`paergo@`): Fak le contesta con Carlos en copia\noriginSessionId: abc\ndos', { archivo: 'a.md' });
        expect(texto).toBe('uno\ndos');
        expect(quitadas.length).toBe(2);
    });
    it('rutas de la PC de Facundo pasan a %USERPROFILE% y el nombre de la PC a "la PC de Facundo"', () => {
        const { texto } = limpiarTexto('en C:\\Users\\FacundoS-PC\\Desktop\\x y creator = FacundoS-PC', { archivo: 'a.md' });
        expect(texto).toBe('en %USERPROFILE%\\Desktop\\x y creator = la PC de Facundo');
    });
    it('un link a una memoria que no va queda como texto; uno que va, como link', () => {
        const incluidas = new Set(['reference_si']);
        const { texto } = limpiarTexto('ver [[reference_si]] y [[feedback_no]]', { archivo: 'a.md', incluidas });
        expect(texto).toBe('ver [[reference_si]] y `feedback_no`');
    });
    it('en una skill se sacan las filas de guardianes y pruebas del repo; en una memoria quedan', () => {
        const t = 'a\n| guardian | `.claude/hooks/x.sh` |\nb';
        expect(limpiarTexto(t, { archivo: 'apqp-legajo/SKILL.md' }).texto).toBe('a\nb');
        expect(limpiarTexto(t, { archivo: 'reference_x.md' }).texto).toBe(t);
    });
    it('en una skill el que aprueba es la persona; en una memoria, Facundo sigue siendo la fuente', () => {
        const t = 'Enviar solo con OK de Fak. Preguntarle a Fak antes. Fak decide el numero.';
        expect(limpiarTexto(t, { archivo: 'imds/SKILL.md' }).texto).toBe('Enviar solo con OK de la persona. Preguntarle a la persona antes. la persona decide el numero.');
        expect(limpiarTexto(t, { archivo: 'imds/reference/manual.md' }).texto).toContain('OK de la persona');
        expect(limpiarTexto(t, { archivo: 'reference_imds.md' }).texto).toBe('Enviar solo con OK de Facundo. Preguntarle a Facundo antes. Facundo decide el numero.');
        expect(limpiarTexto(t, { archivo: 'conocimiento/comun/donde-vive.md' }).texto).toContain('OK de Facundo');
    });
    it('lo limpio pasa el control', () => {
        const sucio = 'Fak: *"ni puta idea"*\nC:/Users/FacundoS-PC/a\n**Mail a Pedro Ergo** x';
        expect(validarTexto(limpiarTexto(sucio, { archivo: 'a.md' }).texto)).toEqual([]);
    });
});

describe('el indice MEMORY.md entra entero en lo que lee Claude', () => {
    it('la descripcion se corta en 100 caracteres', () => {
        const d = descripcion(`---\ndescription: "${'x'.repeat(300)}"\n---`);
        expect(d.length).toBeLessThanOrEqual(100);
    });
    it('el tope queda por debajo de lo que lee Claude Code (200 renglones, 25.000 caracteres)', () => {
        expect(TOPE_INDICE.renglones).toBeLessThan(200);
        expect(TOPE_INDICE.caracteres).toBeLessThan(25000);
    });
});

describe('memorias.data.json: lo que no va, no esta en la lista', () => {
    const noVan = [
        'feedback_carlos_baptista_siempre_en_copia.md', 'reference_acceso_mails_outlook.md', 'project_claudes_por_area.md',
        'project_seguimientos_con_fecha.md', 'feedback_mails_a_calidad_cecilia_sin_flancos.md', 'project_escritorio_fak_tareas.md',
        'reference_una_sola_pc_facu.md', 'project_reunion_amfe_calidad_2026-10.md', 'project_taller_de_motores_walter_pirfo.md',
        'project_reporte_meta_ads_barack_mobility.md', 'project_upper_trimming_flujograma_amfe.md', 'project_mails_del_equipo_a_la_nube.md',
    ];
    it('ninguna de las personales de Facundo', () => { for (const n of noVan) expect(DATOS.van).not.toContain(n); });
    it('ninguna feedback: van resumidas en los principios', () => { expect(DATOS.van.filter((f) => f.startsWith('feedback_'))).toEqual([]); });
    it('sin repetidas', () => { expect(new Set(DATOS.van).size).toBe(DATOS.van.length); });
    it('sin las skills que escriben en la base de la app de AMFE', () => {
        for (const s of ['supabase-safety', 'apqp-schema', 'amfe-cookbook', 'pieza-nueva-flujograma-amfe']) expect(DATOS.skills).not.toContain(s);
    });
    it('la caja de herramientas trae los cinco zip en el orden en que se abren', () => {
        expect(HERRAMIENTAS).toEqual(['repo.zip', 'node_modules.zip', 'node.zip', 'python.zip', 'playwright.zip']);
    });
});
