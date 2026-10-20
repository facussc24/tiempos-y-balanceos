/**
 * Tests de `scripts/_lib/soloLocal.mjs` — las skills, reglas, agentes, hooks y el settings de Claude viven solo en
 * las PC de Fak (Fak, 20/10/2026: *"lo que no quiero es que tengan mis skills... quiero tenerlas en local"*).
 * La memoria, los registros y los mails siguen yendo a la nube. Probado en las dos direcciones.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esRutaDeNube, frenarSiEsNube, PIEZAS_SOLO_LOCAL, SUELTOS_SOLO_LOCAL } from '../../scripts/_lib/soloLocal.mjs';

const BIB = 'C:\\Users\\FacundoS-PC\\BARACK ARGENTINA SRL\\Ingeniería y Proyecto - General';
const PERSONAL = 'C:\\Users\\FacundoS-PC\\OneDrive - BARACK ARGENTINA SRL\\Desktop';

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

describe('_nube.mjs no sube ni sincroniza la configuracion', () => {
    const fuente = readFileSync(join(__dirname, '..', '..', 'scripts', '_nube.mjs'), 'utf8');
    it('las piezas de configuracion son solo locales y la memoria no', () => {
        for (const c of ['reglas', 'skills', 'agentes', 'comandos', 'hooks', 'planes']) expect(PIEZAS_SOLO_LOCAL.has(c)).toBe(true);
        expect(PIEZAS_SOLO_LOCAL.has('memoria')).toBe(false);
        expect(SUELTOS_SOLO_LOCAL.has('settings.json')).toBe(true);
        expect(SUELTOS_SOLO_LOCAL.has('.env.local')).toBe(false);
    });
    it('el script filtra las listas antes de usarlas', () => {
        expect(fuente).toMatch(/const PIEZAS = PIEZAS_TODAS\.filter\(\(\[clave\]\) => !PIEZAS_SOLO_LOCAL\.has\(clave\)\)/);
        expect(fuente).toMatch(/const SUELTOS = SUELTOS_TODOS\.filter\(\(\[, nombre\]\) => !SUELTOS_SOLO_LOCAL\.has\(nombre\)\)/);
    });
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
