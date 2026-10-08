/**
 * `_mails.py` lee tambien los mails del equipo que ya estan en la nube de Ingenieria (07/10/2026).
 *
 * El caso real: le dije a Fak "el correo de Carlos no lo puedo leer, solo tengo acceso al tuyo" y era falso: los mails
 * de Carlos (cbaptista) y de la PC que era de Marcelo (lucca.tuccio) suben solos a
 * `<biblioteca>\_CUARENTENA_Claude Barack\mails\_entrada\<persona>\*.jsonl`, y la herramienta solo miraba el Outlook de
 * Fak. Fak: "si lo podes leer, esta en la nube... desde cuando no recordas eso?".
 *
 * Se prueba en las dos direcciones, contra una nube DE MENTIRA en el TEMP (BARACK_MAIL_EQUIPO + BARACK_MAIL_CACHE):
 *   - lo que tiene que aparecer: un mail de la nube del equipo, con su buzon; el mismo mail en dos buzones, una vez;
 *   - lo que NO puede aparecer nunca: lo que esta en `_cuarentena\` (por la ruta o por un enlace que apunte ahi), lo de
 *     una carpeta `_oculta`, y la nube PERSONAL de Fak;
 *   - lo que no puede romper: sin la nube a la vista el buzon de Fak sigue andando, y los avisos de un robot (mismo texto,
 *     otro destinatario) no se cuentan como el mismo mail.
 * Mismo criterio que mailsSelftest.test.mjs: NUNCA skip si falta python.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', '_mails.py');

const FAK_ENT = 'f.santoro@barackmercosul.com / Bandeja de entrada';
const FAK_ENV = 'f.santoro@barackmercosul.com / Elementos enviados';
const CARLOS_ENT = 'cbaptista@barackmercosul.com / Bandeja de entrada';
const CARLOS_ENV = 'cbaptista@barackmercosul.com / Elementos enviados';
const MARCELO_ENT = 'marcelo.nieve@barackmercosul.com / Bandeja de entrada';

// Un mail como lo guarda el cache de Fak: el remitente interno viene como DN de Exchange, no como direccion.
const fakMail = (id, carpeta, fecha, de, asunto, para, cuerpo, adjuntos = []) => ({
    id, carpeta, fecha, de, de_mail: `/O=EXCHANGELABS/OU=EXCHANGE ADMINISTRATIVE GROUP/CN=RECIPIENTS/CN=${id}`, para, cc: '', asunto, adjuntos, cuerpo,
});
// Un mail como lo sube la PC de un companero: Message-ID en `id`, su EntryID en `eid`.
const nubeMail = (id, carpeta, fecha, de, asunto, para, cuerpo, adjuntos = []) => ({
    id, eid: `EID-${id}`, carpeta, fecha, de, de_mail: 'x@barackmercosul.com', para, cc: '', asunto, conversacion: 'CONV', cuerpo, para_mails: [], cc_mails: [], adjuntos,
});
const jsonl = (lista) => lista.map((m) => JSON.stringify(m)).join('\n') + '\n';
const escribir = (ruta, texto) => { fs.mkdirSync(path.dirname(ruta), { recursive: true }); fs.writeFileSync(ruta, texto); };

const TEXTO_A = 'Buenas, te paso el plano del 0428 para que lo revises antes del viernes';
const FILAS_FAK = [
    // A: esta en Fak y en cbaptista (su Elementos enviados, un minuto despues): UN solo resultado
    fakMail('EID-FAK-A', FAK_ENT, '2026-10-05 10:00', 'Carlos Baptista', 'Plano 0428 ZZ-COMPARTIDO', 'Facundo Santoro', TEXTO_A, ['plano0428.pdf']),
    // B: solo de Fak
    fakMail('EID-FAK-B', FAK_ENT, '2026-10-05 11:00', 'Pablo Gamboa', 'Consulta de codigos ZZ-SOLOFAK', 'Facundo Santoro', 'Necesito los codigos nuevos'),
    // E: aviso de un robot, mismo texto y hora que el de Carlos pero para OTRA persona: no es el mismo mail
    fakMail('EID-FAK-E', FAK_ENT, '2026-10-05 12:00', 'Portal VW', 'Aviso ZZ-ROBOT vence en 10 dias', 'Facundo Santoro', 'Las siguientes tareas vencen en 10 dias'),
];
const FILAS_CARLOS = [
    nubeMail('<A1@barack.local>', CARLOS_ENV, '2026-10-05 10:01', 'Carlos Baptista', 'Plano 0428 ZZ-COMPARTIDO', 'Facundo Santoro', TEXTO_A, ['plano0428.pdf']),
    nubeMail('<C1@barack.local>', CARLOS_ENT, '2026-10-05 15:00', 'Pablo Gamboa', 'Pedido de HO tapizado ZZ-SOLONUBE', 'Carlos Baptista', 'Carlos, necesito la HO de tapizado',
        ['HO-971-tapizado.pdf', 'foto.png']),
    nubeMail('<D1@barack.local>', CARLOS_ENT, '2026-10-05 16:00', 'Leo Lattanzi', 'Reunion ZZ-DOSBUZONES', 'Carlos Baptista; Marcelo Nieve', 'Reunion del jueves'),
    nubeMail('<E1@barack.local>', CARLOS_ENT, '2026-10-05 12:00', 'Portal VW', 'Aviso ZZ-ROBOT vence en 10 dias', 'Carlos Baptista', 'Las siguientes tareas vencen en 10 dias'),
    nubeMail('<F1@barack.local>', CARLOS_ENT, '2026-10-05 17:00', 'Leo Lattanzi', 'Sin adjuntos ZZ-SINADJ', 'Carlos Baptista', 'Solo texto'),
];
const FILAS_MARCELO = [
    nubeMail('<D1@barack.local>', MARCELO_ENT, '2026-10-05 16:00', 'Leo Lattanzi', 'Reunion ZZ-DOSBUZONES', 'Carlos Baptista; Marcelo Nieve', 'Reunion del jueves'),
    nubeMail('<M1@barack.local>', MARCELO_ENT, '2026-10-03 09:00', 'Pedro Ergo', 'Aviso de IMDS ZZ-MARCELO', 'Marcelo Nieve', 'Se rechazo el MDS'),
];
// Lo que el filtro aparto por privado: NO se lee nunca
const FILAS_CUARENTENA = [
    nubeMail('<P1@barack.local>', CARLOS_ENT, '2026-10-04 09:00', 'RRHH', 'Recibo de sueldo ZZ-CUARENTENA', 'Carlos Baptista', 'Detalle del sueldo ZZ-CUARENTENA'),
];

let raiz; let mails; let cache; let env;
const corre = (args, extra = {}) => {
    const r = spawnSync('python', [SCRIPT, ...args], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8', ...env, ...extra } });
    return { out: r.stdout || '', err: r.stderr || '', code: r.status, todo: `${r.stdout || ''}${r.stderr || ''}` };
};
const hits = (out) => (out.match(/^\[\d{4}-\d\d-\d\d \d\d:\d\d\]/gm) || []).length;
const idDe = (out, i = 0) => [...out.matchAll(/^ {4}id: (.+)$/gm)][i]?.[1];

beforeAll(() => {
    raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'mailsequipo-'));
    cache = path.join(raiz, 'cache');
    mails = path.join(raiz, 'mails');
    escribir(path.join(cache, 'mails.jsonl'), jsonl(FILAS_FAK));
    escribir(path.join(mails, '_entrada', 'cbaptista', '20261005-170000.jsonl'), jsonl(FILAS_CARLOS));
    escribir(path.join(mails, '_entrada', 'lucca.tuccio', '20261005-170000.jsonl'), jsonl(FILAS_MARCELO));
    escribir(path.join(mails, '_entrada', '_oculta', 'x.jsonl'), jsonl([nubeMail('<O1@barack.local>', CARLOS_ENT, '2026-10-01 09:00', 'Alguien', 'Mail ZZ-OCULTA', 'Carlos', 'oculto')]));
    escribir(path.join(mails, '_cuarentena', 'cbaptista', '20261005-170000.jsonl'), jsonl(FILAS_CUARENTENA));
    escribir(path.join(mails, '_cuarentena', 'lucca.tuccio', 'x.jsonl'), jsonl([nubeMail('<P2@barack.local>', MARCELO_ENT, '2026-10-04 09:00', 'RRHH', 'Licencia medica ZZ-CUARENTENA', 'Marcelo Nieve', 'ZZ-CUARENTENA')]));
    // Un enlace DENTRO de `_entrada` que apunta a la cuarentena: no se sigue
    fs.symlinkSync(path.join(mails, '_cuarentena', 'cbaptista'), path.join(mails, '_entrada', 'enlace'), 'junction');
    env = { BARACK_MAIL_CACHE: cache, BARACK_MAIL_EQUIPO: mails };
});

afterAll(() => {
    // El enlace se saca primero, y solo el: asi borrar el TEMP nunca puede seguirlo.
    const enlace = path.join(mails, '_entrada', 'enlace');
    try { fs.unlinkSync(enlace); } catch { try { fs.rmdirSync(enlace); } catch { /* sin enlace */ } }
    fs.rmSync(raiz, { recursive: true, force: true });
});

