// P5: agentes-guard avisa, sin frenar, cuando un Sonnet lleva un pedido de busqueda.
// Corre el hook REAL por bash con una casa de mentira (HOME y CLAUDE_PROJECT_DIR temporales):
// no toca ~/.claude ni el registro real de spawns. Sin red, sin Supabase.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// Git Bash quiere barras normales en las rutas que le pasamos por argumento y por entorno
const posix = (p) => p.replace(/\\/g, '/');
const HOOK = posix(path.join(RAIZ, '.claude', 'hooks', 'agentes-guard.sh'));

const DEF = (name, model, effort) => `---\nname: ${name}\nmodel: ${model}\neffort: ${effort}\n---\n`;

function armarCasa() {
  const casa = mkdtempSync(path.join(tmpdir(), 'agentes-guard-p5-'));
  const home = path.join(casa, 'home');
  const repo = path.join(casa, 'repo');
  const propios = path.join(home, '.claude', 'agents');
  const proyecto = path.join(repo, '.claude', 'agents');
  mkdirSync(propios, { recursive: true });
  mkdirSync(proyecto, { recursive: true });
  // las tres definiciones que la regla nombra: sonnet+xhigh, haiku+medium, y el auditor en opus
  writeFileSync(path.join(propios, 'investigador.md'), DEF('investigador', 'sonnet', 'xhigh'));
  writeFileSync(path.join(propios, 'buscador.md'), DEF('buscador', 'haiku', 'medium'));
  writeFileSync(path.join(proyecto, 'auditor.md'), DEF('auditor', 'opus', 'xhigh'));
  return { casa, home, repo };
}

function correr(c, tool_input, tool_name = 'Agent') {
  const payload = JSON.stringify({ session_id: 'sesion-p5', tool_name, tool_input });
  const r = spawnSync('bash', [HOOK], {
    input: payload,
    encoding: 'utf8',
    timeout: 10_000,
    env: { ...process.env, HOME: posix(c.home), CLAUDE_PROJECT_DIR: posix(c.repo) },
  });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const aviso = (r) => (r.stdout.trim() ? JSON.parse(r.stdout).hookSpecificOutput.additionalContext : '');
const lineas = (c, nombre) => {
  const f = path.join(c.home, '.claude', nombre);
  return existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean) : [];
};

const BUSCA = 'Buscá en scripts/ dónde se define cicloDia y listame las rutas con número de línea.';
const ESCRIBE = 'Escribí el test de cicloDia en __tests__/scripts/ y corré vitest hasta que pase.';

