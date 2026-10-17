// carpeta-guard (hook GLOBAL, tanda 1.7 del plan del sistema, 16/10/2026): un renglon cuando la sesion se abrio POR ERROR
// en una carpeta que no es la del proyecto (una de arriba del repo, la de usuario, otra con «barack») y el repo existe en
// la PC; silencio en el repo, en un worktree, en una carpeta que Fak abre a proposito (estudio) y si el repo no esta.
// Se corre como lo corre Claude Code: `bash <hook> <modo>` con el JSON por stdin; HOME y BARACK_REPO apuntan a una
// carpeta de prueba para no tocar las marcas reales de la maquina. El caso H4/H9 sale del auditor del 16/10.
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const RAIZ = process.cwd();
const HOOK = path.join(RAIZ, '.claude', 'hooks', 'carpeta-guard.sh');
// Fuera de la carpeta Temp a proposito: Git Bash convierte HOME a /tmp/... cuando apunta adentro de %TEMP% (medido el
// 16/10/2026), y el hook compara la carpeta de la sesion contra HOME tal como bash lo ve. Debajo de la carpeta de usuario
// real llega como C:/Users/... o /c/Users/..., las dos formas que el hook normaliza.
const TMP = fs.mkdtempSync(path.join(os.homedir(), '.carpeta-guard-test-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));
const posix = (p) => p.replace(/\\/g, '/');
const win = (p) => p.replace(/\//g, '\\');

const home = path.join(TMP, 'Users', 'facu');
const dev = path.join(TMP, 'Dev');
const repo = path.join(dev, 'BarackMercosul');
fs.mkdirSync(home, { recursive: true });
fs.mkdirSync(repo, { recursive: true });

const correr = (modo, payload, extra = {}) => {
  const r = spawnSync('bash', [HOOK, modo], {
    input: JSON.stringify(payload), encoding: 'utf8', cwd: RAIZ,
    env: { ...process.env, HOME: posix(home), BARACK_REPO: posix(repo), ...extra },
  });
  return { exit: r.status, out: r.stdout ?? '', err: r.stderr ?? '' };
};
// El mensaje REAL de Fak (16/10/2026 10:55), con el que nacio esta pieza.
const FAK = 'el Claude de mi PC principal no sabe cómo se comunican mis 2 notebooks… ni yo sé qué carpeta debo elegir, ¿Barack Mercosul? Si Claude detecta que estoy en la carpeta incorrecta me puede avisar, es muy importante';

describe('carpeta-guard.sh inicio (SessionStart)', () => {
  it('ROJO: la sesion esta en la carpeta de arriba del repo (C:\\Dev) y el repo existe -> un renglon con las dos carpetas, exit 0', () => {
    const r = correr('inicio', { hook_event_name: 'SessionStart', source: 'startup', cwd: win(dev) });
    expect(r.exit).toBe(0);
    expect(r.out).toMatch(/^\[CARPETA\] Esta sesion esta en «/);
    expect(r.out.toLowerCase()).toContain(win(dev).toLowerCase());
    expect(r.out.toLowerCase()).toContain(win(repo).toLowerCase());
    expect(r.out).toContain('Alt+1');
    expect(r.out.trim().split('\n')).toHaveLength(1);
    expect(r.err).toBe('');
  });

  it('ROJO: tambien la raiz del disco, la carpeta de usuario (en las dos formas de ruta) y otra carpeta con «barack» (otro clon, el asistente por area)', () => {
    expect(correr('inicio', { cwd: win(TMP) }).out).toContain('[CARPETA]');                 // arriba del repo
    expect(correr('inicio', { cwd: win(home) }).out).toContain('[CARPETA]');                // la de usuario, C:\Users\x
    expect(correr('inicio', { cwd: posix(home) }).out).toContain('[CARPETA]');              // la misma, C:/Users/x
    expect(correr('inicio', { cwd: `${win(repo)}-viejo` }).out).toContain('[CARPETA]');     // C:\Dev\BarackMercosul-viejo
    expect(correr('inicio', { cwd: 'C:\\ClaudeBarack' }).out).toContain('[CARPETA]');
  });

  it('VERDE: en el repo (con cualquier mayuscula o barra) y en un worktree adentro del repo, silencio', () => {
    expect(correr('inicio', { cwd: win(repo) })).toMatchObject({ exit: 0, out: '' });
    expect(correr('inicio', { cwd: posix(repo) })).toMatchObject({ exit: 0, out: '' });
    expect(correr('inicio', { cwd: win(repo).toUpperCase() })).toMatchObject({ exit: 0, out: '' });
    expect(correr('inicio', { cwd: `${win(repo)}\\.claude\\worktrees\\impresora-tanda17` })).toMatchObject({ exit: 0, out: '' });
  });

  it('VERDE (H4): una carpeta que Fak abre a proposito (estudio, un kit, otra cosa suya) no es un error: silencio', () => {
    for (const cwd of ['D:\\KIT-ESTUDIO-CLAUDE', `${win(home)}\\Documents\\estudio`, 'C:\\Proyectos\\otro', 'C:\\Dev\\Pedro']) {
      expect(correr('inicio', { cwd }), cwd).toMatchObject({ exit: 0, out: '' });
    }
  });

  it('VERDE: si el repo no existe en esta PC, o el JSON no trae carpeta, no dice nada', () => {
    expect(correr('inicio', { cwd: win(dev) }, { BARACK_REPO: posix(path.join(TMP, 'no-existe')) })).toMatchObject({ exit: 0, out: '' });
    expect(correr('inicio', { hook_event_name: 'SessionStart' })).toMatchObject({ exit: 0, out: '' });
  });
});

describe('carpeta-guard.sh prompt (UserPromptSubmit): el primer mensaje de la sesion, y la pregunta por la carpeta', () => {
  it('ROJO: primer mensaje de una sesion en C:\\Dev -> aviso; el segundo mensaje de la misma sesion -> silencio', () => {
    const primero = correr('prompt', { session_id: 's1', cwd: win(dev), prompt: 'hola' });
    expect(primero.exit).toBe(0);
    expect(primero.out).toContain('[CARPETA] Esta sesion esta en «');
    expect(fs.existsSync(path.join(home, '.claude', '.carpeta-guard', 's1'))).toBe(true);
    expect(correr('prompt', { session_id: 's1', cwd: win(dev), prompt: 'segundo mensaje' })).toMatchObject({ exit: 0, out: '' });
  });

  it('la pregunta real de Fak por la carpeta se contesta aunque la sesion este bien y no sea el primer mensaje', () => {
    expect(correr('prompt', { session_id: 's2', cwd: win(repo), prompt: 'hola' })).toMatchObject({ exit: 0, out: '' });
    const r = correr('prompt', { session_id: 's2', cwd: win(repo), prompt: FAK });
    expect(r.exit).toBe(0);
    expect(r.out).toContain('[CARPETA] Si Fak pregunta que carpeta elegir o abrir: siempre ');
    expect(r.out.toLowerCase()).toContain(win(repo).toLowerCase());
    expect(r.out).not.toContain('Esta sesion esta en');
    expect(correr('prompt', { session_id: 's2', cwd: win(repo), prompt: '¿cuál carpeta tengo que abrir en la notebook?' }).out).toContain('Si Fak pregunta');
  });

  it('VERDE (H9): mensajes que nombran una carpeta sin preguntar por ella, y los avisos de la app, no disparan nada', () => {
    const comunes = [
      'guardalo en la carpeta de la tarea del Escritorio',
      'mové los videos a la carpeta de la máquina y fijate que quede bien',
      'la carpeta de usuario tiene el curl que te dije, revisala',
      'archivá la carpeta de la tarea, ya está terminada',
      '<task-notification>¿avisar en cualquier carpeta, o solo en C:\\ y la carpeta de usuario? debo elegir</task-notification>',
      '[SYSTEM NOTIFICATION] que carpeta debo elegir',
      'From Impresora: en qué carpeta debo elegir dejar el zip',
    ];
    for (const prompt of comunes) {
      expect(correr('prompt', { session_id: 's2', cwd: win(repo), prompt }), prompt).toMatchObject({ exit: 0, out: '' });
    }
  });

  it('en C:\\Dev, la pregunta de Fak trae los dos renglones (donde esta y cual es la carpeta); un session_id larguisimo no rompe nada', () => {
    const r = correr('prompt', { session_id: 's3', cwd: win(dev), prompt: FAK });
    const lineas = r.out.trim().split('\n');
    expect(lineas).toHaveLength(2);
    expect(lineas[0]).toContain('Esta sesion esta en «');
    expect(lineas[1]).toContain('Si Fak pregunta que carpeta');
    const largo = correr('prompt', { session_id: 'x'.repeat(400), cwd: win(dev), prompt: 'hola' });
    expect(largo.exit).toBe(0);
    expect(largo.err).toBe('');
    expect(largo.out).toContain('[CARPETA]');
  });
});
