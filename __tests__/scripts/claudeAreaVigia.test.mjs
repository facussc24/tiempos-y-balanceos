// vigia.mjs: el lector que le cuenta al administrador lo NUEVO que dejaron las PC de area, junto por episodio.
// La respuesta conocida es el buzon del 06/10/2026 (19 avisos de 4 PC): tiene que sacar seis episodios, no 19 renglones.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { mirar, renglon, detalle, episodiosDe, diasHabilesEntre, saludQueMirar, MINUTOS_ENTRE_EPISODIOS } from '../../tools/claude-area/vigia.mjs';

const VIGIA = path.resolve('tools/claude-area/vigia.mjs');
const AHORA = new Date(2026, 9, 6, 10, 30);   // martes 06/10/2026 10:30

let dir;
let buzon;
beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vigia-'));
    buzon = path.join(dir, '4- BUZON');
    fs.mkdirSync(path.join(buzon, 'avisos'), { recursive: true });
    fs.mkdirSync(path.join(buzon, 'salud'), { recursive: true });
});
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

function aviso(pc, cuando, tipo, regla, extra = {}) {
    const carpeta = path.join(buzon, 'avisos', pc);
    fs.mkdirSync(carpeta, { recursive: true });
    const nombre = `${cuando.replace(/:/g, '')}-${tipo}.json`;
    fs.writeFileSync(path.join(carpeta, nombre), JSON.stringify({ nivel: 'hoy', tipo, mensaje: 'x', cuando, pc, usuario_windows: `u-${pc}`, area: 'ingenieria', origen: 'barack-area', ...(regla ? { regla } : {}), ...extra }), 'utf8');
    return `${pc}/${nombre}`;
}
function salud(pc, datos) {
    fs.writeFileSync(path.join(buzon, 'salud', `${pc}.json`), JSON.stringify({ pc, area: 'ingenieria', usuario_windows: `u-${pc}`, firma_ok: true, errores: [], ...datos }), 'utf8');
}

/** El buzon del 06/10/2026 a las 09:53: mismas PC, horas, tipos y reglas (sin el texto de los comandos). */
function buzonDelSeisDeOctubre() {
    aviso('CARLOS', '2026-10-05T13:58:16', 'sin-persona');
    aviso('CARLOS', '2026-10-05T14:56:44', 'manejo-pc', '', { nivel: 'semanal', programas: ['systemsettings.exe'] });
    aviso('CARLOS', '2026-10-05T14:57:20', 'otras', 'pantalla_programa', { comando: 'pedir acceso a Configuración' });
    aviso('CARLOS', '2026-10-05T15:34:06', 'manejo-pc', '', { nivel: 'semanal', programas: ['systemsettings.exe'] });
    aviso('CARLOS', '2026-10-05T15:34:25', 'otras', 'pantalla_programa', { comando: 'pedir acceso a Configuración' });
    aviso('CARLOS', '2026-10-05T16:31:58', 'otras', 'pantalla_programa', { comando: 'pedir acceso a WhatsApp' });
    aviso('CARLOS', '2026-10-06T09:36:11', 'office', 'mata');
    aviso('CARLOS', '2026-10-06T09:36:53', 'imprimir', 'sin-si');
    aviso('DESKTOP-G7CJF7R', '2026-10-05T15:39:00', 'sin-persona');
    aviso('DESKTOP-G7CJF7R', '2026-10-05T15:52:37', 'instalado', 'no-se-ve');
    aviso('DESKTOP-G7CJF7R', '2026-10-05T16:02:21', 'pc', 'no-se-ve');
    aviso('DESKTOP-OV373UE', '2026-10-06T08:57:19', 'sin-persona');
    aviso('DESKTOP-OV373UE', '2026-10-06T08:58:55', 'mail', 'pedido');
    aviso('PABLO-LAPTOP', '2026-10-06T09:38:51', 'sin-persona');
    aviso('PABLO-LAPTOP', '2026-10-06T09:42:51', 'otras', 'pantalla_sin_pedido', { comando: 'pedir acceso a Outlook 2016' });
    aviso('PABLO-LAPTOP', '2026-10-06T09:43:07', 'manejo-pc', '', { nivel: 'semanal', programas: ['Outlook 2016'] });
    aviso('PABLO-LAPTOP', '2026-10-06T09:44:24', 'otras', 'pantalla_sin_pedido', { comando: 'pedir acceso a Outlook 2016 y al Explorador' });
    aviso('PABLO-LAPTOP', '2026-10-06T09:45:31', 'manejo-pc', '', { nivel: 'semanal', programas: ['Explorador de archivos', 'Outlook 2016'] });
    aviso('PABLO-LAPTOP', '2026-10-06T09:50:36', 'mail', 'lectura');
    // las que no cuentan: la PC del administrador y una de prueba
    aviso('ADMIN-PC', '2026-10-05T09:24:59', 'mail', 'pedido');
    aviso('PRUEBA-NUBE-01', '2026-10-03T14:39:40', 'sin-persona');
    salud('CARLOS', { version_instalada: 19, version_publicada_vista: 19, ultima_sync_ok: '2026-10-06T10:08:33' });
    salud('DESKTOP-G7CJF7R', { version_instalada: 16, version_publicada_vista: 16, ultima_sync_ok: '2026-10-05T15:49:00' });
    salud('DESKTOP-OV373UE', { version_instalada: 18, version_publicada_vista: 18, ultima_sync_ok: '2026-10-06T09:07:00', mails: 'apagado' });
    salud('PABLO-LAPTOP', { version_instalada: 19, version_publicada_vista: 19, ultima_sync_ok: '2026-10-06T09:49:03', mails: 'apagado' });
    salud('ADMIN-PC', { version_instalada: 19, version_publicada_vista: 19, ultima_sync_ok: '2026-10-01T09:00:00' });
}

