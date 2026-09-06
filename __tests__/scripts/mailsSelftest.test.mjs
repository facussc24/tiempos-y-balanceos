/**
 * Corre el selftest de `_mails.py` (el detector de sync parcial) desde la suite, para que
 * CI lo ejecute. El selftest no necesita Outlook ni pywin32: es la funcion pura
 * `evaluar_parcial` contra 9 casos sinteticos.
 *
 * Por que existe: la version anterior del detector daba PARCIAL en TODAS las corridas
 * (comparaba la ventana del .ost contra el cache historico entero) — un control que da
 * siempre lo mismo no detecta nada, y este test impide que una regresion lo devuelva a
 * ese estado sin que nadie lo note. Son 9 casos: 3 rotulados ROJO, 2 avisos de ventana
 * achicada, y 4 que tienen que dar OK.
 *
 * Mismo criterio que pdfBomArb.test.mjs: NUNCA skip si falta python — un test salteado
 * es un verde vacio, y el runner de CI ya instala Python 3.12 para pdfBomArb.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', '_mails.py');

describe('_mails.py --selftest (detector de sync parcial)', () => {
    it('los 9 casos pasan, y el rojo sigue siendo rojo', () => {
        const out = execFileSync('python', [SCRIPT, '--selftest'], { encoding: 'utf8' });
        expect(out).toContain('todo verde');
        // Ola 4 (05/09/2026): el mismo selftest corre los 18 casos de pedidos_sin_respuesta (16 + los 2 de acuses).
        expect(out).toContain('todo verde (sin respuesta)');
        const bloque = out.slice(out.indexOf('selftest de pedidos_sin_respuesta'));
        expect((bloque.match(/^  ok  /gm) || []).length).toBe(18);
        expect(bloque).toMatch(/ROJO: pedido de hace 14 dias sin mail de Fak.*'sin respuesta'/);
        expect(bloque).toMatch(/en cola de salida/);
        expect(out).not.toContain('MAL');
        // Que el rojo siga siendo rojo: 5 veredictos PARCIAL (los 3 casos ROJO + las dos
        // corridas de aviso de "ventana achicada"; la tercera de esas ya acepta base y da OK).
        expect((out.match(/-> PARCIAL/g) ?? []).length).toBe(5);
    });
});

describe('_mails.py --sin-respuesta --json sobre un cache temporal (BARACK_MAIL_CACHE)', () => {
    it('lista el pedido de hace 14 dias, no el contestado, y sale JSON parseable', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mailcache-'));
        // Fecha LOCAL (no toISOString, que es UTC): _mails.py cuenta los dias desde date.today() local, y
        // despues de las 21:00 de Argentina el dia UTC ya es el siguiente (el 05/09 a las 21:30 dio 13 en vez de 14).
        const hace = (d) => { const f = new Date(Date.now() - d * 86400000); const p = (n) => String(n).padStart(2, '0');
            return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())} 10:00`; };
        const ENT = 'f.santoro@barackmercosul.com / Bandeja de entrada';
        const ENV = 'f.santoro@barackmercosul.com / Elementos enviados';
        const m = (id, carpeta, fecha, de, asunto, para = 'Facundo Santoro') =>
            JSON.stringify({ id, carpeta, fecha, de, de_mail: de === 'Facundo Santoro' ? 'f.santoro@barackmercosul.com' : 'x@x.com', para, cc: '', asunto, adjuntos: [], cuerpo: '' });
        fs.writeFileSync(path.join(dir, 'mails.jsonl'), [
            m('1', ENT, hace(14), 'Pablo Gamboa', 'Alta codigos 21-9694/95'),
            m('2', ENT, hace(9), 'Carlos Baptista', 'Medios carton'),
            m('3', ENV, hace(8), 'Facundo Santoro', 'RE: Medios carton', 'Carlos Baptista'),
            m('4', ENT, hace(2), 'Federico Kipersain', 'BOM IP Pad'),
        ].join('\n') + '\n');
        const out = execFileSync('python', [SCRIPT, '--sin-respuesta', '--json'], {
            encoding: 'utf8', env: { ...process.env, BARACK_MAIL_CACHE: dir, PYTHONIOENCODING: 'utf-8' },
        });
        const datos = JSON.parse(out.trim().split(/\r?\n/).pop());
        expect(datos.total).toBe(1);
        expect(datos.pedidos[0]).toMatchObject({ hilo: 'alta codigos 21 9694 95', de: 'Pablo Gamboa', dias: 14, estado: 'sin respuesta', id: '1' });
        // el texto plano tampoco revienta (la consola cp1252 tumbaba el listado con un emoji en el asunto)
        const txt = execFileSync('python', [SCRIPT, '--sin-respuesta'], { encoding: 'utf8', env: { ...process.env, BARACK_MAIL_CACHE: dir } });
        expect(txt).toMatch(/PEDIDOS SIN RESPUESTA/);
        expect(txt).toMatch(/14 d  Pablo Gamboa/);
        fs.rmSync(dir, { recursive: true, force: true });
    });
});
