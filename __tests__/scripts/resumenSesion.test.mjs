import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  lineaInteresaResumen, eventosDeHerramienta, leerSesion, parsearGitLog, argumentosGitLog, relativaA,
  cotejarConGit, armarPagina, armarHtml, carpetaDe, resumirSesion, elegirSesion, diaLocal, main,
} from '../../scripts/_resumenSesion.mjs';
import { lineasInteresantes, lineaInteresa } from '../../scripts/_lib/transcriptsFak.mjs';

// Dobles: ni canon del repo, ni git real, ni ~/.claude. Un .jsonl chico en tmp y git log como texto fijo.
const NO_ES_DE_FAK = ['<system', 'Intentar nuevamente'];
const CWD = 'C:\\Dev\\BarackMercosul';
const SID = 'abc12345-0000-4000-8000-000000000001';
const linea = (o) => JSON.stringify({ sessionId: SID, cwd: CWD, ...o });
const user = (uuid, ts, content) => linea({ type: 'user', uuid, timestamp: ts, origin: { kind: 'human' }, message: { role: 'user', content } });
const tool = (uuid, ts, bloques) => linea({ type: 'assistant', uuid, timestamp: ts, message: { role: 'assistant', content: bloques } });
const uso = (id, name, input) => ({ type: 'tool_use', id, name, input });

const LINEAS = [
  user('u1', '2026-10-09T13:05:00.000Z', 'Armá la página de la sesión'),
  tool('a1', '2026-10-09T13:06:00.000Z', [uso('t1', 'Skill', { skill: 'codigo-madre' })]),
  tool('a2', '2026-10-09T13:07:00.000Z', [uso('t2', 'Edit', { file_path: `${CWD}\\scripts\\_resumenSesion.mjs`, old_string: 'a', new_string: 'b' })]),
  linea({ type: 'user', uuid: 'u2', timestamp: '2026-10-09T13:07:01.000Z', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't2', content: 'ok' }] } }),
  tool('a3', '2026-10-09T13:20:00.000Z', [uso('t3', 'Write', { file_path: 'C:/Dev/BarackMercosul/tests/resumenSesion.test.mjs', content: 'x' })]),
  tool('a3', '2026-10-09T13:20:00.000Z', [uso('t3', 'Write', { file_path: 'C:/Dev/BarackMercosul/tests/resumenSesion.test.mjs', content: 'x' })]), // repetida (resume)
  tool('a4', '2026-10-09T13:30:00.000Z', [uso('t4', 'Bash', { command: 'git commit -m "feat(HOY-18d): resumen de sesión"' })]),
  user('u3', '2026-10-09T13:31:00.000Z', 'Intentar nuevamente'), // botón de la app: no es Fak
];
const GIT_OK = ['abc1234\x1f2026-10-09T10:30:00-03:00\x1ffeat(HOY-18d): resumen de sesión', '', 'scripts/_resumenSesion.mjs', 'tests/resumenSesion.test.mjs', ''].join('\n');
const GIT_MAL = `${GIT_OK}\ndef5678\x1f2026-10-09T11:00:00-03:00\x1fdocs: otra cosa\n\ndocs/COLA_CAMBIOS_CODIGO.md\n`;

let dir;
let ruta;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'resumen-sesion-'));
  ruta = path.join(dir, `${SID}.jsonl`);
  fs.writeFileSync(ruta, `${LINEAS.join('\n')}\n`, 'utf8');
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('prefiltro', () => {
  it('verde: deja pasar una línea de asistente con tool_use (string y Buffer)', () => {
    expect(lineaInteresaResumen(LINEAS[2])).toBe(true);
    expect(lineaInteresaResumen(Buffer.from(LINEAS[2]))).toBe(true);
  });
  it('rojo: no deja pasar un tool_result ni un texto de asistente sin herramientas', () => {
    expect(lineaInteresaResumen(LINEAS[3])).toBe(false);
    expect(lineaInteresaResumen(tool('a9', '2026-10-09T13:00:00.000Z', [{ type: 'text', text: 'listo' }]))).toBe(false);
  });
  it('lineasInteresantes acepta un prefiltro propio y conserva el de siempre', async () => {
    const con = []; for await (const l of lineasInteresantes(ruta, { lineas: 0 }, lineaInteresaResumen)) con.push(l);
    const sin = []; for await (const l of lineasInteresantes(ruta)) sin.push(l);
    expect(con.length).toBe(7); // 2 user + 5 assistant con tool_use (la repetida pasa: el dedup es después)
    expect(sin.length).toBe(3); // 2 user + la carga de Skill
    expect(sin.every((l) => lineaInteresa(l))).toBe(true);
  });
});