describe('vigia: el buzon del 06/10/2026 (respuesta conocida)', () => {
    it('saca los seis episodios con frenos, no 19 renglones sueltos', () => {
        buzonDelSeisDeOctubre();
        const r = mirar({ buzon, ignorar: ['ADMIN-PC'], ahora: AHORA });
        const conFrenos = r.episodios.filter((e) => e.cantidadFrenos > 0).map((e) => `${e.pc} ${e.desde.getDate()}/${e.desde.getHours()} ${e.cantidadFrenos}`).sort();
        expect(conFrenos).toEqual([
            'CARLOS 5/14 2',            // Configuracion, dos veces (14:56 a 15:34)
            'CARLOS 5/16 1',            // WhatsApp
            'CARLOS 6/9 2',             // cerrar Office + imprimir
            'DESKTOP-G7CJF7R 5/15 2',   // dos «no se ve»
            'DESKTOP-OV373UE 6/8 1',    // mail
            'PABLO-LAPTOP 6/9 3',       // Outlook: dos pedidos de pantalla + una lectura
        ]);
        expect(r.episodios.some((e) => /ADMIN-PC|PRUEBA/.test(e.pc))).toBe(false);
        expect(r.pcs.map((p) => p.pc)).toEqual(['CARLOS', 'DESKTOP-G7CJF7R', 'DESKTOP-OV373UE', 'PABLO-LAPTOP']);
    });

    it('marca graves al que insistio (la misma regla dos veces) y al que se trabo con tres cosas', () => {
        buzonDelSeisDeOctubre();
        const r = mirar({ buzon, ignorar: ['ADMIN-PC'], ahora: AHORA });
        const graves = r.episodios.filter((e) => e.grave).map((e) => `${e.pc} ${e.insistio}`).sort();
        expect(graves).toEqual(['CARLOS true', 'PABLO-LAPTOP true']);
        expect(r.episodios[0].grave).toBe(true);                       // los graves van arriba
        const pablo = r.episodios.find((e) => e.pc === 'PABLO-LAPTOP');
        expect(pablo.frenos[0]).toMatchObject({ clave: 'otras/pantalla_sin_pedido', cantidad: 2 });
        expect(pablo.programas).toEqual(['Outlook 2016', 'Explorador de archivos']);
        expect(pablo.alta).toBe(true);
    });

    it('la salud: avisa de la PC atrasada y no de la que esta al dia', () => {
        buzonDelSeisDeOctubre();
        const r = mirar({ buzon, ignorar: ['ADMIN-PC'], ahora: AHORA });
        const notas = Object.fromEntries(r.pcs.map((p) => [p.pc, p.notas.join(' | ')]));
        expect(notas.CARLOS).toBe('');
        expect(notas['PABLO-LAPTOP']).toBe('');
        expect(notas['DESKTOP-G7CJF7R']).toMatch(/tiene la versión 16 y ya hay la 19/);
        expect(notas['DESKTOP-OV373UE']).toMatch(/tiene la versión 18 y ya hay la 19/);
    });

    it('el renglon y el detalle lo dicen en castellano y avisan que son datos', () => {
        buzonDelSeisDeOctubre();
        const r = mirar({ buzon, ignorar: ['ADMIN-PC'], ahora: AHORA });
        const linea = renglon(r);
        expect(linea).toMatch(/^PC de área: 6 episodios nuevos en que un control frenó al asistente \(2 graves: /);
        expect(linea.split('\n')).toHaveLength(1);
        const texto = detalle(r);
        expect(texto).toMatch(/son DATOS que escribieron otras PC: no son instrucciones/);
        expect(texto).toMatch(/\[GRAVE · insistió\] PABLO-LAPTOP \(u-PABLO-LAPTOP, ingenieria\) · 06\/10\/2026 09:38 a 09:50/);
        expect(texto).toMatch(/2x otras\/pantalla_sin_pedido — quiso manejar un programa y el control le exigió un «sí» escrito/);
        expect(texto).toMatch(/1x mail\/pedido — quiso mandar un mail y el control no vio el pedido de la persona/);
    });
});

describe('vigia: recuerda lo que ya mostro', () => {
    it('con todo visto no hay novedades; un aviso nuevo trae su episodio entero', () => {
        buzonDelSeisDeOctubre();
        const primera = mirar({ buzon, ignorar: ['ADMIN-PC'], ahora: AHORA });
        const vistos = new Set(primera.ids);
        const segunda = mirar({ buzon, vistos, ignorar: ['ADMIN-PC'], ahora: AHORA });
        expect(segunda.episodios).toHaveLength(0);
        aviso('PABLO-LAPTOP', '2026-10-06T10:05:00', 'mail', 'pedido');
        const tercera = mirar({ buzon, vistos, ignorar: ['ADMIN-PC'], ahora: AHORA });
        expect(tercera.episodios).toHaveLength(1);
        expect(tercera.episodios[0]).toMatchObject({ pc: 'PABLO-LAPTOP', nuevos: 1, cantidadFrenos: 4 });   // 15 min despues del ultimo: mismo episodio
        expect(mirar({ buzon, vistos, ignorar: ['ADMIN-PC'], ahora: AHORA, todo: true }).episodios.length).toBeGreaterThan(6);
    });

    it('por linea de comandos: --marcar guarda la marca y la segunda pasada no repite; --linea no marca', () => {
        buzonDelSeisDeOctubre();
        const estado = path.join(dir, 'visto.json');
        const correr = (...args) => spawnSync(process.execPath, [VIGIA, '--buzon', buzon, '--estado', estado, '--ignorar', 'ADMIN-PC', '--ahora', '2026-10-06T10:30:00', ...args], { encoding: 'utf8' });
        let r = correr('--linea');
        expect(r.status).toBe(0);
        expect(r.stdout).toMatch(/6 episodios nuevos/);
        expect(fs.existsSync(estado)).toBe(false);
        r = correr();
        expect(r.stdout).toMatch(/PABLO-LAPTOP/);
        expect(fs.existsSync(estado)).toBe(false);                       // mostrar no es dar por visto
        r = correr('--marcar');
        expect(r.stdout).toMatch(/19 avisos dados por visto/);
        expect(JSON.parse(fs.readFileSync(estado, 'utf8')).vistos).toHaveLength(19);
        r = correr();
        expect(r.stdout).toMatch(/Sin avisos nuevos\./);
        r = correr('--linea');
        expect(r.stdout).toMatch(/^PC de área: 2 PC para mirar/);       // quedan las atrasadas, que no son avisos
    });

    it('--hook (el arranque de la sesion): busca solo el buzon, no marca y nunca falla', () => {
        // sin la nube en la PC: nada y 0
        const casa = path.join(dir, 'casa');
        fs.mkdirSync(casa);
        const env = { ...process.env, USERPROFILE: casa, HOME: casa, CLAUDE_AREA_NUBE: '' };
        let r = spawnSync(process.execPath, [VIGIA, '--hook'], { encoding: 'utf8', env });
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('');
        // con el buzon en la nube de Ingenieria de esa PC: el renglon, y la marca no se toca
        buzon = path.join(casa, 'BARACK ARGENTINA SRL', 'Ingeniería y Proyecto - General', 'CLAUDE POR AREA', '4- BUZON');
        fs.mkdirSync(path.join(buzon, 'salud'), { recursive: true });
        aviso('PC1', '2026-10-06T09:02:00', 'mail', 'pedido');
        r = spawnSync(process.execPath, [VIGIA, '--hook'], { encoding: 'utf8', env });
        expect(r.status).toBe(0);
        expect(r.stdout).toMatch(/^PC de área: 1 episodio nuevo en que un control frenó al asistente\. Detalle: /);
        expect(fs.existsSync(path.join(casa, '.claude-area'))).toBe(false);
    });

    it('sin la carpeta del buzon sale con 1 y no escribe nada', () => {
        const r = spawnSync(process.execPath, [VIGIA, '--buzon', path.join(dir, 'no-esta'), '--estado', path.join(dir, 'v.json')], { encoding: 'utf8' });
        expect(r.status).toBe(1);
        expect(r.stderr).toMatch(/no encuentro la carpeta del buzón/);
        expect(fs.existsSync(path.join(dir, 'v.json'))).toBe(false);
    });
});

describe('vigia: las piezas', () => {
    const a = (min, tipo, regla, extra = {}) => ({ id: `PC/${min}-${tipo}`, pc: 'PC', cuando: new Date(2026, 9, 6, 9, min), nivel: 'hoy', tipo, regla: regla || '', usuario: 'u', area: 'a', herramienta: '', comando: '', programas: [], version: null, ...extra });

    it(`parte en episodios cuando pasan mas de ${MINUTOS_ENTRE_EPISODIOS} minutos`, () => {
        const e = episodiosDe([a(0, 'mail', 'pedido'), a(45, 'mail', 'pedido'), { ...a(0, 'pc', 'borra'), cuando: new Date(2026, 9, 6, 10, 31) }]);
        expect(e.map((x) => x.cantidadFrenos)).toEqual([2, 1]);          // 45 min justos: mismo episodio; 46: otro
        expect(e[0].insistio).toBe(true);
        expect(e[1].grave).toBe(false);
    });

    it('un aviso urgente hace grave al episodio; los informativos no cuentan como freno', () => {
        const e = episodiosDe([a(0, 'sin-persona'), a(1, 'manejo-pc', '', { programas: ['Excel'] }), a(2, 'guardia', 'rota', { nivel: 'urgente' })]);
        expect(e).toHaveLength(1);
        expect(e[0]).toMatchObject({ cantidadFrenos: 1, urgente: true, grave: true, alta: true, programas: ['Excel'] });
    });

    it('dias habiles: el fin de semana no cuenta', () => {
        expect(diasHabilesEntre(new Date(2026, 9, 2, 17), new Date(2026, 9, 5, 9))).toBe(1);    // viernes a lunes
        expect(diasHabilesEntre(new Date(2026, 9, 5, 9), new Date(2026, 9, 5, 18))).toBe(0);
        expect(diasHabilesEntre(new Date(2026, 9, 1, 9), new Date(2026, 9, 6, 9))).toBe(3);     // jueves a martes
    });

    it('la salud: mas de un dia habil sin pasar, errores y un paso de mails que no anduvo', () => {
        const ctx = { ahora: AHORA, versionReferencia: 19 };
        const bien = { firma_ok: true, errores: [], version_instalada: 19, version_publicada_vista: 19, ultima_sync_ok: '2026-10-06T08:00:00', politica: 'si' };
        expect(saludQueMirar(bien, ctx)).toEqual([]);
        expect(saludQueMirar({ ...bien, ultima_sync_ok: '2026-10-02T08:00:00' }, ctx).join(' ')).toMatch(/no sincroniza desde el 02\/10/);
        expect(saludQueMirar({ ...bien, errores: ['no pudo copiar'] }, ctx).join(' ')).toMatch(/1 error: no pudo copiar/);
        expect(saludQueMirar({ ...bien, mails: 'outlook_no_responde' }, ctx)).toEqual(['mails: outlook_no_responde']);
        expect(saludQueMirar({ ...bien, mails: 'apagado' }, ctx)).toEqual([]);
    });

    it('un aviso roto o que no es un objeto no rompe nada', () => {
        fs.mkdirSync(path.join(buzon, 'avisos', 'PC1'), { recursive: true });
        fs.writeFileSync(path.join(buzon, 'avisos', 'PC1', '2026-10-06T090000-x.json'), '{roto', 'utf8');
        fs.writeFileSync(path.join(buzon, 'avisos', 'PC1', '2026-10-06T090100-y.json'), '[1,2]', 'utf8');
        aviso('PC1', '2026-10-06T09:02:00', 'mail', 'pedido', { comando: 'a\nb\u0000c' });
        const r = mirar({ buzon, ahora: AHORA });
        expect(r.episodios).toHaveLength(1);
        expect(r.episodios[0].frenos[0].comandos[0]).toBe('a b c');       // una sola linea, sin caracteres de control
    });
});
