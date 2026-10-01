// @vitest-environment node
/**
 * Pruebas de las tres piezas de "un Claude por area" que le dan al administrador la vista de
 * las PC (tools/claude-area/):
 *   - tablero.mjs            semaforo de cada PC + avisos agrupados (TABLERO.md y la linea del hook)
 *   - inventario_resumen.mjs INVENTARIO.md con los programas de todas las PC
 *   - inventario.ps1         la lista de programas de UNA PC, corrida de verdad en esta
 *
 * Todo corre contra carpetas temporales: nada toca la nube real ni C:\ClaudeBarack.
 * Las dos direcciones: el caso bueno pasa y el malo (borde justo, firma mal, JSON roto, parametros
 * que faltan, ruta imposible) se frena o se reporta sin tumbar el resto.
 *
 * El test de PowerShell solo se saltea donde no hay powershell.exe (CI en Linux); en Windows corre.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clasificarPc, lineaResumen, armarTablero, agruparAvisos } from '../../tools/claude-area/tablero.mjs';
import { leerInventarios, leerConocidos, armarInforme, contarProgramas } from '../../tools/claude-area/inventario_resumen.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const AREA = path.join(RAIZ, 'tools', 'claude-area');
const TABLERO = path.join(AREA, 'tablero.mjs');
const RESUMEN = path.join(AREA, 'inventario_resumen.mjs');
const PS1 = path.join(AREA, 'inventario.ps1');

const MS_DIA = 86400000;
const AHORA = new Date(2026, 9, 1, 8, 0, 0); // 01/10/2026 08:00, hora local

const temporales = [];
function carpetaTemporal(prefijo = 'claude-area-') {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), prefijo));
    temporales.push(d);
    return d;
}
afterAll(() => {
    for (const d of temporales) fs.rmSync(d, { recursive: true, force: true });
});

const iso = (d) => d.toISOString();
const haceDias = (n) => iso(new Date(AHORA.getTime() - n * MS_DIA));

/** Una salud.json sana; cada prueba pisa lo que quiere romper. */
function salud(pc, cambios = {}) {
    return {
        pc, usuario_windows: `usuario-${pc}`, area: 'compras',
        version_instalada: 6, version_publicada_vista: 6,
        ultima_sync_ok: haceDias(0.1), firma_ok: true, politica: 'si',
        outlook: 'clasico', python: true, ve_Y: true, ve_Z: true, disco_libre_gb: 80,
        errores: [], escrito: haceDias(0.1),
        ...cambios,
    };
}
const ctx = { ahora: AHORA, versionReferencia: 6 };

/** Arma un 4- BUZON de mentira con las salud y los avisos dados. */
function armarBuzon({ saludes = {}, crudos = {}, avisos = {} } = {}) {
    const buzon = carpetaTemporal('buzon-');
    fs.mkdirSync(path.join(buzon, 'salud'), { recursive: true });
    for (const [pc, s] of Object.entries(saludes)) fs.writeFileSync(path.join(buzon, 'salud', `${pc}.json`), JSON.stringify(s));
    for (const [nombre, texto] of Object.entries(crudos)) fs.writeFileSync(path.join(buzon, 'salud', nombre), texto);
    for (const [pc, archivos] of Object.entries(avisos)) {
        fs.mkdirSync(path.join(buzon, 'avisos', pc), { recursive: true });
        for (const [nombre, contenido] of Object.entries(archivos)) {
            fs.writeFileSync(path.join(buzon, 'avisos', pc, nombre), typeof contenido === 'string' ? contenido : JSON.stringify(contenido));
        }
    }
    return buzon;
}

function correr(script, args, extra = {}) {
    const env = { ...process.env, ...extra.env };
    if (extra.sinNube) delete env.CLAUDE_AREA_NUBE;
    return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env, cwd: extra.cwd });
}

// =============================================================================================
describe('tablero: semaforo de una PC', () => {
    it.each([
        [0.1, 'VERDE'],
        [1.9, 'VERDE'],
        [2.0, 'AMARILLO'],   // "menos de 2 dias" es estricto
        [2.1, 'AMARILLO'],
        [6.9, 'AMARILLO'],
        [7.0, 'AMARILLO'],   // "mas de 7 dias" es estricto
        [7.1, 'ROJO'],
        [30, 'ROJO'],
    ])('sincronizo hace %s dias -> %s', (dias, esperado) => {
        const r = clasificarPc(salud('compras-01', { ultima_sync_ok: haceDias(dias) }), ctx);
        expect(r.estado).toBe(esperado);
        expect(r.dias).toBeCloseTo(dias, 5);
    });

    it('una PC sana, al dia y con politica es VERDE y no tiene motivos', () => {
        const r = clasificarPc(salud('compras-01'), ctx);
        expect(r.estado).toBe('VERDE');
        expect(r.motivos).toEqual([]);
    });

    it('la firma mal es ROJO aunque haya sincronizado hace una hora', () => {
        const r = clasificarPc(salud('compras-01', { firma_ok: false, ultima_sync_ok: haceDias(0.04) }), ctx);
        expect(r.estado).toBe('ROJO');
        expect(r.motivos[0].texto).toMatch(/firma/);
    });

    it('si no informa la firma no puede ser VERDE', () => {
        const s = salud('compras-01');
        delete s.firma_ok;
        expect(clasificarPc(s, ctx).estado).toBe('AMARILLO');
    });

    it('con errores es ROJO y dice el primero', () => {
        const r = clasificarPc(salud('compras-01', { errores: ['no pude copiar skills/x', 'otro'] }), ctx);
        expect(r.estado).toBe('ROJO');
        expect(r.motivos.map((m) => m.texto).join(' ')).toContain('2 errores: no pude copiar skills/x');
    });

    it('errores como objetos tambien se muestran', () => {
        const r = clasificarPc(salud('compras-01', { errores: [{ cuando: haceDias(1), mensaje: 'disco lleno' }] }), ctx);
        expect(r.estado).toBe('ROJO');
        expect(r.motivos[0].texto).toContain('disco lleno');
    });

    it('atrasada (version instalada menor que la publicada) es AMARILLO', () => {
        const r = clasificarPc(salud('compras-01', { version_instalada: 5, version_publicada_vista: 6 }), ctx);
        expect(r.estado).toBe('AMARILLO');
        expect(r.motivos[0].texto).toContain('tiene la versión 5 y ya hay la 6');
    });

    it('la version publicada que vio OTRA PC tambien cuenta', () => {
        const r = clasificarPc(salud('compras-01', { version_instalada: 5, version_publicada_vista: 5 }), { ahora: AHORA, versionReferencia: 6 });
        expect(r.estado).toBe('AMARILLO');
    });

    it('tener una version mas nueva que la que vio publicada no es estar atrasada', () => {
        const r = clasificarPc(salud('compras-01', { version_instalada: 7, version_publicada_vista: 6 }), ctx);
        expect(r.estado).toBe('VERDE');
    });

    it('sin politica (modo basico) es AMARILLO', () => {
        expect(clasificarPc(salud('compras-01', { politica: 'no' }), ctx).estado).toBe('AMARILLO');
    });

    it('sin ninguna version instalada es AMARILLO', () => {
        expect(clasificarPc(salud('compras-01', { version_instalada: 0 }), ctx).estado).toBe('AMARILLO');
    });

    it('nunca sincronizo, o la fecha no se entiende, es ROJO', () => {
        expect(clasificarPc(salud('compras-01', { ultima_sync_ok: null }), ctx).estado).toBe('ROJO');
        expect(clasificarPc(salud('compras-01', { ultima_sync_ok: 'ayer a la tarde' }), ctx).estado).toBe('ROJO');
    });

    it('cuando cae en dos colores gana el peor', () => {
        const r = clasificarPc(salud('compras-01', { politica: 'no', firma_ok: false, ultima_sync_ok: haceDias(3) }), ctx);
        expect(r.estado).toBe('ROJO');
        expect(r.motivos[0].nivel).toBe('ROJO');
        expect(r.motivos.some((m) => m.nivel === 'AMARILLO')).toBe(true);
    });

    it('entiende la fecha del contrato sin zona horaria (hora local de la PC)', () => {
        const local = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
        const ayer = new Date(2026, 8, 30, 8, 0, 0);
        const r = clasificarPc(salud('compras-01', { ultima_sync_ok: local(ayer) }), ctx);
        expect(r.dias).toBeCloseTo(1, 3);
        expect(r.estado).toBe('VERDE');
    });
});

