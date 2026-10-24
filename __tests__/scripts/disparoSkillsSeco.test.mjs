// @vitest-environment node
/**
 * Prueba de disparo EN SECO (ítem 6f, 24/10/2026): scripts/_disparoSkillsSeco.mjs contra los 20 mensajes reales de
 * Fak del cuadro B del informe 21 (fixture `disparoSkills_6f.json`). Lee los nombres y las descriptions REALES de
 * `.claude/skills/*`: si alguien saca una línea «NO es para X (eso es la skill Y)» o una palabra de Fak, esto se
 * pone rojo. Los casos que el analista dio por resueltos tienen que dar bien (salvo los `limites` declarados en el
 * fixture, con su motivo); los «a medias» y los ambiguos se listan, no fallan. Es una aproximación: el disparo
 * real lo hace el modelo. Sin red y sin API.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import * as S from '../../scripts/_disparoSkillsSeco.mjs';

const fixture = JSON.parse(fs.readFileSync(S.FIXTURE, 'utf8'));

describe('las reglas del buscador', () => {
  it('compara sin acentos, por raíz y con errores de tipeo chicos, pero no confunde palabras distintas', () => {
    expect(S.mismaPalabra('imrpesora', 'impresora')).toBe(true); // una trasposición
    expect(S.mismaPalabra('imprimirlo', 'imprimilo')).toBe(true);
    expect(S.mismaPalabra('consumos', 'consumo')).toBe(true); // raíz
    expect(S.mismaPalabra('ploter', 'plotter')).toBe(true);
    expect(S.mismaPalabra('gracias', 'vacias')).toBe(false);
    expect(S.mismaPalabra('juntos', 'cuantos')).toBe(false);
    expect(S.mismaPalabra('arb', 'arbol')).toBe(false); // menos de 5 letras: sin raíz
    expect(S.palabras('Dale, ¿podés imprimí LOS pines?')).toEqual(['imprimi', 'pines']);
  });

  it('una frase de hasta 2 palabras pide todas; desde 3, la mitad', () => {
    expect([1, 2, 3, 4, 5].map(S.hacenFalta)).toEqual([1, 2, 2, 2, 3]);
  });

  it('lo que dice un «NO es para … (eso es la skill Y)» vota por Y y le resta a la que lo dice', () => {
    const skills = [
      { nombre: 'alfa', description: 'Usar cuando pidan «el informe azul». NO es para «la planilla verde» (eso es la skill beta).' },
      { nombre: 'beta', description: 'Usar cuando pidan «el resumen».' },
      { nombre: 'gama', description: 'Usar cuando pidan «otra cosa». NO es para «la tabla roja», ni para el gráfico (eso es la skill alfa o la skill beta); van las dos.' },
    ];
    const indice = S.armarIndice(skills);
    expect(S.elegir('mandame la planilla verde', indice).elegida).toBe('beta');
    expect(S.elegir('quiero el informe azul', indice).elegida).toBe('alfa');
    // dos skills nombradas en el mismo paréntesis: empatan, y la que lo dice queda en contra
    const r = S.elegir('pasame la tabla roja', indice);
    expect(r.ambiguo).toBe(true);
    expect(r.puntos.map((p) => p.skill).sort()).toEqual(['alfa', 'beta']);
    // lo que va después del «;» es de la propia
    const partes = S.partesDe(skills[2].description);
    expect(partes.find((p) => p.resta && p.para.length)?.para).toEqual(['alfa', 'beta']);
  });
});

describe('los 20 mensajes reales del cuadro B contra las descriptions de hoy', () => {
  const r = S.correrCasos({ casos: fixture.casos, limites: fixture.limites });

  it('el fixture tiene los 20 casos del informe: 11 resueltos, 4 a medias, 5 ambiguos', () => {
    expect(fixture.casos).toHaveLength(20);
    const cuenta = (e) => fixture.casos.filter((c) => c.estado === e).length;
    expect([cuenta('resuelto'), cuenta('a_medias'), cuenta('ambiguo')]).toEqual([11, 4, 5]);
  });

  it('cada caso que el analista dio por resuelto da la skill esperada', () => {
    const mal = r.malSinMotivo.map((f) => `#${f.id} espera ${f.esperada}, elige ${f.elegida ?? (f.ambiguo ? 'EMPATE' : 'ninguna')} (${f.puntos.map((p) => `${p.skill} ${p.puntos}`).join(', ')})`);
    expect(mal).toEqual([]);
  });

  it('un límite declarado es de un caso resuelto, tiene su motivo y sigue dando mal (si da bien, se saca de la lista)', () => {
    expect(fixture.limites.length).toBeLessThanOrEqual(1);
    for (const l of fixture.limites) {
      const f = r.filas.find((x) => x.id === l.id);
      expect(f?.estado).toBe('resuelto');
      expect(String(l.motivo).length).toBeGreaterThan(40);
      expect(f.bien).toBe(false);
    }
  });

  it('los a medias y los ambiguos se listan (no fallan)', () => {
    const lista = r.filas.filter((f) => f.estado !== 'resuelto')
      .map((f) => `#${f.id} [${f.estado}] espera ${f.esperada ?? '(no se sabe)'} -> ${f.elegida ?? (f.ambiguo ? 'EMPATE' : 'ninguna')}`);
    console.log(['Prueba en seco, casos que se listan:', ...lista].join('\n  '));
    expect(lista).toHaveLength(9);
  });
});
