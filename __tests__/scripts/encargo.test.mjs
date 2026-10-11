/**
 * Tests de la PLANTILLA DE ARRANQUE de _encargo.mjs (Ola 4, item 17, 05/09/2026).
 *
 * Por que existe: en 77 transcripts del 21/08 al 04/09 Fak tipeo a mano "modo plan" 47 veces,
 * "agente independiente que audite" 41, "la tarea esta en el Escritorio" 31, "sintetiza" 24,
 * "procedimiento de cierre" 14 y "lee este archivo entero + carga skill" 10. Eso ahora sale
 * fijo al final de cada encargo, desde el canon del coordinador.
 *
 * Lo que se prueba en las dos direcciones:
 *   - el bloque aparece con carpeta y skills, y desaparece con --sin-arranque;
 *   - el texto COMPLETO (cuerpo + arranque) pasa por los mismos candados del guardian
 *     (G3 conectores, G4 irreversibles): una linea nueva de la plantilla que dispare un candado
 *     dejaria TODOS los encargos bloqueados, y eso se ve aca antes que en produccion;
 *   - --skill inexistente y --carpeta inexistente se rechazan; los existentes pasan.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  armarTexto, lineasArranque, parseArgs, validarEncargo, validarArranque, skillsDisponibles,
  detectarSegundaTarea, detectarIrreversibles, horaDeLaMadre,
} from '../../scripts/_encargo.mjs';
import { spawnSync } from 'node:child_process';
import { fijar, terminar, enLocal, vigente } from '../../scripts/_lib/horaGuard.mjs';
import { decidir } from '../../scripts/_lib/coordinadorGuard.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CANON = JSON.parse(fs.readFileSync(path.join(RAIZ, 'scripts', '_lib', 'coordinadorCanon.data.json'), 'utf8'));

let carpeta;
beforeAll(() => { carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'encargo-carpeta-')); });
afterAll(() => { try { fs.rmSync(carpeta, { recursive: true, force: true }); } catch { /* */ } });

const base = () => ({
  id: 'E260905-abcd', a: 'barackmercosul-c9', entregable: 'Tabla de carga del arb para el IP Pad', origen: 'fak', etapa: 'serie',
  cuerpo: 'Armá la tabla de carga del IP Pad desde la BOM Rev 7 y validala con el validador de consumos.',
  fuentes: ['docs/COMO_LEER_PDF.md'], condicionales: [], supuestos: ['la Rev 7 es la vigente'], okFak: null, hora: null,
});