// =============================================================================================
describe('tablero: linea resumen', () => {
    function doce() {
        const saludes = {};
        for (let i = 1; i <= 10; i++) saludes[`pc-${String(i).padStart(2, '0')}`] = salud(`pc-${String(i).padStart(2, '0')}`);
        saludes['ventas-03'] = salud('ventas-03', { version_instalada: 5 });                                  // amarilla: atrasada
        saludes['compras-02'] = salud('compras-02', { ultima_sync_ok: '2026-09-24T07:00:00' });                // roja: 7,04 dias
        return saludes;
    }

    it('es la del plan: "12 PC: 10 verdes, 1 amarilla, 1 roja: <pc> sin sincronizar desde el 24/09"', () => {
        const buzon = armarBuzon({ saludes: doce() });
        const t = armarTablero({ saludDir: path.join(buzon, 'salud'), avisosDir: path.join(buzon, 'avisos'), ahora: AHORA });
        expect(t.linea).toBe('12 PC: 10 verdes, 1 amarilla, 1 roja: compras-02 sin sincronizar desde el 24/09');
        expect(t.markdown).toContain(`**${t.linea}**`);
    });

    it('todas verdes, una sola PC y ninguna PC', () => {
        const dos = [{ estado: 'VERDE', pc: 'a', motivos: [] }, { estado: 'VERDE', pc: 'b', motivos: [] }];
        expect(lineaResumen(dos)).toBe('2 PC: todas verdes');
        expect(lineaResumen([dos[0]])).toBe('1 PC: 1 verde');
        expect(lineaResumen([])).toMatch(/^Sin PC/);
    });

    it('si no hay rojas nombra las amarillas, y con muchas rojas nombra 3 y cuenta el resto', () => {
        const amarilla = { estado: 'AMARILLO', pc: 'ventas-03', dias: 0.1, motivos: [{ corto: 'atrasada (tiene la 5, ya hay la 6)' }] };
        expect(lineaResumen([{ estado: 'VERDE', pc: 'a', motivos: [] }, amarilla])).toBe('2 PC: 1 verde, 1 amarilla: ventas-03 atrasada (tiene la 5, ya hay la 6)');
        const rojas = [1, 2, 3, 4, 5].map((i) => ({ estado: 'ROJO', pc: `r-${i}`, dias: 10 + i, motivos: [{ corto: 'con errores' }] }));
        const linea = lineaResumen(rojas);
        expect(linea).toBe('5 PC: 5 rojas: r-5 con errores; r-4 con errores; r-3 con errores y 2 más');
    });

    it('la linea es una sola linea, sin saltos', () => {
        const buzon = armarBuzon({ saludes: doce() });
        const t = armarTablero({ saludDir: path.join(buzon, 'salud'), avisosDir: path.join(buzon, 'avisos'), ahora: AHORA });
        expect(t.linea).not.toMatch(/\n/);
    });
});

