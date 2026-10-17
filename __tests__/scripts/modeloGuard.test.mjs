/**
 * modelo-guard (PreModelSwitch y PreToolUse de set_session_model) — tanda 3 del plan del sistema, pieza 12 (16/10/2026).
 * En las DOS direcciones, por el camino real (bash .claude/hooks/modelo-guard.sh con el JSON del evento).
 *
 * El modelo no se cambia a mitad de camino por cuenta propia (CLAUDE.md). /model y el selector interactivo los dispara una
 * persona: pasan. El selector de la app de escritorio llega como `sdk` (lo manda el puente con `set_model`): pasa salvo
 * que el cambio salga de una llamada de la propia sesion sin que Fak lo haya pedido en su ultimo mensaje.
 * Los mensajes de Fak son textuales de sus registros (con sus errores de tipeo).
 */
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { decidir, FRASE_MODELO } from '../../scripts/_lib/modeloGuard.mjs';

vi.setConfig({ testTimeout: 60_000 });
const RAIZ = process.cwd();
const HOOK = path.join(RAIZ, '.claude', 'hooks', 'modelo-guard.sh');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'modelo-guard-'));
// Fak, 16/10/2026 (techo-agentes.md): «Fable 5.1 ultracode de una… si o si». Fak, 15/10 (informe de CATA): el otro.
const PIDE_MODELO = 'Fable 5.1 ultracode de una… si o si';
const OTRA_COSA = 'ah si me encanta eso si hagamoslo asi me encanta dale labura aunque te tome mucho timepo hacer eos hacelo si';

/** Transcript: el mensaje de Fak y, si `llamada`, despues una llamada de la sesion a set_session_model. */
function transcript(nombre, fak, llamada, destino = 'x') {
    const f = path.join(TMP, `${nombre}.jsonl`);
    const l = [JSON.stringify({ type: 'user', timestamp: '2026-10-16T20:00:00.000Z', message: { role: 'user', content: fak } })];
    if (llamada) l.push(JSON.stringify({ type: 'assistant', timestamp: '2026-10-16T20:01:00.000Z', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'mcp__ccd_session_mgmt__set_session_model', input: { session_id: destino, model: 'claude-sonnet-5-5' } }] } }));
    fs.writeFileSync(f, `${l.join('\n')}\n`);
    return f;
}
function correr(payload) {
    const r = spawnSync('bash', [HOOK], { input: JSON.stringify(payload), encoding: 'utf8' });
    let deny = false;
    try { deny = JSON.parse(r.stdout || '{}').hookSpecificOutput?.permissionDecision === 'deny'; } catch { deny = false; }
    return { exit: r.status, deny, err: r.stderr || '' };
}
const cambio = (source, tp) => ({ hook_event_name: 'PreModelSwitch', session_id: 'x', transcript_path: tp, from_model: 'claude-fable-5-1', to_model: 'claude-sonnet-5-5', requested_model: 'sonnet', source, context_tokens: 400000, prompt_cache_warm: true });
const herramienta = (tp, model = 'claude-sonnet-5-5', destino = 'y') => ({ hook_event_name: 'PreToolUse', session_id: 'x', transcript_path: tp, tool_name: 'mcp__ccd_session_mgmt__set_session_model', tool_input: { session_id: destino, model } });