describe('eventosDeHerramienta', () => {
  it('verde: Edit/Write dan archivo, Bash con git commit da git', () => {
    expect(eventosDeHerramienta(JSON.parse(LINEAS[2]))).toEqual([expect.objectContaining({ tipo: 'archivo', herramienta: 'Edit', ruta: `${CWD}\\scripts\\_resumenSesion.mjs`, id: 't2' })]);
    expect(eventosDeHerramienta(JSON.parse(LINEAS[6]))[0]).toMatchObject({ tipo: 'git', comando: 'git commit -m "feat(HOY-18d): resumen de sesión"' });
  });
  it('rojo: Read, Bash sin commit, sidechain o un turno de usuario no dan nada', () => {
    expect(eventosDeHerramienta(JSON.parse(tool('x', null, [uso('t', 'Read', { file_path: 'C:/x' })])))).toEqual([]);
    expect(eventosDeHerramienta(JSON.parse(tool('x', null, [uso('t', 'Bash', { command: 'git log --oneline' })])))).toEqual([]);
    expect(eventosDeHerramienta({ ...JSON.parse(LINEAS[2]), isSidechain: true })).toEqual([]);
    expect(eventosDeHerramienta(JSON.parse(LINEAS[0]))).toEqual([]);
  });
});

describe('leerSesion', () => {
  it('verde: una pasada saca pedidos, cargas y eventos, sin contar dos veces la línea repetida', async () => {
    const s = await leerSesion(ruta, { noEsDeFak: NO_ES_DE_FAK });
    expect(s.sesion).toBe(SID);
    expect(s.cwd).toBe(CWD);
    expect(s.mensajes.map((m) => m.texto)).toEqual(['Armá la página de la sesión']);
    expect(s.cargas.map((c) => c.nombre)).toEqual(['codigo-madre']);
    expect(s.eventos.map((e) => e.tipo)).toEqual(['archivo', 'archivo', 'git']);
  });
  it('rojo: el botón "Intentar nuevamente" no entra como pedido de Fak', async () => {
    const s = await leerSesion(ruta, { noEsDeFak: NO_ES_DE_FAK });
    expect(s.mensajes.some((m) => /Intentar/.test(m.texto))).toBe(false);
  });
});

describe('git log', () => {
  it('verde: parsea hash, fecha, asunto y archivos; los argumentos acotan el día', () => {
    const c = parsearGitLog(GIT_MAL);
    expect(c.map((x) => x.hash)).toEqual(['abc1234', 'def5678']);
    expect(c[0]).toMatchObject({ asunto: 'feat(HOY-18d): resumen de sesión', archivos: ['scripts/_resumenSesion.mjs', 'tests/resumenSesion.test.mjs'] });
    const args = argumentosGitLog('2026-10-09');
    expect(args).toContain('--since=2026-10-09 00:00:00');
    expect(args).toContain('--until=2026-10-09 23:59:59');
    expect(args).toContain('--name-only');
  });
  it('rojo: salida vacía da cero commits; una fecha mal formada tira', () => {
    expect(parsearGitLog('')).toEqual([]);
    expect(parsearGitLog('\n\n')).toEqual([]);
    expect(() => argumentosGitLog('ayer')).toThrow(/YYYY-MM-DD/);
  });
});

describe('rutas y cotejo (el control de la fila)', () => {
  it('verde: las rutas absolutas de Windows quedan como las escribe git y el cotejo da OK', () => {
    expect(relativaA(`${CWD}\\scripts\\_x.mjs`, CWD)).toBe('scripts/_x.mjs');
    expect(relativaA('C:/Dev/BarackMercosul/tests/a.mjs', CWD)).toBe('tests/a.mjs');
    const r = cotejarConGit(['scripts/_resumenSesion.mjs', 'tests/resumenSesion.test.mjs'], parsearGitLog(GIT_OK));
    expect(r.ok).toBe(true);
    expect(r.soloEnSesion).toEqual([]);
  });
  it('rojo: un commit con un archivo que la sesión no tocó falla y lo nombra', () => {
    const r = cotejarConGit(['scripts/_resumenSesion.mjs', 'tests/resumenSesion.test.mjs', 'docs/notas.md'], parsearGitLog(GIT_MAL));
    expect(r.ok).toBe(false);
    expect(r.commits[1].faltan).toEqual(['docs/COLA_CAMBIOS_CODIGO.md']);
    expect(r.soloEnSesion).toEqual(['docs/notas.md']);
    expect(relativaA('D:/otro/x.txt', CWD)).toBe('D:/otro/x.txt'); // afuera del repo: queda como vino, se ve
  });
});

