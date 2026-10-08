// @vitest-environment node
/**
 * Pruebas de tools/claude-area/mails_pc.mjs: una PC con mas de una cuenta de Outlook (la notebook de Calidad, 08/10/2026)
 * sube a la nube de Ingenieria los mails de las cuentas de Calidad.
 *
 * Las dos direcciones, porque esto saca mails de una PC:
 *   - lo que tiene que subir, sube: las cuentas de Calidad, cada una a su carpeta, con el mismo filtro de siempre;
 *   - lo que NO tiene que salir no sale: una cuenta personal, de otro dominio, de lo privado o sacada desde la nube; otra PC
 *     u otro usuario de Windows; sin lista de lo privado; la nube apagada; y el archivo de control de la nube no puede SUMAR.
 * Todo corre contra carpetas temporales y mails de mentira: no toca Outlook ni la nube real.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { correrPc, elegirCasillas, leerControl, listarCasillas, INCLUIR_POR_DEFECTO } from '../../tools/claude-area/mails_pc.mjs';
import { cargarPrivados } from '../../tools/claude-area/mails_area.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const AREA = path.join(RAIZ, 'tools', 'claude-area');
const PROGRAMA = path.join(AREA, 'mails_pc.mjs');
const LECTOR = path.join(AREA, 'mails_outlook.ps1');
const AHORA = new Date(2026, 9, 8, 16, 0, 0);
const ENV = { SystemRoot: process.env.SystemRoot || 'C:\\Windows' };

const temporales = [];
afterAll(() => { for (const d of temporales) fs.rmSync(d, { recursive: true, force: true }); });

const PRIVADOS_OK = { _que_es: 'de prueba', total_direcciones: 2, direcciones: ['dueno@barack.test', 'rrhh@barackmercosul.com'], dominios: ['estudio-contable.test'], nombres: ['Dueño Prueba'], apellidos: ['Zzapellido'], palabras_extra: [] };
const CALIDAD = 'calidad@barackmercosul.com';
const PRINCIPAL = { casilla: 'f.prueba@barackmercosul.com', nombre: 'f.prueba@barackmercosul.com', tipo: 'principal', predeterminada: true };
const BUZON_CALIDAD = { casilla: CALIDAD, nombre: 'Calidad', tipo: 'adicional', predeterminada: false };
const SOY = { usuario: 'Facundo Prueba', pc: 'PC-CALIDAD' };
const CONFIG = { nombre: 'Facundo Prueba', pc: 'PC-CALIDAD', usuario: 'Facundo Prueba', incluir: ['calidad'], gracia_horas: 0 };

/** Una PC de mentira: la raiz de la instalacion con la lista de lo privado, y una biblioteca con la carpeta de mails. */
function armarPc({ privados = PRIVADOS_OK, config = CONFIG, conNube = true } = {}) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mails-pc-'));
    temporales.push(t);
    const raiz = path.join(t, 'BarackMailsPC');
    const comun = path.join(raiz, 'casa', 'publicado', 'conocimiento', 'comun');
    fs.mkdirSync(comun, { recursive: true });
    fs.mkdirSync(path.join(raiz, 'estado'), { recursive: true });
    if (privados !== null) fs.writeFileSync(path.join(comun, 'mails_privados.json'), typeof privados === 'string' ? privados : JSON.stringify(privados), 'utf8');
    if (config !== null) fs.writeFileSync(path.join(raiz, 'estado', 'config.json'), JSON.stringify(config), 'utf8');
    const mails = path.join(t, 'biblioteca', 'Ingeniería y Proyecto - General', '_CUARENTENA_Claude Barack', 'mails');
    if (conNube) fs.mkdirSync(mails, { recursive: true });
    return { t, raiz, comun, mails, entrada: path.join(mails, '_entrada') };
}

