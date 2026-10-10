// novedadesClaude: leer sin sesion lo que publican las cuentas que Fak sigue sobre Claude Code (04/10/2026).
// Se prueba lo puro: la busqueda que se arma, que posteos quedan, las versiones nuevas del registro de cambios y el listado.
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import * as N from '../../scripts/_lib/novedadesClaude.mjs';

const post = (id, extra = {}) => ({ type: 'status', id, url: `https://x.com/trq212/status/${id}`, text: `texto ${id}`, author: { screen_name: 'trq212' }, likes: 10, created_timestamp: 1791013798, ...extra });

describe('novedadesClaude — la busqueda', () => {
  it('arma la direccion con la cuenta, la fecha y la pagina; y frena una cuenta o una fecha con otra forma', () => {
    const u = N.urlBusqueda('https://api.fxtwitter.com/2/search', 'trq212', '2026-09-28');
    expect(u).toBe('https://api.fxtwitter.com/2/search?q=from%3Atrq212%20since%3A2026-09-28&feed=latest');
    expect(N.urlBusqueda('https://x', 'ClaudeDevs', '2026-10-01', 'AB/c=')).toContain('&cursor=AB%2Fc%3D');
    expect(() => N.urlBusqueda('https://x', 'trq212 OR from:otro', '2026-09-28')).toThrow();
    expect(() => N.urlBusqueda('https://x', 'trq212', '28/09/2026')).toThrow();
  });
});

describe('novedadesClaude — que posteos quedan', () => {
  it('quedan: el posteo, el hilo propio y la respuesta a otro con muchos me gusta', () => {
    const { items } = N.filtrar([
      post('300'),
      post('301', { replying_to: { screen_name: 'trq212' } }),
      post('302', { replying_to: { screen_name: 'otro' }, likes: 120 }),
    ], 'trq212', { minRespuesta: 50 });
    expect(items.map((i) => `${i.id}:${i.tipo}`)).toEqual(['302:respuesta', '301:hilo', '300:posteo']);   // del mas nuevo al mas viejo
    expect(items[0].a_quien).toBe('otro');
  });

  it('afuera: lo de otro autor, la respuesta suelta, lo ya visto y lo que no tiene forma de posteo', () => {
    const { items, fuera } = N.filtrar([
      post('400', { author: { screen_name: 'karpathy' } }),
      post('401', { replying_to: { screen_name: 'otro' }, likes: 3 }),
      post('200'),
      { type: 'otra_cosa' },
      post('402'),
    ], 'TRQ212', { minRespuesta: 50, ultimoId: '250' });
    expect(items.map((i) => i.id)).toEqual(['402']);
    expect(fuera).toEqual({ otro_autor: 1, ya_visto: 1, respuesta_suelta: 1, sin_forma: 1 });
  });

  it('los numeros de posteo se comparan enteros (no entran en un numero comun)', () => {
    expect(N.idMasNuevo('2106568079778230655', '2106568079778230654')).toBe(true);
    expect(N.idMasNuevo('2106568079778230654', '2106568079778230655')).toBe(false);
    expect(N.idMasNuevo('999', '1000')).toBe(false);
  });

  it('guarda la cita, los medios y la fecha', () => {
    const { items } = N.filtrar([post('500', { quote: { author: { screen_name: 'ClaudeDevs' }, text: 'anuncio', url: 'https://x.com/ClaudeDevs/status/1' }, media: { all: [{ type: 'video' }, { type: 'video' }] }, is_note_tweet: true })], 'trq212');
    expect(items[0]).toMatchObject({ cita: { autor: 'ClaudeDevs', texto: 'anuncio' }, medios: ['video'], largo: true, fecha: '2026-10-03T07:49:58.000Z' });
  });
});

describe('novedadesClaude — el registro de cambios', () => {
  const REG = '# Changelog\n\n## 2.1.289\n\n- Fixed A\n- Fixed B\n\n## 2.1.288\n\n- Added C\n\n## 2.1.9\n\n- Viejo\n';
  it('compara versiones numero por numero (2.1.289 es mas nueva que 2.1.9)', () => {
    expect(N.compararVersion('2.1.289', '2.1.9')).toBe(1);
    expect(N.compararVersion('2.1.9', '2.1.289')).toBe(-1);
    expect(N.compararVersion('2.1.283', '2.1.283')).toBe(0);
  });
  it('devuelve solo las versiones mas nuevas que la ultima vista; la primera vez, las mas nuevas hasta el tope', () => {
    expect(N.versionesNuevas(REG, '2.1.288').map((v) => v.version)).toEqual(['2.1.289']);
    expect(N.versionesNuevas(REG, '2.1.289')).toEqual([]);
    expect(N.versionesNuevas(REG, null, { primeraVez: 2 }).map((v) => v.version)).toEqual(['2.1.289', '2.1.288']);
    expect(N.versionesNuevas(REG, '2.1.9')[0].cambios).toEqual(['Fixed A', 'Fixed B']);
  });
});