// =============================================================================================
describe('tablero: carpetas con datos reales de mentira', () => {
    it('un JSON roto o vacio no tumba el tablero: se reporta y la PC queda en ROJO', () => {
        const buzon = armarBuzon({
            saludes: { 'compras-01': salud('compras-01'), 'ventas-02': salud('ventas-02') },
            crudos: { 'rrhh-09.json': '{"pc": "rrhh-09", "version_instalada": 6, "ultima_sy', 'logistica-04.json': '' },
        });
        let t;
        expect(() => { t = armarTablero({ saludDir: path.join(buzon, 'salud'), avisosDir: path.join(buzon, 'avisos'), ahora: AHORA }); }).not.toThrow();
        expect(t.filas).toHaveLength(4);
        expect(t.filas.filter((f) => f.estado === 'VERDE').map((f) => f.pc).sort()).toEqual(['compras-01', 'ventas-02']);
        const rotas = t.filas.filter((f) => f.estado === 'ROJO').map((f) => f.pc).sort();
        expect(rotas).toEqual(['logistica-04', 'rrhh-09']);
        expect(t.linea).toBe('4 PC: 2 verdes, 2 rojas: logistica-04 con el archivo de salud roto; rrhh-09 con el archivo de salud roto');
        expect(t.ilegibles.map((i) => i.lugar).sort()).toEqual(['salud/logistica-04.json', 'salud/rrhh-09.json']);
        expect(t.markdown).toContain('## Archivos que no se pudieron leer');
        expect(t.markdown).toContain('salud/rrhh-09.json');
    });

    it('un archivo que no es un objeto (una lista, un numero) tambien se reporta', () => {
        const buzon = armarBuzon({ saludes: { 'a-01': salud('a-01') }, crudos: { 'b-02.json': '[1,2,3]', 'c-03.json': '42' } });
        const t = armarTablero({ saludDir: path.join(buzon, 'salud'), avisosDir: path.join(buzon, 'avisos'), ahora: AHORA });
        expect(t.filas).toHaveLength(3);
        expect(t.ilegibles).toHaveLength(2);
    });

    it('ordena las PC: rojas primero, despues amarillas, despues verdes', () => {
        const buzon = armarBuzon({
            saludes: {
                'a-verde': salud('a-verde'),
                'b-amarilla': salud('b-amarilla', { politica: 'no' }),
                'c-roja': salud('c-roja', { firma_ok: false }),
            },
        });
        const t = armarTablero({ saludDir: path.join(buzon, 'salud'), avisosDir: path.join(buzon, 'avisos'), ahora: AHORA });
        expect(t.filas.map((f) => f.estado)).toEqual(['ROJO', 'AMARILLO', 'VERDE']);
        const tabla = t.markdown.split('\n').filter((l) => /^\| (ROJO|AMARILLO|VERDE) \|/.test(l));
        expect(tabla.map((l) => l.split('|')[1].trim())).toEqual(['ROJO', 'AMARILLO', 'VERDE']);
    });

    it('un archivo de salud con nombre de una PC que dice ser de otra queda AMARILLO', () => {
        const buzon = armarBuzon({ saludes: { 'compras-01': salud('contaduria-07') } });
        const t = armarTablero({ saludDir: path.join(buzon, 'salud'), avisosDir: path.join(buzon, 'avisos'), ahora: AHORA });
        expect(t.filas[0].estado).toBe('AMARILLO');
        expect(t.markdown).toContain('contaduria-07');
    });

    it('sin archivos de salud dice que no hay ninguna PC, en vez de romper', () => {
        const buzon = armarBuzon();
        const t = armarTablero({ saludDir: path.join(buzon, 'salud'), avisosDir: path.join(buzon, 'avisos'), ahora: AHORA });
        expect(t.filas).toEqual([]);
        expect(t.linea).toMatch(/^Sin PC/);
        expect(t.markdown).toContain('Todavía no llegó ningún archivo de salud.');
    });

    it('lo que llega de la nube no rompe la tabla ni se cuela como HTML', () => {
        const feo = salud('compras-01', { area: 'a|b<script>alert(1)</script>', errores: ['linea1\nlinea2 | col <b>x</b>'] });
        const buzon = armarBuzon({ saludes: { 'compras-01': feo } });
        const t = armarTablero({ saludDir: path.join(buzon, 'salud'), avisosDir: path.join(buzon, 'avisos'), ahora: AHORA });
        expect(t.markdown).not.toContain('<script>');
        expect(t.markdown).not.toContain('<b>');
        const fila = t.markdown.split('\n').find((l) => l.startsWith('| ROJO | compras-01'));
        expect(fila.replace(/\\\|/g, '').split('|')).toHaveLength(9);   // 7 columnas + los bordes
    });
});

// =============================================================================================
describe('tablero: avisos', () => {
    const cuando = (n) => haceDias(n);

    function buzonConAvisos() {
        const repetidos = {};
        for (let i = 0; i < 40; i++) {
            repetidos[`202609${String(10 + (i % 18)).padStart(2, '0')}-${String(i).padStart(4, '0')}-disco_lleno.json`] = {
                pc: 'compras-02', nivel: 'hoy', tipo: 'disco_lleno', mensaje: 'queda poco lugar en el disco', cuando: cuando(2 + i / 100),
            };
        }
        return armarBuzon({
            saludes: { 'compras-02': salud('compras-02'), 'rrhh-01': salud('rrhh-01'), 'ventas-03': salud('ventas-03') },
            avisos: {
                'compras-02': repetidos,
                'rrhh-01': {
                    '20260930-181500-firma_invalida.json': { nivel: 'urgente', tipo: 'firma_invalida', mensaje: 'la firma del paquete no verifica', cuando: cuando(1) },
                    '20260929-090000-roto.json': '{"nivel": "urgente", "tip',
                },
                'ventas-03': { '20261001-081500-sin_politica.txt': 'La política no está instalada\nsegunda línea que no va' },
                'pc-fantasma': { '20260930-000000-sin_area.json': { nivel: 'hoy', tipo: 'sin_area', mensaje: 'no estoy en personas.json' } },
            },
        });
    }

    it('40 avisos iguales de una PC son UNA linea con el conteo', () => {
        const buzon = buzonConAvisos();
        const t = armarTablero({ saludDir: path.join(buzon, 'salud'), avisosDir: path.join(buzon, 'avisos'), ahora: AHORA });
        const lineas = t.markdown.split('\n').filter((l) => l.includes('queda poco lugar en el disco'));
        expect(lineas).toHaveLength(1);
        expect(lineas[0]).toMatch(/^- compras-02: queda poco lugar en el disco \(40 veces, el último el \d{2}\/\d{2}\/2026\)$/);
    });

    it('agrupa por nivel y por tipo: urgente, despues hoy, y cada tipo una sola vez', () => {
        const buzon = buzonConAvisos();
        const t = armarTablero({ saludDir: path.join(buzon, 'salud'), avisosDir: path.join(buzon, 'avisos'), ahora: AHORA });
        const md = t.markdown;
        expect(md.indexOf('### Urgente')).toBeGreaterThan(-1);
        expect(md.indexOf('### Urgente')).toBeLessThan(md.indexOf('### Para mirar hoy'));
        expect(md.indexOf('### Para mirar hoy')).toBeLessThan(md.indexOf('### Sin nivel indicado'));
        expect(md.match(/\*\*disco_lleno\*\*/g)).toHaveLength(1);
        expect(md).toContain('- rrhh-01: la firma del paquete no verifica');
        // un aviso en texto suelto: la primera linea es el mensaje, el tipo sale del nombre del archivo
        expect(md).toContain('**sin_politica**');
        expect(md).toContain('- ventas-03: La política no está instalada');
        expect(md).not.toContain('segunda línea que no va');
    });

    it('el aviso roto se reporta y no frena a los demas', () => {
        const buzon = buzonConAvisos();
        const t = armarTablero({ saludDir: path.join(buzon, 'salud'), avisosDir: path.join(buzon, 'avisos'), ahora: AHORA });
        expect(t.ilegibles.map((i) => i.lugar)).toContain('avisos/rrhh-01/20260929-090000-roto.json');
        expect(t.markdown).toContain('- compras-02: queda poco lugar');
    });

    it('una PC que dejo avisos pero nunca mando su salud aparece en ROJO', () => {
        const buzon = buzonConAvisos();
        const t = armarTablero({ saludDir: path.join(buzon, 'salud'), avisosDir: path.join(buzon, 'avisos'), ahora: AHORA });
        const f = t.filas.find((x) => x.pc === 'pc-fantasma');
        expect(f.estado).toBe('ROJO');
        expect(t.filas).toHaveLength(4);
        expect(t.linea).toContain('pc-fantasma sin archivo de salud');
    });

    it('si el mismo tipo trae textos distintos lo dice, y muestra el ultimo', () => {
        const g = agruparAvisos([
            { pc: 'a-01', nivel: 'hoy', tipo: 'disco', mensaje: 'quedan 9 GB', cuando: new Date(2026, 8, 20) },
            { pc: 'a-01', nivel: 'hoy', tipo: 'disco', mensaje: 'quedan 4 GB', cuando: new Date(2026, 8, 28) },
            { pc: 'a-01', nivel: 'hoy', tipo: 'disco', mensaje: 'quedan 6 GB', cuando: new Date(2026, 8, 25) },
        ]);
        expect(g).toHaveLength(1);
        expect(g[0].cantidad).toBe(3);
        expect(g[0].mensajes.size).toBe(3);
        expect(g[0].ultimoMensaje).toBe('quedan 4 GB');
    });

    it('un aviso gigante o con markdown raro no rompe nada', () => {
        const buzon = armarBuzon({
            saludes: { 'a-01': salud('a-01') },
            avisos: { 'a-01': {
                '20261001-000000-grande.json': 'x'.repeat(200 * 1024),
                '20261001-000001-raro.json': { nivel: 'urgente', tipo: 'raro|tipo', mensaje: '# titulo\n| celda | <img src=x onerror=alert(1)> |' },
            } },
        });
        const t = armarTablero({ saludDir: path.join(buzon, 'salud'), avisosDir: path.join(buzon, 'avisos'), ahora: AHORA });
        expect(t.ilegibles.some((i) => i.lugar.endsWith('grande.json') && /grande/.test(i.motivo))).toBe(true);
        expect(t.markdown).not.toContain('<img');
        expect(t.markdown.split('\n').filter((l) => l.startsWith('- a-01:')).every((l) => !l.includes('\n'))).toBe(true);
    });

    it('sin avisos dice "No hay avisos."', () => {
        const buzon = armarBuzon({ saludes: { 'a-01': salud('a-01') } });
        const t = armarTablero({ saludDir: path.join(buzon, 'salud'), avisosDir: path.join(buzon, 'avisos'), ahora: AHORA });
        expect(t.markdown).toContain('No hay avisos.');
    });
});