describe('página y elección de sesión', () => {
  it('verde: la página lista pedido, archivos, commit y cotejo en orden de hora', async () => {
    const s = await leerSesion(ruta, { noEsDeFak: NO_ES_DE_FAK });
    const r = resumirSesion(s, { ejecutar: () => GIT_OK, tz: 'UTC' });
    expect(r.dia).toBe('2026-10-09');
    expect(r.cotejo.ok).toBe(true);
    expect(r.pagina).toContain('| 13:05 | Fak pidió | Armá la página de la sesión |');
    expect(r.pagina).toContain('| 13:07 | Edit | `scripts/_resumenSesion.mjs` |');
    expect(r.pagina).toContain('| 13:30 | Commit | abc1234 feat(HOY-18d): resumen de sesión |');
    expect(r.pagina).toContain('✔ Los 1 commit(s)');
    expect(r.pagina.indexOf('Fak pidió')).toBeLessThan(r.pagina.indexOf('| Commit |'));
  });
  it('rojo: sin pedidos ni archivos la página lo dice; sin fechas tira; el commit ajeno se marca', async () => {
    const vacia = { sesion: 'vacia', ruta: 'x.jsonl', cwd: CWD, mensajes: [], cargas: [], eventos: [] };
    const p = armarPagina({ ...vacia, dia: '2026-10-09', commits: [], tz: 'UTC' });
    expect(p.pagina).toContain('(sin mensajes de Fak ni archivos tocados)');
    expect(() => resumirSesion(vacia, { ejecutar: () => '' })).toThrow(/no tiene fechas/);
    const s = await leerSesion(ruta, { noEsDeFak: NO_ES_DE_FAK });
    const r = resumirSesion(s, { ejecutar: () => GIT_MAL, tz: 'UTC' });
    expect(r.cotejo.ok).toBe(false);
    expect(r.pagina).toContain('✘ 1 commit(s) con archivos que esta sesión no tocó');
    expect(r.pagina).toContain('⚠ archivos que esta sesión no tocó: docs/COLA_CAMBIOS_CODIGO.md');
  });
  it('elige la sesión con más pedidos del día, o por prefijo; ninguna si el día no tiene', async () => {
    const s = await leerSesion(ruta, { noEsDeFak: NO_ES_DE_FAK });
    const otra = { ...s, sesion: 'zzz', mensajes: [] };
    expect(elegirSesion([otra, s], { dia: '2026-10-09', tz: 'UTC' })).toBe(s);
    expect(elegirSesion([otra, s], { sesion: 'zzz' })).toBe(otra);
    expect(elegirSesion([otra, s], { dia: '2026-10-08', tz: 'UTC' })).toBeNull();
    expect(diaLocal('2026-10-09T02:30:00.000Z', 'America/Argentina/Buenos_Aires')).toBe('2026-10-08'); // la noche cae en el día de acá
  });
});

describe('main (CLI)', () => {
  const consola = { log() {}, error() {} };
  it('verde: --archivo escribe la página y sale 0', async () => {
    const salida = path.join(dir, 'pagina.md');
    const c = await main(['--archivo', ruta, '--salida', salida, '--cotejar'], { ejecutar: () => GIT_OK, tz: 'UTC', consola, noEsDeFak: NO_ES_DE_FAK });
    expect(c).toBe(0);
    expect(fs.readFileSync(salida, 'utf8')).toContain('# Sesión `abc12345-');
  });
  it('rojo: --cotejar sale 2 cuando git tiene un archivo que la sesión no tocó; un flag desconocido tira', async () => {
    const salida = path.join(dir, 'pagina2.md');
    const c = await main(['--archivo', ruta, '--salida', salida, '--cotejar'], { ejecutar: () => GIT_MAL, tz: 'UTC', consola, noEsDeFak: NO_ES_DE_FAK });
    expect(c).toBe(2);
    await expect(main(['--loquesea'], { consola, noEsDeFak: NO_ES_DE_FAK })).rejects.toThrow(/desconocido/);
  });
});

