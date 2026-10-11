// El hook unico de mensajes (cola P10 C2) con las CUATRO piezas reales hablando en el mismo mensaje. Corre siempre.
// Lo que los otros tests no ven (auditor 11/10/2026, R2 y R3): el de dobles no usa las piezas reales, el gate compara
// la tabla contra si misma y el de igualdad (20 mensajes reales) no trae ninguno con dos piezas. Aca el orden, el
// separador y las marcas estan ESCRITOS en el test, no importados: si alguien cambia el orden de PIEZAS_REALES, saca
// una pieza o cambia el separador, se pone rojo.
// Y el tope: Claude Code corta en 10.000 caracteres lo que inyecta UN hook (pasado eso al modelo le llega un adelanto
// con la ruta de un archivo). Antes cada pieza tenia su tope; fusionadas lo comparten.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as ce from '../../scripts/_lib/caracteristicasEspecialesPrompt.mjs';
import * as co from '../../scripts/_lib/correccionGuard.mjs';
import * as ex from '../../scripts/_lib/explicarGuard.mjs';
import { cargarPiezas } from '../../scripts/_lib/hookComun.mjs';
import * as ho from '../../scripts/_lib/horaGuard.mjs';
import { PIEZAS_REALES, correr } from '../../scripts/_lib/promptHooks.mjs';

const TOPE = 10000;
// El caso armado abajo no es el peor posible: con el aviso «ya entregaste N versiones» y una carpeta larga de la
// biblioteca el auditor midio hasta 9.544 (11/10/2026). Por eso el test corta antes: 400 caracteres de aire.
const TOPE_DEL_TEST = 9600;
const SEPARADOR = '\n\n';
const MARCAS = ['[CARACTERISTICAS ESPECIALES', '[CORRECCION-GUARD]', '[EXPLICAR-MEJOR]', '[TRABAJAR-HASTA]'];
// La tanda: un pedido, una correccion y la segunda correccion, que ademas nombra CC/SC, pide que se lo expliquen y
// pone una hora. Con ese tercer mensaje hablan las cuatro.
const TANDA = [
  'necesito que me armes una hoja con las fotos de las dos prensas hot press, la BMA 101 y la BMA 103, con el proceso completo de cada una',
  'no era eso lo que te pedi, faltan las fotos de la BMA 103 y pusiste el flujograma',
  'otra vez lo mismo, seguis sin poner la descarga. y la caracteristica critica CC / SC donde esta? no entiendo que hiciste, explicame mejor. quedate laburando hasta las 23:30hs con la lista, no pares',
];

let dir = '';
let antes;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-hooks-cuatro-'));
  antes = process.env.CORRECCION_GUARD_DIR;
  process.env.CORRECCION_GUARD_DIR = dir;                    // el estado de correccion-guard, lejos del real
});
afterAll(() => {
  if (antes === undefined) delete process.env.CORRECCION_GUARD_DIR; else process.env.CORRECCION_GUARD_DIR = antes;
});

async function correrTanda(sesion) {
  const piezas = await cargarPiezas(PIEZAS_REALES, { avisar: () => {} });
  let ultimo = null;
  for (const prompt of TANDA) ultimo = await correr({ session_id: sesion, hook_event_name: 'UserPromptSubmit', cwd: process.cwd(), prompt }, piezas, { avisar: () => {} });
  return ultimo?.hookSpecificOutput?.additionalContext ?? '';
}

