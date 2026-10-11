/**
 * Las cuatro lecturas de Outlook de `scripts/_mails.py` (cola HOY-19a a d, 10/10/2026): `--nuevos`, `--abrir`,
 * `--borradores` y `--agenda`. La logica vive en `scripts/_lib/mailsLectura.py` y se prueba contra un Outlook de
 * mentira que ANOTA todo lo que no sea una lectura conocida (lista blanca) y cualquier llamada que escriba.
 *
 * Que se cuida aca:
 *   - que el selftest corra entero en CI (49 casos, con sus rojos: el formato de fecha equivocado en la agenda, la
 *     hora tomada con 3 h de corrimiento, una carpeta que no se puede leer, un id que no existe) y que el gemelo de la
 *     bitacora siga viendo una escritura;
 *   - que el codigo de las cuatro funciones no nombre ningun metodo que escriba en Outlook (regla mail-envio.md);
 *   - la CONSOLA entera contra el Outlook de mentira (`mailsLecturaConsola.py`): lo que imprime, lo que devuelve, lo
 *     que agrega al cache y que lo unico que le hace a Outlook es mostrar un mail;
 *   - que la consola no haga nada raro sin Outlook: `--abrir` sin id no abre nada, `--nuevos` con el cache vacio manda a
 *     `--sync` y no toca Outlook.
 * Mismo criterio que mailsSelftest.test.mjs: NUNCA skip si falta python.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LIB = path.join(RAIZ, 'scripts', '_lib', 'mailsLectura.py');
const SCRIPT = path.join(RAIZ, 'scripts', '_mails.py');
const CONSOLA = path.join(RAIZ, '__tests__', 'scripts', 'mailsLecturaConsola.py');
const py = (args, env = {}) => spawnSync('python', args, { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8', ...env }, timeout: 60_000 });
const temporal = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mailcache-lectura-'));
const limpiar = (dir) => { for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f)); fs.rmdirSync(dir); };

describe('mailsLectura.py --selftest (Outlook de mentira)', () => {
    const r = py([LIB, '--selftest']);
    it('los 49 casos pasan', () => {
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('todo verde (mailsLectura, 49 casos)');
        expect((r.stdout.match(/^  ok  /gm) || []).length).toBe(49);
        expect(r.stdout).not.toContain('MAL');
    });
    it('estan los rojos y los casos que encontraron las dos revisiones', () => {
        for (const caso of [
            'ROJO agenda: con la fecha en el formato equivocado el control da rojo',
            'ROJO agenda: sin citas sueltas en el rango, la sonda ve el formato equivocado',
            'ROJO agenda: si el filtro devuelve una de las dos iguales, el control lo ve',
            'ROJO agenda: si Outlook rechaza el filtro, sale control rojo con el motivo',
            'agenda: entra la reunion que ya empezo y sigue, y la de todo el dia de hoy',
            'agenda: con una sola cita suelta en 10/10 la sonda dice que NO pudo probar',
            'agenda: una tarea que vence hoy no sale como vencida',
            'nuevos: la hora se compara como hora de pared, sin correr 3 h',
            'nuevos: una carpeta que no se puede leer NO corta a su hermana ni a la nieta',
            'nuevos: un mail nuevo detras de 10 viejos igual entra',
            'ROJO corte_desde_cache: un borrador con anio 4501 no mueve el corte',
            'ROJO abrir: un id que no existe tira',
            'NINGUNA funcion guardo, mando, movio, borro ni cambio un item',
            'GEMELO: el Outlook de mentira anota un Save() y una asignacion',
            'GEMELO: y anota cualquier cosa que no sea una lectura conocida',
        ]) expect(r.stdout).toContain(`ok  ${caso}`);
    });
});

describe('las cuatro lecturas no nombran nada que escriba en Outlook', () => {
    // El codigo de las funciones es lo que esta ANTES del Outlook de mentira (que si nombra esos metodos, para anotarlos).
    const texto = fs.readFileSync(LIB, 'utf8');
    const corte = texto.indexOf('Outlook de mentira (selftest)');
    const funciones = texto.slice(texto.indexOf('OL_MAIL = 43'), corte);
    const PROHIBIDO = /\.(Send|Save|SaveAs|Delete|Move|Copy|Reply|ReplyAll|Forward|Close|Remove|Add|CreateItem|MarkAsTask|ClearTaskFlag|Respond|PrintOut|SetProperty)\s*\(|\bsetattr\s*\(/;
    const ASIGNA = /\.(UnRead|Subject|Body|To|CC|Categories|FlagStatus|Importance|Complete|ReminderSet|FlagRequest|Sensitivity|Start|End)\s*=[^=]/;
    it('el corte entre funciones y selftest existe', () => {
        expect(corte).toBeGreaterThan(1000);
        expect(funciones).toContain('def agenda(');
    });
    it('ninguna llamada que guarde, mande, mueva, borre o cree; ninguna asignacion a un campo de un item', () => {
        expect(funciones).not.toMatch(PROHIBIDO);
        expect(funciones).not.toMatch(ASIGNA);
        expect(funciones.match(/\.Display\(\)/g)).toHaveLength(1);          // solo abrir() muestra una ventana
    });
    it('GEMELO: los patrones si ven una escritura', () => {
        for (const mala of ['    it.Save()', 'm.Move(carpeta)', 'items.Remove(n)', 'ns.Application.CreateItem(0)', "setattr(m, 'UnRead', False)", 'ins.Close(0)']) expect(mala).toMatch(PROHIBIDO);
        expect('m.UnRead = False').toMatch(ASIGNA);
        expect('if x.Class == 43 and m.UnRead == True').not.toMatch(PROHIBIDO);
        expect('if m.UnRead == True').not.toMatch(ASIGNA);
    });
    it('la consola (_mails.py) tampoco: lo unico que guarda es un adjunto al disco', () => {
        const consola = fs.readFileSync(SCRIPT, 'utf8').replace(/^\s*#.*$/gm, '').replace(/"""[\s\S]*?"""/g, '');
        expect(consola).not.toMatch(/\.(Send|Save|Delete|Move|Copy|Reply|ReplyAll|Forward|Close|Remove|CreateItem|MarkAsTask)\s*\(|\bsetattr\s*\(/);
        expect(consola).not.toMatch(/\.(UnRead|Subject|Body|Categories|FlagStatus)\s*=[^=]/);
        expect(consola.match(/\.SaveAsFile\(/g)).toHaveLength(1);
    });
});

describe('la consola de las cuatro lecturas contra un Outlook de mentira (mailsLecturaConsola.py)', () => {
    const dir = temporal();
    const r = py([CONSOLA], { BARACK_MAIL_CACHE: dir });
    const casos = Object.fromEntries(r.stdout.trim().split(/\r?\n/).filter(Boolean).map((l) => { const j = JSON.parse(l); return [j.caso, j]; }));
    limpiar(dir);
    it('corre entera', () => {
        expect(r.status).toBe(0);
        expect(Object.keys(casos)).toHaveLength(11);
    });
    it('--nuevos trae el que falta, lo agrega al cache una sola vez y no revienta con un emoji en el asunto', () => {
        expect(casos.nuevos.codigo).toBe(0);
        expect(casos.nuevos.salida).toMatch(/nuevos al cache      : 1/);
        expect(casos.nuevos.salida).toMatch(/Mail nuevo con ñ/);
        expect(casos['nuevos otra vez'].salida).toMatch(/nuevos al cache      : 0/);
        expect(casos.FIN.cache).toEqual(['C1', 'N1']);
    });
    it('--abrir dice ABIERTO solo con la ventana a la vista, y avisa que el mail estaba sin leer', () => {
        expect(casos.abrir.codigo).toBe(0);
        expect(casos.abrir.salida).toMatch(/^ABIERTO en Outlook/);
        expect(casos.abrir.salida).toMatch(/SIN LEER y Outlook lo marca como leido al abrirlo/);
    });
    it('--borradores lista con la edad y dice que no mueve ni borra', () => {
        expect(casos.borradores.salida).toMatch(/BORRADORES DE OUTLOOK: 1 {2}\(solo lectura/);
        expect(casos.borradores.salida).toMatch(/100 d .*Borrador viejo/);
    });
    it('--agenda respeta los dias pedidos, trae lo que ya empezo y deja la copia en el cache', () => {
        const a = casos['agenda 3 dias'].salida;
        expect(a).toMatch(/\(3 dias\)/);
        expect(a).toMatch(/En curso/);
        expect(a).toMatch(/Pasado maniana/);
        expect(a).not.toMatch(/Fuera de 3 dias/);
        expect(a).toMatch(/control del filtro: ok .*cita de prueba: ok/);
        expect(JSON.parse(casos['agenda json'].salida).control.ok).toBe(true);
        expect(casos.FIN.agenda_json).toBe(true);
    });
    it('--adjuntos --abrir: abre la foto de un telefono (image0.jpeg), no la imagen de la firma; sin nada para abrir no dice abierto', () => {
        expect(casos.FIN.abiertos).toEqual(['image0.jpeg', 'Plano.pdf']);
        expect(casos['adjuntos: solo la firma'].codigo).toBe(1);
        expect(casos['adjuntos: solo la firma'].salida).toMatch(/NADA PARA ABRIR/);
        expect(casos['adjuntos: ninguno'].codigo).toBe(1);
        expect(casos['adjuntos: uno que no se ve abierto'].codigo).toBe(1);
    });
    it('en toda la corrida, lo unico que se le hizo a Outlook fue mostrar un mail', () => {
        expect(casos.FIN.bitacora).toEqual([['Display', 'N1']]);
    });
});

describe('_mails.py: las banderas nuevas, sin Outlook', () => {
    it('--abrir sin id no abre nada y explica', () => {
        const r = py([SCRIPT, '--abrir']);
        expect(r.status).toBe(2);
        expect(r.stderr).toMatch(/--abrir va con el id del mail/);
    });
    it('--nuevos con el cache vacio manda a --sync antes de hablar con Outlook', () => {
        const dir = temporal();
        const r = py([SCRIPT, '--nuevos'], { BARACK_MAIL_CACHE: dir });
        expect(r.status).not.toBe(0);
        expect(r.stderr).toMatch(/El cache esta vacio/);
        limpiar(dir);
    });
    it('--nuevos con --desde mal escrito no llega a Outlook', () => {
        const dir = temporal();
        fs.writeFileSync(path.join(dir, 'mails.jsonl'), JSON.stringify({ id: '1', carpeta: 'x / Bandeja de entrada', fecha: '2026-10-01 10:00', de: 'a', de_mail: 'a@x', para: '', cc: '', asunto: 's', adjuntos: [], cuerpo: '' }) + '\n');
        const r = py([SCRIPT, '--nuevos', '--desde', '10/10/2026'], { BARACK_MAIL_CACHE: dir });
        expect(r.status).not.toBe(0);
        expect(r.stderr).toMatch(/--desde va como AAAA-MM-DD/);
        limpiar(dir);
    });
    it('la ayuda lista las cuatro, y --dias sirve para las dos (5 en sin-respuesta, 7 en agenda)', () => {
        const r = py([SCRIPT, '--help']);
        for (const b of ['--nuevos', '--abrir', '--borradores', '--agenda']) expect(r.stdout).toContain(b);
        const codigo = fs.readFileSync(SCRIPT, 'utf8');
        expect(codigo).toContain('dias=5 if a.dias is None else a.dias');
        expect(codigo).toContain('dias=7 if a.dias is None else a.dias');
        expect(codigo).not.toContain("'--dias' in sys.argv");
    });
});
