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
  'secretos-guard.sh': { test: GUARDIANES, tipo: 'bloquea' },
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
  'video-maquina-guard.sh': { test: '__tests__/scripts/videoMaquinaGuard.test.mjs', tipo: 'bloquea' },
  // PreToolUse via _dispatcher (21/09/2026): el paquete de PPAP que va al cliente lo arma
  // CALIDAD, y los listados maestros son registro compartido. Regla autonomy-contract.md §F.
  'apqp-cliente-guard.sh': { test: '__tests__/scripts/apqpClienteGuard.test.mjs', tipo: 'bloquea' },
  // PreToolUse via _dispatcher (01/10/2026): nada se guarda en la nube PERSONAL de Fak; el trabajo
  // va a la biblioteca de Ingenieria. Regla nube-ingenieria.md ("regla dura, no podemos volver a fallar").
  'nube-personal-guard.sh': { test: '__tests__/scripts/nubePersonalGuard.test.mjs', tipo: 'bloquea' },
  // PreToolUse via _dispatcher (08/10/2026): ningun documento de Barack dice que lo hizo Claude o una IA
  // (core-prohibiciones.md §9). El wrapper fino se agrego el 08/10 a la noche: el guardian estaba en
  // guardianes.mjs desde fda8f920 sin wrapper y el test 4a (y el CI) quedaron en rojo.
  'firma-ia-guard.sh': { test: '__tests__/scripts/firmaIAGuard.test.mjs', tipo: 'bloquea' },
  // PreToolUse via _dispatcher (02/10/2026): un `git commit` sin rutas se lleva lo que otra sesion tenga
  // en el indice (cee8f1b2 salio con 12 archivos ajenos). Regla git-deploy.md, paso 2.
  'commit-rutas-guard.sh': { test: '__tests__/scripts/commitRutasGuard.test.mjs', tipo: 'bloquea' },
  // PreToolUse via _dispatcher (tanda 3, pieza 9, 16/10/2026): un permiso de un solo uso de Fak se arma solo con su frase
  // de este turno citada en el comando (autonomy-contract.md §G).
  'permiso-un-uso-guard.sh': { test: '__tests__/scripts/permisoUnUso.test.mjs', tipo: 'bloquea' },
  // PreToolUse via _dispatcher (11/09/2026): recordatorio 1x/h del criterio CC/SC (S 9-10 · S 5-8 y O>=4)
  // al tocar siglas, flujogramas o el tema. No bloquea: el bloqueo duro son los CRITICAL del validador.
  'caracteristicas-especiales-guard.sh': { test: GUARDIANES, tipo: 'aviso' },
  // UserPromptSubmit (11/09/2026): el mismo criterio, SIN cooldown, cuando Fak nombra el tema.
  'caracteristicas-especiales-prompt.sh': { test: VARIOS, tipo: 'aviso' },
  // UserPromptSubmit (02/10/2026): cuando un entregable vuelve (2a correccion, o 2 versiones
  // de la misma carpeta) devuelve el pedido original. No bloquea. Origen: fotos de las prensas Hot Press, 01/10/2026.
  'correccion-guard.sh': { test: '__tests__/scripts/correccionGuard.test.mjs', tipo: 'aviso' },
  // UserPromptSubmit (02/10/2026): cuando Fak dice que no entendio, pide que se lo expliquen o pide corto,
  // recuerda el skill explicar-mejor. No bloquea. Origen: prueba de la escalera del post de Karpathy.
  'explicar-prompt.sh': { test: '__tests__/scripts/explicarGuard.test.mjs', tipo: 'aviso' },
  'arb-cerrar-guard.sh': { test: '.claude/hooks/arb-cerrar-guard.test.sh', tipo: 'bloquea' },
  'causas-ajenas-guard.sh': { test: '.claude/hooks/causas-ajenas-guard.test.sh', tipo: 'bloquea' },
  'supabase-guard.sh': { test: VARIOS, tipo: 'bloquea' },
  'mcp-write-gate.sh': { test: VARIOS, tipo: 'bloquea' },
  'supabase-write-flag.sh': { test: VARIOS, tipo: 'observa' },
  // PreToolUse AskUserQuestion (06/10/2026): dejo de ser un recordatorio. Frena la pregunta con opcion recomendada
  // fuera de lo que el contrato manda confirmar, y el menu de alcance. Origen: 35 de 81 preguntas rechazadas por Fak.
  'pregunta-guard.sh': { test: '__tests__/scripts/preguntaGuard.test.mjs', tipo: 'bloquea' },
  'cierre-guard.sh': { test: VARIOS, tipo: 'bloquea' },
  // UserPromptSubmit + Stop (03/10/2026): cuando Fak deja a Claude trabajando solo hasta una hora, avisa lo que
  // hay que armar (lista, hora fijada, latido) y frena el cierre antes de la hora. Origen: "quedate laburando hasta
  // las 8" y el cierre a las 17:10. Regla trabajar-hasta-la-hora.md.
  'hora-prompt.sh': { test: '__tests__/scripts/horaGuard.test.mjs', tipo: 'aviso' },
  'hora-guard.sh': { test: '__tests__/scripts/horaGuard.test.mjs', tipo: 'bloquea' },
  // UserPromptSubmit (10/10/2026, cola P10): UN solo node por mensaje; corre las cuatro piezas de arriba
  // (caracteristicas-especiales-prompt, correccion-guard, explicar-prompt, hora-prompt) en orden y junta el texto. No bloquea.
  'prompt-hooks.sh': { test: '__tests__/scripts/promptHooks.test.mjs', tipo: 'aviso' },
  // Stop (10/10/2026, cola P10): UN solo node para el cierre: cierre-guard y despues hora-guard, las dos siempre;
  // exit = el mas alto. ROJO exit 2 / VERDE exit 0 en su test.
  'stop-hooks.sh': { test: '__tests__/scripts/stopHooks.test.mjs', tipo: 'bloquea' },
  // PermissionRequest (10/10/2026, cola P41): con una hora fijada para esa sesion y sin Fak en la ventana, el cartel de
  // permiso se contesta solo con deny y queda anotado en la lista. Su ROJO es «niega» (sale con 0: en este evento el
  // codigo 2 no hace nada) y su VERDE es «no decide». Origen: 04/10, 55 minutos esperando un cartel.
  'permiso-guard.sh': { test: '__tests__/scripts/permisoGuard.test.mjs', tipo: 'bloquea' },
  'coordinador-guard.sh': { test: '__tests__/scripts/coordinadorGuard.test.mjs', tipo: 'bloquea' },
  'cerebro-guard.sh': { test: '.claude/hooks/cerebro-guard.test.sh', tipo: 'aviso' },
  // Inyecta contexto (SessionStart). El test unitario prueba que el texto sale entero y corto;
  // que el MODELO lo recibe se sigue verificando en el TRANSCRIPT de una sesion nueva
  // (LECCIONES 04/09: 144 sesiones con el preview de 2 KB).
  'session-start-context.sh': { test: VARIOS, tipo: 'aviso' },
  // InstructionsLoaded (10/09/2026, C5): registro TSV de lo que Claude Code cargo de verdad.
  'instrucciones-log.sh': { test: VARIOS, tipo: 'observa' },
  // PreCompact y PostCompact (16/10/2026, tanda 1.3.3): registro de compactaciones en .claude/state/compactaciones.jsonl.
  'compactacion-registro.sh': { test: '__tests__/scripts/compactacionRegistro.test.mjs', tipo: 'observa' },
  'agentes-guard.sh': { test: VARIOS, tipo: 'bloquea', ruta: GLOBAL },
  // Hooks GLOBALES (viven en ~/.claude/hooks; la copia del repo viaja por git): tanda 1.7, 16/10/2026.
  'carpeta-guard.sh': { test: '__tests__/scripts/carpetaGuard.test.mjs', tipo: 'aviso' },
  'pedidos-pendientes.sh': { test: '__tests__/scripts/pedidosPendientes.test.mjs', tipo: 'aviso' },
};
/** En el disco pero no cableados. Borrarlos es decision de Fak (autonomy-contract C). */
const HUERFANOS = {
  'session-close-guard.sh': 'reemplazado por cierre-guard.sh el 04/09/2026; pendiente el OK de Fak para borrarlo',
  // cola P10, 10/10/2026: escrito y probado (tiene fila en COBERTURA) pero todavia sin cablear en settings.json;
  // sale de aca en el commit que lo cablea (C3, tras la medicion de P9 y con T1 y T2 del auditor arreglados).
  'stop-hooks.sh': 'cola P10: se cablea en C3 (Stop) despues de la medicion de P9; hasta entonces nadie lo llama',
  // cola P10 C2 (11/10/2026): reemplazados por prompt-hooks.sh en settings.json; siguen sueltos (los corren sus tests y
  // el de igualdad) hasta el OK de Fak para borrarlos (autonomy-contract C).
  'caracteristicas-especiales-prompt.sh': 'reemplazado por prompt-hooks.sh (cola P10 C2); pendiente el OK de Fak para borrarlo',
  'correccion-guard.sh': 'reemplazado por prompt-hooks.sh (cola P10 C2); pendiente el OK de Fak para borrarlo',
  'explicar-prompt.sh': 'reemplazado por prompt-hooks.sh (cola P10 C2); pendiente el OK de Fak para borrarlo',
  'hora-prompt.sh': 'reemplazado por prompt-hooks.sh (cola P10 C2); pendiente el OK de Fak para borrarlo',
};
/**
 * Retirados con el si de Fak (tanda 3, 16/10/2026, si del 09/10): viven en `.claude/hooks/_retirados/` (no se borran del
 * historial), con un renglon de por que al principio, y no estan cableados. `enDisco` no baja a esa carpeta.
 */