describe('--buscar mira los mails del equipo de la nube y dice de que buzon sale cada uno', () => {
    it('un mail que solo esta en la nube aparece, con su buzon y un id corto que sirve para --ver', () => {
        const r = corre(['--buscar', 'ZZ-SOLONUBE']);
        expect(r.code).toBe(0);
        expect(hits(r.out)).toBe(1);
        expect(r.out).toMatch(/buzon: cbaptista {2}\(nube del equipo\)/);
        expect(idDe(r.out)).toMatch(/^nube:[0-9a-f]{12}$/);
        expect(r.out).toContain('ADJUNTOS: HO-971-tapizado.pdf | foto.png');
    });

    it('la cabecera dice cada buzon, cuantos mails tiene y hasta que mail llega', () => {
        const r = corre(['--buscar', 'ZZ-SOLOFAK']);
        expect(r.out).toMatch(/cache: 3 de Fak \+ 5 solo del equipo \(nube\)/);
        expect(r.out).toContain('Fak 3 (hasta 2026-10-05 12:00)');
        expect(r.out).toContain('cbaptista 5 (hasta 2026-10-05 17:00)');
        expect(r.out).toContain('lucca.tuccio 2 (hasta 2026-10-05 16:00)');
    });

    it('el mismo mail en el buzon de Fak y en el de Carlos se muestra UNA vez, con los dos buzones y el id de Fak', () => {
        const r = corre(['--buscar', 'ZZ-COMPARTIDO']);
        expect(hits(r.out)).toBe(1);
        expect(r.out).toMatch(/buzones: Fak \+ cbaptista {2}\(el mismo mail en 2 buzones\)/);
        expect(idDe(r.out)).toBe('EID-FAK-A');
    });

    it('el mismo mail en dos buzones del equipo (mismo Message-ID) tambien sale una vez', () => {
        const r = corre(['--buscar', 'ZZ-DOSBUZONES']);
        expect(hits(r.out)).toBe(1);
        expect(r.out).toMatch(/buzones: cbaptista \+ lucca\.tuccio {2}\(el mismo mail en 2 buzones\)/);
    });

    it('el aviso de un robot que le llega por separado a Fak y a Carlos NO se junta: son dos mails', () => {
        const r = corre(['--buscar', 'ZZ-ROBOT']);
        expect(hits(r.out)).toBe(2);
        expect(r.out).toMatch(/buzon: Fak\r?\n/);
        expect(r.out).toMatch(/buzon: cbaptista {2}\(nube del equipo\)/);
    });

    it('--buzon filtra por nombre del buzon, por casilla o por la persona; uno que no existe dice cuales hay', () => {
        expect(hits(corre(['--buscar', 'ZZ', '--buzon', 'carlos']).out)).toBe(5);
        expect(hits(corre(['--buscar', 'ZZ', '--buzon', 'marcelo.nieve@']).out)).toBe(2);
        expect(hits(corre(['--buscar', 'ZZ', '--buzon', 'fak']).out)).toBe(3);
        const r = corre(['--buscar', 'ZZ', '--buzon', 'pedro']);
        expect(r.code).not.toBe(0);
        expect(r.todo).toMatch(/Ningun buzon coincide con "pedro".*Fak, cbaptista, lucca\.tuccio/);
    });

    it('--solo-fak no mira la nube', () => {
        const r = corre(['--buscar', 'ZZ-SOLONUBE', '--solo-fak']);
        expect(hits(r.out)).toBe(0);
        expect(r.out).toContain('nube del equipo: no miro (--solo-fak)');
    });
});