// =============================================================================================
describe('tablero: linea de comandos', () => {
    const ahoraTexto = AHORA.toISOString();

    it('--linea imprime solo la linea resumen y no escribe ningun archivo', () => {
        const buzon = armarBuzon({ saludes: { 'a-01': salud('a-01'), 'b-02': salud('b-02', { firma_ok: false }) } });
        const antes = fs.readdirSync(buzon).sort();
        const r = correr(TABLERO, ['--buzon', buzon, '--linea', '--ahora', ahoraTexto]);
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('2 PC: 1 verde, 1 roja: b-02 con la firma mal\n');
        expect(fs.readdirSync(buzon).sort()).toEqual(antes);
    });

    it('sin --linea escribe TABLERO.md en el buzon, completo y sin temporales', () => {
        const buzon = armarBuzon({ saludes: { 'a-01': salud('a-01') }, avisos: { 'a-01': { '20261001-000000-x.json': { nivel: 'semanal', tipo: 'resumen', mensaje: 'todo en orden' } } } });
        const r = correr(TABLERO, ['--buzon', buzon, '--ahora', ahoraTexto]);
        expect(r.status).toBe(0);
        const md = fs.readFileSync(path.join(buzon, 'TABLERO.md'), 'utf8');
        expect(md).toContain('# Tablero de las PC con Claude');
        expect(md).toContain('| VERDE | a-01 |');
        expect(md).toContain('### Semanal');
        expect(fs.readdirSync(buzon).filter((n) => n.includes('.tmp-'))).toEqual([]);
        expect(md).toContain('Armado el 01/10/2026 a las 08:00.');
    });

    it('usa la variable CLAUDE_AREA_NUBE cuando no se pasa --buzon', () => {
        const nube = carpetaTemporal('nube-');
        const buzon = path.join(nube, '4- BUZON');
        fs.mkdirSync(path.join(buzon, 'salud'), { recursive: true });
        fs.writeFileSync(path.join(buzon, 'salud', 'a-01.json'), JSON.stringify(salud('a-01')));
        const r = correr(TABLERO, ['--linea', '--ahora', ahoraTexto], { env: { CLAUDE_AREA_NUBE: nube } });
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('1 PC: 1 verde\n');
    });

    it('sin carpeta ni variable, o con una carpeta que no existe, sale con 1 y lo dice', () => {
        const sinNada = correr(TABLERO, ['--linea'], { sinNube: true });
        expect(sinNada.status).toBe(1);
        expect(sinNada.stderr).toMatch(/CLAUDE_AREA_NUBE/);
        const noExiste = correr(TABLERO, ['--buzon', path.join(os.tmpdir(), 'no-existe-claude-area-xyz'), '--linea']);
        expect(noExiste.status).toBe(1);
        expect(noExiste.stderr).toMatch(/salud/);
    });

    it('la salida del tablero con un JSON roto igual sale con 0', () => {
        const buzon = armarBuzon({ saludes: { 'a-01': salud('a-01') }, crudos: { 'b-02.json': '{rota' } });
        const r = correr(TABLERO, ['--buzon', buzon, '--ahora', ahoraTexto]);
        expect(r.status).toBe(0);
        expect(fs.readFileSync(path.join(buzon, 'TABLERO.md'), 'utf8')).toContain('salud/b-02.json');
    });
});