const RETIRADOS = {
  'dev-server-guard.sh': 'P11: en el mes freno 4 veces y las 4 fueron falsas',
  'timeout-guard.sh': 'P20: ~51.800 corridas en el mes y 6 avisos',
  'timeoutGuard.mjs': 'P20: la logica que settings.json llamaba directo con node',
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
        // Un hook cableado como `node "${CLAUDE_PROJECT_DIR}/scripts/_lib/X.mjs"` (sin el envoltorio bash, 30/09/2026)
        // cuenta como cableado para el wrapper .sh que nombra a ese X.mjs (timeout-guard.sh -> timeoutGuard.mjs).
        const n = String(h.command ?? '').match(/^node\s+"\$\{CLAUDE_PROJECT_DIR\}\/scripts\/_lib\/([A-Za-z0-9_.-]+\.mjs)"/);
        if (n) for (const f of enDisco) if (leer(`.claude/hooks/${f}`).includes(n[1])) nombres.add(f);
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
    // agentes-guard, carpeta-guard y pedidos-pendientes: los cablea ~/.claude/settings.json (son globales, aplican a
    // toda la PC; tools/instalar_mi_pc/ajustar_settings.mjs los cablea en las otras PC); la copia del repo es la
    // versionada — se chequea aparte (5b, 5e) que sea identica a la instalada.
    const huerfanosReales = enDisco.filter((f) => !cableados.has(f) && !HUERFANOS[f]
      && !['session-start-context.sh', 'cerebro-guard.sh', 'agentes-guard.sh', 'carpeta-guard.sh', 'pedidos-pendientes.sh'].includes(f));
    expect(huerfanosReales, `hooks en el disco que nadie llama: ${huerfanosReales.join(', ')}`).toEqual([]);
  });

  it('5c. todo hook de settings.json se llama por ${CLAUDE_PROJECT_DIR}, nunca por ruta relativa', () => {
    // 22/09/2026: con `bash .claude/hooks/x.sh`, un `cd scripts` del Bash tool dejaba al hook sin
    // archivo (exit 127, "non-blocking"): la tool corria SIN guardianes. 388 veces en un mes, en
    // al menos 10 sesiones. La doc oficial (hooks, "CLAUDE_PROJECT_DIR") pide la ruta absoluta.
    const s = JSON.parse(leer('.claude/settings.json'));
    const relativos = [];
    for (const evento of Object.values(s.hooks ?? {})) {
      for (const grupo of evento) {
        for (const h of grupo.hooks ?? []) {
          const cmd = String(h.command ?? '');
          if (/\.claude\/hooks\//.test(cmd) && !cmd.includes('"${CLAUDE_PROJECT_DIR}/.claude/hooks/')) relativos.push(cmd);
        }
      }
    }
    expect(relativos, `hooks con ruta relativa (se apagan tras un cd): ${relativos.join(' | ')}`).toEqual([]);
  });

  it('5d. un hook cableado como `node ...mjs` (sin bash): el script existe y usa ${CLAUDE_PROJECT_DIR}; el wrapper .sh de esa logica sigue cableado por nombre', () => {
    const s = JSON.parse(leer('.claude/settings.json'));
    const directos = [];
    for (const [evento, grupos] of Object.entries(s.hooks ?? {})) {
      for (const g of grupos) for (const h of g.hooks ?? []) {
        const cmd = String(h.command ?? '');
        if (!/^node\s/.test(cmd)) continue;
        expect(cmd, `${evento}: un hook de node se llama por \${CLAUDE_PROJECT_DIR}, nunca por ruta relativa`).toMatch(/^node\s+"\$\{CLAUDE_PROJECT_DIR\}\/scripts\/_lib\/[A-Za-z0-9_.-]+\.mjs"$/);
        const rel = cmd.match(/\/(scripts\/_lib\/[A-Za-z0-9_.-]+\.mjs)"/)[1];
        expect(fs.existsSync(path.join(RAIZ, rel)), `${evento} llama a ${rel}, que no existe`).toBe(true);
        directos.push(`${evento}:${rel}`);
      }
    }
    // el unico que corria asi era el timeout-guard, retirado el 16/10/2026 (tanda 3, P20): hoy no queda ninguno
    expect(directos.sort()).toEqual([]);
  });

  it('6. los retirados viven en _retirados/ con su renglon de por que, y nadie los cablea (tanda 3, 16/10/2026)', () => {
    const settings = leer('.claude/settings.json');
    for (const [f, motivo] of Object.entries(RETIRADOS)) {
      const ruta = path.join(HOOKS, '_retirados', f);
      expect(fs.existsSync(ruta), `${f}: ${motivo} — tiene que estar en .claude/hooks/_retirados/`).toBe(true);
      expect(fs.existsSync(path.join(HOOKS, f)), `${f} sigue en .claude/hooks/`).toBe(false);
      expect(fs.readFileSync(ruta, 'utf8').split('\n').slice(0, 3).join('\n'), `${f} sin el renglon de por que`).toMatch(/RETIRADO el \d{2}\/\d{2}\/\d{4}/);
      expect(settings.includes(f), `settings.json todavia nombra a ${f}`).toBe(false);
    }
    expect(enDisco.some((f) => RETIRADOS[f]), 'un retirado volvio a .claude/hooks/').toBe(false);
  });

  it.skipIf(!fs.existsSync(GLOBAL))('5b. agentes-guard.sh del repo es identico al instalado en ~/.claude/hooks (el que corre)', () => {
    expect(leer('.claude/hooks/agentes-guard.sh')).toBe(fs.readFileSync(GLOBAL, 'utf8'));
  });

  for (const g of ['carpeta-guard.sh', 'pedidos-pendientes.sh']) {
    const instalado = path.join(os.homedir(), '.claude', 'hooks', g);
    it.skipIf(!fs.existsSync(instalado))(`5e. ${g} del repo es identico al instalado en ~/.claude/hooks (hook global, tanda 1.7)`, () => {
      expect(leer(`.claude/hooks/${g}`)).toBe(fs.readFileSync(instalado, 'utf8'));
    });
  }
});