describe('_cuarentena NO se lee nunca', () => {
    it('lo que esta en _cuarentena no aparece en --buscar, ni por el asunto ni por el texto, ni en --buzones', () => {
        for (const termino of ['ZZ-CUARENTENA', 'sueldo', 'Licencia', 'RRHH']) {
            const r = corre(['--buscar', termino]);
            expect(hits(r.out), termino).toBe(0);
            expect(r.todo).not.toContain('ZZ-CUARENTENA');
        }
        const b = corre(['--buzones']);
        expect(b.out).toContain('cbaptista');
        expect(b.out).toMatch(/cbaptista@barackmercosul\.com \(Carlos Baptista\) +5 /);
        expect(b.out).not.toMatch(/enlace|_oculta/);
    });

    it('un enlace de _entrada hacia _cuarentena no se sigue (los 5 de Carlos son los de _entrada, ni uno mas)', () => {
        const r = corre(['--buscar', 'ZZ']);
        expect(r.out).toContain('cbaptista 5 (hasta');
        expect(r.todo).not.toContain('Recibo de sueldo');
    });

    it('una carpeta `_oculta` adentro de _entrada no es un buzon', () => {
        expect(hits(corre(['--buscar', 'ZZ-OCULTA']).out)).toBe(0);
    });

    it('--ver con el id o el Message-ID de un mail de _cuarentena no lo encuentra', () => {
        for (const id of ['<P1@barack.local>', 'P1@barack.local', 'EID-<P1@barack.local>', 'nube:000000000000']) {
            const r = corre(['--ver', id]);
            expect(r.code, id).not.toBe(0);
            expect(r.todo, id).toMatch(/No encontre ese id/);
            expect(r.todo, id).not.toContain('sueldo');
        }
    });

    it('si BARACK_MAIL_EQUIPO apunta a la cuarentena misma, no lee nada de ahi', () => {
        const r = corre(['--buscar', 'ZZ-CUARENTENA'], { BARACK_MAIL_EQUIPO: path.join(mails, '_cuarentena') });
        expect(hits(r.out)).toBe(0);
        expect(r.todo).not.toContain('Recibo de sueldo');
        expect(corre(['--buzones'], { BARACK_MAIL_EQUIPO: path.join(mails, '_cuarentena') }).out).not.toMatch(/cbaptista@/);
    });
});