let contador = 0;
function mail(para, cambios = {}) {
    contador++;
    return {
        id: `<m${contador}@barack.test>`, eid: `E${contador}`, carpeta: 'Bandeja de entrada', fecha: '2026-10-04 10:00',
        de: 'Cliente', de_mail: 'cliente@proveedor.test', representa_mail: '', para: 'Calidad', para_mails: [para], cc: '', cc_mails: [], cco_mails: [],
        asunto: `Reclamo ${contador}`, adjuntos: [], conversacion: 'C1', cuerpo: 'Adjunto el informe de la pieza.', sin_resolver: 0, ...cambios,
    };
}
function fuente(pc, renglones) {
    const ruta = path.join(pc.t, `fuente-${++contador}.jsonl`);
    fs.writeFileSync(ruta, renglones.map((m) => JSON.stringify(m)).join('\n') + '\n', 'utf8');
    return ruta;
}
const listar = (buzones, outlook = null) => async () => ({ buzones, outlook, completa: !outlook });
const corre = (pc, extra = {}) => correrPc({ raiz: pc.raiz, carpetaMails: pc.mails, ahora: AHORA, env: ENV, identidad: SOY, lector: path.join(pc.t, 'no-existe.ps1'), listar: listar([PRINCIPAL, BUZON_CALIDAD]), ...extra });
function archivos(dir) {
    const out = [];
    const anda = (d, rel) => { for (const e of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []) { const r = path.join(rel, e.name); if (e.isDirectory()) anda(path.join(d, e.name), r); else out.push(r); } };
    anda(dir, '');
    return out.sort();
}
const subidos = (pc, carpeta) => archivos(path.join(pc.entrada, carpeta)).flatMap((f) => fs.readFileSync(path.join(pc.entrada, carpeta, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
const priv = () => cargarPrivados(path.join(armarPc().comun, 'mails_privados.json'));

describe('mails_pc: que cuentas del Outlook suben', () => {
    const p = priv();
    const elegir = (buzones, config = CONFIG, control) => elegirCasillas(buzones, config, p, control);
    const b = (casilla, extra = {}) => ({ casilla, nombre: casilla, tipo: 'adicional', predeterminada: false, ...extra });
    it('la lista de privados de la prueba esta completa', () => expect(p.estado).toBe('ok'));
    it('la cuenta de Calidad sube y la propia de la persona no (esa ya se lee en su PC)', () => {
        const r = elegir([PRINCIPAL, BUZON_CALIDAD]);
        expect(r.suben.map((s) => s.casilla)).toEqual([CALIDAD]);
        expect(r.omitidas).toEqual([expect.objectContaining({ casilla: PRINCIPAL.casilla, motivo: 'no_es_de_calidad' })]);
    });
    it('cada cuenta de Calidad va a su carpeta: lo de antes de la arroba', () => {
        const r = elegir([b('calidad@barackmercosul.com'), b('calidad.reclamos@barackmercosul.com'), b('Calidad2@BarackMercosul.com')]);
        expect(r.suben.map((s) => s.autor)).toEqual(['calidad', 'calidad.reclamos', 'calidad2']);
    });
    const NO = [
        ['una cuenta personal de otra persona', b('l.tuccio@barackmercosul.com'), 'no_es_de_calidad'],
        ['una cuenta de Gmail aunque diga calidad', b('calidad.barack@gmail.com'), 'otro_dominio'],
        ['un dominio que solo se parece', b('calidad@barackmercosul.com.evil.test'), 'otro_dominio'],
        ['un subdominio de la empresa (no es el dominio)', b('calidad@mail.barackmercosul.com'), 'otro_dominio'],
        ['una cuenta de lo privado aunque diga calidad', b('rrhh@barackmercosul.com', { nombre: 'calidad' }), 'privada'],
        ['una carpeta publica', b(CALIDAD, { tipo: 'publica' }), 'carpeta_publica'],
        ['un buzon cuya casilla no se pudo leer', b('', { nombre: 'Calidad' }), 'sin_casilla'],
        ['un buzon cuya casilla es un nombre', b('Calidad'), 'sin_casilla'],
        ['una direccion interna de Exchange', b('/o=ExchangeLabs/ou=x/cn=Recipients/cn=calidad'), 'sin_casilla'],
    ];
    for (const [nombre, buzon, motivo] of NO) it(`${nombre} no sube (${motivo})`, () => {
        const r = elegir([buzon]);
        expect(r.suben).toEqual([]);
        expect(r.omitidas[0].motivo).toBe(motivo);
    });
    it('una cuenta que Ingenieria saco desde la nube no sube, en cualquier forma de escribirla', () => {
        const r = elegir([BUZON_CALIDAD], CONFIG, { excluir: ['calidad@barackmercosul.com'] });
        expect(r.suben).toEqual([]);
        expect(r.omitidas[0].motivo).toBe('excluida');
        expect(elegir([b('CALIDAD@BarackMercosul.com')], CONFIG, { excluir: [CALIDAD] }).suben).toEqual([]);
    });
    it('una cuenta repetida (el principal y un archivo con la misma casilla) sube una sola vez, la del principal', () => {
        const r = elegir([b(CALIDAD), b(CALIDAD, { tipo: 'principal', predeterminada: true })]);
        expect(r.suben).toEqual([expect.objectContaining({ casilla: CALIDAD, tipo: 'principal' })]);
        expect(r.omitidas).toEqual([expect.objectContaining({ motivo: 'repetida' })]);
    });
    it('«incluir» puede nombrar una casilla entera: esa sube aunque no diga calidad', () => {
        const r = elegir([b('m.meszaros@barackmercosul.com')], { ...CONFIG, incluir: ['calidad', 'm.meszaros@barackmercosul.com'] });
        expect(r.suben.map((s) => s.casilla)).toEqual(['m.meszaros@barackmercosul.com']);
    });
    it('sin «incluir» en la configuracion, entra solo «calidad»', () => {
        expect(INCLUIR_POR_DEFECTO).toEqual(['calidad']);
        expect(elegir([BUZON_CALIDAD, PRINCIPAL], { ...CONFIG, incluir: undefined }).suben.map((s) => s.casilla)).toEqual([CALIDAD]);
        expect(elegir([BUZON_CALIDAD, PRINCIPAL], { ...CONFIG, incluir: [] }).suben.map((s) => s.casilla)).toEqual([CALIDAD]);
    });
    it('una palabra de «incluir» que es una casilla escrita mal no deja entrar todo', () => {
        const r = elegir([PRINCIPAL, b('l.tuccio@barackmercosul.com')], { ...CONFIG, incluir: ['@'] });
        expect(r.suben).toEqual([]);
    });
    it('cadenas cortas o caracteres como «.» o «a» en «incluir» no matchean casillas personales', () => {
        for (const c of ['.', 'a', 'f', 'p', 'pr', '..', '@']) {
            const r = elegir([PRINCIPAL, b('l.tuccio@barackmercosul.com')], { ...CONFIG, incluir: [c] });
            expect(r.suben).toEqual([]);
        }
    });
    it('basura en la lista de buzones no rompe: se salta', () => {
        const r = elegir([null, undefined, 5, 'x', {}, BUZON_CALIDAD]);
        expect(r.suben.map((s) => s.casilla)).toEqual([CALIDAD]);
        expect(elegir(undefined).suben).toEqual([]);
    });
});

describe('mails_pc: el archivo de control de la nube solo apaga', () => {
    const conControl = (contenido, nombre = 'PC-CALIDAD.json') => {
        const pc = armarPc();
        fs.mkdirSync(path.join(pc.mails, '_control'), { recursive: true });
        fs.writeFileSync(path.join(pc.mails, '_control', nombre), typeof contenido === 'string' ? contenido : JSON.stringify(contenido), 'utf8');
        return pc;
    };
    it('sin archivo no cambia nada', () => expect(leerControl(armarPc().mails, 'PC-CALIDAD')).toEqual({ apagado: false, excluir: [] }));
    it('apagado y excluir se leen (el nombre de la PC en cualquier mayuscula)', () => {
        const pc = conControl({ apagado: true, excluir: ['Calidad2@BarackMercosul.com'] }, 'pc-calidad.JSON');
        expect(leerControl(pc.mails, 'PC-CALIDAD')).toEqual({ apagado: true, excluir: ['calidad2@barackmercosul.com'] });
    });
    it('coincide tanto por nombre corto como por FQDN', () => {
        const pc1 = conControl({ apagado: true }, 'PC-CALIDAD.barack.local.json');
        expect(leerControl(pc1.mails, 'PC-CALIDAD').apagado).toBe(true);
        const pc2 = conControl({ apagado: true }, 'PC-CALIDAD.json');
        expect(leerControl(pc2.mails, 'PC-CALIDAD.barack.local').apagado).toBe(true);
    });
    it('lo que intente sumar no cuenta: ni «incluir», ni «casillas», ni «apagado» que no sea true', () => {
        const pc = conControl({ incluir: ['todo'], casillas: ['otra@barackmercosul.com'], apagado: 'no', excluir: 'calidad@barackmercosul.com' });
        expect(leerControl(pc.mails, 'PC-CALIDAD')).toEqual({ apagado: false, excluir: [] });
    });
    it('un archivo de control de esta PC que esta roto, vacio o no es objeto apaga por seguridad (fail-closed)', () => {
        for (const x of ['{', '', '[]', '5', 'null']) {
            const c = leerControl(conControl(x).mails, 'PC-CALIDAD');
            expect(c.apagado).toBe(true);
            expect(c.ilegible).toBe(true);
        }
    });
    it('si el archivo de control no puede leerse, asume apagado por seguridad y lo dice', async () => {
        const pc = conControl('{');
        const r = await corre(pc, { fuentes: { [CALIDAD]: fuente(pc, [mail(CALIDAD)]) } });
        expect([r.codigo, r.resumen.resultado]).toEqual([0, 'apagado']);
        expect(r.resumen.detalle).toContain('seguridad');
        expect(archivos(pc.entrada)).toEqual([]);
    });
    it('el archivo de otra PC no es de esta', () => expect(leerControl(conControl({ apagado: true }, 'OTRA-PC.json').mails, 'PC-CALIDAD').apagado).toBe(false));
    it('apagada desde la nube: no lee ni mira Outlook, y lo dice', async () => {
        const pc = conControl({ apagado: true });
        let llamado = false;
        const r = await corre(pc, { listar: async () => { llamado = true; return { buzones: [], outlook: null, completa: true }; }, fuentes: { [CALIDAD]: fuente(pc, [mail(CALIDAD)]) } });
        expect([r.codigo, r.resumen.resultado]).toEqual([0, 'apagado']);
        expect(llamado).toBe(false);
        expect(archivos(pc.entrada)).toEqual([]);
    });
    it('una cuenta sacada desde la nube no sube pero la otra si', async () => {
        const pc = conControl({ excluir: [CALIDAD] });
        const OTRA = 'calidad.reclamos@barackmercosul.com';
        const r = await corre(pc, { listar: listar([PRINCIPAL, BUZON_CALIDAD, { ...BUZON_CALIDAD, casilla: OTRA }]), fuentes: { [CALIDAD]: fuente(pc, [mail(CALIDAD)]), [OTRA]: fuente(pc, [mail(OTRA)]) } });
        expect(r.resumen.casillas.map((c) => c.casilla)).toEqual([OTRA]);
        expect(subidos(pc, 'calidad')).toEqual([]);
        expect(subidos(pc, 'calidad.reclamos')).toHaveLength(1);
    });
});

describe('mails_pc: una corrida', () => {
    it('sube los mails de la cuenta de Calidad a su carpeta, con el mismo filtro de siempre', async () => {
        const pc = armarPc();
        const bueno = mail(CALIDAD);
        const aDireccion = mail(CALIDAD, { cc_mails: ['dueno@barack.test'] });
        const sueldo = mail(CALIDAD, { asunto: 'Recibo de sueldo de septiembre' });
        const r = await corre(pc, { fuentes: { [CALIDAD]: fuente(pc, [bueno, aDireccion, sueldo]) } });
        expect([r.codigo, r.resumen.resultado]).toEqual([0, 'ok']);
        const subido = subidos(pc, 'calidad');
        expect(subido.map((m) => m.id)).toEqual([bueno.id]);
        expect(r.resumen.casillas[0]).toMatchObject({ casilla: CALIDAD, autor: 'calidad', nuevos: 3, entrada: 1, privado: 1, cuarentena: 1 });
        expect(archivos(path.join(pc.t, 'biblioteca')).every((f) => f.includes('_entrada'))).toBe(true);
    });
    it('el mail de HOY sube ya (sin el dia de espera: la persona es quien lo instalo), y no deja aviso en la PC', async () => {
        const pc = armarPc();
        const hoy = mail(CALIDAD, { fecha: '2026-10-08 15:30' });
        const r = await corre(pc, { fuentes: { [CALIDAD]: fuente(pc, [hoy]) } });
        expect(r.resumen.resultado).toBe('ok');
        expect(subidos(pc, 'calidad')).toHaveLength(1);
        expect(fs.existsSync(path.join(pc.raiz, 'casa', 'Trabajo'))).toBe(false);
    });
    it('la segunda pasada no repite lo ya subido', async () => {
        const pc = armarPc();
        const f = fuente(pc, [mail(CALIDAD), mail(CALIDAD)]);
        await corre(pc, { fuentes: { [CALIDAD]: f } });
        const r2 = await corre(pc, { fuentes: { [CALIDAD]: f } });
        expect(r2.resumen.resultado).toBe('ok');
        expect(subidos(pc, 'calidad')).toHaveLength(2);
        expect(r2.resumen.casillas[0].nuevos).toBe(0);
    });
    it('dos cuentas de Calidad: cada una a su carpeta, con su propio estado', async () => {
        const pc = armarPc();
        const OTRA = 'calidad.proveedores@barackmercosul.com';
        const r = await corre(pc, { listar: listar([PRINCIPAL, BUZON_CALIDAD, { ...BUZON_CALIDAD, casilla: OTRA }]), fuentes: { [CALIDAD]: fuente(pc, [mail(CALIDAD)]), [OTRA]: fuente(pc, [mail(OTRA), mail(OTRA)]) } });
        expect(r.resumen.resultado).toBe('ok');
        expect(subidos(pc, 'calidad')).toHaveLength(1);
        expect(subidos(pc, 'calidad.proveedores')).toHaveLength(2);
        expect(fs.existsSync(path.join(pc.raiz, 'estado', 'calidad', 'mails-area-estado.json'))).toBe(true);
        expect(fs.existsSync(path.join(pc.raiz, 'estado', 'calidad.proveedores', 'mails-area-estado.json'))).toBe(true);
    });
    it('los mails de la cuenta propia de la persona no se tocan ni se suben', async () => {
        const pc = armarPc();
        const r = await corre(pc, { fuentes: { [CALIDAD]: fuente(pc, [mail(CALIDAD)]), [PRINCIPAL.casilla]: fuente(pc, [mail(PRINCIPAL.casilla)]) } });
        expect(r.resumen.casillas.map((c) => c.casilla)).toEqual([CALIDAD]);
        expect(archivos(pc.entrada).every((f) => f.startsWith('calidad'))).toBe(true);
    });
    it('--inventario dice que cuentas hay y cuales subirian, sin leer ni escribir nada', async () => {
        const pc = armarPc();
        const r = await corre(pc, { inventario: true, fuentes: { [CALIDAD]: fuente(pc, [mail(CALIDAD)]) } });
        expect([r.codigo, r.resumen.resultado]).toEqual([0, 'inventario']);
        expect(r.resumen.suben).toEqual([CALIDAD]);
        expect(r.resumen.omitidas).toEqual([expect.objectContaining({ casilla: PRINCIPAL.casilla, motivo: 'no_es_de_calidad' })]);
        expect(archivos(pc.entrada)).toEqual([]);
        expect(fs.existsSync(path.join(pc.raiz, 'estado', 'calidad'))).toBe(false);
    });
    it('--simular cuenta lo que haria y no escribe en la nube', async () => {
        const pc = armarPc();
        const r = await corre(pc, { simular: true, fuentes: { [CALIDAD]: fuente(pc, [mail(CALIDAD)]) } });
        expect(r.resumen.casillas[0]).toMatchObject({ resultado: 'simulado', entrada: 1 });
        expect(archivos(pc.entrada)).toEqual([]);
    });
    it('si ninguna cuenta es de Calidad no copia nada y lo dice con las cuentas que vio', async () => {
        const pc = armarPc();
        const r = await corre(pc, { listar: listar([PRINCIPAL]) });
        expect([r.codigo, r.resumen.resultado]).toEqual([0, 'sin_casillas']);
        expect(r.resumen.cuentas).toEqual([expect.objectContaining({ casilla: PRINCIPAL.casilla })]);
        expect(archivos(pc.entrada)).toEqual([]);
    });
    it('si una cuenta falla, las otras igual suben', async () => {
        const pc = armarPc();
        const OTRA = 'calidad.proveedores@barackmercosul.com';
        // la primera no tiene fuente: el lector (que no existe) dice que no esta; la segunda sube
        const r = await corre(pc, { listar: listar([BUZON_CALIDAD, { ...BUZON_CALIDAD, casilla: OTRA }]), fuentes: { [OTRA]: fuente(pc, [mail(OTRA)]) } });
        expect(r.resumen.resultado).toBe('parcial');
        expect(r.resumen.casillas.find((c) => c.casilla === CALIDAD).resultado).toBe('error');
        expect(subidos(pc, 'calidad.proveedores')).toHaveLength(1);
    });
});

describe('mails_pc: lo que frena la corrida antes de leer nada', () => {
    const intento = (pc, extra = {}) => corre(pc, { fuentes: { [CALIDAD]: fuente(pc, [mail(CALIDAD)]) }, ...extra });
    it('otra PC con la misma configuracion no lee (3)', async () => {
        const pc = armarPc();
        const r = await intento(pc, { identidad: { usuario: 'Facundo Prueba', pc: 'OTRA-PC' } });
        expect([r.codigo, r.resumen.resultado]).toEqual([3, 'otra_pc']);
        expect(archivos(pc.entrada)).toEqual([]);
    });
    it('otro usuario de Windows en la misma PC no lee (3)', async () => {
        const pc = armarPc();
        const r = await intento(pc, { identidad: { usuario: 'Otra persona', pc: 'PC-CALIDAD' } });
        expect([r.codigo, r.resumen.resultado]).toEqual([3, 'otra_pc']);
        expect(archivos(pc.entrada)).toEqual([]);
    });
    it('sin configuracion no lee (1)', async () => {
        const pc = armarPc({ config: null });
        const r = await intento(pc);
        expect([r.codigo, r.resumen.resultado]).toEqual([1, 'sin_config']);
    });
    it('sin la lista de lo privado, o con una sin completar, no sube nada (5)', async () => {
        for (const privados of [null, '{ roto', { direcciones: ['dueno@barack.test'] }, { ...PRIVADOS_OK, total_direcciones: 9 }]) {
            const pc = armarPc({ privados });
            const r = await intento(pc);
            expect(r.codigo).toBe(5);
            expect(archivos(pc.entrada)).toEqual([]);
        }
    });
    it('sin la biblioteca de Ingenieria a la vista no sube y no inventa la carpeta (6)', async () => {
        const pc = armarPc({ conNube: false });
        const r = await intento(pc);
        expect([r.codigo, r.resumen.resultado]).toEqual([6, 'sin_nube']);
        expect(archivos(path.join(pc.t, 'biblioteca'))).toEqual([]);
    });
    it('una carpeta de mails que no cuelga de «Claude Barack» o no esta en la biblioteca de Ingenieria, tampoco', async () => {
        const pc = armarPc();
        const suelta = path.join(pc.t, 'pendrive', 'mails');
        fs.mkdirSync(suelta, { recursive: true });
        expect((await intento(pc, { carpetaMails: suelta })).resumen.resultado).toBe('sin_nube');
    });
    for (const [estado, resultado, codigo] of [['cerrado', 'outlook_cerrado', 4], ['nuevo', 'outlook_nuevo', 4], ['no_instalado', 'sin_outlook', 4], ['no_responde', 'outlook_no_responde', 4], ['rarisimo', 'error', 1]]) {
        it(`Outlook «${estado}» no sube nada y dice ${resultado}`, async () => {
            const pc = armarPc();
            const r = await intento(pc, { listar: listar([], { estado, detalle: 'detalle' }) });
            expect([r.codigo, r.resumen.resultado]).toEqual([codigo, resultado]);
            expect(archivos(pc.entrada)).toEqual([]);
        });
    }
});

describe('mails_pc: el lector de Outlook por casilla (-Buzon / -Listar)', () => {
    const fuentePs = fs.readFileSync(LECTOR, 'ascii');
    const codigo = fuentePs.split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join('\n');
    it('sigue siendo solo lectura y en ASCII, con -Buzon y -Listar', () => {
        expect([...fs.readFileSync(LECTOR)].filter((b) => b > 126).length).toBe(0);
        expect(codigo).toMatch(/\[string\]\$Buzon = ''/);
        expect(codigo).toMatch(/\[switch\]\$Listar/);
        for (const prohibido of [/\.Send\s*\(/i, /\.Delete\s*\(/i, /\.Move\s*\(/i, /\.Save\s*\(/i, /\.Display\s*\(/i, /\.Copy\s*\(/i, /UnRead/i, /\.Quit\s*\(/i, /Set-Content/i, /New-Item/i, /Remove-Item/i, /Start-Process/i]) {
            expect(codigo).not.toMatch(prohibido);
        }
    });
    it('-Listar no lee ningun mail: sale antes de recorrer carpetas', () => {
        expect(codigo.indexOf("t = 'casilla'")).toBeGreaterThan(0);
        expect(codigo.indexOf("t = 'casilla'")).toBeLessThan(codigo.indexOf('$pila.Push'));
        expect(codigo.slice(codigo.indexOf('if ($Listar)'), codigo.indexOf('$pila.Push'))).toMatch(/exit 0/);
    });
    it('dice de quien es el buzon que lee ANTES del primer mail', () => {
        expect(codigo.indexOf("t = 'buzon'")).toBeLessThan(codigo.indexOf('$pila.Push'));
    });
    it('en un buzon que no es el principal aparta por nombre las carpetas que Outlook no supo decir; en el principal, no lee nada', () => {
        expect(codigo).toMatch(/elseif \(-not \$esPrincipal\)/);
        expect(codigo).toMatch(/Terminar 'no_responde' \('Outlook no pudo decir cual es la carpeta/);
        for (const nombre of ['elementos eliminados', 'deleted items', 'bandeja de salida', 'borradores', 'drafts', 'correo no deseado', 'junk email']) expect(codigo).toContain(nombre);
    });
    const conPowerShell = process.platform === 'win32';
    it.runIf(conPowerShell)('con la sintaxis de PowerShell bien armada', () => {
        const r = spawnSync('powershell.exe', ['-NoProfile', '-Command', `$e=$null;$t=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('${LECTOR}',[ref]$t,[ref]$e);if($e){$e|ForEach-Object{$_.Message};exit 1}`], { encoding: 'utf8' });
        expect(r.stdout.trim()).toBe('');
        expect(r.status).toBe(0);
    }, 60000);
    it.runIf(conPowerShell)('sin Outlook clasico abierto, -Listar y -Buzon dicen «cerrado» y no devuelven ninguna cuenta (codigo 4)', async () => {
        const env = { ...process.env, CLAUDE_AREA_SIN_OUTLOOK: '1' };
        const l = await listarCasillas({ lector: LECTOR, env });
        expect(l.buzones).toEqual([]);
        expect(l.outlook).toMatchObject({ estado: 'cerrado' });
        const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', LECTOR, '-Buzon', CALIDAD], { encoding: 'utf8', env });
        expect(r.status).toBe(4);
        expect(r.stdout).toContain('"estado":"cerrado"');
    }, 60000);
    it('listarCasillas con un lector que no existe dice error, no tira', async () => {
        const l = await listarCasillas({ lector: path.join(os.tmpdir(), 'no-existe-123.ps1'), env: ENV });
        expect(l.buzones).toEqual([]);
        expect(l.outlook).toMatchObject({ estado: 'error' });
    });
    it.runIf(conPowerShell)('listarCasillas lee los renglones de un lector de mentira, y uno que no termina cuenta como «no responde»', async () => {
        const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mails-pc-lector-'));
        temporales.push(t);
        const bueno = path.join(t, 'bueno.ps1');
        fs.writeFileSync(bueno, `param([switch]$Listar)\r\n[Console]::Out.WriteLine('{"t":"casilla","casilla":"${CALIDAD}","nombre":"Calidad","tipo":"adicional","predeterminada":false}')\r\n[Console]::Out.WriteLine('{"t":"casilla","casilla":"","nombre":"Archivo","tipo":"no_exchange","predeterminada":false}')\r\n[Console]::Out.WriteLine('{"t":"fin","completa":true}')\r\n`, 'ascii');
        const l = await listarCasillas({ lector: bueno, env: process.env });
        expect(l.outlook).toBeNull();
        expect(l.buzones).toEqual([expect.objectContaining({ casilla: CALIDAD, tipo: 'adicional' }), expect.objectContaining({ casilla: '', tipo: 'no_exchange' })]);
        const colgado = path.join(t, 'colgado.ps1');
        fs.writeFileSync(colgado, `param([switch]$Listar)\r\nStart-Sleep -Seconds 30\r\n`, 'ascii');
        const t0 = Date.now();
        const m = await listarCasillas({ lector: colgado, env: process.env, segundos: 3 });
        expect(Date.now() - t0).toBeLessThan(20000);
        expect(m.outlook).toMatchObject({ estado: 'no_responde' });
    }, 60000);
});

describe('mails_pc: como programa', () => {
    const lanzar = (programa, args, env = {}) => spawnSync(process.execPath, [programa, ...args], { encoding: 'utf8', env: { ...process.env, CLAUDE_AREA_SIN_OUTLOOK: '1', ...env } });
    /** El programa copiado donde va instalado: `<raiz>\programas\`. */
    function instalado(pc) {
        const dir = path.join(pc.raiz, 'programas');
        fs.mkdirSync(dir, { recursive: true });
        for (const f of ['mails_pc.mjs', 'mails_area.mjs', 'mails_outlook.ps1']) fs.copyFileSync(path.join(AREA, f), path.join(dir, f));
        return path.join(dir, 'mails_pc.mjs');
    }
    it('viaja con mails_area.mjs: sus unicos imports son de node o de ese archivo', () => {
        const texto = fs.readFileSync(PROGRAMA, 'utf8');
        const imports = [...texto.matchAll(/from '([^']+)';$/gm)].map((m) => m[1]);
        expect(imports.every((i) => i.startsWith('node:') || i === './mails_area.mjs')).toBe(true);
    });
    it('desde su instalacion escribe UN renglon JSON (con Outlook cerrado: nada sube)', () => {
        const pc = armarPc({ config: { ...CONFIG, pc: os.hostname(), usuario: os.userInfo().username } });
        const r = lanzar(instalado(pc), ['--raiz', pc.raiz, '--carpeta-mails', pc.mails]);
        expect(r.stdout.trim().split('\n')).toHaveLength(1);
        expect(JSON.parse(r.stdout.trim()).resultado).toBe(process.platform === 'win32' ? 'outlook_cerrado' : 'error');
        expect(archivos(pc.entrada)).toEqual([]);
    }, 90000);
    it('no corre fuera de su instalacion, ni apuntado a otra raiz', () => {
        const pc = armarPc();
        const suelto = path.join(pc.t, 'copia', 'mails_pc.mjs');
        fs.mkdirSync(path.dirname(suelto), { recursive: true });
        fs.copyFileSync(PROGRAMA, suelto);
        fs.copyFileSync(path.join(AREA, 'mails_area.mjs'), path.join(path.dirname(suelto), 'mails_area.mjs'));
        for (const programa of [suelto]) {
            const r = lanzar(programa, ['--raiz', pc.raiz, '--carpeta-mails', pc.mails]);
            expect(r.status).toBe(1);
            expect(JSON.parse(r.stdout.trim()).resultado).toBe('error');
        }
        const otra = armarPc();
        const r = lanzar(instalado(pc), ['--raiz', otra.raiz, '--carpeta-mails', otra.mails]);
        expect(r.status).toBe(1);
        expect(archivos(pc.entrada)).toEqual([]);
    });
    it('por la linea de comandos no hay forma de darle otra configuracion, otros mails ni otro lector', () => {
        const pc = armarPc({ config: { ...CONFIG, pc: os.hostname(), usuario: os.userInfo().username } });
        const f = fuente(pc, [mail(CALIDAD)]);
        const r = lanzar(instalado(pc), ['--raiz', pc.raiz, '--carpeta-mails', pc.mails, '--config', f, '--fuentes', f, '--lector', f, '--identidad', 'x', '--ahora', '2026-10-08T16:00:00']);
        expect(JSON.parse(r.stdout.trim()).resultado).toBe(process.platform === 'win32' ? 'outlook_cerrado' : 'error');
        expect(archivos(pc.entrada)).toEqual([]);
    }, 90000);
    it('sin --raiz no corre', () => {
        const r = lanzar(PROGRAMA, []);
        expect(r.status).toBe(1);
        expect(JSON.parse(r.stdout.trim()).resultado).toBe('error');
    });
});

describe('mails_pc: el instalador y la tarea de punta a punta (con un Outlook de mentira)', () => {
    const conPowerShell = process.platform === 'win32';
    const PS = (archivo, args) => spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', archivo, ...args], { encoding: 'utf8', env: process.env, timeout: 200000 });
    /** Un lector de Outlook de mentira: con -Listar dice que cuentas hay, y con -Buzon entrega un mail de esa cuenta. */
    const lectorFalso = (cuentas) => [
        "param([string]$Desde = '', [string]$Conocidos = '', [int]$MaxSegundos = 0, [int]$MaxCuerpo = 0, [int]$PausaMs = 0, [string]$Buzon = '', [switch]$Listar)",
        'function W([string]$s) { [Console]::Out.WriteLine($s); [Console]::Out.Flush() }',
        'if ($Listar) {',
        ...cuentas.map(([casilla, nombre, tipo, pred]) => `  W '{"t":"casilla","casilla":"${casilla}","nombre":"${nombre}","tipo":"${tipo}","predeterminada":${pred}}'`),
        '  W \'{"t":"fin","completa":true,"revisados":0,"fallados":0}\'',
        '  exit 0',
        '}',
        "W ('{\"t\":\"buzon\",\"casilla\":\"' + $Buzon + '\"}')",
        'W \'{"t":"mail","id":"<e2e1@x.test>","eid":"AA11","carpeta":"Bandeja de entrada","fecha":"2026-10-07 10:00","de":"Cliente","de_mail":"cliente@proveedor.test","representa_mail":"","para":"Calidad","para_mails":["calidad@barackmercosul.com"],"cc":"","cc_mails":[],"cco_mails":[],"asunto":"Reclamo de prueba","adjuntos":[],"conversacion":"CC11","cuerpo":"Adjunto el informe.","reserva":0,"sin_resolver":0}\'',
        'W \'{"t":"fin","completa":true,"revisados":1,"fallados":0}\'',
        'exit 0',
        '',
    ].join('\r\n');
    /** La biblioteca de mentira y la carpeta del instalador (programa\ con los archivos del repo y el lector falso). */
    function armarBiblioteca(cuentas) {
        const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mails-pc-e2e-'));
        temporales.push(t);
        const bib = path.join(t, 'Ingeniería y Proyecto - General');
        const mails = path.join(bib, '_CUARENTENA_Claude Barack', 'mails');
        fs.mkdirSync(path.join(mails, '_entrada'), { recursive: true });
        const comun = path.join(bib, 'PAQUETE', '1- PUBLICADO', 'contenido', 'conocimiento', 'comun');
        fs.mkdirSync(comun, { recursive: true });
        fs.writeFileSync(path.join(comun, 'mails_privados.json'), JSON.stringify(PRIVADOS_OK), 'utf8');
        const bin = path.join(bib, 'PAQUETE', '1- PUBLICADO', 'contenido', 'marketplace', 'plugins', 'barack-area', 'bin');
        fs.mkdirSync(bin, { recursive: true });
        fs.copyFileSync(process.execPath, path.join(bin, 'node.exe'));
        const programa = path.join(bib, 'INSTALAR MAILS', 'programa');
        fs.mkdirSync(programa, { recursive: true });
        for (const f of ['mails_pc.mjs', 'mails_area.mjs']) fs.copyFileSync(path.join(AREA, f), path.join(programa, f));
        for (const f of ['instalar.ps1', 'subir.ps1', 'casillas.json']) fs.copyFileSync(path.join(AREA, 'mails_pc', f), path.join(programa, f));
        fs.writeFileSync(path.join(programa, 'mails_outlook.ps1'), lectorFalso(cuentas), 'ascii');
        return { t, bib, mails, programa, raiz: path.join(t, 'BarackMailsPC') };
    }
    const CUENTAS = [['f.prueba@barackmercosul.com', 'f.prueba@barackmercosul.com', 'principal', 'true'], [CALIDAD, 'Calidad', 'adicional', 'false'], ['', 'Archivo', 'no_exchange', 'false']];
    const saludDe = (b) => JSON.parse(fs.readFileSync(path.join(b.mails, '_salud', `${process.env.COMPUTERNAME}.json`), 'utf8'));

    it.runIf(conPowerShell)('instala, mira las cuentas, y la tarea sube solo la de Calidad (sin repetir en la segunda pasada)', () => {
        const b = armarBiblioteca(CUENTAS);
        const i = PS(path.join(b.programa, 'instalar.ps1'), ['-Raiz', b.raiz, '-SinTarea']);
        expect(i.status, i.stdout + i.stderr).toBe(0);
        expect(i.stdout).toMatch(/SE COPIA\s+calidad@barackmercosul\.com/);
        expect(i.stdout).toMatch(/no se copia\s+f\.prueba@barackmercosul\.com - no es una cuenta de Calidad/);
        expect(i.stdout).toMatch(/no se copia\s+\(Archivo\) - no pude saber su casilla/);
        expect(i.stdout).toMatch(/LISTO/);
        const config = JSON.parse(fs.readFileSync(path.join(b.raiz, 'estado', 'config.json'), 'utf8'));
        expect(config).toMatchObject({ pc: process.env.COMPUTERNAME, usuario: process.env.USERNAME, incluir: ['calidad'] });
        // (la ruta puede venir en su forma corta 8.3 o larga: se comparan resueltas)
        expect(fs.realpathSync.native(config.biblioteca).toLowerCase()).toBe(fs.realpathSync.native(b.bib).toLowerCase());
        expect(fs.existsSync(path.join(b.raiz, 'node', 'node.exe'))).toBe(true);
        expect(fs.existsSync(path.join(b.raiz, 'casa', 'publicado', 'conocimiento', 'comun', 'mails_privados.json'))).toBe(true);
        expect(saludDe(b).resultado).toMatchObject({ resultado: 'inventario', suben: [CALIDAD] });
        expect(archivos(path.join(b.mails, '_entrada'))).toEqual([]);      // el inventario no lee ni sube nada

        // la tarea: tal cual la lanza Windows
        const s = PS(path.join(b.raiz, 'subir.ps1'), []);
        expect(s.status, s.stdout + s.stderr).toBe(0);
        const subidoEnTarea = () => archivos(path.join(b.mails, '_entrada', 'calidad')).flatMap((f) => fs.readFileSync(path.join(b.mails, '_entrada', 'calidad', f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
        expect(subidoEnTarea().map((m) => m.asunto)).toEqual(['Reclamo de prueba']);
        expect(archivos(path.join(b.mails, '_entrada'))).toHaveLength(1);
        const salud2 = saludDe(b);
        expect(salud2.resultado).toMatchObject({ resultado: 'ok', casillas: [expect.objectContaining({ casilla: CALIDAD, entrada: 1 })] });
        expect(JSON.stringify(salud2)).not.toContain('Adjunto el informe');      // en la salud no va ningun mail
        expect(fs.readFileSync(path.join(b.raiz, 'mails.log'), 'utf8')).toMatch(/codigo 0/);
        // segunda pasada: nada repetido
        PS(path.join(b.raiz, 'subir.ps1'), []);
        expect(subidoEnTarea()).toHaveLength(1);
    }, 400000);

    it.runIf(conPowerShell)('si ninguna cuenta es de Calidad, el instalador lo dice, sale con 2 y la tarea no sube nada', () => {
        const b = armarBiblioteca([CUENTAS[0]]);
        const i = PS(path.join(b.programa, 'instalar.ps1'), ['-Raiz', b.raiz, '-SinTarea']);
        expect(i.status, i.stdout + i.stderr).toBe(2);
        expect(i.stdout).toMatch(/TODAVIA NO COPIA NADA/);
        expect(i.stdout).toMatch(/ninguna de las cuentas de este Outlook es de Calidad/);
        const s = PS(path.join(b.raiz, 'subir.ps1'), []);
        expect(s.status).toBe(0);
        expect(archivos(path.join(b.mails, '_entrada'))).toEqual([]);
        expect(saludDe(b).resultado.resultado).toBe('sin_casillas');
    }, 400000);

    // 08/10/2026: la PC de Ingenieria de Fak sube SU casilla con el mismo instalador (Fak: "todos mis mails en la nube").
    // -SoloCasillas reemplaza a casillas.json y -NombreTarea a la tarea de Calidad (en PowerShell $Tarea y $TAREA son la
    // misma variable: por eso los nombres distintos).
    it.runIf(conPowerShell)('con -SoloCasillas sube SOLO esa casilla (la de Calidad queda afuera) y la tarea la respeta', () => {
        const b = armarBiblioteca(CUENTAS);
        const i = PS(path.join(b.programa, 'instalar.ps1'), ['-Raiz', b.raiz, '-SinTarea', '-SoloCasillas', 'f.prueba@barackmercosul.com', '-NombreTarea', 'Barack - mis mails a la nube']);
        expect(i.status, i.stdout + i.stderr).toBe(0);
        expect(i.stdout).toMatch(/SE COPIA\s+f\.prueba@barackmercosul\.com/);
        expect(i.stdout).toMatch(/no se copia\s+calidad@barackmercosul\.com/);
        const config = JSON.parse(fs.readFileSync(path.join(b.raiz, 'estado', 'config.json'), 'utf8'));
        expect(config.incluir).toEqual(['f.prueba@barackmercosul.com']);
        expect(PS(path.join(b.raiz, 'subir.ps1'), []).status).toBe(0);
        expect(archivos(path.join(b.mails, '_entrada')).map((f) => f.split(/[\\/]/)[0])).toEqual(['f.prueba']);
        expect(saludDe(b).resultado).toMatchObject({ resultado: 'ok', casillas: [expect.objectContaining({ casilla: 'f.prueba@barackmercosul.com', entrada: 1 })] });
    }, 400000);

    it.runIf(conPowerShell)('con -SoloCasillas y esa casilla ausente, lo dice con la casilla (no con «Calidad») y sale con 2', () => {
        const b = armarBiblioteca([CUENTAS[1]]);
        const i = PS(path.join(b.programa, 'instalar.ps1'), ['-Raiz', b.raiz, '-SinTarea', '-SoloCasillas', 'f.prueba@barackmercosul.com']);
        expect(i.status, i.stdout + i.stderr).toBe(2);
        expect(i.stdout).toMatch(/ninguna de las cuentas de este Outlook es f\.prueba@barackmercosul\.com/);
    }, 400000);

    it.runIf(conPowerShell)('apagada desde la nube (archivo de control con el nombre de la PC): la tarea no sube nada', () => {
        const b = armarBiblioteca(CUENTAS);
        expect(PS(path.join(b.programa, 'instalar.ps1'), ['-Raiz', b.raiz, '-SinTarea']).status).toBe(0);
        fs.mkdirSync(path.join(b.mails, '_control'), { recursive: true });
        fs.writeFileSync(path.join(b.mails, '_control', `${process.env.COMPUTERNAME}.json`), JSON.stringify({ apagado: true }), 'utf8');
        expect(PS(path.join(b.raiz, 'subir.ps1'), []).status).toBe(0);
        expect(archivos(path.join(b.mails, '_entrada'))).toEqual([]);
        expect(saludDe(b).resultado.resultado).toBe('apagado');
    }, 400000);

    it('el instalador y la tarea no mandan nada afuera ni dejan nada en la nube personal', () => {
        for (const f of ['instalar.ps1', 'subir.ps1']) {
            const texto = fs.readFileSync(path.join(AREA, 'mails_pc', f), 'ascii');
            expect(texto).not.toMatch(/OneDrive - BARACK/i);
            expect(texto).not.toMatch(/\.Send\s*\(|Invoke-WebRequest|Invoke-RestMethod|Net\.WebClient/i);
        }
    });
});
