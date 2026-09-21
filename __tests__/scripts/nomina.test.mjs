/**
 * nomina.mjs — los dos sentidos.
 *
 * El caso que lo motivo es el ROJO: el 21/09/2026 emiti el AMFE 173 con el equipo del AMFE
 * 127 (agosto 2024) copiado tal cual. Araceli Maidana se habia ido en marzo de 2024 — o sea
 * que el 127 tambien estaba mal — y Valeria Atencio en agosto de 2025. Fak lo vio apenas
 * abrio el archivo.
 *
 * Un gate que no puede dar VERDE esta tan roto como el que no puede dar ROJO, asi que el
 * equipo correcto del 173 tiene que pasar entero.
 */
import { describe, it, expect } from 'vitest';
import {
  NOMINA, buscarPersona, trabajaHoy, revisarEquipo, normalizarNombre, activosDe, nominaVencida,
} from '../../scripts/_lib/nomina.mjs';

const EQUIPO_QUE_EMITI = [
  'Facundo Santoro (Ingenieria)',
  'Carlos Baptista (Ingenieria)',
  'Araceli Maidana (Ingenieria)',
  'Pablo Gamboa (Ingenieria)',
  'Manuel Meszaros (Calidad)',
  'Cristina Rabago (Seguridad e Higiene)',
  'Valeria Atencio (Seguridad e Higiene)',
];

const EQUIPO_CORREGIDO = EQUIPO_QUE_EMITI.filter(
  (e) => !e.startsWith('Araceli') && !e.startsWith('Valeria'),
);

describe('nomina de Barack', () => {
  describe('ROJO — no deja pasar a quien no trabaja', () => {
    it('el equipo que emiti en el AMFE 173 da DOS criticos, y los nombra', () => {
      const p = revisarEquipo(EQUIPO_QUE_EMITI).filter((x) => x.gravedad === 'CRITICAL');
      expect(p.map((x) => x.persona).sort()).toEqual(['Araceli Maidana', 'Valeria Atencio']);
      // El motivo tiene que traer la evidencia, no solo el veredicto.
      expect(p.find((x) => x.persona === 'Araceli Maidana').motivo).toMatch(/2024/);
    });

    it('Marcelo Nieve tampoco pasa: renuncio el 01/09/2026', () => {
      expect(trabajaHoy('Marcelo Nieve (Calidad)')).toBe(false);
      expect(revisarEquipo(['Marcelo Nieve (Calidad)'])[0].gravedad).toBe('CRITICAL');
    });

    it('un nombre que la nomina no conoce es critico, no se adivina', () => {
      const p = revisarEquipo(['Juan Perez (Calidad)']);
      expect(p[0].gravedad).toBe('CRITICAL');
      expect(p[0].motivo).toMatch(/no esta en la nomina/);
    });

    it('una baja probable sin confirmar avisa, no bloquea', () => {
      const p = revisarEquipo(['Jean Claudio Pagliaroli (Seguridad e Higiene)']);
      expect(p[0].gravedad).toBe('WARNING');
      expect(p[0].motivo).toMatch(/sin confirmar/);
    });
  });

  describe('VERDE — el equipo correcto pasa entero', () => {
    it('los cinco que quedan del 173 no dan ningun problema', () => {
      expect(revisarEquipo(EQUIPO_CORREGIDO)).toEqual([]);
    });

    it('tambien pasa escrito como texto separado por comas', () => {
      expect(revisarEquipo(EQUIPO_CORREGIDO.join(', '))).toEqual([]);
    });

    it('una lista vacia no inventa problemas', () => {
      expect(revisarEquipo([])).toEqual([]);
      expect(revisarEquipo('')).toEqual([]);
    });
  });

  describe('como se escribe el nombre no cambia quien es', () => {
    it('la inicial y el apellido alcanzan: asi lo escriben los listados maestros', () => {
      expect(buscarPersona('C.BAPTISTA').nombre).toBe('Carlos Baptista');
      expect(buscarPersona('C. Baptista').nombre).toBe('Carlos Baptista');
      expect(buscarPersona('Carlos Baptista (Ingenieria)').nombre).toBe('Carlos Baptista');
    });

    it('las tildes no cambian a la persona', () => {
      expect(buscarPersona('Paulo Centurión').nombre).toBe('Paulo Centurion');
      expect(normalizarNombre('Paulo Centurión (Ingeniería)')).toBe('paulo centurion');
    });

    it('una inicial que no coincide NO encuentra a nadie: no se adivina por apellido', () => {
      expect(buscarPersona('Z.Baptista')).toBeNull();
    });
  });

  describe('el archivo de nomina se sostiene solo', () => {
    it('toda persona tiene area y evidencia, y toda baja tiene su fecha', () => {
      for (const p of NOMINA.personas) {
        expect(p.nombre, 'nombre').toBeTruthy();
        expect(p.area, `area de ${p.nombre}`).toBeTruthy();
        expect(p.evidencia, `evidencia de ${p.nombre}`).toBeTruthy();
        if (p.activo === false) expect(p.baja, `fecha de baja de ${p.nombre}`).toBeTruthy();
      }
    });

    it('no hay dos veces la misma persona', () => {
      const n = NOMINA.personas.map((p) => normalizarNombre(p.nombre));
      expect(new Set(n).size).toBe(n.length);
    });

    it('declara hasta cuando vale, y hoy todavia vale', () => {
      expect(NOMINA.verificado_el).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(NOMINA.vence_el).getTime()).toBeGreaterThan(new Date(NOMINA.verificado_el).getTime());
      expect(nominaVencida()).toBe(false);
    });

    it('vencida, avisa — el control no se queda callado cuando el dato envejece', () => {
      const dentroDeDosAnios = new Date(new Date(NOMINA.vence_el).getTime() + 730 * 864e5);
      expect(nominaVencida(dentroDeDosAnios)).toBe(true);
    });

    it('hay alguien activo en cada area que firma un AMFE', () => {
      for (const area of ['Ingenieria', 'Calidad', 'Seguridad e Higiene']) {
        expect(activosDe(area).length, area).toBeGreaterThan(0);
      }
    });
  });
});