describe('--ver y --adjuntos con un id que sale de la nube', () => {
    it('--ver acepta el id corto, el Message-ID (con o sin <>) y un prefijo del corto; todos dan el mismo mail', () => {
        const corto = idDe(corre(['--buscar', 'ZZ-SOLONUBE']).out);
        for (const id of [corto, '<C1@barack.local>', 'C1@barack.local', corto.slice(0, 11), 'EID-<C1@barack.local>']) {
            const r = corre(['--ver', id]);
            expect(r.code, id).toBe(0);
            expect(r.out, id).toContain('ASUNTO   Pedido de HO tapizado ZZ-SOLONUBE');
            expect(r.out, id).toMatch(/BUZONES {2}cbaptista {2}\(nube del equipo\)/);
            expect(r.out, id).toContain('(solo los nombres: los archivos no estan en la nube)');
            expect(r.out, id).toContain('Carlos, necesito la HO de tapizado');
        }
    });

    it('--ver de un mail que esta en dos buzones dice los dos, y el id de Fak y el de la nube dan el mismo', () => {
        for (const id of ['EID-FAK-A', '<A1@barack.local>']) {
            const r = corre(['--ver', id]);
            expect(r.code, id).toBe(0);
            expect(r.out, id).toMatch(/BUZONES {2}Fak \+ cbaptista/);
        }
    });

    it('--ver de un id que no existe en ningun lado sigue fallando con su mensaje', () => {
        const r = corre(['--ver', 'no-existe']);
        expect(r.code).not.toBe(0);
        expect(r.todo).toMatch(/No encontre ese id/);
    });

    it('--adjuntos de un mail que solo esta en la nube dice que los archivos no estan, lista los nombres y no escribe nada', () => {
        const corto = idDe(corre(['--buscar', 'ZZ-SOLONUBE']).out);
        const out = path.join(raiz, 'salida_adjuntos');
        const r = corre(['--adjuntos', corto, '--out', out]);
        expect(r.code).not.toBe(0);
        expect(r.todo).toMatch(/ARCHIVOS no estan en la nube/);
        expect(r.todo).toContain('buzon cbaptista');
        expect(r.todo).toContain('HO-971-tapizado.pdf | foto.png');
        expect(fs.existsSync(out)).toBe(false);
    });

    it('--adjuntos de un mail de la nube sin adjuntos lo dice y termina bien', () => {
        const r = corre(['--adjuntos', '<F1@barack.local>']);
        expect(r.code).toBe(0);
        expect(r.out).toMatch(/no tiene adjuntos/);
    });

    it('--adjuntos de un id de la nube que no existe dice que no lo encontro (no intenta Outlook)', () => {
        const r = corre(['--adjuntos', 'nube:000000000000']);
        expect(r.code).not.toBe(0);
        expect(r.todo).toMatch(/No encontre ese id en el cache de Fak ni en la nube del equipo/);
    });
});