describe('modelo-guard — PreModelSwitch', () => {
    it('VERDE: /model y el selector interactivo pasan siempre (los dispara una persona)', () => {
        const tp = transcript('otra-con-llamada', OTRA_COSA, true);
        for (const s of ['command', 'picker']) { const r = correr(cambio(s, tp)); expect(r.exit).toBe(0); expect(r.deny, s).toBe(false); }
    });
    it('VERDE: el selector de la app (sdk) sin una llamada de la sesion pasa: es Fak', () => {
        const r = correr(cambio('sdk', transcript('otra-sin-llamada', OTRA_COSA, false)));
        expect(r.exit).toBe(0);
        expect(r.deny).toBe(false);
    });
    it('VERDE (auditor Opus 17/10): la madre le cambio el modelo a una HIJA y despues Fak usa el selector: pasa', () => {
        // la llamada apuntaba a otra sesion; la app no deja que una sesion se cambie el modelo a si misma
        expect(correr(cambio('sdk', transcript('a-otra-sesion', OTRA_COSA, true, 'hija-123'))).deny).toBe(false);
    });
    it('ROJO (la red, por si la app lo permite): sdk que salio de una llamada de ESTA sesion sobre si misma, sin que Fak hablara del modelo', () => {
        const r = correr(cambio('sdk', transcript('otra-con-llamada-2', OTRA_COSA, true)));
        expect(r.exit).toBe(0);
        expect(r.deny).toBe(true);
    });
    it('VERDE: la misma llamada con Fak pidiendo el modelo en su ultimo mensaje pasa', () => {
        expect(correr(cambio('sdk', transcript('pide-con-llamada', PIDE_MODELO, true))).deny).toBe(false);
    });
    it('VERDE: sin transcript que leer no se puede atribuir a la sesion: pasa (no se le traba el selector a Fak)', () => {
        expect(decidir(cambio('sdk', path.join(TMP, 'no-existe.jsonl'))).decision).toBe('deja');
    });
});

describe('modelo-guard — PreToolUse de set_session_model (una sesion que cambia el modelo de otra)', () => {
    it('ROJO: sin la frase de Fak, exit 2; sin transcript, exit 2', () => {
        const r = correr(herramienta(transcript('otra', OTRA_COSA, false)));
        expect(r.exit).toBe(2);
        expect(r.err).toMatch(/MODELO-GUARD/);
        expect(correr(herramienta(path.join(TMP, 'no-existe.jsonl'))).exit).toBe(2);
    });
    // Ronda 2 (17/10, hallazgo 17; decision de la madre): el paso 4 del camino B de lanzar-sesion-hija
    it('VERDE (ronda 2): la madre pone a una HIJA en Opus 5.5 sin frase de Fak (el modelo de la casa para las hijas)', () => {
        const tp = transcript('hija-opus', 'abri una hija para revisar los guardianes', false);
        expect(correr(herramienta(tp, 'claude-opus-5-5', 'local_hija')).exit).toBe(0);
    });
    it('ROJO (ronda 2): la madre pone a una hija en Fable sin frase de Fak; y Opus sobre la MISMA sesion tambien la pide', () => {
        const tp = transcript('hija-fable', 'abri una hija para revisar los guardianes', false);
        expect(correr(herramienta(tp, 'claude-fable-5-1', 'local_hija')).exit).toBe(2);
        expect(correr(herramienta(tp, 'claude-opus-5-5', 'x')).exit).toBe(2);
    });
    it('VERDE: con Fak pidiendolo en su ultimo mensaje, exit 0; otro evento u otra herramienta, exit 0', () => {
        expect(correr(herramienta(transcript('pide', PIDE_MODELO, false))).exit).toBe(0);
        expect(correr({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ls' } }).exit).toBe(0);
    });
    it('la frase: nombra el modelo o el cambio, sin importar tildes', () => {
        for (const t of ['pasate a opus', 'cambiá el modelo', 'usá Sonnet para eso', 'Fable 5.1 ultracode de una']) expect(FRASE_MODELO.test(t.normalize('NFD').replace(/[̀-ͯ]/g, '')), t).toBe(true);
        expect(FRASE_MODELO.test(OTRA_COSA)).toBe(false);
    });
});

describe('modelo-guard — cableado', () => {
    it('settings.json lo llama en PreModelSwitch y en PreToolUse de set_session_model, por ${CLAUDE_PROJECT_DIR}', () => {
        const s = JSON.parse(fs.readFileSync(path.join(RAIZ, '.claude', 'settings.json'), 'utf8'));
        const usa = (evento, matcher) => (s.hooks[evento] || []).some((g) => g.matcher === matcher && g.hooks.some((h) => h.command === 'bash "${CLAUDE_PROJECT_DIR}/.claude/hooks/modelo-guard.sh"'));
        expect(usa('PreModelSwitch', '')).toBe(true);
        expect(usa('PreToolUse', 'mcp__ccd_session_mgmt__set_session_model')).toBe(true);
    });
});