describe('novedadesClaude — el aviso del arranque', () => {
  const hoy = new Date('2026-10-12T12:00:00Z');
  it('avisa si nunca se leyo o si paso una semana; se calla si se leyo hace menos', () => {
    expect(N.avisoHook(null, hoy)).toContain('Todavia no se leyo nunca');
    expect(N.avisoHook({ ultima_corrida: '2026-10-04T14:30:50.120Z' }, hoy)).toContain('Pasaron 7 dias');
    expect(N.avisoHook({ ultima_corrida: '2026-10-04T14:30:50.120Z' }, hoy)).toContain('El decide que se implementa');
    expect(N.avisoHook({ ultima_corrida: '2026-10-06T14:30:50.120Z' }, hoy)).toBe('');
    expect(N.avisoHook({ ultima_corrida: 'roto' }, hoy)).toContain('Todavia no se leyo nunca');
  });
  it('--hook no sale a internet ni guarda: con una carpeta vacia avisa; exit 0 siempre', () => {
    const r = spawnSync(process.execPath, [path.join(process.cwd(), 'scripts', '_novedadesClaude.mjs'), '--hook'], { encoding: 'utf8', env: { ...process.env, BARACK_NOVEDADES_DIR: path.join(process.cwd(), 'no-existe-esta-carpeta') } });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('[NOVEDADES DE CLAUDE]');
  });
});