describe('plantilla de arranque · lo que Fak tipeaba a mano sale fijo', () => {
  it('con carpeta y skills: modo plan, la carpeta, leer entero, cargar skills, cierre con _cierreSesion + auditor a archivo + sintesis', () => {
    const t = armarTexto({ ...base(), carpeta: 'C:\\Users\\Fak\\Desktop\\IP Pad', skills: ['carga-arb', 'verificacion-consumos'] });
    expect(t).toContain(CANON.plantillaArranque.titulo);
    expect(t).toMatch(/1\. Entrá en modo plan/);
    expect(t).toMatch(/2\. La tarea vive en el Escritorio: C:\\Users\\Fak\\Desktop\\IP Pad/);
    expect(t).toMatch(/3\. Leé ENTERO cada archivo fuente/);
    expect(t).toMatch(/4\. Cargá con la tool Skill, antes de empezar: carga-arb, verificacion-consumos\./);
    expect(t).toMatch(/5\. Al cerrar: node scripts\/_cierreSesion\.mjs --sin-build en verde; agente auditor con el informe a un ARCHIVO/);
    expect(t).toMatch(/síntesis con lo que recomendás, el comando o la ruta y lo que le cambia una decisión, con la RUTA del entregable en la primera línea/);
    expect(t).toMatch(/el entregable se escribe directo en su carpeta por tipo/);
    // el cierre del encargo sigue siendo la ultima linea
    expect(t.trim().split('\n').pop()).toBe('Si algo de este encargo no cierra, PARA y avisame antes de seguir.');
  });

  it('sin carpeta ni skills: la linea de carpeta dice que la decide Fak y la de skills no aparece (numeracion corrida)', () => {
    const t = armarTexto(base());
    expect(t).toMatch(/2\. Carpeta de la tarea: ninguna declarada\. .*la carpeta la decide Fak/);
    expect(t).not.toMatch(/Cargá con la tool Skill/);
    expect(t).toMatch(/4\. Al cerrar:/);
    expect(t).not.toMatch(/\{carpeta\}|\{skills\}/);
  });

  it('--sin-arranque saca el bloque entero', () => {
    const t = armarTexto({ ...base(), sinArranque: true });
    expect(t).not.toContain(CANON.plantillaArranque.titulo);
    expect(t).not.toMatch(/modo plan/);
    expect(lineasArranque({ sinArranque: true })).toEqual([]);
  });

  it('--lanzada (10/10/2026, HOY-8): la linea 1 dice NO entrar en modo plan y el resto del bloque queda igual', () => {
    const t = armarTexto({ ...base(), carpeta: 'C:\\Escritorio\\Tarea', skills: ['carga-arb'], lanzada: true });
    expect(t).toContain(CANON.plantillaArranque.titulo);
    expect(t).toMatch(/1\. Esta sesión la lanzó OTRA sesión y Fak no está en la ventana: NO entres en modo plan/);
    expect(t).not.toMatch(/Entrá en modo plan/);
    expect(t).toMatch(/2\. La tarea vive en el Escritorio: C:\\Escritorio\\Tarea/);
    expect(t).toMatch(/3\. Leé ENTERO cada archivo fuente/);
    expect(t).toMatch(/4\. Cargá con la tool Skill, antes de empezar: carga-arb\./);
    expect(t).toMatch(/5\. Al cerrar: node scripts\/_cierreSesion\.mjs --sin-build en verde/);
    // sin --lanzada, la linea 1 sigue pidiendo el modo plan (Fak esta y aprueba el QUE)
    expect(armarTexto(base())).toMatch(/1\. Entrá en modo plan/);
    expect(lineasArranque({ lanzada: true })[1]).toBe(`  1. ${CANON.plantillaArranque.lineaLanzada}`);
  });

  it('--lanzada pasa los candados del guardian igual que el encargo comun, y --sin-arranque le gana', () => {
    const t = armarTexto({ ...base(), lanzada: true });
    expect(detectarSegundaTarea(t)).toEqual([]);
    expect(detectarIrreversibles(t)).toEqual([]);
    const r = decidir(
      { tool_name: 'SendMessage', tool_input: { to: 'barackmercosul-c9', message: t } },
      { hayEscape: () => false, leerEncargo: () => ({ id: 'E260905-abcd', texto: t, cerrado: null }) },
    );
    expect(r.ok, JSON.stringify(r)).toBe(true);
    expect(armarTexto({ ...base(), lanzada: true, sinArranque: true })).not.toMatch(/modo plan/);
    expect(parseArgs(['--a', 'barackmercosul-c9', '--lanzada']).lanzada).toBe(true);
  });

  describe('--lanzada con una hora de trabajo vigente en la que lanza: la hija la hereda (10/10/2026, cola P41b)', () => {
    const MADRE = 'ae95ec7e-065a-4443-9058-d97fa9820e10';
    const hereda = { madre: MADRE, hasta: '2026-10-11 23:00', lista: 'C:\\Dev\\BarackMercosul\\docs\\drafts\\LISTA_ORQUESTADOR_2026-10-10.md' };

    it('VERDE: el punto 2 del ARRANQUE trae el comando con el id de la madre, su hora y su lista; el resto se corre un numero', () => {
      const t = armarTexto({ ...base(), lanzada: true, hereda });
      expect(t).toMatch(/1\. Esta sesión la lanzó OTRA sesión/);
      expect(t).toContain(`2. La sesión que te lanzó tiene una hora de trabajo fijada por Fak (hasta las 2026-10-11 23:00)`);
      expect(t).toContain(`con este comando, tal cual: node scripts/_lib/permisoGuard.mjs --heredar ${MADRE} · Con eso,`);
      expect(t).toContain(`queda anotado en la lista de la que te lanzó (${hereda.lista})`);
      expect(t).toMatch(/No fijes una hora propia y no lances un latido/);
      expect(t).toMatch(/3\. Carpeta de la tarea: ninguna declarada/);
      expect(t).toMatch(/5\. Al cerrar:/);
      expect(t).not.toMatch(/\{hasta\}|\{madre\}|\{lista\}|\{hereda\}/);
    });

    it('ROJO: sin hora vigente en la que lanza (hereda null) el renglon no aparece; tampoco sin --lanzada ni con --sin-arranque', () => {
      for (const t of [armarTexto({ ...base(), lanzada: true }), armarTexto({ ...base(), lanzada: true, hereda: null }), armarTexto({ ...base(), hereda }), armarTexto({ ...base(), lanzada: true, hereda, sinArranque: true }), armarTexto({ ...base(), lanzada: true, hereda: { madre: MADRE } })]) {
        expect(t).not.toMatch(/--heredar|hora de trabajo fijada/);
      }
      expect(armarTexto({ ...base(), lanzada: true })).toMatch(/2\. Carpeta de la tarea/);
    });

    it('el encargo con el renglon pasa los candados del guardian (ni segunda tarea, ni irreversible) y el guardian lo deja salir', () => {
      const t = armarTexto({ ...base(), lanzada: true, hereda });
      expect(detectarSegundaTarea(t)).toEqual([]);
      expect(detectarIrreversibles(t)).toEqual([]);
      const r = decidir(
        { tool_name: 'SendMessage', tool_input: { to: 'barackmercosul-c9', message: t } },
        { hayEscape: () => false, leerEncargo: () => ({ id: 'E260905-abcd', texto: t, cerrado: null }) },
      );
      expect(r.ok, JSON.stringify(r)).toBe(true);
    });

    it('horaDeLaMadre: lee la hora de la sesion que arma el encargo (CLAUDE_CODE_SESSION_ID); sin hora vigente, null', () => {
      const home = fs.mkdtempSync(path.join(os.tmpdir(), 'encargo-hora-'));
      try {
        const lista = path.join(home, 'lista.md'); fs.writeFileSync(lista, '# lista\n');
        const en3h = new Date(Date.now() + 3 * 3600 * 1000);
        expect(fijar({ sesion: MADRE, hasta: en3h, lista, home }).ok).toBe(true);
        // VERDE: la madre tiene hora -> { madre, hasta, lista }
        expect(horaDeLaMadre({ vigente, env: { CLAUDE_CODE_SESSION_ID: MADRE }, home })).toEqual({ madre: MADRE, hasta: enLocal(en3h), lista: path.resolve(lista) });
        // ROJO: otra sesion, sin hora propia, no toma la de la madre
        expect(horaDeLaMadre({ vigente, env: { CLAUDE_CODE_SESSION_ID: 'otra-sesion-sin-hora' }, home })).toBe(null);
        // ROJO: la hora ya vencio, o se cerro
        expect(horaDeLaMadre({ vigente, env: { CLAUDE_CODE_SESSION_ID: MADRE }, home, ahora: new Date(Date.now() + 4 * 3600 * 1000) })).toBe(null);
        // ROJO: sin el id de la sesion NO se adivina otra (con dos sesiones con hora, la mas reciente no era la madre)
        expect(horaDeLaMadre({ vigente, env: {}, home })).toBe(null);
        expect(horaDeLaMadre({ vigente, env: { CLAUDE_CODE_SESSION_ID: 'x; rm' }, home })).toBe(null);
        // sin la funcion de la hora (el modulo no cargo) tampoco: el encargo sale sin el renglon
        expect(horaDeLaMadre({ env: { CLAUDE_CODE_SESSION_ID: MADRE }, home })).toBe(null);
        expect(terminar({ sesion: MADRE, porque: 'Fak dijo que pare, ya esta', home }).ok).toBe(true);
        expect(horaDeLaMadre({ vigente, env: { CLAUDE_CODE_SESSION_ID: MADRE }, home })).toBe(null);
      } finally { fs.rmSync(home, { recursive: true, force: true }); }
    });

    it('por la linea de comandos: con hora vigente el texto y el JSON del encargo guardan la hora heredada; sin hora, hereda es null', () => {
      const home = fs.mkdtempSync(path.join(os.tmpdir(), 'encargo-cli-'));
      const creados = [];
      try {
        const lista = path.join(home, 'lista.md'); fs.writeFileSync(lista, '# lista\n');
        expect(fijar({ sesion: MADRE, hasta: new Date(Date.now() + 3 * 3600 * 1000), lista, home }).ok).toBe(true);
        const correr = (sesion) => spawnSync('node', [path.join(RAIZ, 'scripts', '_encargo.mjs'), '--a', 'prueba-hija-p41b', '--entregable', 'Prueba del renglon de la hora heredada', '--origen', 'continuidad',
          '--cuerpo', 'Prueba del test encargo.test.mjs: no hay nada que hacer con este texto.', '--sin-supuestos', '--lanzada'],
        { encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_CODE_SESSION_ID: sesion } });
        const con = correr(MADRE);
        expect(con.status, con.stderr).toBe(0);
        const id = con.stdout.match(/^\[ENCARGO (E[\w-]+)\]/)[1]; creados.push(id);
        expect(con.stdout).toContain(`--heredar ${MADRE} · Con eso,`);
        const j = JSON.parse(fs.readFileSync(path.join(RAIZ, '.claude', 'state', 'encargos', `${id}.json`), 'utf8'));
        expect(j.hereda).toMatchObject({ madre: MADRE, lista: path.resolve(lista) });
        expect(j.texto).toBe(con.stdout.trimEnd());
        const sin = correr('una-sesion-sin-hora');
        expect(sin.status, sin.stderr).toBe(0);
        const id2 = sin.stdout.match(/^\[ENCARGO (E[\w-]+)\]/)[1]; creados.push(id2);
        expect(sin.stdout).not.toMatch(/--heredar/);
        expect(JSON.parse(fs.readFileSync(path.join(RAIZ, '.claude', 'state', 'encargos', `${id2}.json`), 'utf8')).hereda).toBe(null);
      } finally {
        // los encargos de prueba se CIERRAN (nada se borra: regla del propio _encargo.mjs), para no dejar abiertos
        for (const id of creados) spawnSync('node', [path.join(RAIZ, 'scripts', '_encargo.mjs'), '--cerrar', id], { encoding: 'utf8' });
        fs.rmSync(home, { recursive: true, force: true });
      }
    });
  });

  it('el texto completo pasa los candados del guardian: ni conector de segunda tarea, ni accion irreversible, ni autorizacion reenviada', () => {
    const t = armarTexto({ ...base(), carpeta: 'C:\\Escritorio\\Tarea', skills: skillsDisponibles() });
    expect(detectarSegundaTarea(t)).toEqual([]);
    expect(detectarIrreversibles(t)).toEqual([]);
    const r = decidir(
      { tool_name: 'SendMessage', tool_input: { to: 'barackmercosul-c9', message: t } },
      { hayEscape: () => false, leerEncargo: () => ({ id: 'E260905-abcd', texto: t, cerrado: null }) },
    );
    expect(r.ok, JSON.stringify(r)).toBe(true);
  });

  it('cada linea de la plantilla, sola, tampoco dispara un candado (una linea nueva se prueba aca antes de ir al canon)', () => {
    const P = CANON.plantillaArranque;
    for (const l of [...P.lineas, P.lineaLanzada, P.lineaHeredaHora, P.conCarpeta, P.sinCarpeta, P.conSkills, P.titulo]) {
      expect(detectarSegundaTarea(l), l).toEqual([]);
      expect(detectarIrreversibles(l), l).toEqual([]);
    }
  });
});

