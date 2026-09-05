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
  detectarSegundaTarea, detectarIrreversibles,
} from '../../scripts/_encargo.mjs';
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
    expect(t).toMatch(/síntesis de 12 líneas o menos, con la RUTA del entregable en la primera/);
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
    for (const l of [...P.lineas, P.conCarpeta, P.sinCarpeta, P.conSkills, P.titulo]) {
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