describe('novedadesClaude — hasta donde queda leido (auditoria del 04/10)', () => {
  const ahora = new Date('2026-10-12T12:00:00Z');
  const previo = { cuentas: { trq212: { ultimo_id: '100', leido_hasta: '2026-09-01T00:00:00.000Z' } }, registro: { ultima_version: '2.1.288' }, ultima_corrida: '2026-09-01T00:00:00.000Z' };
  const leida = (usuario, id, extra = {}) => ({ usuario, items: id ? [{ id }] : [], ...extra });

  it('una corrida normal y entera avanza las cuentas, la version y la fecha de la ultima lectura', () => {
    const n = N.estadoNuevo(previo, { porCuenta: [leida('trq212', '300'), leida('ClaudeDevs', '50')], versiones: [{ version: '2.1.289' }], ahora });
    expect(n.cuentas.trq212).toEqual({ ultimo_id: '300', leido_hasta: ahora.toISOString() });
    expect(n.cuentas.ClaudeDevs.ultimo_id).toBe('50');
    expect(n.registro.ultima_version).toBe('2.1.289');
    expect(n.ultima_corrida).toBe(ahora.toISOString());
  });

  it('con rango pedido (--desde, --dias) es una consulta: no mueve las cuentas ni la fecha', () => {
    const n = N.estadoNuevo(previo, { porCuenta: [leida('trq212', '300')], pidioRango: true, ahora });
    expect(n.cuentas.trq212).toEqual(previo.cuentas.trq212);
    expect(n.ultima_corrida).toBe(previo.ultima_corrida);
  });

  it('una cuenta con error o que llego al tope de paginas no avanza, y la fecha de la ultima lectura tampoco', () => {
    const n = N.estadoNuevo(previo, { porCuenta: [leida('trq212', '300', { tope: true }), leida('ClaudeDevs', null, { error: 'respondio 500' }), leida('lydiahallie', '7')], ahora });
    expect(n.cuentas.trq212).toEqual(previo.cuentas.trq212);
    expect(n.cuentas.ClaudeDevs).toBeUndefined();
    expect(n.cuentas.lydiahallie.ultimo_id).toBe('7');
    expect(n.ultima_corrida).toBe(previo.ultima_corrida);
    // el registro de cambios caido tampoco deja mover la fecha, ni una corrida de una sola cuenta
    expect(N.estadoNuevo(previo, { porCuenta: [leida('trq212', '300')], errorRegistro: 'respondio 500', ahora }).ultima_corrida).toBe(previo.ultima_corrida);
    expect(N.estadoNuevo(previo, { porCuenta: [leida('trq212', '300')], unaSolaCuenta: true, ahora }).ultima_corrida).toBe(previo.ultima_corrida);
  });

  it('nunca retrocede y aguanta un estado roto', () => {
    expect(N.estadoNuevo(previo, { porCuenta: [leida('trq212', '90')], ahora }).cuentas.trq212.ultimo_id).toBe('100');
    for (const roto of [null, 'x', { cuentas: null, registro: 7 }]) {
      const n = N.estadoNuevo(roto, { porCuenta: [leida('trq212', '5')], ahora });
      expect(n.cuentas.trq212.ultimo_id).toBe('5');
      expect(n.registro).toEqual({});
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cola H21 (09/10/2026): leer por ventanas de fechas y no tirar lo leido si una pagina falla.
// Cola H20 (Fak, 08/10/2026: "los links que pasa Claude Devs"): seguir los links de cada posteo.
// La red va INYECTADA: aca `traer` devuelve respuestas guardadas, nunca sale a internet.
// ─────────────────────────────────────────────────────────────────────────────

describe('novedadesClaude — ventanas de fechas (H21)', () => {
  it('la busqueda con `hasta` agrega until: y frena una fecha con otra forma', () => {
    expect(N.urlBusqueda('https://x', 'alexalbert__', '2026-09-01', null, '2026-09-08')).toBe('https://x?q=from%3Aalexalbert__%20since%3A2026-09-01%20until%3A2026-09-08&feed=latest');
    expect(() => N.urlBusqueda('https://x', 'trq212', '2026-09-01', null, '08/09')).toThrow();
  });
  it('un rango corto (la lectura de todos los dias) da UNA ventana sin until: la consulta de siempre', () => {
    expect(N.ventanas('2026-10-09', '2026-10-10', 7)).toEqual([{ desde: '2026-10-09', hasta: null }]);
    expect(N.ventanas('2026-10-04', '2026-10-10', 7)).toEqual([{ desde: '2026-10-04', hasta: null }]);
    expect(N.ventanas('2026-10-10', '2026-10-10', 7)).toEqual([{ desde: '2026-10-10', hasta: null }]);
  });
  it('un rango largo se parte de la mas nueva a la mas vieja, sin huecos ni dias repetidos', () => {
    const v = N.ventanas('2026-09-10', '2026-10-10', 7);
    expect(v[0]).toEqual({ desde: '2026-10-04', hasta: null });
    expect(v[1]).toEqual({ desde: '2026-09-27', hasta: '2026-10-04' });
    expect(v.at(-1)).toEqual({ desde: '2026-09-10', hasta: '2026-09-13' });
    for (let i = 1; i < v.length; i++) expect(v[i].hasta).toBe(v[i - 1].desde);   // until no incluye ese dia: no se pisa ni queda hueco
    expect(v.length).toBe(5);
  });
  it('una fecha de comienzo posterior a hoy da una sola ventana, y una fecha rota frena', () => {
    expect(N.ventanas('2026-10-12', '2026-10-10', 7)).toEqual([{ desde: '2026-10-12', hasta: null }]);
    expect(() => N.ventanas('ayer', '2026-10-10')).toThrow();
  });
});

describe('novedadesClaude — leerCuenta con respuestas guardadas (H21)', () => {
  const pagina = (ids, bottom = null) => ({ code: 200, results: ids.map((id) => post(id)), cursor: bottom ? { bottom } : {} });
  const base = 'https://b';
  /** Un `traer` de mentira: contesta segun la ventana (el `until` de la direccion) y el cursor. Anota lo que le pidieron. */
  const servidor = (tabla) => { const pedidos = []; const traer = async (url) => { pedidos.push(decodeURIComponent(url)); const k = Object.keys(tabla).find((x) => decodeURIComponent(url).includes(x)); const r = tabla[k]; if (r instanceof Error) throw r; if (r === undefined) throw new Error(`respuesta no guardada para ${url}`); return typeof r === 'function' ? r(url) : r; }; return { traer, pedidos }; };

  it('lee todas las ventanas y todas las paginas; un posteo que cae en dos ventanas entra una vez', async () => {
    const s = servidor({
      'since:2026-10-04&feed=latest&cursor=C1': pagina(['502'], null),
      'since:2026-10-04&feed': pagina(['504', '503'], 'C1'),
      'since:2026-09-27 until:2026-10-04': pagina(['503', '400']),
    });
    const r = await N.leerCuenta({ traer: s.traer, base, usuario: 'trq212', desde: '2026-09-27', hoy: '2026-10-10', ventanaDias: 7 });
    expect(r.todos.map((x) => x.id)).toEqual(['504', '503', '502', '400']);
    expect(r).toMatchObject({ tope: false, parcial: false, error: null });
    expect(s.pedidos.length).toBe(3);
  });

  it('ROJO de antes: una pagina que falla A MITAD no tira lo leido; vuelve parcial con el error y donde fue', async () => {
    const s = servidor({
      'since:2026-10-04&feed': pagina(['504', '503']),
      'since:2026-09-27 until:2026-10-04': new Error('respondio 404'),
    });
    const r = await N.leerCuenta({ traer: s.traer, base, usuario: 'trq212', desde: '2026-09-27', hoy: '2026-10-10', ventanaDias: 7 });
    expect(r.todos.map((x) => x.id)).toEqual(['504', '503']);
    expect(r.parcial).toBe(true);
    expect(r.error).toMatch(/respondio 404 \(ventana desde 2026-09-27 hasta 2026-10-04, pagina 1\)/);
  });

  it('si falla la PRIMERA pagina no hay nada que guardar: levanta, como antes', async () => {
    const s = servidor({ 'since:2026-10-09': new Error('respondio 500') });
    await expect(N.leerCuenta({ traer: s.traer, base, usuario: 'trq212', desde: '2026-10-09', hoy: '2026-10-10' })).rejects.toThrow('respondio 500');
    const raro = servidor({ 'since:2026-10-09': { code: 404, message: 'no' } });
    await expect(N.leerCuenta({ traer: raro.traer, base, usuario: 'trq212', desde: '2026-10-09', hoy: '2026-10-10' })).rejects.toThrow(/no devolvio una lista \(codigo 404\)/);
  });

  it('auditor R10: la respuesta de HOY del servicio ({code:404, results:[]}) nunca se toma por una pagina vacia', async () => {
    const caido = { code: 404, results: [], cursor: { top: null, bottom: null } };
    // en la primera pagina: error (la cuenta no avanza, no hay nada que guardar)
    const s1 = servidor({ 'since:2026-10-09': caido });
    await expect(N.leerCuenta({ traer: s1.traer, base, usuario: 'trq212', desde: '2026-10-09', hoy: '2026-10-10' })).rejects.toThrow(/codigo 404/);
    // en una ventana vieja, despues de haber leido la nueva: parcial, con lo leido
    const s2 = servidor({ 'since:2026-10-04&feed': pagina(['504']), 'since:2026-09-27 until:2026-10-04': caido });
    const r = await N.leerCuenta({ traer: s2.traer, base, usuario: 'trq212', desde: '2026-09-27', hoy: '2026-10-10', ventanaDias: 7 });
    expect(r).toMatchObject({ parcial: true });
    expect(r.todos.map((x) => x.id)).toEqual(['504']);
    expect(r.error).toMatch(/codigo 404/);
  });

  it('auditor R6: un rango descomunal lee solo las ventanas mas nuevas y lo avisa como tope', async () => {
    const s = servidor({ 'since:': pagina([]) });
    const r = await N.leerCuenta({ traer: s.traer, base, usuario: 'trq212', desde: '2006-01-01', hoy: '2026-10-10', ventanaDias: 7, ventanasMaximo: 4 });
    expect(s.pedidos.length).toBe(4);
    expect(r.tope).toBe(true);
    const corto = servidor({ 'since:': pagina([]) });
    expect((await N.leerCuenta({ traer: corto.traer, base, usuario: 'trq212', desde: '2026-09-20', hoy: '2026-10-10', ventanaDias: 7, ventanasMaximo: 4 })).tope).toBe(false);
  });

  it('el tope de paginas vale por ventana y se avisa; una pagina que repite el cursor corta', async () => {
    let n = 0;
    const sinFin = servidor({ 'since:2026-10-09': () => { n++; return pagina([String(900 + n)], `cursor${n}`); } });
    const r = await N.leerCuenta({ traer: sinFin.traer, base, usuario: 'trq212', desde: '2026-10-09', hoy: '2026-10-10', paginasMaximo: 3 });
    expect(r.tope).toBe(true);
    expect(sinFin.pedidos.length).toBe(3);
    const repite = servidor({ 'since:2026-10-09': pagina(['1'], 'IGUAL') });
    const r2 = await N.leerCuenta({ traer: repite.traer, base, usuario: 'trq212', desde: '2026-10-09', hoy: '2026-10-10', paginasMaximo: 5 });
    expect(r2.tope).toBe(false);
    expect(repite.pedidos.length).toBe(2);
  });

  it('una cuenta leida a medias no avanza y la fecha de la ultima lectura tampoco; el listado lo dice y muestra lo leido', () => {
    const ahora = new Date('2026-10-12T12:00:00Z');
    const previo = { cuentas: { trq212: { ultimo_id: '100', leido_hasta: '2026-09-01T00:00:00.000Z' } }, registro: {}, ultima_corrida: '2026-09-01T00:00:00.000Z' };
    const { items, fuera } = N.filtrar([post('600')], 'trq212');
    const c = { usuario: 'trq212', quien: 'Thariq', desde: '2026-09-27', items, fuera, parcial: true, error: 'respondio 404 (ventana desde 2026-09-27 hasta 2026-10-04, pagina 1)' };
    const n = N.estadoNuevo(previo, { porCuenta: [c], ahora });
    expect(n.cuentas.trq212).toEqual(previo.cuentas.trq212);
    expect(n.ultima_corrida).toBe(previo.ultima_corrida);
    const t = N.listado({ cuando: 'x', desde: '2026-09-27', porCuenta: [c] });
    expect(t).toContain('se leyó A MEDIAS (respondio 404');
    expect(t).toContain('https://x.com/trq212/status/600');
    expect(t).not.toContain('No se pudo leer: respondio 404');
    // `parcial` alcanza solo, sin `error`, para que la cuenta no avance (auditor R10: ese control no tenia test)
    const sinError = N.estadoNuevo(previo, { porCuenta: [{ usuario: 'trq212', items: [{ id: '600' }], parcial: true }], ahora });
    expect(sinError.cuentas.trq212).toEqual(previo.cuentas.trq212);
    expect(sinError.ultima_corrida).toBe(previo.ultima_corrida);
    // y el tope de paginas se dice en el listado, no solo por consola (auditor R4)
    expect(N.listado({ cuando: 'x', desde: 'x', porCuenta: [{ usuario: 'trq212', quien: 'T', items, fuera, tope: true }] })).toContain('OJO: llegó al tope de páginas y quedaba más');
  });
});

describe('novedadesClaude — los links de cada posteo (H20)', () => {
  // forma real de un posteo de @ClaudeDevs (crudo del 04/10/2026): el link verdadero viene en raw_text.facets
  const conLink = (id, url, extra = {}) => post(id, { text: 'Claude can now help you build evaluations https://t.co/PgKFC2DWth', raw_text: { text: 'x', facets: [{ type: 'url', original: 'https://t.co/PgKFC2DWth', replacement: url, display: 'claude.dev/blog/automatin…' }, { type: 'mention', original: '@x' }] }, ...extra });
  const DOMINIOS = ['claude.dev', 'claude.com', 'anthropic.com'];
  const RELLENO = `<p>${'Texto del articulo para que tenga el largo de una pagina de verdad. '.repeat(4)}</p>`;
  const HTML = `<html><head><title>Automating eval design &amp; hillclimbing</title><style>.a{color:red}</style></head><body><nav>Menu Blog Docs</nav><main><h1>Automating eval design</h1><p>Claude can now help you build <b>evaluations</b>.</p><script>alert(1)</script><ul><li>Primero</li><li>Segundo &#8212; fin</li></ul>${RELLENO}</main><footer>Pie de pagina</footer></body></html>`;
  const ARCH = (url) => N.nombreArticulo(url);

  it('linksDe: toma la direccion real, saca el #fragmento, no repite, y deja afuera lo que vuelve a X', () => {
    expect(N.linksDe(conLink('1', 'https://claude.dev/blog/automating-eval-design-and-hillclimbing/'))).toEqual(['https://claude.dev/blog/automating-eval-design-and-hillclimbing/']);
    const varios = post('2', { raw_text: { facets: [
      { type: 'url', replacement: 'https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback#how-refusals-are-billed' },
      { type: 'url', replacement: 'https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback' },
      { type: 'url', replacement: 'https://x.com/i/broadcasts/1YGNrbqpRvNGw' },
      { type: 'url', replacement: 'javascript:alert(1)' },
      { type: 'url', replacement: 'no es una direccion' },
    ] }, card: { url: 'https://claude.com/blog/claude-code-mods' } });
    expect(N.linksDe(varios)).toEqual(['https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback', 'https://claude.com/blog/claude-code-mods']);
    expect(N.linksDe(post('3'))).toEqual([]);
    expect(N.linksDe(null)).toEqual([]);
  });

  it('seSigue: solo https de la lista y sus subdominios; un dominio que solo termina parecido no', () => {
    expect(N.seSigue('https://claude.dev/blog/x', DOMINIOS)).toBe(true);
    expect(N.seSigue('https://www.anthropic.com/news/x', DOMINIOS)).toBe(true);
    expect(N.seSigue('https://docs.claude.com/en/x', DOMINIOS)).toBe(true);
    expect(N.seSigue('https://noesclaude.dev/x', DOMINIOS)).toBe(false);
    expect(N.seSigue('https://claude.dev.atacante.com/x', DOMINIOS)).toBe(false);
    expect(N.seSigue('http://claude.dev/x', DOMINIOS)).toBe(false);
    expect(N.seSigue('https://github.com/x/y', DOMINIOS)).toBe(false);
    expect(N.seSigue('basura', DOMINIOS)).toBe(false);
  });

  it('nombreArticulo: un nombre de archivo sin barras, puntos ni nada raro, y estable', () => {
    expect(N.nombreArticulo('https://claude.dev/blog/getting-started-with-claude-code-mods/')).toMatch(/^claude-dev-blog-getting-started-with-claude-code-mods-[0-9a-f]{8}\.md$/);
    expect(N.nombreArticulo('https://www.anthropic.com/news/x?a=1&b=../../etc')).toMatch(/^anthropic-com-news-x-a-1-b-etc-[0-9a-f]{8}\.md$/);
    expect(N.nombreArticulo(`https://claude.com/${'largo/'.repeat(60)}`).length).toBeLessThanOrEqual(123);
    expect(N.nombreArticulo('https://claude.com/')).toMatch(/^claude-com-[0-9a-f]{8}\.md$/);
    expect(N.nombreArticulo('https://claude.com/blog/x')).toBe(N.nombreArticulo('https://claude.com/blog/x'));
    for (const raro of ['https://claude.com/con', 'https://claude.com/..%2f..%2fsecreto', 'https://claude.com/a\\b']) expect(N.nombreArticulo(raro)).toMatch(/^[a-z0-9-]+\.md$/);
  });

  it('auditor T3: dos direcciones distintas que antes daban el mismo nombre ya no se pisan', () => {
    expect(N.nombreArticulo('https://claude.com/blog/a-b')).not.toBe(N.nombreArticulo('https://claude.com/blog/a/b'));
    expect(N.nombreArticulo('https://claude.com/blog/a?x=1')).not.toBe(N.nombreArticulo('https://claude.com/blog/a/x/1'));
  });

  it('auditor T2: una pagina sin cuerpo (solo su <title>, o armada con JavaScript) da texto vacio, no su titulo', () => {
    expect(N.textoDeHtml('<html><head><title>Claude</title></head><body><div id="app"></div><script>app()</script></body></html>')).toEqual({ titulo: 'Claude', texto: '', cortado: false });
    // el <title> de un dibujo SVG del cuerpo no es el de la pagina, y un titulo enorme se corta
    expect(N.textoDeHtml('<html><head><title>La pagina</title></head><body><svg><title>icono</title></svg><p>hola</p></body></html>')).toMatchObject({ titulo: 'La pagina', texto: 'hola' });
    expect(N.textoDeHtml(`<head><title>${'t'.repeat(5000)}</title></head><body>x</body>`).titulo.length).toBe(200);
    // un <article> adentro de otro no corta el texto en el primer cierre
    expect(N.textoDeHtml('<body><article><p>uno</p><article><p>dos</p></article><p>tres</p></article></body>').texto).toBe('uno\ndos\ntres');
  });

  it('auditor R3: HTML roto o armado a proposito no cuelga el lector (aperturas sin cierre, 1 MB)', () => {
    const t0 = Date.now();
    for (const roto of ['<script>'.repeat(120000), '<!--'.repeat(250000), '<'.repeat(1000000), '<title>'.repeat(140000), '<article>'.repeat(110000), `<main>${'<nav>x'.repeat(160000)}`]) {
      expect(typeof N.textoDeHtml(roto).texto).toBe('string');
    }
    expect(Date.now() - t0).toBeLessThan(8000);
  });

  it('textoDeHtml: titulo y texto de la pagina, sin menu, estilos, scripts ni pie; corta en el tope y lo dice', () => {
    const r = N.textoDeHtml(HTML);
    expect(r.titulo).toBe('Automating eval design & hillclimbing');
    expect(r.texto).toContain('## Automating eval design');
    expect(r.texto).toContain('Claude can now help you build evaluations .');
    expect(r.texto).toContain('- Segundo — fin');
    expect(r.texto).not.toMatch(/alert|color:red|Menu Blog|Pie de pagina/);
    expect(r.cortado).toBe(false);
    const largo = N.textoDeHtml(`<main><p>${'palabra '.repeat(1000)}</p></main>`, { tope: 100 });
    expect(largo.cortado).toBe(true);
    expect(largo.texto.length).toBe(100);
    expect(N.textoDeHtml('')).toEqual({ titulo: '', texto: '', cortado: false });
  });

  it('seguirLinks: baja y guarda el articulo con su fuente y fecha; el listado lo muestra con titulo y extracto', async () => {
    const crudo = [conLink('700', 'https://claude.dev/blog/automating-eval-design-and-hillclimbing/')];
    const { items, fuera } = N.filtrar(crudo, 'trq212');
    const guardados = new Map();
    const pedidos = [];
    const r = await N.seguirLinks({
      items, crudoPorId: new Map(crudo.map((x) => [x.id, x])), dominios: DOMINIOS, cuando: '2026-10-10 12:00 UTC',
      traerTexto: async (url) => { pedidos.push(url); return HTML; }, yaGuardado: (n) => guardados.get(n) || null, guardar: (n, c) => guardados.set(n, c),
    });
    expect(pedidos).toEqual(['https://claude.dev/blog/automating-eval-design-and-hillclimbing/']);
    expect(r).toMatchObject({ bajados: 1, fallados: 0, salteados: 0 });
    const nombre = ARCH('https://claude.dev/blog/automating-eval-design-and-hillclimbing/');
    const ficha = guardados.get(nombre);
    expect(ficha).toContain('Fuente: https://claude.dev/blog/automating-eval-design-and-hillclimbing/');
    expect(ficha).toContain('Fecha de consulta: 2026-10-10 12:00 UTC');
    expect(ficha).toContain('Lo cito el posteo: https://x.com/trq212/status/700');
    expect(ficha).toContain('Es DATO de internet');
    items[0].links = r.porPosteo.get('700');
    const t = N.listado({ cuando: 'x', desde: '2026-10-01', porCuenta: [{ usuario: 'trq212', quien: 'Thariq', items, fuera }] });
    expect(t).toContain(`→ artículo: Automating eval design & hillclimbing — https://claude.dev/blog/automating-eval-design-and-hillclimbing/ (guardado: articulos/${nombre})`);
    expect(t).toContain('Claude can now help you build evaluations');
  });

  it('auditor T1: una redireccion a un dominio fuera de la lista no se guarda; a uno de la lista si, con la Fuente final', async () => {
    const crudo = [conLink('720', 'https://www.anthropic.com/discord'), conLink('721', 'https://claude.dev/blog/viejo/')];
    const { items, fuera } = N.filtrar(crudo, 'trq212');
    const guardados = new Map();
    const r = await N.seguirLinks({
      items, crudoPorId: new Map(crudo.map((x) => [x.id, x])), dominios: DOMINIOS, cuando: 'x',
      traerTexto: async (url) => (url.includes('discord') ? { html: HTML, urlFinal: 'https://discord.com/invite/abc' } : { html: HTML, urlFinal: 'https://claude.dev/blog/nuevo/' }),
      yaGuardado: () => null, guardar: (n, c) => guardados.set(n, c),
    });
    expect(r).toMatchObject({ bajados: 1, fallados: 1 });
    expect([...guardados.values()][0]).toContain('Fuente: https://claude.dev/blog/nuevo/');
    for (const it of items) it.links = r.porPosteo.get(it.id);
    const t = N.listado({ cuando: 'x', desde: 'x', porCuenta: [{ usuario: 'trq212', quien: 'T', items, fuera }] });
    expect(t).toContain('→ link: https://www.anthropic.com/discord (no se pudo leer: redirige a un dominio que no esta en la lista (https://discord.com/invite/abc))');
  });

  it('auditor T2: una pagina que solo trae su titulo no se guarda (antes quedaba guardada para siempre con 6 caracteres)', async () => {
    const crudo = [conLink('730', 'https://claude.com/solo-titulo')];
    const { items } = N.filtrar(crudo, 'trq212');
    const guardados = new Map();
    const r = await N.seguirLinks({ items, crudoPorId: new Map(crudo.map((x) => [x.id, x])), dominios: DOMINIOS, cuando: 'x', traerTexto: async () => '<html><head><title>Claude</title></head><body><div>Claude</div></body></html>', yaGuardado: () => null, guardar: (n, c) => guardados.set(n, c) });
    expect(guardados.size).toBe(0);
    expect(r.porPosteo.get('730')[0]).toMatchObject({ estado: 'error' });
    expect(r.porPosteo.get('730')[0].error).toMatch(/no trajo texto para leer \(6 caracteres/);
  });

  it('auditor R1: el tope de la corrida se gasta primero en los posteos con mas me gusta, no en el orden de llegada', async () => {
    const crudo = [conLink('740', 'https://claude.dev/blog/poco/', { likes: 3 }), conLink('741', 'https://claude.dev/blog/mucho/', { likes: 9000 }), conLink('742', 'https://claude.dev/blog/medio/', { likes: 50 })];
    const { items } = N.filtrar(crudo, 'trq212');
    const pedidos = [];
    const r = await N.seguirLinks({ items, crudoPorId: new Map(crudo.map((x) => [x.id, x])), dominios: DOMINIOS, maximo: 2, cuando: 'x', traerTexto: async (url) => { pedidos.push(url); return HTML; }, yaGuardado: () => null, guardar: () => {} });
    expect(pedidos).toEqual(['https://claude.dev/blog/mucho/', 'https://claude.dev/blog/medio/']);
    expect(r.porPosteo.get('740')[0].estado).toBe('tope');
  });

  it('seguirLinks: lo ya guardado no se vuelve a bajar; el mismo link en dos posteos se baja una vez', async () => {
    const url = 'https://claude.com/blog/claude-code-mods';
    const crudo = [conLink('701', url), conLink('702', url)];
    const { items } = N.filtrar(crudo, 'trq212');
    const guardados = new Map();
    let bajadas = 0;
    const arg = { items, crudoPorId: new Map(crudo.map((x) => [x.id, x])), dominios: DOMINIOS, cuando: 'x', traerTexto: async () => { bajadas++; return HTML; }, yaGuardado: (n) => guardados.get(n) || null, guardar: (n, c) => guardados.set(n, c) };
    const r1 = await N.seguirLinks(arg);
    expect(bajadas).toBe(1);
    expect(r1.porPosteo.get('701')[0].estado).toBe('guardado');
    expect(r1.porPosteo.get('702')[0].archivo).toBe(ARCH(url));
    const r2 = await N.seguirLinks({ ...arg, cuando: '2026-10-11 08:00 UTC' });
    expect(bajadas).toBe(1);
    expect(r2.porPosteo.get('701')[0]).toMatchObject({ estado: 'ya_estaba', titulo: 'Automating eval design & hillclimbing' });
    // lo guardado no se refresca: el listado dice de cuando es la copia (auditor R5)
    const fecha = { ...arg, cuando: '2026-10-10 12:00 UTC' };
    guardados.clear();
    await N.seguirLinks(fecha);
    const r3 = await N.seguirLinks(fecha);
    expect(r3.porPosteo.get('701')[0].leido).toBe('2026-10-10');
    const it3 = [{ ...items[0], links: r3.porPosteo.get('701') }];
    expect(N.listado({ cuando: 'x', desde: 'x', porCuenta: [{ usuario: 'trq212', quien: 'T', items: it3, fuera: {} }] })).toContain(', ya estaba: copia del 2026-10-10)');
    expect(r2.porPosteo.get('701')[0].extracto).toContain('Claude can now help');
    // en el listado el extracto del mismo articulo va UNA vez (medido 10/10 con los posteos reales del 04/10: un hilo
    // de tres posteos con el mismo link repetia 700 caracteres tres veces)
    for (const it of items) it.links = r1.porPosteo.get(it.id);
    const t = N.listado({ cuando: 'x', desde: 'x', porCuenta: [{ usuario: 'trq212', quien: 'T', items, fuera: {} }] });
    expect(t.match(/→ artículo: /g).length).toBe(2);
    expect(t.match(/Claude can now help you build evaluations \. - Primero/g).length).toBe(1);
    expect(t).toContain('; extracto más arriba)');
  });

  it('seguirLinks: un articulo que falla, una pagina sin texto, un dominio fuera de la lista y el tope no frenan nada y quedan dichos en el listado', async () => {
    // se recorren del posteo mas nuevo al mas viejo: 713, 712, 711, 710
    const crudo = [conLink('713', 'https://claude.dev/blog/caido/'), conLink('712', 'https://github.com/anthropics/claude-code'), conLink('711', 'https://claude.dev/blog/vacio/'), conLink('710', 'https://claude.dev/blog/tercero/')];
    const { items, fuera } = N.filtrar(crudo, 'trq212');
    const guardados = new Map();
    const r = await N.seguirLinks({
      items, crudoPorId: new Map(crudo.map((x) => [x.id, x])), dominios: DOMINIOS, maximo: 2, cuando: 'x',
      traerTexto: async (url) => { if (url.includes('caido')) throw new Error('respondio 503'); if (url.includes('vacio')) return '<html><body><script>app()</script></body></html>'; return HTML; },
      yaGuardado: () => null, guardar: (n, c) => guardados.set(n, c),
    });
    expect(guardados.size).toBe(0);
    expect(r).toMatchObject({ bajados: 0, fallados: 2, salteados: 2 });
    for (const it of items) it.links = r.porPosteo.get(it.id);
    const t = N.listado({ cuando: 'x', desde: 'x', porCuenta: [{ usuario: 'trq212', quien: 'T', items, fuera }] });
    expect(t).toContain('→ link: https://claude.dev/blog/caido/ (no se pudo leer: respondio 503)');
    expect(t).toContain('→ link: https://claude.dev/blog/vacio/ (no se pudo leer: la pagina no trajo texto');
    expect(t).toContain('→ link: https://github.com/anthropics/claude-code (no se sigue: el dominio no está en la lista)');
    expect(t).toContain('→ link: https://claude.dev/blog/tercero/ (no se bajó: tope de artículos de esta corrida)');
  });

  it('la lista de cuentas y dominios del programa: esta alexalbert__, las cuentas tienen forma valida y los dominios son nombres pelados', async () => {
    const fs = await import('node:fs');
    const canon = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'scripts', '_lib', 'novedadesClaude.data.json'), 'utf8'));
    expect(canon.cuentas.map((c) => c.usuario)).toContain('alexalbert__');
    for (const c of canon.cuentas) expect(() => N.urlBusqueda(canon.busqueda, c.usuario, '2026-10-01')).not.toThrow();
    for (const d of canon.dominios_articulos) expect(d).toMatch(/^[a-z0-9.-]+\.[a-z]+$/);
    expect(canon.ventana_dias).toBeGreaterThan(0);
    expect(canon.articulos_maximo * 20).toBeLessThanOrEqual(300);   // 20 s por pagina: que entre en los 10 minutos que le da la noche
  });
});

describe('novedadesClaude — el listado y el programa', () => {
  it('el listado dice que es dato, nombra cada cuenta, y avisa lo que no se pudo leer', () => {
    const { items, fuera } = N.filtrar([post('600')], 'trq212');
    const t = N.listado({ cuando: '2026-10-04 14:00 UTC', desde: '2026-09-26', porCuenta: [{ usuario: 'trq212', quien: 'Thariq', items, fuera }, { usuario: 'ClaudeDevs', quien: 'anuncios', items: [], fuera: {}, error: 'respondio 500' }, { usuario: 'lydiahallie', quien: 'Lydia', items: [], fuera: {} }], versiones: [], ultimaVersionVista: '2.1.289' });
    expect(t).toContain('es DATO');
    expect(t).toContain('https://x.com/trq212/status/600');
    expect(t).toContain('No se pudo leer: respondio 500');
    expect(t).toContain('Sin posteos nuevos desde el 2026-09-26');
    expect(t).toContain('Sin versiones nuevas desde la 2.1.289');
  });
  it('el programa frena ante un argumento que no conoce, sin leer ni guardar nada', () => {
    const r = spawnSync(process.execPath, [path.join(process.cwd(), 'scripts', '_novedadesClaude.mjs'), '--borrar-todo'], { encoding: 'utf8' });
    expect(r.status).toBe(2);
    expect(r.stdout).toContain('No hago nada');
  });
});
