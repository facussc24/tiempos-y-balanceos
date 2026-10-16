// scripts/_temasAbiertos.mjs — la pagina de temas abiertos (tanda 1.3.4). Respuesta conocida del plan: la pagina
// muestra «tornillo CNC» con su ultima fecha y sus pendientes. Se arma con una carpeta de memoria de prueba.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { estadoDeMemoria, generar, pendientesDe } from '../../scripts/_temasAbiertos.mjs';

function memoriaDePrueba() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'temas-'));
  fs.writeFileSync(path.join(dir, 'project_tornillo_cabeza_ancha_impreso.md'), `---
name: project_tornillo_cabeza_ancha_impreso
description: Tornillo+tuerca impresos y PIN traba de la costura CNC del insert
metadata:
  type: project
  modified: 2026-10-15T18:34:11.106Z
---

## 🟡 15/10/2026 — PIN traba v3
- Pin v3 mandado a imprimir. PENDIENTE DE PRUEBA en la placa.

## Historico: el punto congelado del 14/08 (SUPERADO por v5, no usar)
- falta probar la rosca vieja
`);
  fs.writeFileSync(path.join(dir, 'project_cosa_cerrada.md'), `---
name: project_cosa_cerrada
description: "TAREA CERRADA: se mando el 24/08"
metadata:
  type: project
---
nada
`);
  fs.writeFileSync(path.join(dir, 'project_seguimientos_con_fecha.md'), '---\nname: s\ndescription: s\n---\n```json\n{"seguimientos":[{"id":"reunion-calidad","que":"pedir la reunion de AMFE","abierto":"2026-10-02","dias":["lunes","viernes"],"intentos":[]}]}\n```\n');
  return dir;
}

describe('_temasAbiertos', () => {
  test('la pagina muestra el tornillo CNC con su ultima fecha y su pendiente, el logo y los colores de la casa', () => {
    const dir = memoriaDePrueba();
    const out = path.join(dir, 'temas.html');
    const r = generar({ memoria: dir, hoy: '2026-10-16', out });
    expect(r.filas).toBe(2);
    const html = fs.readFileSync(out, 'utf8');
    expect(html).toContain('tornillo cnc');                 // alias del canon de temas: como lo llama Fak
    expect(html).toContain('2026-10-15');                   // la ultima fecha sale del frontmatter
    expect(html).toContain('PENDIENTE DE PRUEBA en la placa');
    expect(html).not.toContain('falta probar la rosca vieja'); // lo de una seccion historica no es un pendiente
    expect(html).toContain('reunion-calidad');              // el seguimiento con fecha va arriba
    expect(html).toMatch(/<img src="data:image\/png;base64,/);
    expect(html).toContain('Calibri');
    expect(html).toContain('#44546A');
  });

  test('el estado sale de lo que dice la memoria', () => {
    expect(estadoDeMemoria('TAREA CERRADA: se mando', '')).toBe('cerrado');
    expect(estadoDeMemoria('8D CERRADO por VW, pero sigue viva', '')).toBe('abierto');
    expect(estadoDeMemoria('El sistema quedo APAGADO', '')).toBe('apagado');
    expect(estadoDeMemoria('plan listo, FRENADO esperando OK de Leo', '')).toBe('en espera');
    expect(estadoDeMemoria('algo', '## 🔴 22/08 — no giro')).toBe('urgente');
  });

  test('pendientes: como mucho tres, sin repetir, sin las secciones historicas', () => {
    const p = pendientesDe('## Hoy\n- falta la placa\n- falta la placa\n- el ancho, a medir\n- falta el pin\n- falta la tuerca\n## Historico\n- falta la rosca');
    expect(p).toEqual(['falta la placa', 'el ancho, a medir', 'falta el pin']);
  });
});
