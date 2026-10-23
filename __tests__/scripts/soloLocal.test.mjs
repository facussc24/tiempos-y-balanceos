/**
 * Tests de `scripts/_lib/soloLocal.mjs` y de lo que `_nube.mjs` sube y baja de la configuracion de Claude.
 *
 * 23/10/2026: este test afirmaba la regla del 20/10 (*"quiero tenerlas en local"*: skills, reglas, agentes, hooks y el
 * settings solo en la PC). Se actualiza porque Fak la revirtio textualmente el 23/10/2026 15:30: *"me gustaría volver a
 * subir la inteligencia a la nube para sincronizar entre mis notebooks... el otro día te había dicho que no pero mejor sí,
 * ya fue, skills todo; necesito que mis notebooks siempre estén sincronizadas"*. Ahora afirma la regla nueva: las piezas de
 * configuracion SALEN en `--subir` y ENTRAN en `--bajar` (a `claude-config\` de la carpeta de Fak en la nube de
 * Ingenieria), y nada apunta a la nube personal. Lo que no cambio: los armadores para otras personas no escriben en una nube.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { esRutaDeNube, frenarSiEsNube, PIEZAS_SOLO_LOCAL, SUELTOS_SOLO_LOCAL, CARPETA_CONFIG_EN_NUBE } from '../../scripts/_lib/soloLocal.mjs';

const BIB = 'C:\\Users\\FacundoS-PC\\BARACK ARGENTINA SRL\\Ingeniería y Proyecto - General';
const PERSONAL = 'C:\\Users\\FacundoS-PC\\OneDrive - BARACK ARGENTINA SRL\\Desktop';
const SCRIPT = join(__dirname, '..', '..', 'scripts', '_nube.mjs');

describe('esRutaDeNube', () => {
    it('la biblioteca de Ingenieria y la nube personal son nube', () => {
        expect(esRutaDeNube(`${BIB}\\ASISTENTE INGENIERIA\\2- EQUIPO (publicado)\\Carlos Baptista`)).toBe(true);
        expect(esRutaDeNube(`${BIB}\\ASISTENTE INGENIERIA\\1- INSTALAR (doble clic)\\3- Asistente de Pedro Ergo`)).toBe(true);
        expect(esRutaDeNube(PERSONAL)).toBe(true);
        expect(esRutaDeNube('C:/Users/x/BARACK ARGENTINA SRL/Ingeniería y Proyecto - General')).toBe(true);
    });
    it('una carpeta local no es nube', () => {
        expect(esRutaDeNube('C:\\Dev\\ASISTENTE-LOCAL\\instaladores\\Pedro')).toBe(false);
        expect(esRutaDeNube('C:\\Users\\x\\AppData\\Local\\Temp\\armar-123')).toBe(false);
        expect(esRutaDeNube('E:\\PENDRIVE\\asistente')).toBe(false);
        expect(esRutaDeNube('')).toBe(false);
    });
});

describe('frenarSiEsNube', () => {
    it('frena en la nube y deja pasar lo local', () => {
        expect(() => frenarSiEsNube(`${BIB}\\ASISTENTE INGENIERIA`, 'X')).toThrow(/no se escribe en la nube/);
        expect(() => frenarSiEsNube('C:\\Dev\\ASISTENTE-LOCAL', 'X')).not.toThrow();
    });
});

describe('desde el 23/10/2026 la configuracion viaja por la nube de Ingenieria', () => {
    const fuente = readFileSync(SCRIPT, 'utf8');
    it('no queda ninguna pieza ni archivo solo-local', () => {
        expect(PIEZAS_SOLO_LOCAL.size).toBe(0);
        expect(SUELTOS_SOLO_LOCAL.size).toBe(0);
        expect(CARPETA_CONFIG_EN_NUBE).toBe('claude-config');
    });
    it('cada pieza de configuracion tiene su carpeta adentro de claude-config', () => {
        for (const [clave, local, sub] of [['reglas', 'rules', 'rules'], ['skills', 'skills', 'skills'], ['agentes', 'agents', 'agents'],
            ['comandos', 'commands', 'commands'], ['hooks', 'hooks', 'hooks'], ['planes', 'plans', 'plans']]) {
            expect(fuente).toContain(`['${clave}', join(CLAUDE, '${local}'), 'claude-config\\\\${sub}',`);
        }
        expect(fuente).toContain("[CLAUDE, 'settings.json', 'claude-config',");
    });
    it('la misma lista alimenta la subida y la bajada', () => {
        expect(fuente).toMatch(/const PIEZAS = PIEZAS_TODAS\.filter\(\(\[clave\]\) => !PIEZAS_SOLO_LOCAL\.has\(clave\)\)/);
        expect(fuente).toContain('const [origen, destino] = subir ? [local, enNube] : [enNube, local];');
        expect(fuente).toContain('const [origen, destino] = subir ? [dir, enNube] : [enNube, dir];');
        // el aviso de "volvio a aparecer claude-config" ya no tiene sentido: ahora tiene que estar ahi
        expect(fuente).not.toMatch(/avisoConfigEnNube/);
    });
});

// Corrida real de _nube.mjs en dry-run (sin --aplicar no copia ni borra nada) contra una PC y una nube de mentira:
// la PC de mentira se dice con USERPROFILE y la nube con BARACK_NUBE_CEREBRO (scripts/_lib/nubeRutas.mjs).
describe('_nube.mjs de verdad, en dry-run, con una PC y una nube de mentira', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'nube-config-'));
    afterAll(() => { try { rmSync(tmp, { recursive: true, force: true }); } catch { /* temporal */ } });
    const casa = join(tmp, 'casa');
    const nube = join(tmp, 'BARACK ARGENTINA SRL', 'Ingeniería y Proyecto - General', 'ASISTENTE INGENIERIA', '5- FACUNDO (memoria y configuracion)');
    const escribir = (ruta, texto = 'x') => { mkdirSync(join(ruta, '..'), { recursive: true }); writeFileSync(ruta, texto, 'utf8'); };
    const CONFIG = [['skills', 'skills', 'a/SKILL.md'], ['agentes', 'agents', 'a.md'], ['comandos', 'commands', 'c.md'],
        ['hooks', 'hooks', 'h.sh'], ['reglas', 'rules', 'r.md'], ['planes', 'plans', 'p.md']];
    const correr = (direccion, variable = nube) => {
        const env = { ...process.env, USERPROFILE: casa, HOME: casa, BARACK_NUBE_CEREBRO: variable };
        const r = spawnSync(process.execPath, [SCRIPT, direccion], { env, encoding: 'utf8', timeout: 90000, windowsHide: true });
        return (r.stdout || '') + (r.stderr || '');
    };
    const renglon = (salida, clave) => (salida.split(/\r?\n/).find((l) => new RegExp(`^\\s+${clave.replace('.', '\\.')}\\s`).test(l)) || '');

    it('--subir: las skills, agentes, comandos, hooks, reglas, planes y el settings salen de la PC', () => {
        escribir(join(casa, '.claude', 'projects', 'C--Dev-BarackMercosul', 'memory', 'm.md'));
        for (const [, local, archivo] of CONFIG) escribir(join(casa, '.claude', local, ...archivo.split('/')));
        escribir(join(casa, '.claude', 'settings.json'), '{}');
        mkdirSync(join(nube, 'claude-memoria'), { recursive: true });
        const salida = correr('--subir');
        expect(salida).toContain('DRY-RUN');
        for (const [clave] of CONFIG) expect(renglon(salida, clave)).toMatch(/1 archivo\b/);
        expect(renglon(salida, 'settings.json')).toMatch(/1 archivo\b/);
        // dry-run de verdad: en la nube de mentira no aparecio nada
        expect(readdirSync(nube)).toEqual(['claude-memoria']);
    }, 120000);

    it('--bajar: lo que hay en claude-config de la nube entra a la PC', () => {
        for (const [, local, archivo] of CONFIG) escribir(join(nube, 'claude-config', local, 'nuevo-' + archivo.replace('/', '-')));
        escribir(join(nube, 'claude-config', 'settings.json'), '{"nuevo":1}');
        const salida = correr('--bajar');
        expect(salida).toContain('DRY-RUN');
        for (const [clave] of CONFIG) expect(renglon(salida, clave)).toMatch(/1 archivo\b/);
        expect(renglon(salida, 'settings.json')).toMatch(/1 archivo\b/);
    }, 120000);

    it('nada va a la nube personal: si la variable apunta a OneDrive - BARACK ARGENTINA SRL, la ignora', () => {
        const personal = join(casa, 'OneDrive - BARACK ARGENTINA SRL', 'copia');
        mkdirSync(join(personal, 'claude-memoria'), { recursive: true });
        const salida = correr('--subir', personal);
        const destino = (salida.split(/\r?\n/).find((l) => /^\s+nube\s+:/.test(l)) || '');
        expect(destino).toMatch(/ASISTENTE INGENIERIA/);
        expect(destino).not.toMatch(/OneDrive - BARACK/i);
    }, 120000);
});

describe('los armadores no escriben en la nube', () => {
    it('armar() del asistente de otra persona frena con --out en la nube', async () => {
        const { armar } = await import('../../tools/claude-area/persona/armar.mjs');
        expect(() => armar({ persona: 'pedro', out: `${BIB}/ASISTENTE INGENIERIA/1- INSTALAR (doble clic)/x` })).toThrow(/no se escribe en la nube/);
    });
    it('armarHerramientas() frena con --out en la nube', async () => {
        const { armarHerramientas } = await import('../../tools/claude-area/persona/armar_herramientas.mjs');
        expect(() => armarHerramientas({ out: `${BIB}/x` })).toThrow(/no se escribe en la nube/);
    });
    it('publicar() de las mejoras devuelve problemas con destino en la nube y no escribe', async () => {
        const { publicar } = await import('../../tools/claude-area/mejoras/publicar.mjs');
        const r = publicar({ persona: { nombre: 'Carlos Baptista' }, mejoras: [], out: BIB, version: 1, aplicar: true });
        expect(r.problemas && r.problemas[0]).toMatch(/no se publican en la nube/);
    });
});