// =============================================================================================
describe('inventario_resumen: cuentas y no conocidos', () => {
    const prog = (nombre, version, editor = 'Editor', alcance = 'maquina') => ({ nombre, version, editor, instalado: '2026-01-31', alcance });
    const inv = (pc, programas, relevado = '2026-09-30T18:00:00') => ({ pc, usuario_windows: `u-${pc}`, relevado, programas });

    function carpetaInventario({ listas, conocidos, crudos = {} }) {
        const buzon = carpetaTemporal('buzon-inv-');
        fs.mkdirSync(path.join(buzon, 'inventario'), { recursive: true });
        for (const [pc, doc] of Object.entries(listas)) fs.writeFileSync(path.join(buzon, 'inventario', `${pc}.json`), JSON.stringify(doc));
        for (const [n, t] of Object.entries(crudos)) fs.writeFileSync(path.join(buzon, 'inventario', n), t);
        if (conocidos !== undefined) fs.writeFileSync(path.join(buzon, 'conocidos.json'), typeof conocidos === 'string' ? conocidos : JSON.stringify(conocidos));
        return buzon;
    }

    const LISTAS = {
        'pc-a': inv('pc-a', [prog('Google Chrome', '120.0'), prog('TeamViewer', '15.1'), prog('7-Zip 23.01', '23.01'), prog('Herramienta Rara', '1.0', 'Nadie')]),
        'pc-b': inv('pc-b', [prog('Google Chrome', '121.0'), prog('TeamViewer', '15.1'), prog('7-Zip 23.01', '23.01')]),
        'pc-c': inv('pc-c', [prog('google  chrome', '121.0'), prog('Microsoft Visual C++ 2015-2022 Redistributable (x64) - 14.38', '14.38'), prog('7-Zip 23.01', '23.01', 'Igor', 'usuario')]),
    };
    const CONOCIDOS = { conocidos: [
        { nombre: 'google chrome', para_que: 'Navegador' },
        { nombre: 'TeamViewer*', para_que: 'Soporte remoto de IT' },
        { patron: '^Microsoft Visual C\\+\\+ ', para_que: 'Librerías que piden otros programas' },
        { patron: '(', para_que: 'patrón mal escrito' },
        { para_que: 'sin nombre ni patrón' },
    ] };

    function informe(opts = {}) {
        const buzon = carpetaInventario({ listas: LISTAS, conocidos: CONOCIDOS, ...opts });
        const { pcs, ilegibles } = leerInventarios(path.join(buzon, 'inventario'));
        const conocidos = leerConocidos(path.join(buzon, 'conocidos.json'));
        return { buzon, pcs, ...armarInforme({ pcs, ilegibles, conocidos, ahora: new Date(2026, 9, 1, 8, 0, 0) }), conocidos };
    }
    const seccion = (md, titulo) => {
        const partes = md.split(/^## /m);
        return partes.find((p) => p.startsWith(titulo)) ?? '';
    };

    it('cuenta las PC, los programas distintos y en cuantas PC esta cada uno', () => {
        const r = informe();
        expect(r.resumen.pcs).toBe(3);
        expect(r.resumen.programas).toBe(5);          // Chrome, TeamViewer, 7-Zip, Herramienta Rara, Visual C++
        const chrome = r.programas.find((g) => g.nombre === 'Google Chrome');
        expect(chrome.pcs.size).toBe(3);              // "google  chrome" (otro espaciado y minusculas) es el mismo programa
        expect([...chrome.versiones.keys()].sort()).toEqual(['120.0', '121.0']);
        expect(r.markdown).toContain('| Google Chrome | 3 de 3 | 121.0 (2 PC), 120.0 (1 PC) | Navegador |');
        expect(r.markdown).toContain('- PC con lista de programas: 3');
        expect(r.markdown).toContain('- Programas distintos: 5');
    });

    it('marca los que NO figuran en conocidos (por nombre exacto, con * y con patron)', () => {
        const r = informe();
        expect(r.resumen.sinClasificar).toBe(2);
        const sec = seccion(r.markdown, 'Programas que no figuran en la lista de conocidos');
        expect(sec).toContain('7-Zip 23.01');
        expect(sec).toContain('Herramienta Rara');
        expect(sec).not.toContain('Google Chrome');
        expect(sec).not.toContain('TeamViewer');
        expect(sec).not.toContain('Visual C++');
        // y los conocidos llevan su "para que"
        expect(r.markdown).toContain('Soporte remoto de IT');
        expect(r.markdown).toContain('Librerías que piden otros programas');
    });

    it('lista los que estan en una sola PC, con cual', () => {
        const r = informe();
        expect(r.resumen.enUnaPc).toBe(2);
        const sec = seccion(r.markdown, 'Programas que están en una sola PC');
        expect(sec).toMatch(/\| Herramienta Rara \| pc-a \| 1\.0 \| no figura \|/);
        expect(sec).toMatch(/\| Microsoft Visual C\+\+ 2015-2022 Redistributable \(x64\) - 14\.38 \| pc-c \|/);
        expect(sec).not.toContain('TeamViewer');
    });

    it('los renglones de conocidos que no sirven se reportan y no frenan nada', () => {
        const r = informe();
        const sec = seccion(r.markdown, 'Archivos o renglones que no se pudieron usar');
        expect(sec).toContain('patrón que no se puede usar');
        expect(sec).toContain('no tiene "nombre" ni "patron"');
        expect(r.conocidos.entradas).toHaveLength(3);
    });

    it('DESCRIBE: no recomienda sacar nada ni dice que algo sobra', () => {
        const r = informe();
        expect(r.markdown).not.toMatch(/desinstal|sobra|recomend|conviene sacar|eliminar/i);
        expect(r.markdown).toContain('Cualquier decisión sobre un programa la toma una persona.');
    });

    it('sin conocidos.json no declara "sin clasificar" a todo: avisa que falta la lista', () => {
        const buzon = carpetaInventario({ listas: LISTAS });
        const { pcs } = leerInventarios(path.join(buzon, 'inventario'));
        const inf = armarInforme({ pcs, conocidos: leerConocidos(path.join(buzon, 'conocidos.json')), ahora: AHORA });
        expect(inf.markdown).toContain('Todavía no hay lista de conocidos');
        expect(inf.markdown).not.toContain('## Programas que no figuran en la lista de conocidos');
        expect(inf.resumen.sinClasificar).toBeNull();
    });

    it('un JSON roto o sin la lista de programas se reporta y el resto se cuenta igual', () => {
        const r = informe({ crudos: { 'pc-rota.json': '{"pc":"pc-rota","programas":[{"nombre":"Cor', 'pc-rara.json': '{"pc":"x","programas":"no es lista"}', 'vacia.json': '' } });
        expect(r.resumen.pcs).toBe(3);
        const sec = seccion(r.markdown, 'Archivos o renglones que no se pudieron usar');
        expect(sec).toContain('inventario/pc-rota.json');
        expect(sec).toContain('inventario/pc-rara.json');
        expect(sec).toContain('inventario/vacia.json');
    });

    it('renglones sin nombre de programa se salteaan y se avisa', () => {
        const buzon = carpetaInventario({ listas: { 'pc-a': inv('pc-a', [prog('Uno', '1'), { version: '2' }, null, { nombre: '   ' }]) } });
        const { pcs, ilegibles } = leerInventarios(path.join(buzon, 'inventario'));
        expect(pcs[0].programas).toHaveLength(1);
        expect(ilegibles[0].motivo).toMatch(/3 renglones sin nombre/);
    });

    it('dos listas de la misma PC: vale la mas nueva y se avisa', () => {
        const buzon = carpetaInventario({ listas: {
            'pc-a': inv('pc-a', [prog('Viejo', '1')], '2026-09-01T10:00:00'),
            'pc-a-copia': inv('pc-a', [prog('Nuevo', '2')], '2026-09-30T10:00:00'),
        } });
        const { pcs, ilegibles } = leerInventarios(path.join(buzon, 'inventario'));
        expect(pcs).toHaveLength(1);
        expect(pcs[0].programas[0].nombre).toBe('Nuevo');
        expect(ilegibles).toHaveLength(1);
        expect(ilegibles[0].motivo).toMatch(/se usó la más nueva/);
    });

    it('una lista de hace mas de 14 dias se marca; una sola PC no se compara con nadie', () => {
        const buzon = carpetaInventario({ listas: { 'pc-a': inv('pc-a', [prog('Uno', '1')], '2026-09-01T10:00:00') } });
        const { pcs } = leerInventarios(path.join(buzon, 'inventario'));
        const inf = armarInforme({ pcs, conocidos: leerConocidos(null), ahora: new Date(2026, 9, 1, 8, 0, 0) });
        expect(inf.markdown).toContain('01/09/2026 (hace más de 14 días)');
        expect(inf.markdown).toContain('Con una sola PC no se puede comparar');
        expect(inf.markdown).not.toContain('## Programas que están en una sola PC');
    });

    it('lo que llega en un nombre de programa no rompe la tabla', () => {
        const buzon = carpetaInventario({ listas: { 'pc-a': inv('pc-a', [prog('Raro | <script>x</script>\nOtro', '1')]) } });
        const { pcs } = leerInventarios(path.join(buzon, 'inventario'));
        const inf = armarInforme({ pcs, conocidos: leerConocidos(null), ahora: AHORA });
        expect(inf.markdown).not.toContain('<script>');
        const fila = inf.markdown.split('\n').find((l) => l.startsWith('| Raro'));
        expect(fila.replace(/\\\|/g, '').split('|')).toHaveLength(6);   // 4 columnas + bordes
    });

    it('sin ninguna lista dice que todavia no hay', () => {
        const buzon = carpetaInventario({ listas: {} });
        const { pcs } = leerInventarios(path.join(buzon, 'inventario'));
        expect(armarInforme({ pcs, conocidos: leerConocidos(null), ahora: AHORA }).markdown).toContain('Todavía no hay ninguna lista de programas.');
    });

    it('contarProgramas ordena por nombre', () => {
        const { pcs } = leerInventarios(path.join(carpetaInventario({ listas: LISTAS }), 'inventario'));
        const nombres = contarProgramas(pcs, { entradas: [] }).map((g) => g.nombre.toLowerCase());
        expect(nombres).toEqual([...nombres].sort((a, b) => a.localeCompare(b)));
    });

    it('linea de comandos: escribe INVENTARIO.md en el buzon, sin temporales', () => {
        const buzon = carpetaInventario({ listas: LISTAS, conocidos: CONOCIDOS });
        const r = correr(RESUMEN, ['--buzon', buzon, '--ahora', AHORA.toISOString()]);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('3 PC, 5 programas distintos.');
        const md = fs.readFileSync(path.join(buzon, 'INVENTARIO.md'), 'utf8');
        expect(md).toContain('# Programas instalados en las PC');
        expect(fs.readdirSync(buzon).filter((n) => n.includes('.tmp-'))).toEqual([]);
        // lo unico que aparece de nuevo en el buzon es el informe
        expect(fs.readdirSync(buzon).sort()).toEqual(['INVENTARIO.md', 'conocidos.json', 'inventario']);
    });

    it('linea de comandos: sin carpeta sale con 1 y lo dice', () => {
        const r = correr(RESUMEN, [], { sinNube: true });
        expect(r.status).toBe(1);
        expect(r.stderr).toMatch(/CLAUDE_AREA_NUBE/);
    });
});

// =============================================================================================
const hayPowerShell = process.platform === 'win32' && (() => {
    try { return spawnSync('powershell.exe', ['-NoProfile', '-Command', 'exit 0']).status === 0; } catch { return false; }
})();

describe('inventario.ps1: el archivo', () => {
    const texto = fs.readFileSync(PS1);

    it('es solo ASCII (PowerShell 5.1 lee UTF-8 sin BOM como ANSI)', () => {
        const raros = [...texto].filter((b) => b > 127);
        expect(raros).toEqual([]);
    });

    it('solo lee el registro: no usa WMI, no cambia el registro, no desinstala, no manda nada', () => {
        const codigo = texto.toString('utf8').split(/\r?\n/).filter((l) => !l.trim().startsWith('#')).join('\n');
        for (const prohibido of [
            'Win32_Product', 'Get-WmiObject', 'Get-CimInstance', 'Set-ItemProperty', 'New-ItemProperty', 'Remove-ItemProperty',
            'Remove-Item', 'Uninstall-', 'msiexec', 'Invoke-WebRequest', 'Invoke-RestMethod', 'Start-Process', 'Stop-Process',
            'Set-Service', 'Send-MailMessage', 'Get-ChildItem -Recurse', 'Get-Content',
        ]) {
            expect(codigo, `no deberia usar ${prohibido}`).not.toContain(prohibido);
        }
        // y lee las tres claves que dice el contrato
        expect(codigo).toContain("HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall");
        expect(codigo).toContain("HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall");
        expect(codigo).toContain("HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall");
    });
});

describe.skipIf(!hayPowerShell)('inventario.ps1: corrido de verdad en esta PC', () => {
    let carpeta; let salida; let corrida; let segundos;
    const ps = (args, cwd) => spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PS1, ...args], { encoding: 'utf8', cwd });

    beforeAll(() => {
        carpeta = carpetaTemporal('inventario-ps-');
        salida = path.join(carpeta, 'nube-falsa', 'inventario', 'PC-DE-PRUEBA.json');   // la carpeta no existe: la crea el script
        const t0 = Date.now();
        corrida = ps(['-Salida', salida], carpeta);
        segundos = (Date.now() - t0) / 1000;
    }, 60000);

    const leer = () => JSON.parse(fs.readFileSync(salida, 'utf8'));

    it('sale con 0 y escribe el JSON en la ruta pedida, creando la carpeta', () => {
        expect(corrida.status, corrida.stderr).toBe(0);
        expect(fs.existsSync(salida)).toBe(true);
        expect(corrida.stdout).toMatch(/Listo: \d+ programas anotados/);
        expect(segundos).toBeLessThan(45);
    });

    it('es JSON valido, UTF-8 sin BOM, con los campos del contrato', () => {
        const crudo = fs.readFileSync(salida);
        expect(crudo[0]).not.toBe(0xef);
        expect(crudo[0]).not.toBe(0xff);
        const j = leer();
        expect(typeof j.pc).toBe('string');
        expect(j.pc.length).toBeGreaterThan(0);
        expect(typeof j.usuario_windows).toBe('string');
        expect(j.relevado).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
        expect(Array.isArray(j.programas)).toBe(true);
        for (const p of j.programas) {
            expect(Object.keys(p)).toEqual(['nombre', 'version', 'editor', 'instalado', 'alcance']);
            expect(p.nombre.length).toBeGreaterThan(0);
            expect(['maquina', 'usuario']).toContain(p.alcance);
            expect(p.instalado === '' || /^\d{4}-\d{2}-\d{2}$/.test(p.instalado)).toBe(true);
        }
    });

    it('encuentra mas de 20 programas, sin duplicados, ordenados por nombre', () => {
        const { programas } = leer();
        expect(programas.length).toBeGreaterThan(20);
        const claves = programas.map((p) => `${p.nombre.toLowerCase()}|${p.version.toLowerCase()}`);
        expect(new Set(claves).size).toBe(claves.length);
        const nombres = programas.map((p) => p.nombre.toLowerCase());
        const ordenados = [...nombres].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        expect(nombres).toEqual(ordenados);
        console.info(`[inventario.ps1] ${programas.length} programas en ${segundos.toFixed(1)} s (con el arranque de PowerShell)`);
    });

    it('no escribe en ningun otro lado: solo el archivo pedido (ni temporales)', () => {
        expect(fs.readdirSync(carpeta).sort()).toEqual(['nube-falsa']);
        expect(fs.readdirSync(path.join(carpeta, 'nube-falsa')).sort()).toEqual(['inventario']);
        expect(fs.readdirSync(path.dirname(salida))).toEqual(['PC-DE-PRUEBA.json']);
    });

    it('corrido otra vez reemplaza el archivo entero (escritura atomica sobre uno existente)', () => {
        fs.writeFileSync(salida, '{"viejo": true}');
        const r = ps(['-Salida', salida], carpeta);
        expect(r.status, r.stderr).toBe(0);
        const j = leer();
        expect(j.viejo).toBeUndefined();
        expect(j.programas.length).toBeGreaterThan(20);
        expect(fs.readdirSync(path.dirname(salida))).toEqual(['PC-DE-PRUEBA.json']);
    }, 60000);

    it('si -Salida es una carpeta existente, escribe <nombre de la PC>.json adentro', () => {
        const destino = carpetaTemporal('inventario-ps-dir-');
        const r = ps(['-Salida', destino], carpeta);
        expect(r.status, r.stderr).toBe(0);
        const archivos = fs.readdirSync(destino);
        expect(archivos).toHaveLength(1);
        expect(archivos[0]).toMatch(/\.json$/);
        expect(JSON.parse(fs.readFileSync(path.join(destino, archivos[0]), 'utf8')).programas.length).toBeGreaterThan(20);
    }, 60000);

    it('-Mostrar enseña en pantalla que se junto, que es lo unico, y lo que se dejo afuera', () => {
        const destino = carpetaTemporal('inventario-ps-mostrar-');
        const r = ps(['-Salida', path.join(destino, 'x.json'), '-Mostrar'], carpeta);
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toContain('Es lo unico que se junta');
        expect(r.stdout).toContain('No se junta nada de tus archivos');
        expect(r.stdout).toMatch(/Se dejaron afuera \d+ componentes del sistema/);
        // lo que muestra en pantalla es lo mismo que escribio en el archivo
        const escrito = JSON.parse(fs.readFileSync(path.join(destino, 'x.json'), 'utf8')).programas.map((p) => p.nombre);
        const visibles = escrito.filter((n) => r.stdout.includes(n.slice(0, 20)));
        expect(visibles.length).toBeGreaterThan(escrito.length * 0.8);
    }, 60000);

    it('solo -Mostrar (sin -Salida) mira y no escribe nada en ningun lado', () => {
        const vacia = carpetaTemporal('inventario-ps-solo-mostrar-');
        const r = ps(['-Mostrar'], vacia);
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toContain('Es lo unico que se junta');
        expect(fs.readdirSync(vacia)).toEqual([]);
    }, 60000);

    it('sin -Salida ni -Mostrar se frena (sale con 2) y no escribe nada', () => {
        const vacia = carpetaTemporal('inventario-ps-sin-nada-');
        const r = ps([], vacia);
        expect(r.status).toBe(2);
        expect(r.stderr).toMatch(/Falta -Salida/);
        expect(fs.readdirSync(vacia)).toEqual([]);
    }, 60000);

    it('una clave del registro que no existe no es un error: se salta', () => {
        const destino = carpetaTemporal('inventario-ps-sinclave-');
        const r = ps(['-Salida', path.join(destino, 'a.json'), '-Claves', 'HKCU:\\Software\\ClaudeAreaNoExiste-xyz\\Uninstall'], carpeta);
        expect(r.status, r.stderr).toBe(0);
        expect(JSON.parse(fs.readFileSync(path.join(destino, 'a.json'), 'utf8')).programas).toEqual([]);
    }, 60000);

    it('una ruta imposible (la carpeta de arriba es un archivo) sale con 1, sin dejar restos', () => {
        const base = carpetaTemporal('inventario-ps-imposible-');
        fs.writeFileSync(path.join(base, 'soy-un-archivo'), 'x');
        const r = ps(['-Salida', path.join(base, 'soy-un-archivo', 'adentro', 'pc.json')], base);
        expect(r.status).toBe(1);
        expect(r.stderr).toMatch(/No se pudo armar la lista de programas/);
        expect(fs.readdirSync(base)).toEqual(['soy-un-archivo']);
        expect(fs.readFileSync(path.join(base, 'soy-un-archivo'), 'utf8')).toBe('x');
    }, 60000);
});

