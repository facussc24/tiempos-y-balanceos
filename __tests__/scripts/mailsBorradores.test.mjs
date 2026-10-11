/**
 * `scripts/_mails.py --limpiar-borradores [--mover]` (cola HOY-19k, 11/10/2026): lo unico de `_mails.py` que escribe en
 * Outlook. La logica vive en `scripts/_lib/mailsBorradores.py` y se prueba contra el Outlook de mentira de
 * `mailsLectura.py`, ampliado con UNA cosa permitida: mover un item hacia Elementos eliminados. Borrar, guardar,
 * transmitir, asignar un campo o mover a otra carpeta siguen quedando anotados, y el test falla si hay uno.
 *
 * Que se cuida aca:
 *   - que el selftest corra entero en CI (31 casos, con sus rojos y el gemelo de la bitacora);
 *   - que el codigo del modulo no nombre ningun metodo que borre, transmita o guarde, y que mueva en UN solo lugar;
 *   - la consola entera: sin lista no mueve, con Outlook cerrado no lo abre, la lista no mueve nada, el movimiento
 *     toca solo los de mas de 90 dias, nunca el de un programa, y un item que tira no corta a los demas.
 * Mismo criterio que mailsLectura.test.mjs: NUNCA skip si falta python.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LIB = path.join(RAIZ, 'scripts', '_lib', 'mailsBorradores.py');
const SCRIPT = path.join(RAIZ, 'scripts', '_mails.py');
const CONSOLA = path.join(RAIZ, '__tests__', 'scripts', 'mailsBorradoresConsola.py');
const py = (args, env = {}) => spawnSync('python', args, { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8', ...env }, timeout: 60_000 });

describe('mailsBorradores.py --selftest (Outlook de mentira)', () => {
    const r = py([LIB, '--selftest']);
    it('los 31 casos pasan', () => {
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('todo verde (mailsBorradores, 31 casos)');
        expect((r.stdout.match(/^  ok  /gm) || []).length).toBe(31);
        expect(r.stdout).not.toContain('MAL');
    });
    it('estan los casos del encargo, los rojos y el gemelo', () => {
        for (const caso of [
            'lista: no movio, no borro ni cambio nada',
            'mover: se mueven solo los viejos que siguen cumpliendo todo',
            'mover: el de un programa NUNCA se mueve',
            'mover: una excepcion en un item no corta a los demas',
            'mover: el que se modifico despues de la lista se omite',
            'mover: el que esta abierto en una ventana se omite',
            'NADA se borro, se guardo, se mando ni se asigno: la bitacora esta vacia',
            'ROJO: un borrador de 3 dias metido en la lista no se mueve',
            'ROJO: una segunda corrida no mueve nada mas',
            'mover: cada item se avisa al terminar, en orden',
            'ROJO: con la lista adulterada (dias 500, umbral -1) el de 3 dias tampoco se mueve',
            'ROJO: el de 90 dias justos no se mueve aunque la lista diga 91',
            'ROJO programa: lo frena el registro aunque la lista no lo marque',
            'ROJO programa: lo frena la marca de la lista aunque el registro ya no lo tenga',
            'ROJO: con una ventana que no se deja leer no se mueve ninguno',
            'ROJO: el que se esta escribiendo en el panel de lectura no se mueve',
            'ROJO: una llamada rechazada es un error',
            'ROJO: movido sin confirmar queda como error',
            'ROJO: si la cuenta final falla, lo movido ya quedo avisado',
            'ROJO: sin poder ver las ventanas abiertas no se mueve ninguno',
            'ROJO: si Eliminados resulta ser Borradores, se corta',
            'GEMELO: borrar, mover a otra carpeta y asignar un campo quedan anotados',
        ]) expect(r.stdout).toContain(`ok  ${caso}`);
    });
});

describe('el modulo mueve en un solo lugar y no nombra nada que borre, transmita o guarde', () => {
    const texto = fs.readFileSync(LIB, 'utf8');
    const corte = texto.indexOf('Outlook de mentira (selftest)');
    const funciones = texto.slice(texto.indexOf('ELIMINADOS = 3'), corte);
    const VERBOS = ['Send', 'Save', 'SaveAs', 'Delete', 'Copy', 'Reply', 'ReplyAll', 'Forward', 'Close', 'Remove', 'Add', 'CreateItem', 'MarkAsTask', 'Respond', 'PrintOut', 'SetProperty', 'Display'];
    const PROHIBIDO = new RegExp(`\\.(${VERBOS.join('|')})\\s*\\(|\\bsetattr\\s*\\(`);
    const ASIGNA = /\.(UnRead|Subject|Body|To|CC|Categories|FlagStatus|Importance|DeferredDeliveryTime)\s*=[^=]/;
    it('el corte entre funciones y selftest existe', () => {
        expect(corte).toBeGreaterThan(1000);
        expect(funciones).toContain('def mover(');
    });
    it('un solo movimiento, hacia la carpeta de Eliminados; ningun borrado, envio, guardado ni ventana', () => {
        expect(funciones).not.toMatch(PROHIBIDO);
        expect(funciones).not.toMatch(ASIGNA);
        expect(funciones.match(/\.Move\(/g)).toHaveLength(1);
        expect(funciones).toContain('it.Move(destino)');
        expect(funciones).toContain('GetDefaultFolder(ELIMINADOS)');
    });
    it('GEMELO: los patrones si ven cada verbo prohibido', () => {
        for (const v of VERBOS) expect(`it.${v}()`).toMatch(PROHIBIDO);
        expect('it.Subject = "x"').toMatch(ASIGNA);
        expect('it.Move(destino)').not.toMatch(PROHIBIDO);
    });
    it('la consola (_mails.py) no mueve por su cuenta: llama al modulo', () => {
        const consola = fs.readFileSync(SCRIPT, 'utf8').replace(/^\s*#.*$/gm, '').replace(/"""[\s\S]*?"""/g, '');
        expect(consola).not.toMatch(new RegExp('\\.(Move|Delete|Save|' + 'Send)\\s*\\('));
        expect(consola).toContain('mailsBorradores.mover(ns, p, registro, al_fila=anotar)');
        // limpiar-borradores no usa el camino que ABRE Outlook
        const fn = consola.slice(consola.indexOf('def limpiar_borradores('), consola.indexOf('def ver_agenda('));
        expect(fn.length).toBeGreaterThan(500);
        expect(fn).not.toContain('_outlook_de_la_persona');
        expect(fn).not.toContain('asegurar_outlook');
    });
});

describe('la consola de --limpiar-borradores contra un Outlook de mentira (mailsBorradoresConsola.py)', () => {
    const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'mailcache-borr-'));
    const salida = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'borr-salida-')), 'BORRADORES');
    const r = py([CONSOLA, salida], { BARACK_MAIL_CACHE: cache });
    const casos = Object.fromEntries(r.stdout.trim().split(/\r?\n/).filter(Boolean).map((l) => { const j = JSON.parse(l); return [j.caso, j]; }));
    fs.rmSync(cache, { recursive: true, force: true });
    fs.rmSync(path.dirname(salida), { recursive: true, force: true });
    it('corre entera', () => {
        expect(r.stderr).toBe('');
        expect(r.status).toBe(0);
        expect(Object.keys(casos)).toHaveLength(13);
    });
    it('--mover sin una lista guardada no hace nada', () => {
        expect(casos['mover sin lista'].codigo).toBe(3);
        expect(casos['mover sin lista'].salida).toMatch(/NO SE HIZO: no hay una lista guardada/);
        expect(casos['mover sin lista'].movs).toEqual([]);
    });
    it('con Outlook cerrado no lo abre y lo dice', () => {
        expect(casos['outlook cerrado'].codigo).toBe(3);
        expect(casos['outlook cerrado'].salida).toMatch(/Outlook esta cerrado .* esta funcion no lo abre/);
        expect(casos['outlook cerrado'].archivos).toEqual([]);
    });
    it('no acepta «viejo» de menos de 30 dias', () => {
        expect(casos['menos de 30 dias'].codigo).toBe(3);
        expect(casos['menos de 30 dias'].salida).toMatch(/--viejos no puede ser menos de 30/);
    });
    it('la lista se guarda y no mueve nada', () => {
        const c = casos.lista;
        expect(c.codigo).toBe(0);
        expect(c.salida).toMatch(/BORRADORES DE OUTLOOK: 5 {2}\| {2}de mas de 90 dias: 4 {2}\| {2}de esos, armados por un programa \(no se mueven\): 1/);
        expect(c.salida).toMatch(/No se movio nada/);
        expect(c.archivos).toEqual(['lista.json', 'lista.md']);
        expect(c.movs).toEqual([]);
        const md = casos.FIN.lista_md;
        expect(md).toMatch(/Se mueven a Elementos eliminados: \*\*3\*\*/);
        expect(md).toMatch(/\| Viejo uno \| Carlos Baptista \| sí \(1\) \| se mueve a Elementos eliminados \|/);
        expect(md).toMatch(/\| Viejo de un programa \| Carlos Baptista \| no \| no se mueve: lo armó un programa \|/);
        expect(md).toMatch(/no se vacía al cerrar Outlook/);
        expect(md).not.toMatch(/De este mes/);
    });
    it('si Outlook vacia Eliminados al cerrarse, no mueve (mover seria borrar)', () => {
        expect(casos['eliminados se vacia al cerrar'].codigo).toBe(3);
        expect(casos['eliminados se vacia al cerrar'].movs).toEqual([]);
    });
    it('si no se pudo leer esa configuracion, tampoco mueve', () => {
        expect(casos['no se sabe si se vacia'].codigo).toBe(3);
        expect(casos['no se sabe si se vacia'].movs).toEqual([]);
    });
    it('--mover con un --viejos distinto del de la lista no mueve: manda lo que dice la lista', () => {
        expect(casos['viejos distinto de la lista'].codigo).toBe(3);
        expect(casos['viejos distinto de la lista'].salida).toMatch(/la lista guardada es de mas de 90 dias y pediste --viejos 60/);
        expect(casos['viejos distinto de la lista'].movs).toEqual([]);
    });
    it('si el registro de los programas existe y no se puede leer, no mueve nada', () => {
        expect(casos['registro ilegible'].codigo).toBe(3);
        expect(casos['registro ilegible'].salida).toMatch(/borradores_claude\.json\) no se/);
        expect(casos['registro ilegible'].movs).toEqual([]);
    });
    it('una lista con la que ya se movio no se pisa', () => {
        expect(casos['lista despues de mover'].codigo).toBe(3);
        expect(casos['lista despues de mover'].salida).toMatch(/ya se movieron borradores\. No la piso/);
        expect(casos.FIN.lista_md).toMatch(/Viejo uno/);
    });
    it('las tres funciones que la corrida reemplaza: Outlook abierto, vaciar al cerrar y el registro', () => {
        expect(casos.PURAS.abierto).toEqual([true, false, false]);            // con procesos, sin procesos, sin poder saber
        // sin claves · preferencias sin el valor · prendido · apagado y una politica lo prende · prendido y una politica lo apaga
        expect(casos.PURAS.vacia).toEqual([null, false, true, true, false]);
        expect(casos.PURAS.registro).toEqual([[[], 'ausente'], 'ok']);
    });
    it('--mover mueve solo los viejos, nunca el de un programa, y el que tira no corta a los demas', () => {
        const c = casos.mover;
        expect(c.codigo).toBe(1);                       // hubo un item con error: el codigo lo dice
        expect(c.salida).toMatch(/en la lista: 4 {2}\| {2}movidos a Elementos eliminados: 2 {2}\| {2}omitidos: 1 {2}\| {2}con error: 1/);
        expect(c.salida).toMatch(/borradores antes: 5 {2}\| {2}despues: 3/);
        expect(c.salida).toMatch(/omitido .*Viejo de un programa/);
        expect(c.salida).toMatch(/error .*El que tira .*item bloqueado/);
        expect([...c.movs].sort()).toEqual(['V1', 'V2']);
        expect(casos.FIN.borradores).toEqual(['E1', 'N1', 'P1']);
        expect(casos.FIN.eliminados).toEqual(['V1', 'V2']);
        expect(c.archivos).toEqual(['lista.json', 'lista.md', 'movimientos.jsonl', 'movimientos.md']);
        expect(casos.FIN.log.slice(0, 4)).toEqual(['movido', 'omitido', 'error', 'movido']);     // un renglon por item, en el momento
    });
    it('una segunda corrida no mueve nada mas y suma su registro', () => {
        expect([...casos['mover otra vez'].movs].sort()).toEqual(['V1', 'V2']);
        expect(casos['mover otra vez'].salida).toMatch(/movidos a Elementos eliminados: 0/);
        expect(casos.FIN.movimientos_md.match(/# Movimiento de borradores/g)).toHaveLength(2);
    });
    it('en toda la corrida no se borro, guardo, transmitio ni asigno nada en Outlook', () => {
        expect(casos.FIN.bitacora).toEqual([]);
    });
});

describe('_mails.py: las banderas, sin Outlook', () => {
    it('--mover solo, sin --limpiar-borradores, no hace nada y explica', () => {
        const r = py([SCRIPT, '--mover']);
        expect(r.status).toBe(2);
        expect(r.stderr).toMatch(/--mover va con --limpiar-borradores/);
    });
    it('la ayuda lista las tres', () => {
        const r = py([SCRIPT, '--help']);
        for (const b of ['--limpiar-borradores', '--mover', '--viejos']) expect(r.stdout).toContain(b);
    });
});
