// @vitest-environment node
/**
 * Pruebas de tools/claude-area/mails_solo (subir_mails.ps1 e instalar_mails_solo.ps1) ante la mudanza del 17/10/2026, cuando todo
 * lo del asistente paso a una sola carpeta de la biblioteca de Ingenieria, «ASISTENTE INGENIERIA».
 *
 * Estos programas corren en otras PC sin el repo: no pueden leer el canon (scripts/_lib/nubeCarpetas.data.json) y llevan los
 * nombres adentro, del lugar NUEVO al de ANTES. Cada PC toma la version nueva recien al reinstalar, asi que tienen que andar con
 * el lugar nuevo, con el de antes, y si estan los dos gana el nuevo (la misma regla de scripts/_lib/nubeRutas.mjs).
 *
 *   - instalar_mails_solo.ps1 no se puede correr entero en una prueba (copia a C:\ClaudeBarack y registra una tarea de Windows):
 *     se verifica que las listas que lleva adentro coincidan, en orden, con «nueva» + «viejas» del canon.
 *   - subir_mails.ps1 si se corre (con -Casa y un USERPROFILE de mentira): se mira donde deja la salud y que lista publicada toma.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOLO = path.join(RAIZ, 'tools', 'claude-area', 'mails_solo');
const PROGRAMA = path.join(RAIZ, 'tools', 'claude-area', 'mails_area.mjs');
const conPowerShell = process.platform === 'win32';
const POWERSHELL = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');

const temporales = [];
afterAll(() => { for (const d of temporales) fs.rmSync(d, { recursive: true, force: true }); });

const CANON = JSON.parse(fs.readFileSync(path.join(RAIZ, 'scripts', '_lib', 'nubeCarpetas.data.json'), 'utf8'));
/** [nueva, ...viejas] de esa clave del canon, cada una como la escribe un .ps1: tramos unidos con barra invertida. */
const delCanon = (clave) => { const e = CANON.carpetas.find((c) => c.clave === clave); return [e.nueva, ...e.viejas].map((t) => t.join('\\')); };
/** Las listas de textos entre comillas simples que lleva un .ps1: @('a', 'b', ...). */
const listasEmbebidas = (texto) => [...texto.matchAll(/@\(((?:\s*'[^']*'\s*,?)+)\)/g)].map((m) => [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]));
const archivos = (dir) => {
    const out = [];
    const anda = (d, rel) => { for (const e of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []) { const r = path.join(rel, e.name); if (e.isDirectory()) anda(path.join(d, e.name), r); else out.push(r); } };
    anda(dir, '');
    return out.sort();
};

describe('mails_solo: los nombres que llevan adentro coinciden con el canon', () => {
    for (const f of ['subir_mails.ps1', 'instalar_mails_solo.ps1']) {
        const texto = fs.readFileSync(path.join(SOLO, f), 'ascii');
        const listas = listasEmbebidas(texto);
        it(`${f}: la carpeta de mails (clave mails) va del lugar nuevo al de antes, en el orden del canon`, () => {
            expect(listas.filter((l) => l[0].startsWith('ASISTENTE INGENIERIA\\4- MAILS'))).toEqual([delCanon('mails')]);
        });
        it(`${f}: el paquete publicado del asistente por area (clave area_vieja) va del lugar nuevo al de antes, en el orden del canon`, () => {
            expect(listas.filter((l) => l[0].startsWith('ASISTENTE INGENIERIA\\9- VIEJO'))).toEqual([delCanon('area_vieja')]);
        });
        it(`${f}: no quedo ninguna lista del orden de antes (la vieja primero)`, () => {
            expect(texto).not.toMatch(/@\('Claude Barack', '_CUARENTENA_Claude Barack'\)/);
            expect(texto).not.toMatch(/@\('CLAUDE POR AREA', '_CUARENTENA_CLAUDE POR AREA'\)/);
        });
        it(`${f}: va solo en ASCII (PowerShell 5.1 lee mal un archivo sin marca con tildes)`, () => {
            expect([...fs.readFileSync(path.join(SOLO, f))].filter((b) => b > 126).length).toBe(0);
        });
        it.runIf(conPowerShell)(`${f}: con la sintaxis de PowerShell bien armada`, () => {
            const r = spawnSync(POWERSHELL, ['-NoProfile', '-Command', `$e=$null;$t=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('${path.join(SOLO, f)}',[ref]$t,[ref]$e);if($e){$e|ForEach-Object{$_.Message};exit 1}`], { encoding: 'utf8' });
            expect(r.stdout.trim()).toBe('');
            expect(r.status).toBe(0);
        }, 90000);
    }
});

describe('subir_mails.ps1: de punta a punta con la biblioteca de mentira (lugar de antes, lugar nuevo y los dos a la vez)', () => {
    const MARCA = { vieja: 'lista del lugar viejo', nueva: 'lista del lugar nuevo' };
    /**
     * La PC de mentira: el USERPROFILE con la biblioteca, la casa con el programa instalado y la carpeta del .ps1 (que escribe su
     * log al lado: una copia, nunca el del repo). Las listas publicadas dicen otra PC, asi que esta PC "se apaga" y toma la lista.
     */
    function armar(layout) {
        const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mails-solo-'));
        temporales.push(t);
        const bib = path.join(t, 'BARACK ARGENTINA SRL', 'Ingeniería y Proyecto - General');
        const lugares = {
            vieja: { mails: path.join(bib, '_CUARENTENA_Claude Barack', 'mails'), area: path.join(bib, '_CUARENTENA_CLAUDE POR AREA') },
            nueva: { mails: path.join(bib, 'ASISTENTE INGENIERIA', '4- MAILS DEL EQUIPO', 'mails'), area: path.join(bib, 'ASISTENTE INGENIERIA', '9- VIEJO (no usar)', '_CUARENTENA_CLAUDE POR AREA') },
        };
        for (const cual of layout === 'ambas' ? ['vieja', 'nueva'] : [layout]) {
            fs.mkdirSync(path.join(lugares[cual].mails, '_entrada'), { recursive: true });
            const comun = path.join(lugares[cual].area, '1- PUBLICADO', 'contenido', 'conocimiento', 'comun');
            fs.mkdirSync(comun, { recursive: true });
            fs.writeFileSync(path.join(comun, 'personas.json'), JSON.stringify({ personas: [{ pc: 'OTRA-PC-DE-MENTIRA', mails: 'sube', baja: null, marca: MARCA[cual] }] }), 'utf8');
        }
        const casa = path.join(t, 'casa');
        fs.mkdirSync(path.join(casa, 'publicado', 'programas'), { recursive: true });
        fs.mkdirSync(path.join(casa, 'publicado', 'conocimiento', 'comun'), { recursive: true });
        fs.copyFileSync(PROGRAMA, path.join(casa, 'publicado', 'programas', 'mails_area.mjs'));
        const estado = path.join(t, 'estado');
        fs.mkdirSync(estado, { recursive: true });
        fs.copyFileSync(path.join(SOLO, 'subir_mails.ps1'), path.join(estado, 'subir_mails.ps1'));
        return { t, casa, estado, lugares, comunLocal: path.join(casa, 'publicado', 'conocimiento', 'comun') };
    }
    const correr = (p) => spawnSync(POWERSHELL, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(p.estado, 'subir_mails.ps1'), '-Casa', p.casa], {
        encoding: 'utf8', timeout: 120000,
        env: { ...process.env, USERPROFILE: p.t, LOCALAPPDATA: path.join(p.t, 'local'), PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH}` },
    });
    const saludEn = (mails) => JSON.parse(fs.readFileSync(path.join(mails, '_salud', `${process.env.COMPUTERNAME}.json`), 'utf8'));

    for (const layout of ['vieja', 'nueva', 'ambas']) {
        it.runIf(conPowerShell)(`layout «${layout}»: ${layout === 'vieja' ? 'sigue con el lugar de antes' : 'usa el lugar nuevo (y si estan los dos, solo ese)'}`, () => {
            const p = armar(layout);
            const r = correr(p);
            expect(r.status, r.stdout + r.stderr).toBe(0);
            const cual = layout === 'vieja' ? 'vieja' : 'nueva';
            // la salud queda en la carpeta de mails del lugar que corresponde, y el programa corrio (apagado: la lista publicada dice otra PC)
            expect(saludEn(p.lugares[cual].mails).resultado).toMatchObject({ resultado: 'apagado' });
            // la lista de personas publicada que tomo es la del paquete del lugar que corresponde
            expect(JSON.parse(fs.readFileSync(path.join(p.comunLocal, 'personas.json'), 'utf8')).personas[0].marca).toBe(MARCA[cual]);
            expect(fs.readFileSync(path.join(p.estado, 'mails.log'), 'utf8')).toMatch(/tomada/);
            // en «ambas» la carpeta de antes queda como estaba: sin salud
            if (layout === 'ambas') expect(archivos(p.lugares.vieja.mails)).toEqual([]);
        }, 180000);
    }

    it.runIf(conPowerShell)('sin ninguna carpeta de mails no inventa una: avisa en el log y no escribe nada en la biblioteca', () => {
        const p = armar('nueva');
        fs.rmSync(p.lugares.nueva.mails, { recursive: true, force: true });
        const antes = archivos(path.join(p.t, 'BARACK ARGENTINA SRL'));
        const r = correr(p);
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(fs.readFileSync(path.join(p.estado, 'mails.log'), 'utf8')).toMatch(/sin nube/);
        expect(archivos(path.join(p.t, 'BARACK ARGENTINA SRL'))).toEqual(antes);
    }, 180000);
});