// Claves de prueba que SE CREAN Y SE BORRAN en HKCU\Software\ClaudeAreaPrueba-* (una rama que es de
// esta prueba y de nadie mas; no se toca ninguna clave "Uninstall" de verdad). Sirve para ejercer
// lo que la lista real de esta PC no trae: duplicados, componentes del sistema, actualizaciones,
// fechas malas y nombres con caracteres raros.
describe.skipIf(!hayPowerShell)('inventario.ps1: contra claves de prueba del registro', () => {
    const rama = `ClaudeAreaPrueba-${process.pid}-${Date.now()}`;
    const base = `HKCU:\\Software\\${rama}`;
    let carpeta; let json; let corrida;
    const correrPs = (archivo, args) => spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', archivo, ...args], { encoding: 'utf8', cwd: carpeta });

    beforeAll(() => {
        carpeta = carpetaTemporal('inventario-ps-reg-');
        const armar = path.join(carpeta, 'armar.ps1');
        fs.writeFileSync(armar, [
            `$base = '${base}'`,
            'function K($ruta, $props) {',
            '  [void](New-Item -Path $ruta -Force)',
            '  foreach ($k in $props.Keys) {',
            '    $v = $props[$k]',
            '    if ($v -is [int]) { [void](New-ItemProperty -Path $ruta -Name $k -Value $v -PropertyType DWord -Force) }',
            '    else { [void](New-ItemProperty -Path $ruta -Name $k -Value $v -PropertyType String -Force) }',
            '  }',
            '}',
            "K ($base + '\\Uninstall\\{A}') @{ DisplayName='Zeta Programa'; DisplayVersion='1.0'; Publisher='Editor Z'; InstallDate='20260131' }",
            "K ($base + '\\Uninstall\\{B}') @{ DisplayName='alfa programa'; DisplayVersion='2.0'; InstallDate='20261399' }",
            "K ($base + '\\Uninstall\\{C}') @{ DisplayName='Zeta Programa'; DisplayVersion='1.0'; Publisher='Editor Z'; InstallDate='20260131' }",
            "K ($base + '\\Uninstall32\\{D}') @{ DisplayName='ZETA PROGRAMA'; DisplayVersion='1.0'; Publisher='Editor Z'; InstallDate='20260131' }",
            "K ($base + '\\Uninstall\\{E}') @{ DisplayName='Zeta Programa'; DisplayVersion='1.1'; Publisher='Editor Z' }",
            "K ($base + '\\Uninstall\\{F}') @{ DisplayName='Componente oculto'; SystemComponent=1 }",
            "K ($base + '\\Uninstall\\{G}') @{ DisplayName='Parche de otro programa'; ParentKeyName='Zeta Programa' }",
            "K ($base + '\\Uninstall\\{H}') @{ DisplayName='Update for Windows (KB5000000)'; ReleaseType='Update' }",
            "K ($base + '\\Uninstall\\{I}') @{ Publisher='Sin nombre de programa' }",
            "K ($base + '\\Uninstall\\{J}') @{ DisplayName=('Con [corchetes] y ' + [char]39 + 'comillas' + [char]39 + ' y ' + [char]34 + 'dobles' + [char]34) }",
            "K ($base + '\\Uninstall\\{K}') @{ DisplayName=('Pi' + [char]0x00F1 + 'a'); Publisher=('Se' + [char]0x00F1 + 'or') }",
            "K ($base + '\\Uninstall\\{L}') @{ DisplayName='Futuro'; InstallDate='20991231' }",
        ].join('\r\n'));
        const crear = correrPs(armar, []);
        if (crear.status !== 0) throw new Error(`no pude armar las claves de prueba: ${crear.stderr}`);
        json = path.join(carpeta, 'salida', 'pc.json');
        corrida = correrPs(PS1, ['-Salida', json, '-Mostrar', '-Claves', `${base}\\Uninstall,${base}\\Uninstall32`]);
    }, 60000);

    afterAll(() => {
        // solo se saca la rama de ESTA prueba
        if (!/^ClaudeAreaPrueba-\d+-\d+$/.test(rama)) return;
        spawnSync('reg.exe', ['delete', `HKCU\\Software\\${rama}`, '/f']);
    }, 60000);

    it('corre bien y dice cuantos componentes del sistema y actualizaciones dejo afuera', () => {
        expect(corrida.status, corrida.stderr).toBe(0);
        expect(corrida.stdout).toContain('Se dejaron afuera 3 componentes');
        expect(corrida.stdout).toContain('Listo: 6 programas anotados');
    });

    it('saca los duplicados (mismo nombre y version, aunque cambie la mayuscula o la clave), pero deja otra version', () => {
        const nombres = JSON.parse(fs.readFileSync(json, 'utf8')).programas.map((p) => `${p.nombre} ${p.version}`.trim());
        expect(nombres).toEqual([
            'alfa programa 2.0',
            "Con [corchetes] y 'comillas' y \"dobles\"",
            'Futuro',
            'Piña',
            'Zeta Programa 1.0',
            'Zeta Programa 1.1',
        ]);
    });

    it('deja afuera lo que Windows no muestra como programa (componentes, partes de otro programa, actualizaciones) y lo que no tiene nombre', () => {
        const todo = fs.readFileSync(json, 'utf8');
        for (const fuera of ['Componente oculto', 'Parche de otro programa', 'KB5000000', 'Sin nombre de programa']) expect(todo).not.toContain(fuera);
    });

    it('la fecha de instalacion solo sale si es una fecha de verdad', () => {
        const p = Object.fromEntries(JSON.parse(fs.readFileSync(json, 'utf8')).programas.map((x) => [`${x.nombre} ${x.version}`.trim(), x]));
        expect(p['Zeta Programa 1.0'].instalado).toBe('2026-01-31');
        expect(p['alfa programa 2.0'].instalado).toBe('');     // 20261399 no existe
        expect(p.Futuro.instalado).toBe('');                    // 2099 todavia no paso
        expect(p['Zeta Programa 1.1'].instalado).toBe('');      // sin dato: no se inventa
    });

    it('guarda los acentos y la eñe como UTF-8 y marca el alcance de la clave de usuario', () => {
        const crudo = fs.readFileSync(json);
        expect(crudo.includes(Buffer.from('Piña', 'utf8'))).toBe(true);
        const j = JSON.parse(crudo.toString('utf8'));
        expect(j.programas.find((x) => x.nombre === 'Piña').editor).toBe('Señor');
        expect(j.programas.every((x) => x.alcance === 'usuario')).toBe(true);   // las claves de prueba cuelgan de HKCU
    });

    it('no quedan temporales ni archivos de mas al lado del resultado', () => {
        expect(fs.readdirSync(path.dirname(json))).toEqual(['pc.json']);
    });
});