describe('sin la nube a la vista el buzon de Fak sigue andando', () => {
    it.each([
        ['una carpeta que no existe', path.join(os.tmpdir(), 'no-existe-mails-equipo-zz')],
        ['vacia (apagado explicito)', ''],
    ])('%s', (_cual, valor) => {
        const r = corre(['--buscar', 'ZZ-SOLOFAK'], { BARACK_MAIL_EQUIPO: valor });
        expect(r.code).toBe(0);
        expect(hits(r.out)).toBe(1);
        expect(r.out).toContain('Fak 3 (hasta 2026-10-05 12:00)');
        // y lo dice: "no la veo" no es lo mismo que "no hay"
        expect(r.out).toContain('nube del equipo: NO la veo en esta PC');
        const b = corre(['--buzones'], { BARACK_MAIL_EQUIPO: valor });
        expect(b.code).toBe(0);
        expect(b.out).toMatch(/Fak +f\.santoro@barackmercosul\.com/);
        expect(b.out).toContain('nube del equipo: NO la veo en esta PC');
    });

    it('lo de Fak sale igual que siempre: mismo formato, el id es su EntryID', () => {
        const r = corre(['--buscar', 'ZZ-SOLOFAK', '--solo-fak']);
        expect(r.out).toContain('[2026-10-05 11:00]  Consulta de codigos ZZ-SOLOFAK');
        expect(r.out).toContain(`de: ${'Pablo Gamboa'.padEnd(30)}  carpeta: ${FAK_ENT}`);
        expect(r.out).toContain('para: Facundo Santoro');
        expect(idDe(r.out)).toBe('EID-FAK-B');
    });

    it('la nube se encuentra sola en la biblioteca de Ingenieria (`_CUARENTENA_Claude Barack`), y la nube PERSONAL no se mira', () => {
        const casa = path.join(raiz, 'casa');
        const ing = path.join(casa, 'BARACK ARGENTINA SRL', 'Ingeniería y Proyecto - General');
        escribir(path.join(ing, '_CUARENTENA_Claude Barack', 'mails', '_entrada', 'ana', 'a.jsonl'),
            jsonl([nubeMail('<N1@barack.local>', 'ana@barackmercosul.com / Bandeja de entrada', '2026-10-02 08:00', 'Leo Lattanzi', 'Mail ZZ-BIBLIOTECA', 'Ana', 'hola')]));
        escribir(path.join(casa, 'OneDrive - BARACK ARGENTINA SRL', 'Claude Barack', 'mails', '_entrada', 'zoe', 'z.jsonl'),
            jsonl([nubeMail('<N2@barack.local>', 'zoe@barackmercosul.com / Bandeja de entrada', '2026-10-02 08:00', 'Leo Lattanzi', 'Mail ZZ-PERSONAL', 'Zoe', 'hola')]));
        const solo = { BARACK_MAIL_EQUIPO: undefined, USERPROFILE: casa, HOME: casa, HOMEDRIVE: '', HOMEPATH: '' };
        const dentro = { ...process.env, PYTHONIOENCODING: 'utf-8', BARACK_MAIL_CACHE: cache, ...solo };
        delete dentro.BARACK_MAIL_EQUIPO;
        const run = (args) => spawnSync('python', [SCRIPT, ...args], { encoding: 'utf8', env: dentro });
        const a = run(['--buscar', 'ZZ-BIBLIOTECA']);
        expect(a.status).toBe(0);
        expect(hits(a.stdout)).toBe(1);
        expect(a.stdout).toMatch(/buzon: ana {2}\(nube del equipo\)/);
        const p = run(['--buscar', 'ZZ-PERSONAL']);
        expect(hits(p.stdout)).toBe(0);
        expect(p.stdout).not.toContain('zoe');
    });
});