describe('prompt-hooks: las cuatro piezas reales en el mismo mensaje', () => {
  it('salen las cuatro marcas, en el orden de siempre, separadas por una linea en blanco y bajo el tope', async () => {
    const texto = await correrTanda(`prueba-cuatro-${process.pid}-${Date.now()}`);
    const donde = MARCAS.map((m) => texto.indexOf(m));
    expect(donde, `falta una marca en: ${texto.slice(0, 200)}`).not.toContain(-1);
    expect(donde[0]).toBe(0);                                   // la primera abre el texto
    expect([...donde].sort((a, b) => a - b)).toEqual(donde);    // y las demas vienen en ese orden
    for (const i of donde.slice(1)) {
      expect(texto.slice(i - SEPARADOR.length, i)).toBe(SEPARADOR);
      expect(texto[i - SEPARADOR.length - 1]).not.toBe('\n');   // una linea en blanco, no dos
    }
    // cada aviso abre UN solo bloque (el de explicar nombra a correccion-guard adentro de su texto: eso no cuenta)
    for (const m of MARCAS) expect(texto.split(SEPARADOR).filter((b) => b.startsWith(m)).length, `${m} abre un solo bloque`).toBe(1);
    expect(texto.length).toBeLessThan(TOPE);
  }, 30000);

  it('el caso mas largo que pueden dar las cuatro juntas entra en el tope de 10.000 caracteres de un hook', () => {
    const largo = (n) => 'palabra '.repeat(Math.ceil(n / 8)).slice(0, n);
    const mayor = (...ts) => ts.filter(Boolean).sort((a, b) => b.length - a.length)[0] ?? '';
    const vigente = { hasta: '2026-10-11 20:00', lista: 'C:\\Dev\\BarackMercosul\\docs\\drafts\\LISTA_SESION_OPUS_2026-10-11_mods.md' };
    const CE = ce.atender({ prompt: 'la sigla CC / SC' });
    const EX = mayor(ex.avisoDe('no entiendo, explicame mejor en que estado esta la tarea'), ex.avisoDe('no entiendo, explicame mejor'));
    const HO = mayor(
      ho.avisoDe('quedate laburando hasta las 8, no pares', { estado: null }),
      ho.avisoDe('quedate laburando hasta las 8, no pares', { estado: vigente }),
      ho.avisoDe('hola', { estado: vigente }),
    );
    // correccion-guard con lo maximo que guarda su estado: tres mensajes largos antes y cinco correcciones largas
    let e = null;
    const avisos = [];
    for (const t of [largo(900), largo(900), largo(900)]) e = co.paso(e, t).estado;
    for (let i = 0; i < 5; i++) { const r = co.paso(e, `no era eso lo que te pedi, otra vez lo mismo ${largo(400)}`); e = r.estado; avisos.push(r.aviso); }
    const CO = mayor(...avisos);
    for (const [nombre, t] of [['caracteristicas especiales', CE], ['correccion', CO], ['explicar', EX], ['hora', HO]]) expect(String(t ?? '').length, `${nombre} no dio aviso`).toBeGreaterThan(0);
    const total = [CE, CO, EX, HO].reduce((a, t) => a + t.length, 0) + SEPARADOR.length * 3;
    // Si esto se pone rojo: un aviso crecio. Acortarlo (o achicar lo que guarda correccion-guard) antes que subir el tope,
    // que no es nuestro: lo pone Claude Code.
    expect(total, `las cuatro juntas suman ${total}`).toBeLessThan(TOPE_DEL_TEST);
  });

  // Quien edite una de estas piezas tiene que probarla con un mensaje real antes de cerrar (regla
  // mejora-implementada.md): eso lo exige el cierre con las tres listas de su canon. Si una pieza se cae de una lista,
  // el control deja de pedirlo sin que nada avise (mutante N04 del auditor, 11/10/2026).
  it('el canon del cierre nombra las piezas del hook unico en sus tres listas', () => {
    const canon = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'scripts', '_lib', 'cierreCanon.data.json'), 'utf8')).mejora;
    const piezas = [
      '.claude/hooks/prompt-hooks.sh', '.claude/hooks/stop-hooks.sh',
      'scripts/_lib/promptHooks.mjs', 'scripts/_lib/stopHooks.mjs', 'scripts/_lib/hookComun.mjs', 'scripts/_lib/caracteristicasEspecialesPrompt.mjs',
      ...PIEZAS_REALES.map((p) => `scripts/_lib/${p.modulo.replace('./', '')}`),
    ];
    for (const lista of ['mensajes_re', 'sistema_re', 'piezas_re']) {
      const re = new RegExp(canon[lista]);
      for (const p of piezas) expect(re.test(p), `${p} falta en ${lista}`).toBe(true);
    }
    // y no se abrio de mas: un modulo cualquiera de scripts/_lib no entra
    for (const lista of ['mensajes_re', 'sistema_re', 'piezas_re']) expect(new RegExp(canon[lista]).test('scripts/_lib/amfeIo.mjs')).toBe(false);
  });
});
