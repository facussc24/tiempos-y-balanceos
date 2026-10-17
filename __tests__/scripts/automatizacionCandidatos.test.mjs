/**
 * `scripts/_automatizacionCandidatos.mjs` (tanda 8 del plan del sistema, 17/10/2026): propone filas para la cola de
 * automatizacion de Barack leyendo los mails de la casa con `_mails.py --buscar` y `--ver`.
 *
 * Que se cuida aca, en las dos direcciones:
 *   - que lea bien la salida real de `_mails.py` (formato copiado de una corrida del 17/10, con CRLF y remitente vacio);
 *   - que la cita sea del tema y no un encabezado, y que «ecr» no cuente adentro de «decrypt»;
 *   - que una clave de API nunca viaje en una cita (y que el texto comun no se toque);
 *   - que a `_mails.py` solo se le pida `--buscar` y `--ver`: ninguna opcion que abra Outlook o escriba;
 *   - que `--out` no pise la cola, y la corrida entera contra un `_mails.py` de mentira que anota lo que le piden.
 * Mismo criterio que el resto de la casa: NUNCA skip si falta python.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    parsearBusqueda, cuerpoDeVer, extraerCita, taparClaves, contieneTermino, esMailExcluido,
    llamarMails, armarPropuesta, temasYaEnLaCola, aMarkdown, haceDias, sinMarcaDelAsistente, CANON, OPCIONES_PERMITIDAS,
} from '../../scripts/_automatizacionCandidatos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(RAIZ, 'scripts', '_automatizacionCandidatos.mjs');

const BUSQUEDA = [
    'cache: 6137 de Fak + 4992 solo del equipo (nube)  |  coincidencias: 3',
    'buzones: Fak 6137 (hasta 2026-10-16 16:49)',
    '',
    '[2026-06-26 08:34]  RV: ECR TEMPLATE REV01.xlsx',
    '    de: Carlos Baptista                 carpeta: marcelo.nieve@barackmercosul.com / Bandeja de entrada',
    '    buzon: lucca.tuccio  (nube del equipo)',
    '    para: Marcelo Nieve; Paulo Hernan Centurion',
    '    ADJUNTOS: image002.png | ECR TEMPLATE REV01.xlsx | image.png',
    '    id: nube:214852eb730e',
    '',
    '[2026-10-13 12:54]  Impresora 3D Bambu: mandar a imprimir',
    '    de:                                 carpeta: f.santoro@barackmercosul.com / Problemas de sincronización / Conflictos',
    '    para: Carlos Baptista; Leonardo Enrique Lattanzi',
    '    id: 00000000E4D41C8C2BAD',
    '',
    '[2026-10-15 11:32]  Cybersecurity & Cyber Law Briefing',
    '    de: ImmuniWeb                       carpeta: f.santoro@barackmercosul.com / Bandeja de entrada',
    '    id: 00000000AAAA',
    '',
].join('\r\n');

const VER = [
    '==============================================================================',
    'ASUNTO   RE:  Alteração de Engenharia 060/26 - 737D',
    'DE       Carlos Baptista <cbaptista@barackmercosul.com>',
    'FECHA    2026-06-23 15:22',
    '==============================================================================',
    'Gracias Facu, cuando podamos que terminemos lo de IATF jueves/Viernes, veamos esto, armemos el ECR/ECO y avanzamos,',
    '',
    'Eng. Carlos Baptista',
    '________________________________',
    'De: Facundo Santoro <f.santoro@barackmercosul.com>',
    'Asunto: RE: Alteração de Engenharia 060/26',
    'Les adjunto el maestro de planos de productos actualizado. El próximo paso es hacer la ecr eco pero va a llevar mas tiempo.',
].join('\r\n');

describe('lectura de la salida real de _mails.py', () => {
    it('--buscar: fecha, asunto, remitente, carpeta e id; el remitente vacio no corre la carpeta', () => {
        const m = parsearBusqueda(BUSQUEDA);
        expect(m).toHaveLength(3);
        expect(m[0]).toMatchObject({ fecha: '2026-06-26 08:34', asunto: 'RV: ECR TEMPLATE REV01.xlsx', de: 'Carlos Baptista', id: 'nube:214852eb730e' });
        expect(m[0].carpeta).toContain('Bandeja de entrada');
        expect(m[1].de).toBe('');
        expect(m[1].carpeta).toContain('Problemas de sincroniz');
    });
    it('--ver: el cuerpo es lo que sigue a la segunda raya, sin el encabezado', () => {
        const c = cuerpoDeVer(VER);
        expect(c[0]).toMatch(/^Gracias Facu/);
        expect(c.join('\n')).not.toContain('ASUNTO');
    });
    it('salida vacia o rara: nada, sin romper', () => {
        expect(parsearBusqueda('')).toEqual([]);
        expect(parsearBusqueda('El cache esta vacio.')).toEqual([]);
        expect(cuerpoDeVer('')).toEqual([]);
    });
});

describe('la cita', () => {
    it('elige el renglon del remitente que nombra el tema, no la firma ni un encabezado', () => {
        const cita = extraerCita(cuerpoDeVer(VER), ['ecr', 'ecr/eco']);
        expect(cita).toMatch(/armemos el ECR\/ECO/);
    });
    it('si lo propio no nombra el tema, toma lo citado que si lo nombra', () => {
        const cuerpo = ['FYI', '', 'Eng. Carlos Baptista', 'De: Toyota <x@y>', 'Este es el formato de ECR que hay que presentar.'];
        expect(extraerCita(cuerpo, ['ecr'])).toBe('Este es el formato de ECR que hay que presentar.');
    });
    it('nunca devuelve una linea de encabezado', () => {
        expect(extraerCita(['Asunto: RV: ECR TEMPLATE REV01.xlsx', 'De: Carlos Baptista <c@b>'], ['ecr'])).toBe('');
    });
    it('una frase larga se corta en 220 caracteres', () => {
        const larga = 'ECR ' + 'x'.repeat(400);
        expect(extraerCita([larga], ['ecr']).length).toBeLessThanOrEqual(220);
    });
});

describe('las claves no viajan', () => {
    it('una clave de Anthropic se tapa, adentro de una cita', () => {
        const c = extraerCita(['La clave del ECR es sk-ant-api03-AbCdEfGhIjKlMnOp_qrstuv-123 para la prueba'], ['ecr']);
        expect(c).not.toMatch(/sk-ant-/);
        expect(c).toContain('[clave retirada]');
    });
    it('otras formas: "api key: ..." y "token=..." largos', () => {
        expect(taparClaves('api key: ABCDEFGHIJKLMNOPQRS')).not.toContain('ABCDEFGHIJKLMNOPQRS');
        expect(taparClaves('token=zzzzzzzzzzzzzzzzzzzz')).not.toContain('zzzzzzzzzzzzzzzz');
    });
    it('el texto comun no se toca (direccion contraria)', () => {
        const t = 'Les pido que me pasen la clave del portal en persona; ask-antes de mandar; sk-8 es un hilo';
        expect(taparClaves(t)).toBe(t);
    });
});

describe('palabra entera y mails que no aportan', () => {
    it('«ecr» no cuenta adentro de «decrypt»; «ECR/ECO» si; sin tildes', () => {
        expect(contieneTermino('ransomware consultant said he would decrypt data', ['ecr'])).toBe(false);
        expect(contieneTermino('armemos el ECR/ECO y avanzamos', ['ecr'])).toBe(true);
        expect(contieneTermino('Alteração de Engenharia', ['alteracao de engenharia'])).toBe(true);
        expect(contieneTermino('el arbol de navidad', ['el arb'])).toBe(true); // limite conocido: solo mira el comienzo
    });
    it('borradores, eliminados, conflictos y boletines se excluyen; un mail comun no', () => {
        const [carlos, conflicto, boletin] = parsearBusqueda(BUSQUEDA);
        expect(esMailExcluido(carlos)).toBe(false);
        expect(esMailExcluido(conflicto)).toBe(true);
        expect(esMailExcluido(boletin)).toBe(true);
        expect(esMailExcluido({ de: '', asunto: 'x', carpeta: 'f.santoro@ / Borradores' })).toBe(true);
    });
});

describe('a _mails.py solo se le pide --buscar y --ver', () => {
    const falso = () => ({ status: 0, stdout: 'ok', stderr: '' });
    it('las dos permitidas pasan', () => {
        expect(OPCIONES_PERMITIDAS).toEqual(['--buscar', '--ver']);
        expect(llamarMails('x.py', ['--buscar', 'ecr', '--desde', '2026-10-01', '--limite', '200'], falso)).toBe('ok');
        expect(llamarMails('x.py', ['--ver', 'nube:1'], falso)).toBe('ok');
    });
    it('cualquier otra frena antes de lanzar nada', () => {
        let lanzado = false;
        const espia = () => { lanzado = true; return falso(); };
        for (const op of ['--sync', '--adjuntos', '--abrir', '--nuevos', '--agenda', '--borradores', '--limpiar-borradores']) {
            expect(() => llamarMails('x.py', [op], espia)).toThrow(/solo se llama/);
        }
        expect(() => llamarMails('x.py', ['--buscar', 'ecr', '--mover'], espia)).toThrow(/no permitida/);
        expect(() => llamarMails('x.py', ['--ver', 'id', '--abrir'], espia)).toThrow(/no permitida/);
        expect(lanzado).toBe(false);
    });
    it('el codigo del script no nombra ninguna opcion que abra Outlook o escriba', () => {
        const src = fs.readFileSync(SCRIPT, 'utf8');
        for (const op of ['--sync', '--full', '--adjuntos', '--abrir', '--nuevos', '--agenda', '--borradores', '--limpiar', '--mover', '--sin-respuesta']) {
            expect(src.includes(`'${op}`), op).toBe(false);
        }
    });
});

describe('la propuesta', () => {
    const MAILS = {
        'buscar:ecr': BUSQUEDA,
        'ver:nube:214852eb730e': VER,
        'ver:00000000AAAA': ['====================', 'x', '====================', 'he would decrypt data'].join('\n'),
    };
    const leer = (a) => MAILS[`${a[0].slice(2)}:${a[1]}`] ?? '';
    const canon = { ...CANON, temas: [CANON.temas.find((t) => t.id === 'ecr-eco')] };
    it('arma la fila con la cita del mail, sin el conflicto ni el boletin, y marca si ya esta en la cola', () => {
        const filas = armarPropuesta({ leer, desde: '2026-06-01', yaEnCola: new Set(['ecr-eco']), canon });
        expect(filas).toHaveLength(1);
        expect(filas[0].total).toBe(1);
        expect(filas[0].citas).toHaveLength(1);
        expect(filas[0].citas[0].cita).toMatch(/armemos el ECR\/ECO/);
        expect(filas[0].yaEnCola).toBe(true);
        const md = aMarkdown(filas, { desde: '2026-06-01', hoy: '2026-10-17' });
        expect(md).toContain('ya tiene fila en la cola');
        expect(md).toContain('Carlos Baptista, 2026-06-26 08:34');
        expect(md).not.toMatch(/claude|anthropic/i);
    });
    it('un mail cuyo termino esta adentro de otra palabra se descarta y se cuenta', () => {
        const leer2 = (a) => (a[0] === '--buscar'
            ? '[2026-10-15 11:32]  Briefing\n    de: Alguien   carpeta: x / Bandeja de entrada\n    id: 00000000AAAA\n'
            : MAILS['ver:00000000AAAA']);
        const [f] = armarPropuesta({ leer: leer2, desde: '2026-10-01', canon });
        expect(f.citas).toHaveLength(0);
        expect(f.falsos).toBe(1);
    });
    it('una cita o un asunto que nombran al asistente salen con la marca entre corchetes (la propuesta va a la nube)', () => {
        const filas = [{ tema: { nombre: 'Impresora' }, total: 1, falsos: 0, ultimo: '2026-10-13', yaEnCola: false, citas: [
            { cita: 'Les paso una función nueva de Claude para la impresora', de: 'Facundo Santoro', fecha: '2026-10-13 12:57', asunto: 'Mandar a imprimir desde Claude (Anthropic)', id: 'x' },
        ] }];
        const md = aMarkdown(filas, { desde: '2026-10-01', hoy: '2026-10-17' });
        expect(md).not.toMatch(/claude|anthropic/i);
        expect(md).toContain('función nueva de [el asistente]');
        expect(sinMarcaDelAsistente('Jean-Claude Van Damme y la claudicación')).toBe('Jean-Claude Van Damme y la claudicación');
    });
    it('temasYaEnLaCola lee el texto de la cola', () => {
        const ya = temasYaEnLaCola('### 2. Cambios de ingeniería (ECR/ECO) — estado: antes\n### 1. Carga en BeOn');
        expect(ya.has('ecr-eco')).toBe(true);
        expect(ya.has('beon')).toBe(true);
        expect(ya.has('procesos-largos')).toBe(false);
        expect(temasYaEnLaCola('').size).toBe(0);
    });
    it('haceDias da AAAA-MM-DD', () => {
        expect(haceDias(15, new Date(2026, 9, 17))).toBe('2026-10-02');
    });
});

describe('de punta a punta, con un _mails.py de mentira', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'autocand-'));
    const log = path.join(dir, 'pedidos.log');
    const falso = path.join(dir, '_mails.py');
    fs.writeFileSync(falso, [
        'import sys, io',
        `io.open(r"${log}", "a", encoding="utf-8").write(" ".join(sys.argv[1:]) + "\\n")`,
        'if sys.argv[1] == "--buscar" and sys.argv[2] == "ecr":',
        `    print(${JSON.stringify(BUSQUEDA.replace(/\r/g, ''))})`,
        'elif sys.argv[1] == "--ver":',
        `    print(${JSON.stringify(VER.replace(/\r/g, ''))})`,
        'else:',
        '    print("cache: 0 de Fak  |  coincidencias: 0")',
    ].join('\n'), 'utf8');
    const cola = path.join(dir, 'cola.md');
    fs.writeFileSync(cola, '### 2. Cambios de ingeniería (ECR/ECO)\n', 'utf8');
    const correr = (args) => spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8', timeout: 120_000 });

    it('propone, deja el archivo pedido y a _mails.py solo le pidio --buscar y --ver', () => {
        const out = path.join(dir, 'relevamientos', 'propuesta.md');
        const r = correr(['--mails', falso, '--cola', cola, '--dias', '200', '--out', out]);
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toContain('Cambios de ingeniería (ECR/ECO)');
        expect(r.stdout).toMatch(/armemos el ECR\/ECO/);
        expect(fs.readFileSync(out, 'utf8')).toContain('relevamiento del');
        const pedidos = fs.readFileSync(log, 'utf8').trim().split('\n');
        expect(pedidos.length).toBeGreaterThan(5);
        for (const p of pedidos) expect(p).toMatch(/^--(buscar|ver) /);
    });
    it('--out nunca pisa la cola', () => {
        const antes = fs.readFileSync(cola, 'utf8');
        const r = correr(['--mails', falso, '--cola', cola, '--out', cola]);
        expect(r.status).toBe(1);
        expect(r.stderr).toMatch(/No piso la cola/);
        expect(fs.readFileSync(cola, 'utf8')).toBe(antes);
    });
    it('una opcion desconocida sale con 1', () => {
        expect(correr(['--sync']).status).toBe(1);
    });
});
