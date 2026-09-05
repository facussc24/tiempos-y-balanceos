// Meta-test: NINGUN hook vive sin test en las dos direcciones.
//
// Por que (auditoria 04/09/2026): 13 de los guardianes no tenian test en ninguna direccion,
// entre ellos los que corren el backup, frenan una escritura irreversible en Supabase y
// limitan los subagentes. Y el que si tenia test daba verde por el motivo equivocado
// (_dispatcher.test.sh: "JSON roto -> BLOQUEA" bloqueaba por el recordatorio 1x/h, no por
// el borrado). Un control no esta probado hasta que se lo vio fallar (LECCIONES 02-03/09).
//
// Que exige:
//   1. Todo hook del disco figura en COBERTURA (o en HUERFANOS, con motivo). Un hook nuevo
//      sin fila hace fallar este test: asi nace con su test, no despues.
//   2. El test citado existe y NOMBRA al hook.
//   3. Si el hook bloquea, su test tiene un rojo (exit 2) y un verde (exit 0). Los que solo
//      avisan u observan quedan exentos del rojo, pero igual tienen que tener test.
//   4. Los wrappers finos (`exec node guardianes.mjs --solo X`) apuntan a un guardian que
//      existe y ARRANCAN: bash + node + import del modulo, con un comando inocente -> exit 0.
//   5. Todo hook cableado en settings.json existe en el disco; los huerfanos conocidos no
//      estan cableados (si alguien los vuelve a cablear, la tabla se actualiza).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { NOMBRES } from '../../scripts/_lib/guardianes.mjs';

const RAIZ = process.cwd();
const HOOKS = path.join(RAIZ, '.claude', 'hooks');
const GLOBAL = path.join(os.homedir(), '.claude', 'hooks', 'agentes-guard.sh');

/** hook -> { test, tipo }. tipo: 'bloquea' (exige rojo y verde) · 'aviso' / 'observa' (exige test, sin rojo). */
const GUARDIANES = '__tests__/scripts/guardianes.test.mjs';
const VARIOS = '__tests__/scripts/hooksVarios.test.mjs';
const COBERTURA = {
  '_dispatcher.sh': { test: '.claude/hooks/_dispatcher.test.sh', tipo: 'bloquea' },
  'file-guard.sh': { test: GUARDIANES, tipo: 'bloquea' },
  'validator-check.sh': { test: GUARDIANES, tipo: 'bloquea' },
  'renumber-guard.sh': { test: GUARDIANES, tipo: 'bloquea' },
  'push-guard.sh': { test: GUARDIANES, tipo: 'bloquea' },
  'consumos-entregable-guard.sh': { test: GUARDIANES, tipo: 'bloquea' },
  'cad-guard.sh': { test: GUARDIANES, tipo: 'bloquea' },
  'patrones-guard.sh': { test: GUARDIANES, tipo: 'bloquea' },
  'escritorio-guard.sh': { test: '__tests__/scripts/escritorioGuard.test.mjs', tipo: 'bloquea' },
  'borrado-masivo-guard.sh': { test: '__tests__/scripts/borradoMasivoGuard.test.mjs', tipo: 'bloquea' },
  'ho-numeracion-guard.sh': { test: GUARDIANES, tipo: 'bloquea' },
  'mail-guard.sh': { test: '.claude/hooks/mail-guard.test.sh', tipo: 'bloquea' },
  'documentacion-oficial-guard.sh': { test: GUARDIANES, tipo: 'bloquea' },
  'arb-cerrar-guard.sh': { test: '.claude/hooks/arb-cerrar-guard.test.sh', tipo: 'bloquea' },
  'causas-ajenas-guard.sh': { test: '.claude/hooks/causas-ajenas-guard.test.sh', tipo: 'bloquea' },
  'supabase-guard.sh': { test: VARIOS, tipo: 'bloquea' },
  'mcp-write-gate.sh': { test: VARIOS, tipo: 'bloquea' },
  'supabase-write-flag.sh': { test: VARIOS, tipo: 'observa' },
  'dev-server-guard.sh': { test: VARIOS, tipo: 'bloquea' },
  'pregunta-guard.sh': { test: VARIOS, tipo: 'aviso' },
  'cierre-guard.sh': { test: VARIOS, tipo: 'bloquea' },
  'coordinador-guard.sh': { test: '__tests__/scripts/coordinadorGuard.test.mjs', tipo: 'bloquea' },
  'cerebro-guard.sh': { test: '.claude/hooks/cerebro-guard.test.sh', tipo: 'aviso' },
  // Inyecta contexto (SessionStart). Lo que inyecta se verifica en el TRANSCRIPT de una sesion
  // nueva, no con un test unitario (LECCIONES 04/09: 144 sesiones con el preview de 2 KB).
  'session-start-context.sh': { test: null, tipo: 'aviso', motivo: 'se verifica en el transcript' },
  'agentes-guard.sh': { test: VARIOS, tipo: 'bloquea', ruta: GLOBAL },
};
/** En el disco pero no cableados. Borrarlos es decision de Fak (autonomy-contract C). */
const HUERFANOS = {
  'session-close-guard.sh': 'reemplazado por cierre-guard.sh el 04/09/2026; pendiente el OK de Fak para borrarlo',
};

