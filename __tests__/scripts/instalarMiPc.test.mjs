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
import { ajustarSettings, ajustarSettingsLocal, asegurarHooksGlobales, usuariosAjenos, HOOKS_GLOBALES, PLUGIN_POR_AREA } from '../../tools/instalar_mi_pc/ajustar_settings.mjs';
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
    // `existe` = los .sh de los hooks globales ya estan en la PC (los trae _nube.mjs --bajar antes de ajustar el settings).
    const TODOS = () => true;
    const ajustar = (o = ORIGEN, home = 'C:\\Users\\Cata', existe = TODOS) => { const r = ajustarSettings(JSON.stringify(o), { home, existe }); return { ...r, j: JSON.parse(r.texto) }; };
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
    it('un settings sin nada de eso sale igual, salvo los hooks globales de la casa, que se cablean (y ninguna otra clave inventada)', () => {
        const { j, cambios } = ajustar({ model: 'opus' });
        expect(j.model).toBe('opus');
        expect(Object.keys(j).sort()).toEqual(['hooks', 'model']);
        expect(cambios).toEqual([`${HOOKS_GLOBALES.length} hook(s) globales cableados: agentes-guard.sh, carpeta-guard.sh inicio, carpeta-guard.sh prompt, pedidos-pendientes.sh`]);
    });
    it('los hooks globales (tanda 1.7, 16/10/2026): se cablean los que faltan con la carpeta de usuario de ESTA PC; el que ya esta no se duplica', () => {
        const { j, cambios } = ajustar();        // ORIGEN ya trae agentes-guard de la otra PC
        expect(j.hooks.PreToolUse).toHaveLength(1);
        expect(j.hooks.PreToolUse[0].hooks[0].command).toBe('bash "C:/Users/Cata/.claude/hooks/agentes-guard.sh"');
        expect(j.hooks.SessionStart.map((g) => g.hooks[0].command)).toEqual([
            'bash "C:/Users/Cata/.claude/hooks/carpeta-guard.sh" inicio',
            'bash "C:/Users/Cata/.claude/hooks/pedidos-pendientes.sh"',
        ]);
        expect(j.hooks.SessionStart[0].matcher).toBe('startup|resume|clear|compact');
        expect(j.hooks.UserPromptSubmit).toEqual([{ matcher: '', hooks: [{ type: 'command', command: 'bash "C:/Users/Cata/.claude/hooks/carpeta-guard.sh" prompt' }] }]);
        expect(cambios.join(' | ')).toMatch(/3 hook\(s\) globales cableados: carpeta-guard\.sh inicio, carpeta-guard\.sh prompt, pedidos-pendientes\.sh/);
        // segunda pasada sobre lo ya ajustado: nada que agregar
        const otra = JSON.parse(ajustarSettings(JSON.stringify(j), { home: 'C:\\Users\\Cata', existe: TODOS }).texto);
        expect(otra.hooks).toEqual(j.hooks);
        expect(asegurarHooksGlobales(otra, 'C:\\Users\\Cata', { existe: TODOS })).toEqual([]);
    });
    it('H2: un hook cuyo .sh no esta en esta PC NO se cablea (bash saldria con 127 en cada mensaje) y se dice cual', () => {
        const soloAgentes = (ruta) => /agentes-guard\.sh$/.test(ruta);
        const { j, cambios } = ajustar({ model: 'opus' }, 'C:\\Users\\Cata', soloAgentes);
        expect(Object.keys(j.hooks)).toEqual(['PreToolUse']);
        expect(cambios.join(' | ')).toMatch(/1 hook\(s\) globales cableados: agentes-guard\.sh/);
        expect(cambios.join(' | ')).toMatch(/3 hook\(s\) globales sin cablear porque su \.sh no esta en esta PC: carpeta-guard\.sh inicio, carpeta-guard\.sh prompt, pedidos-pendientes\.sh/);
        // con el .sh ya en disco, la siguiente pasada los cablea
        const despues = ajustar(j, 'C:\\Users\\Cata', TODOS);
        expect(despues.j.hooks.SessionStart).toHaveLength(2);
    });
    it('H12: un hook ya cableado con otra forma (sin comillas, comillas simples, barras invertidas, mayusculas) no se duplica', () => {
        const formas = [
            "bash 'C:/Users/Cata/.claude/hooks/carpeta-guard.sh' inicio",
            'bash C:/Users/Cata/.claude/hooks/carpeta-guard.sh inicio',
            'bash "C:\\Users\\Cata\\.claude\\hooks\\carpeta-guard.sh" inicio',
            'bash "C:/Users/CATA/.claude/hooks/CARPETA-GUARD.sh" inicio ',
        ];
        for (const command of formas) {
            const s = { hooks: { SessionStart: [{ matcher: 'startup', hooks: [{ type: 'command', command }] }] } };
            const agregados = asegurarHooksGlobales(s, 'C:\\Users\\Cata', { existe: TODOS });
            expect(agregados, command).not.toContain('carpeta-guard.sh inicio');
            expect(s.hooks.SessionStart.filter((g) => /carpeta-guard/i.test(g.hooks[0].command)), command).toHaveLength(1);
        }
    });
    it('ajustarSettingsLocal (lo que corre _nube.mjs --bajar): en la misma PC solo cablea los hooks que faltan y el PATH queda; con dryRun no escribe', () => {
        const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-pc-'));
        temporales.push(t);
        const ruta = path.join(t, 'settings.json');
        const mio = { env: { PATH: 'C:\\Windows;C:\\Users\\FacundoS-PC\\.cargo\\bin' }, hooks: { PreToolUse: [{ matcher: 'Agent', hooks: [{ type: 'command', command: 'bash "C:/Users/FacundoS-PC/.claude/hooks/agentes-guard.sh"' }] }] } };
        fs.writeFileSync(ruta, JSON.stringify(mio, null, 2), 'utf8');
        const seco = ajustarSettingsLocal(ruta, { home: 'C:\\Users\\FacundoS-PC', dryRun: true, existe: TODOS });
        expect(seco.dryRun).toBe(true);
        expect(seco.cambios).toHaveLength(1);
        expect(JSON.parse(fs.readFileSync(ruta, 'utf8'))).toEqual(mio);          // no escribio
        const real = ajustarSettingsLocal(ruta, { home: 'C:\\Users\\FacundoS-PC', existe: TODOS });
        const j = JSON.parse(fs.readFileSync(ruta, 'utf8'));
        expect(real.cambios.join(' ')).toMatch(/3 hook\(s\) globales cableados/);
        expect(j.env.PATH).toBe(mio.env.PATH);                                     // misma PC: el PATH queda
        expect(j.hooks.SessionStart).toHaveLength(2);
        expect(j.hooks.UserPromptSubmit).toHaveLength(1);
        expect(ajustarSettingsLocal(ruta, { home: 'C:\\Users\\FacundoS-PC', existe: TODOS }).cambios).toEqual([]);   // ya esta: no toca
        expect(fs.readdirSync(t)).toEqual(['settings.json']);                      // sin archivos aparte olvidados
    });
    it('H3: «es de otra PC» se decide sobre los VALORES: una ruta con barra invertida de otro usuario cuenta; Public y un nombre corto 8.3 no', () => {
        const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-pc-'));
        temporales.push(t);
        const ruta = path.join(t, 'settings.json');
        // misma PC, pero con una ruta a Public y a la forma corta de SU carpeta: NO es de otra PC -> el PATH queda
        fs.writeFileSync(ruta, JSON.stringify({ env: { PATH: 'C:\\Users\\Public\\bin;C:\\Users\\FACUND~1\\x' }, statusLine: { command: 'C:/Users/FacundoS-PC/.claude/s.cmd' } }), 'utf8');
        ajustarSettingsLocal(ruta, { home: 'C:\\Users\\FacundoS-PC', existe: TODOS });
        expect(JSON.parse(fs.readFileSync(ruta, 'utf8')).env.PATH).toBe('C:\\Users\\Public\\bin;C:\\Users\\FACUND~1\\x');
        // otra PC, con la ruta ajena SOLO con barras invertidas: si se detecta -> se ajusta entero (PATH afuera, ruta cambiada)
        fs.writeFileSync(ruta, JSON.stringify({ env: { PATH: 'C:\\Windows' }, statusLine: { command: 'C:\\Users\\FacundoS-PC\\.claude\\s.cmd' } }), 'utf8');
        const r = ajustarSettingsLocal(ruta, { home: 'C:\\Users\\Cata', existe: TODOS });
        const j = JSON.parse(fs.readFileSync(ruta, 'utf8'));
        expect(r.cambios.join(' | ')).toMatch(/ruta\(s\) de la otra PC/);
        expect(j.env.PATH).toBeUndefined();
        expect(j.statusLine.command).toBe('C:\\Users\\Cata\\.claude\\s.cmd');
        expect(usuariosAjenos({ a: 'C:\\Users\\Otro\\x', b: 'C:/Users/Public/y', c: 'C:\\Users\\FACUND~1\\z' }, 'C:\\Users\\FacundoS-PC')).toEqual(['Otro']);
    });
    it('ajustarSettingsLocal con el settings de OTRA PC: se ajusta entero (rutas, PATH afuera, hooks con la carpeta de esta)', () => {
        const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-pc-'));
        temporales.push(t);
        const ruta = path.join(t, 'settings.json');
        fs.writeFileSync(ruta, JSON.stringify(ORIGEN), 'utf8');
        const r = ajustarSettingsLocal(ruta, { home: 'C:\\Users\\Cata', existe: TODOS });
        const j = JSON.parse(fs.readFileSync(ruta, 'utf8'));
        expect(r.cambios.join(' | ')).toMatch(/ruta\(s\) de la otra PC/);
        expect(j.env.PATH).toBeUndefined();
        expect(j.hooks.SessionStart[1].hooks[0].command).toBe('bash "C:/Users/Cata/.claude/hooks/pedidos-pendientes.sh"');
        expect(fs.readdirSync(t)).toEqual(['settings.json']);
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

    // Mudanza del 17/10/2026 (todo lo del asistente en «ASISTENTE INGENIERIA»): el Node del paquete publicado del asistente por area
    // (clave area_vieja del canon scripts/_lib/nubeCarpetas.data.json) se busca primero en el lugar nuevo y, si no esta, en las carpetas
    // de primer nivel de antes. Este instalador corre en otra PC sin el repo y lleva el nombre adentro.
    it('el lugar nuevo del paquete publicado que lleva adentro es el del canon (clave area_vieja)', () => {
        const canon = JSON.parse(fs.readFileSync(path.join(RAIZ, 'scripts', '_lib', 'nubeCarpetas.data.json'), 'utf8'));
        const nueva = canon.carpetas.find((c) => c.clave === 'area_vieja').nueva.join('\\');
        expect(ps1.toString('ascii')).toContain(`Join-Path $bib '${nueva}'`);
    });
    const NODE_DEL_PAQUETE = ['1- PUBLICADO', 'contenido', 'marketplace', 'plugins', 'barack-area', 'bin', 'node.exe'];
    const LUGARES_DEL_PAQUETE = {
        vieja: ['CLAUDE POR AREA'],
        nueva: ['ASISTENTE INGENIERIA', '9- VIEJO (no usar)', '_CUARENTENA_CLAUDE POR AREA'],
    };
    for (const layout of ['vieja', 'nueva', 'ambas']) {
        it.runIf(conPowerShell)(`el Node de la nube sale ${layout === 'vieja' ? 'del lugar de antes' : 'del lugar nuevo (y si estan los dos, de ese)'} (layout «${layout}», en ensayo)`, () => {
            const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-pc-'));
            temporales.push(t);
            const bib = path.join(t, 'biblioteca');      // (sin tilde: la consola de PowerShell escribe la salida en otra codificacion y no se podria comparar la ruta)
            // la memoria y la configuracion de Fak, como estaban (primer nivel): este caso mira solo el Node
            for (const c of ['claude-memoria', 'claude-config']) fs.mkdirSync(path.join(bib, 'Claude Fak', c), { recursive: true });
            const nodes = {};
            for (const cual of layout === 'ambas' ? ['vieja', 'nueva'] : [layout]) {
                nodes[cual] = path.join(bib, ...LUGARES_DEL_PAQUETE[cual], ...NODE_DEL_PAQUETE);
                fs.mkdirSync(path.dirname(nodes[cual]), { recursive: true });
                fs.writeFileSync(nodes[cual], 'no es un node de verdad: en ensayo no se ejecuta', 'utf8');
            }
            // una PC donde no hay Node en el PATH ni instalado por otros programas (si no, el instalador ni mira la nube)
            const env = { ...process.env, PATH: [path.join(process.env.SystemRoot || 'C:\\Windows', 'System32'), process.env.SystemRoot || 'C:\\Windows', path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0')].join(path.delimiter), LOCALAPPDATA: path.join(t, 'local'), USERPROFILE: t };
            const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
            const r = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(DIR, 'instalar_mi_pc.ps1'), '-Ensayo', '-Biblioteca', bib, '-Repo', path.join(t, 'repo')], { encoding: 'utf8', env, timeout: 120000 });
            expect(r.status, r.stdout + r.stderr).toBe(0);
            // (la ruta puede venir en su forma corta 8.3 o larga segun como la arme PowerShell: se comparan resueltas)
            const dichos = [...r.stdout.matchAll(/^\s*OK\s+Node: (.+)$/gm)].map((m) => fs.realpathSync.native(m[1].trim()).toLowerCase());
            expect(dichos).toEqual([fs.realpathSync.native(nodes[layout === 'vieja' ? 'vieja' : 'nueva']).toLowerCase()]);
            expect(r.stdout).toMatch(/\[ensayo\] haria: copiar Node de la nube/);
            expect(fs.existsSync(path.join(t, 'repo'))).toBe(false);
            expect(fs.existsSync(path.join(t, 'local', 'MiAsistente'))).toBe(false);      // el ensayo no copia el Node: solo dice que lo haria
        }, 180000);
    }
    // La memoria y la configuracion de Fak (clave «facundo» del canon): antes del 17/10/2026 en la raiz de la biblioteca,
    // despues en la carpeta unica. El instalador de una PC nueva las tiene que encontrar en los dos lugares.
    const LUGARES_DE_LA_MEMORIA = {
        vieja: ['Claude Fak'],
        nueva: ['ASISTENTE INGENIERIA', '5- FACUNDO (memoria y configuracion)'],
    };
    for (const layout of ['vieja', 'nueva', 'ambas']) {
        it.runIf(conPowerShell)(`la memoria sale ${layout === 'vieja' ? 'del lugar de antes' : 'del lugar nuevo (y si estan los dos, de ese)'} (layout «${layout}», en ensayo)`, () => {
            const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-pc-mem-'));
            temporales.push(t);
            const bib = path.join(t, 'biblioteca');
            for (const cual of layout === 'ambas' ? ['vieja', 'nueva'] : [layout]) {
                for (const c of ['claude-memoria', 'claude-config']) fs.mkdirSync(path.join(bib, ...LUGARES_DE_LA_MEMORIA[cual], c), { recursive: true });
            }
            const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
            const r = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(DIR, 'instalar_mi_pc.ps1'), '-Ensayo', '-Biblioteca', bib, '-Repo', path.join(t, 'repo')], { encoding: 'utf8', env: { ...process.env, LOCALAPPDATA: path.join(t, 'local'), USERPROFILE: t }, timeout: 120000 });
            expect(r.status, r.stdout + r.stderr).toBe(0);
            const dicha = (r.stdout.match(/tu memoria y tu configuracion: (.+)$/m) || [])[1];
            expect(dicha && fs.realpathSync.native(dicha.trim()).toLowerCase()).toBe(fs.realpathSync.native(path.join(bib, ...LUGARES_DE_LA_MEMORIA[layout === 'vieja' ? 'vieja' : 'nueva'])).toLowerCase());
        }, 180000);
    }
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
