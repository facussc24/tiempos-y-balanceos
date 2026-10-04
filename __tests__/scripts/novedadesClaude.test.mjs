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