describe('validacion de --skill y --carpeta', () => {
  it('parseArgs junta varios --skill y toma --carpeta y --sin-arranque', () => {
    const a = parseArgs(['--a', 'barackmercosul-c9', '--skill', 'carga-arb', '--skill', 'arb-operar', '--carpeta', carpeta, '--sin-arranque']);
    expect(a.skill).toEqual(['carga-arb', 'arb-operar']);
    expect(a.carpeta).toBe(carpeta);
    expect(a['sin-arranque']).toBe(true);
  });

  it('ROJO: un skill que no existe se rechaza y se listan los disponibles', () => {
    const e = validarArranque({ skill: ['skill-inventado'] });
    expect(e).toHaveLength(1);
    expect(e[0]).toMatch(/--skill "skill-inventado" no existe/);
    expect(e[0]).toMatch(/verificacion-consumos/);
  });

  it('ROJO: una carpeta que no existe se rechaza (la carpeta se crea antes, con OK de Fak)', () => {
    const e = validarArranque({ carpeta: path.join(carpeta, 'no-existe') });
    expect(e).toHaveLength(1);
    expect(e[0]).toMatch(/la ruta no existe/);
    expect(validarArranque({ carpeta: true })[0]).toMatch(/--carpeta sin valor/);
  });

  it('ROJO (auditor Ola 4): una carpeta RELATIVA se rechaza aunque exista; un --skill repetido sale una sola vez', () => {
    const rel = path.relative(process.cwd(), carpeta);
    const e = validarArranque({ carpeta: rel });
    expect(e).toHaveLength(1);
    expect(e[0]).toMatch(/va la ruta COMPLETA/);
    const t = armarTexto({ ...base(), skills: ['carga-arb', 'carga-arb'] });
    expect(t).toMatch(/Cargá con la tool Skill, antes de empezar: carga-arb\./);
    expect(t).not.toMatch(/carga-arb, carga-arb/);
  });

  it('VERDE: skills reales del repo y carpeta existente pasan; sin ninguno de los dos tambien', () => {
    expect(skillsDisponibles()).toContain('verificacion-consumos');
    expect(validarArranque({ skill: ['verificacion-consumos', 'carga-arb'], carpeta })).toEqual([]);
    expect(validarArranque({})).toEqual([]);
  });

  it('validarEncargo completo: un encargo sano con --skill y --carpeta pasa; con skill falso, no', () => {
    const sano = parseArgs(['--a', 'barackmercosul-c9', '--entregable', 'Informe de medios', '--origen', 'fak',
      '--cuerpo', 'Relevá los medios de la linea 3 y dejá el informe en la carpeta.', '--sin-supuestos',
      '--carpeta', carpeta, '--skill', 'verificacion-consumos']);
    expect(validarEncargo(sano)).toEqual([]);
    const malo = parseArgs(['--a', 'barackmercosul-c9', '--entregable', 'Informe de medios', '--origen', 'fak',
      '--cuerpo', 'Relevá los medios de la linea 3.', '--sin-supuestos', '--skill', 'no-existe']);
    expect(validarEncargo(malo).some((e) => /--skill "no-existe"/.test(e))).toBe(true);
  });
});
