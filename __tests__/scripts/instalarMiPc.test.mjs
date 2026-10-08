// @vitest-environment node
/**
 * Pruebas de tools/instalar_mi_pc: el instalador de "mi asistente completo" para una PC nueva (08/10/2026, notebook de Calidad).
 * Las dos direcciones: lo que tiene que cambiar del settings.json de la otra PC cambia (rutas de usuario, env.PATH, asistente
 * por area apagado) y lo que no, queda igual; y el instalador es ASCII, de PowerShell 5.1, y en ensayo no escribe nada.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ajustarSettings, PLUGIN_POR_AREA } from '../../tools/instalar_mi_pc/ajustar_settings.mjs';
import { plan, CARPETA } from '../../tools/instalar_mi_pc/publicar.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = path.join(RAIZ, 'tools', 'instalar_mi_pc');
const temporales = [];
afterAll(() => { for (const d of temporales) fs.rmSync(d, { recursive: true, force: true }); });

const ORIGEN = {
    env: { PATH: 'C:\\Windows;C:\\Users\\FacundoS-PC\\.cargo\\bin', CLAUDE_CODE_AUTO_COMPACT_WINDOW: '1000000' },
    hooks: { PreToolUse: [{ matcher: 'Agent', hooks: [{ type: 'command', command: 'bash "C:/Users/FacundoS-PC/.claude/hooks/agentes-guard.sh"' }] }] },
    statusLine: { type: 'command', command: 'C:\\Users\\FacundoS-PC\\.claude\\statusline.cmd' },
    enabledPlugins: { [PLUGIN_POR_AREA]: true, 'otro@mk': true },
    extraKnownMarketplaces: { barack: { source: { source: 'directory', path: 'C:\\ClaudeBarack\\x' } }, otro: { source: 'x' } },
    permissions: { defaultMode: 'plan', deny: ['Read(./.env)'] },
};

describe('ajustar_settings: el settings.json de la otra PC, listo para esta', () => {
    const ajustar = (o = ORIGEN, home = 'C:\\Users\\Cata') => { const r = ajustarSettings(JSON.stringify(o), { home }); return { ...r, j: JSON.parse(r.texto) }; };
    it('las rutas de usuario de la otra PC pasan a la carpeta de usuario de esta, con el mismo tipo de barra', () => {
        const { j } = ajustar();
        expect(j.hooks.PreToolUse[0].hooks[0].command).toBe('bash "C:/Users/Cata/.claude/hooks/agentes-guard.sh"');
        expect(j.statusLine.command).toBe('C:\\Users\\Cata\\.claude\\statusline.cmd');
    });
    it('env.PATH sale (es de la otra PC) y el resto de env queda', () => {
        const { j } = ajustar();
        expect(j.env).toEqual({ CLAUDE_CODE_AUTO_COMPACT_WINDOW: '1000000' });
    });
    it('el asistente por area queda apagado, su marketplace sale y lo demas no se toca', () => {
        const { j, cambios } = ajustar();
        expect(j.enabledPlugins).toEqual({ [PLUGIN_POR_AREA]: false, 'otro@mk': true });
        expect(j.extraKnownMarketplaces).toEqual({ otro: { source: 'x' } });
        expect(j.permissions).toEqual(ORIGEN.permissions);
        expect(cambios.join(' | ')).toMatch(/asistente por area apagado/);
    });
    it('en la misma PC (mismo usuario) no cambia ninguna ruta', () => {
        const { texto, cambios } = ajustar(ORIGEN, 'C:\\Users\\FacundoS-PC');
        expect(cambios.join(' ')).not.toMatch(/ruta/);
        expect(texto).toContain('C:/Users/FacundoS-PC/.claude/hooks/agentes-guard.sh');
    });
    it('un settings sin nada de eso sale igual (y sin inventar claves)', () => {
        const { j, cambios } = ajustar({ model: 'opus' });
        expect(j).toEqual({ model: 'opus' });
        expect(cambios).toEqual([]);
    });
    it('lo que no es un objeto JSON se rechaza', () => {
        for (const x of ['[]', '5', 'null', '{ roto', '']) expect(() => ajustarSettings(x, { home: 'C:\\Users\\Cata' })).toThrow();
    });
    it('un archivo con ceros adentro (copia a medio bajar) se rechaza y no escribe nada', () => {
        const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-pc-'));
        temporales.push(t);
        const origen = path.join(t, 'origen.json');
        const destino = path.join(t, 'destino.json');
        fs.writeFileSync(origen, Buffer.alloc(64));
        fs.writeFileSync(destino, '{"viejo":true}', 'utf8');
        const r = spawnSync(process.execPath, [path.join(DIR, 'ajustar_settings.mjs'), '--origen', origen, '--destino', destino, '--home', 'C:\\Users\\Cata'], { encoding: 'utf8' });
        expect(r.status).toBe(1);
        expect(JSON.parse(r.stdout).resultado).toBe('error');
        expect(fs.readFileSync(destino, 'utf8')).toBe('{"viejo":true}');
    });
    it('como programa: guarda una copia de lo que habia (una sola vez), escribe el nuevo y --ensayo no escribe', () => {
        const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-pc-'));
        temporales.push(t);
        const origen = path.join(t, 'origen.json');
        const destino = path.join(t, '.claude', 'settings.json');
        fs.mkdirSync(path.dirname(destino), { recursive: true });
        fs.writeFileSync(origen, JSON.stringify(ORIGEN), 'utf8');
        fs.writeFileSync(destino, '{"del_instalador_por_area":true}', 'utf8');
        const correr = (extra = []) => JSON.parse(spawnSync(process.execPath, [path.join(DIR, 'ajustar_settings.mjs'), '--origen', origen, '--destino', destino, '--home', 'C:\\Users\\Cata', ...extra], { encoding: 'utf8' }).stdout);
        expect(correr(['--ensayo']).resultado).toBe('ensayo');
        expect(fs.readFileSync(destino, 'utf8')).toBe('{"del_instalador_por_area":true}');
        const r1 = correr();
        expect(r1.resultado).toBe('ok');
        expect(JSON.parse(fs.readFileSync(destino, 'utf8')).enabledPlugins[PLUGIN_POR_AREA]).toBe(false);
        expect(fs.readFileSync(`${destino}.antes-del-instalador`, 'utf8')).toBe('{"del_instalador_por_area":true}');
        correr();      // la copia del principio no se pisa con la segunda
        expect(fs.readFileSync(`${destino}.antes-del-instalador`, 'utf8')).toBe('{"del_instalador_por_area":true}');
    });
});

describe('instalar_mi_pc.ps1', () => {
    const ps1 = fs.readFileSync(path.join(DIR, 'instalar_mi_pc.ps1'));
    const conPowerShell = process.platform === 'win32';
    it('va solo en ASCII (PowerShell 5.1)', () => { for (const f of ['instalar_mi_pc.ps1', 'Instalar-Mi-PC.cmd']) expect([...fs.readFileSync(path.join(DIR, f))].filter((b) => b > 126).length).toBe(0); });
    it('no manda nada afuera salvo bajar el repo de GitHub, ni toca la nube personal, ni borra', () => {
        const texto = ps1.toString('ascii');
        expect(texto).not.toMatch(/OneDrive - BARACK/i);
        expect(texto).not.toMatch(/Remove-Item|\.Send\s*\(|Invoke-RestMethod|Net\.WebClient/i);
        expect([...texto.matchAll(/https?:\/\/[^\s'")]+/g)].map((m) => m[0]).filter((u) => !/github\.com\/facussc24\/tiempos-y-balanceos/.test(u))).toEqual([]);
    });
    it('el ensayo y la sintaxis estan previstos (-Ensayo, sin sintaxis de PowerShell 7)', () => {
        const texto = ps1.toString('ascii');
        expect(texto).toMatch(/\[switch\]\$Ensayo/);
        expect(texto).not.toMatch(/\?\?|\?\.|&&|\|\|/);
    });
    it.runIf(conPowerShell)('con la sintaxis de PowerShell bien armada', () => {
        const r = spawnSync('powershell.exe', ['-NoProfile', '-Command', `$e=$null;$t=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('${path.join(DIR, 'instalar_mi_pc.ps1')}',[ref]$t,[ref]$e);if($e){$e|ForEach-Object{$_.Message};exit 1}`], { encoding: 'utf8' });
        expect(r.stdout.trim()).toBe('');
        expect(r.status).toBe(0);
    }, 90000);
    it.runIf(conPowerShell)('con una biblioteca sin la memoria de Fak dice por que no puede y sale con 1, sin escribir nada', () => {
        const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-pc-'));
        temporales.push(t);
        const bib = path.join(t, 'Ingeniería y Proyecto - General');
        fs.mkdirSync(path.join(bib, 'otra'), { recursive: true });
        const repo = path.join(t, 'repo');
        const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(DIR, 'instalar_mi_pc.ps1'), '-Ensayo', '-Biblioteca', bib, '-Repo', repo], { encoding: 'utf8' });
        expect(r.status).toBe(1);
        expect(r.stdout).toMatch(/NO SE PUDO/);
        expect(r.stdout).toMatch(/tu memoria y tu configuracion/);
        expect(fs.existsSync(repo)).toBe(false);
    }, 120000);
});

describe('publicar: una sola carpeta en la nube, sin la palabra del asistente en los nombres', () => {
    it('los destinos cuelgan de «INSTALAR EN UNA PC NUEVA» y ningun nombre dice Claude', () => {
        const p = plan(path.join(os.tmpdir(), 'bib-que-no-existe'));
        expect(p.length).toBeGreaterThan(3);
        for (const x of p) {
            expect(x.destino).toContain(CARPETA);
            expect(path.relative(path.join(os.tmpdir(), 'bib-que-no-existe'), x.destino)).not.toMatch(/claude/i);
            expect(fs.existsSync(x.origen)).toBe(true);
        }
    });
});