const enDisco = fs.readdirSync(HOOKS).filter((f) => f.endsWith('.sh') && !f.endsWith('.test.sh'));
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

function hooksCableados() {
  const s = JSON.parse(leer('.claude/settings.json'));
  const nombres = new Set();
  for (const evento of Object.values(s.hooks ?? {})) {
    for (const grupo of evento) {
      for (const h of grupo.hooks ?? []) {
        const m = String(h.command ?? '').match(/\.claude\/hooks\/([A-Za-z0-9_.-]+\.sh)/);
        if (m) nombres.add(m[1]);
      }
    }
  }
  // Los que el despachador corre por su cuenta.
  const disp = leer('.claude/hooks/_dispatcher.sh');
  for (const m of disp.matchAll(/\$DIR\/([a-z-]+\.sh)/g)) nombres.add(m[1]);
  // Los wrappers: el despachador los corre por dentro del modulo (script-inline-guard no tiene .sh).
  for (const n of NOMBRES) if (fs.existsSync(path.join(HOOKS, `${n}.sh`))) nombres.add(`${n}.sh`);
  return nombres;
}

describe('hooksTienenTest — todo hook figura en la tabla, con su test', () => {
  it('1. ningun hook del disco queda fuera de COBERTURA/HUERFANOS (un hook nuevo nace con su fila y su test)', () => {
    const sinFila = enDisco.filter((f) => !COBERTURA[f] && !HUERFANOS[f]);
    expect(sinFila, `hooks sin test: ${sinFila.join(', ')} — agregalos a COBERTURA con un test rojo y uno verde`).toEqual([]);
  });

  it('1b. la tabla no cita hooks que ya no existen', () => {
    const fantasmas = Object.entries(COBERTURA)
      .filter(([f, c]) => !fs.existsSync(c.ruta ?? path.join(HOOKS, f)))
      .map(([f]) => f)
      .filter((f) => f !== 'agentes-guard.sh' || fs.existsSync(GLOBAL));
    expect(fantasmas).toEqual([]);
  });

  for (const [hook, c] of Object.entries(COBERTURA)) {
    if (!c.test) continue;
    it(`2. ${hook} -> ${path.basename(c.test)} existe y lo nombra`, () => {
      expect(fs.existsSync(path.join(RAIZ, c.test)), `no existe ${c.test}`).toBe(true);
      const nombre = hook.replace(/\.sh$/, '');
      expect(leer(c.test).includes(nombre), `${c.test} no nombra a ${nombre}`).toBe(true);
    });
  }

  for (const [hook, c] of Object.entries(COBERTURA)) {
    if (c.tipo !== 'bloquea') continue;
    it(`3. ${hook} bloquea: su test tiene un ROJO (exit 2) y un VERDE (exit 0)`, () => {
      const t = leer(c.test);
      // .sh: `afirmar "..." 2 ...` / `probar 2 ...` / `probar guard "..." \` + linea siguiente `... 2`.
      const aserciones = c.test.endsWith('.sh')
        ? t.replace(/\\\n\s*/g, ' ').split('\n').filter((l) => /^\s*(afirmar|probar)\b/.test(l))
        : null;
      const rojo = aserciones ? aserciones.some((l) => /\s2(\s|$)/.test(l)) : /toBe\(2\)/.test(t) || /ROJO/.test(t);
      const verde = aserciones ? aserciones.some((l) => /\s0(\s|$)/.test(l)) : /toBe\(0\)/.test(t) || /VERDE/.test(t);
      expect(rojo, `${c.test}: no veo una asercion de exit 2`).toBe(true);
      expect(verde, `${c.test}: no veo una asercion de exit 0`).toBe(true);
    });
  }

  it('4a. cada wrapper fino apunta a un guardian que guardianes.mjs conoce, y cada guardian tiene su wrapper', () => {
    const wrappers = {};
    for (const f of enDisco) {
      const m = leer(`.claude/hooks/${f}`).match(/guardianes\.mjs"\s+--solo\s+([a-z-]+)/);
      if (m) wrappers[f] = m[1];
    }
    for (const [f, nombre] of Object.entries(wrappers)) {
      expect(NOMBRES, `${f} apunta a "${nombre}", que no existe en guardianes.mjs`).toContain(nombre);
      expect(f).toBe(`${nombre}.sh`);
    }
    // supabase-guard y script-inline-guard no tienen wrapper: el primero es bash de verdad (corre el
    // backup), el segundo solo existe dentro del despachador (no hay .sh que reemplazar).
    const sinWrapper = NOMBRES.filter((n) => !wrappers[`${n}.sh`]);
    expect(sinWrapper.sort()).toEqual(['script-inline-guard', 'supabase-guard']);
  });

  const wrappers = enDisco.filter((f) => /guardianes\.mjs"\s+--solo/.test(leer(`.claude/hooks/${f}`)));
  it.each(wrappers)('4b. %s arranca suelto: bash -> node -> import, comando inocente -> exit 0 sin ruido', (f) => {
    const r = spawnSync('bash', [path.join(HOOKS, f)], {
      input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'echo hola' } }),
      encoding: 'utf8',
    });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stderr).toBe('');
    expect(r.stdout).toBe('');
  });

  it('5. lo cableado en settings.json existe; los huerfanos conocidos NO estan cableados', () => {
    const cableados = hooksCableados();
    const faltan = [...cableados].filter((f) => !fs.existsSync(path.join(HOOKS, f)));
    expect(faltan, `settings.json / despachador citan hooks que no existen: ${faltan.join(', ')}`).toEqual([]);
    for (const h of Object.keys(HUERFANOS)) {
      expect(cableados.has(h), `${h} figura como huerfano pero esta cableado: sacalo de HUERFANOS y dale test`).toBe(false);
    }
    // session-start-context / cerebro-guard: SessionStart, cableados por nombre de script.
    // agentes-guard: lo cablea ~/.claude/settings.json (es global, aplica a toda la PC); la copia del
    // repo es la versionada — se chequea aparte que sea identica a la instalada.
    const huerfanosReales = enDisco.filter((f) => !cableados.has(f) && !HUERFANOS[f]
      && !['session-start-context.sh', 'cerebro-guard.sh', 'agentes-guard.sh'].includes(f));
    expect(huerfanosReales, `hooks en el disco que nadie llama: ${huerfanosReales.join(', ')}`).toEqual([]);
  });

  it.skipIf(!fs.existsSync(GLOBAL))('5b. agentes-guard.sh del repo es identico al instalado en ~/.claude/hooks (el que corre)', () => {
    expect(leer('.claude/hooks/agentes-guard.sh')).toBe(fs.readFileSync(GLOBAL, 'utf8'));
  });
});