describe('agentes-guard · P5: ¿esto es buscar o decidir? (aviso, no freno)', () => {
  let c;
  beforeEach(() => { c = armarCasa(); });
  afterEach(() => { rmSync(c.casa, { recursive: true, force: true }); });

  it('VERDE: un Sonnet con un pedido de búsqueda pasa (0), recibe el aviso y queda anotado', () => {
    const r = correr(c, { subagent_type: 'investigador', description: 'Buscar cicloDia', prompt: BUSCA });
    expect(r.status).toBe(0);
    expect(aviso(r)).toContain('buscar o decidir');
    expect(aviso(r)).toContain('buscador');
    expect(aviso(r)).toContain('no la relances');
    const reg = lineas(c, '.agent-busquedas.log');
    expect(reg).toHaveLength(1);
    expect(reg[0]).toMatch(/^\d+ investigador \S+$/);
    // la llamada descontó igual: el aviso no la saca del presupuesto
    expect(lineas(c, '.agent-spawns.log')[0]).toMatch(/ Agent 4$/);
  });

  it('VERDE: alcanza con la description (prompt sin verbo de búsqueda)', () => {
    const r = correr(c, { subagent_type: 'investigador', description: 'Listar las skills sin «Usar cuando»', prompt: 'Las 29 de .claude/skills.' });
    expect(r.status).toBe(0);
    expect(aviso(r)).toContain('buscar o decidir');
  });

  it('VERDE: comillas escapadas antes del verbo y «no escribas nada» no tapan el aviso', () => {
    const prompt = 'Contexto: Fak dijo "¿de dónde sacaste eso?". Encontrá la fuente del número en exports/. No escribas nada.';
    const r = correr(c, { subagent_type: 'investigador', description: 'x', prompt });
    expect(r.status).toBe(0);
    expect(aviso(r)).toContain('buscar o decidir');
  });

  it('VERDE: con el orden real del payload (description, prompt, subagent_type al final) y un prompt corto, el aviso sale', () => {
    // el texto del prompt no debe seguir de largo hasta "subagent_type":"investigador" («investig» es verbo de trabajo)
    const r = correr(c, { description: 'Buscar cicloDia', prompt: 'Buscá dónde se define cicloDia.', subagent_type: 'investigador' });
    expect(r.status).toBe(0);
    expect(aviso(r)).toContain('buscar o decidir');
  });

  it('VERDE: «no escribas» como única señal dispara y se anota sin espacios (3 campos en el registro)', () => {
    const r = correr(c, { subagent_type: 'investigador', description: 'Mirar un archivo', prompt: 'Mirá docs/COLA_CAMBIOS_CODIGO.md y decime qué dice la fila P5. No escribas nada.' });
    expect(r.status).toBe(0);
    expect(aviso(r)).toContain('«no escribas»');
    expect(lineas(c, '.agent-busquedas.log')[0]).toMatch(/^\d+ investigador no_escribas$/);
  });

  it('VERDE: con .agent-limit en 0 (conteo apagado) el aviso sale igual y se anota', () => {
    writeFileSync(path.join(c.home, '.claude', '.agent-limit'), '0\n');
    const r = correr(c, { subagent_type: 'investigador', description: 'Buscar', prompt: BUSCA });
    expect(r.status).toBe(0);
    expect(aviso(r)).toContain('buscar o decidir');
    expect(lineas(c, '.agent-busquedas.log')).toHaveLength(1);
  });

  it('VERDE: el JSON del aviso es válido y es solo hookSpecificOutput de PreToolUse', () => {
    const r = correr(c, { subagent_type: 'investigador', description: 'Buscar', prompt: BUSCA });
    const j = JSON.parse(r.stdout);
    expect(Object.keys(j)).toEqual(['hookSpecificOutput']);
    expect(j.hookSpecificOutput.hookEventName).toBe('PreToolUse');
    expect(j.hookSpecificOutput.permissionDecision).toBeUndefined();
  });

  it('ROJO: el mismo pedido en buscador (haiku) pasa callado y no se anota', () => {
    const r = correr(c, { subagent_type: 'buscador', description: 'Buscar cicloDia', prompt: BUSCA });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('');
    expect(lineas(c, '.agent-busquedas.log')).toEqual([]);
  });

  it('ROJO: un Sonnet que escribe no recibe aviso', () => {
    const r = correr(c, { subagent_type: 'investigador', description: 'Escribir el test', prompt: ESCRIBE });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('');
    expect(lineas(c, '.agent-busquedas.log')).toEqual([]);
  });

  it('ROJO: buscar Y arreglar es trabajo de Sonnet: sin aviso', () => {
    const r = correr(c, { subagent_type: 'investigador', description: 'Arreglar cicloDia', prompt: `${BUSCA} Después arreglá el parseo del día 30.` });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  it('ROJO: el auditor (opus) con «buscá» en el prompt no recibe aviso', () => {
    const r = correr(c, { subagent_type: 'auditor', description: 'Auditoría', prompt: `Auditá el diff. ${BUSCA}` });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  it('ROJO: Opus explícito con un pedido de búsqueda pasa sin aviso (Opus decide, no busca)', () => {
    const r = correr(c, { subagent_type: 'investigador', model: 'opus', description: 'Buscar', prompt: BUSCA });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('');
    expect(lineas(c, '.agent-spawns.log')[0]).toMatch(/ Agent 8$/);
  });

  it('FRENO INTACTO: effort max sigue en 2 aunque el pedido sea una búsqueda, y sin JSON', () => {
    const r = correr(c, { subagent_type: 'investigador', effort: 'max', description: 'Buscar', prompt: BUSCA });
    expect(r.status).toBe(2);
    expect(r.stdout.trim()).toBe('');
    expect(r.stderr).toContain('el maximo es xhigh');
    expect(lineas(c, '.agent-busquedas.log')).toEqual([]);
  });

  it('FRENO INTACTO: presupuesto agotado sigue en 2; una llamada frenada no se anota como búsqueda', () => {
    const ahora = Math.floor(Date.now() / 1000);
    const diezSonnet = Array.from({ length: 10 }, () => `${ahora} Agent 4`).join('\n') + '\n';
    writeFileSync(path.join(c.home, '.claude', '.agent-spawns.log'), diezSonnet);
    const r = correr(c, { subagent_type: 'investigador', description: 'Buscar', prompt: BUSCA });
    expect(r.status).toBe(2);
    expect(r.stdout.trim()).toBe('');
    expect(r.stderr).toContain('presupuesto de subagentes agotado');
    expect(lineas(c, '.agent-busquedas.log')).toEqual([]);
  });

  it('FRENO INTACTO: Workflow sigue denegado y sin JSON', () => {
    const r = correr(c, { prompt: BUSCA }, 'Workflow');
    expect(r.status).toBe(2);
    expect(r.stdout.trim()).toBe('');
  });
});