describe('la página para leer (HTML)', () => {
  const consola = { log() {}, error() {} };
  const base = { sesion: 'abc12345-0000', cwd: CWD, dia: '2026-10-09', tz: 'UTC', cargas: [] };
  const commit = (hash, fecha, asunto, archivos) => ({ hash, fecha, asunto, archivos });

  it('verde: lo pedido y lo guardado en orden de hora, los números arriba y los archivos por carpeta', async () => {
    const s = await leerSesion(ruta, { noEsDeFak: NO_ES_DE_FAK });
    const html = resumirSesion(s, { ejecutar: () => GIT_OK, tz: 'UTC' }).html();
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<h1>Sesión del 09/10/2026</h1>');
    expect(html).toContain('<b>1</b><span>pedido tuyo</span>');
    expect(html).toContain('<b>2</b><span>archivos tocados</span>');
    expect(html).toContain('Armá la página de la sesión');
    expect(html.indexOf('>Pediste<')).toBeLessThan(html.indexOf('>Quedó guardado<'));
    expect(html).toContain('<p class="bien">Sí: el cambio guardado tiene todos sus archivos');
    expect(html).toContain('<summary>scripts · 1 archivo</summary>');
    expect(html).not.toMatch(/https?:\/\//);   // un solo archivo, sin nada de afuera
    expect(html).not.toContain('Intentar nuevamente');   // el botón de la app no es un pedido
  });

  it('rojo: lo que se escribe en un pedido no se vuelve HTML, y la barra vertical va pelada', () => {
    const html = armarHtml({ ...base, mensajes: [{ fecha: '2026-10-09T13:00:00.000Z', texto: 'poné <b>esto</b> & "eso" | lo otro <script>alert(1)</script>' }], eventos: [], commits: [] });
    expect(html).toContain('poné &lt;b&gt;esto&lt;/b&gt; &amp; &quot;eso&quot; | lo otro &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('Ese día no se guardó ningún cambio');
  });

  it('una sesión que cruza la medianoche dice cuándo cambia el día', () => {
    const html = armarHtml({ ...base, eventos: [], commits: [], mensajes: [
      { fecha: '2026-10-09T23:50:00.000Z', texto: 'antes de las doce' }, { fecha: '2026-10-10T00:10:00.000Z', texto: 'después de las doce' }] });
    const donde = ['<strong>09/10/2026</strong>', 'antes de las doce', '<strong>10/10/2026</strong>', 'después de las doce'].map((t) => html.indexOf(t));
    expect(donde[0]).toBeGreaterThan(0);
    expect(donde).toEqual(donde.slice().sort((x, y) => x - y));
  });

  it('los cambios guardados con archivos que la sesión no tocó se avisan, hasta seis y «y N más»', () => {
    const commits = Array.from({ length: 9 }, (_, i) => commit(`h${i}`, `2026-10-09T1${i}:00:00.000Z`, `cambio ${i}`, [`otra/carpeta/a${i}.md`]));
    const html = armarHtml({ ...base, mensajes: [], eventos: [], commits });
    expect(html).toContain('9 cambios guardados traen archivos que esta sesión no tocó');
    expect(html).toContain('· cambio 5</li>');
    expect(html).not.toContain('· cambio 6</li>');
    expect(html).toContain('y 3 más');
  });

  it('sin nada: la página igual se arma y lo dice', () => {
    const html = armarHtml({ ...base, mensajes: [], eventos: [], commits: [] });
    expect(html).toContain('No hay pedidos ni cambios guardados ese día.');
    expect(html).toContain('<b>0</b><span>pedidos tuyos</span>');
  });

  it('carpetaDe agrupa a dos niveles', () => {
    expect(carpetaDe('scripts/_lib/x.mjs')).toBe('scripts/_lib');
    expect(carpetaDe('docs/a.md')).toBe('docs');
    expect(carpetaDe('package.json')).toBe('(raíz)');
    expect(carpetaDe('a\\b\\c\\d.txt')).toBe('a/b');
  });

  it('main: --salida-html escribe la página al lado del Markdown; sin --html no la escribe', async () => {
    const md = path.join(dir, 'p3.md');
    const html = path.join(dir, 'p3.html');
    expect(await main(['--archivo', ruta, '--salida', md], { ejecutar: () => GIT_OK, tz: 'UTC', consola, noEsDeFak: NO_ES_DE_FAK })).toBe(0);
    expect(fs.existsSync(html)).toBe(false);
    expect(await main(['--archivo', ruta, '--salida', md, '--salida-html', html], { ejecutar: () => GIT_OK, tz: 'UTC', consola, noEsDeFak: NO_ES_DE_FAK })).toBe(0);
    expect(fs.readFileSync(html, 'utf8')).toContain('<h1>Sesión del 09/10/2026</h1>');
  });
});
