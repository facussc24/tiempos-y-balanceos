// explicar-prompt.sh (UserPromptSubmit) — cuando Fak dice que no entendio, pide que se lo expliquen o pide corto,
// le recuerda a Claude el skill `explicar-mejor`. No bloquea.
// Origen: 02/10/2026, despues de probar la escalera del post de Karpathy (texto simple -> dibujo -> pagina -> video).
//
// Probado en las dos direcciones con mensajes REALES de Fak (con sus errores de tipeo): los rojos tienen que marcar,
// y las muletillas ("entendes?"), los pedidos de trabajo y las palabras parecidas no.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CASOS, CANON, senales, avisoDe, atender } from '../../scripts/_lib/explicarGuard.mjs';

const RAIZ = process.cwd();
const HOOK = path.join(RAIZ, '.claude', 'hooks', 'explicar-prompt.sh');
const correr = (payload) => spawnSync('bash', [HOOK], { input: typeof payload === 'string' ? payload : JSON.stringify(payload), encoding: 'utf8' });
const prompt = (t, extra = {}) => ({ hook_event_name: 'UserPromptSubmit', session_id: 's1', prompt: t, ...extra });

describe('explicarGuard — como dice Fak que no entendio (palabras)', () => {
  it.each(['no_entendi', 'explicame', 'corto'])('ROJO: los mensajes reales de "%s" marcan esa senal', (k) => {
    for (const t of CASOS[k]) expect(senales(t), t.slice(0, 60)).toContain(k);
  });
  it('VERDE: muletillas, pedidos de trabajo y palabras parecidas no marcan nada', () => {
    for (const t of CASOS.verdes) expect(senales(t), t.slice(0, 60)).toEqual([]);
  });
  it('"entendes?" y "entendiste?" van para Claude o son muletilla; la primera persona si marca, aun mal tipeada', () => {
    expect(senales('no etnenedes comoc funciona el rpoceos?')).toEqual([]);
    expect(senales('pasame la bom entendes? asi lo reviso comprendes')).toEqual([]);
    expect(senales('no entenidste bien creo')).toEqual([]);
    expect(senales('noe ntenid nada')).toContain('no_entendi');
    expect(senales('la verdad noentiendo')).toContain('no_entendi');
    expect(senales('yo lo mire y no la entendi sinceramente')).toContain('no_entendi');
  });
  it('sin negacion no marca: "ya entiendo", "entiendo que falta el nido"', () => {
    expect(senales('ah listo ya entiendo dale')).toEqual([]);
    expect(senales('entiendo de que falta disenar el nido')).toEqual([]);
  });
  it('una palabra comun escrita exacta no es un tipeo de "entiendo" (y no le gana a un tipeo real)', () => {
    expect(senales('no la seguis teniendo')).toEqual([]);
    expect(senales('no estoy enviando nada ni comprando el material')).toEqual([]);
    expect(senales('que carajo es la scp ?? no etneindo?')).toContain('no_entendi');   // empataba con "teniendo"
    for (const p of CANON.no_entendi.otras_palabras) expect(CANON.no_entendi.propias).not.toContain(p);
  });
  it('"explicame" es un pedido; "explicales", "te explico" y "eso explica por que" no', () => {
    expect(senales('explciame mejor')).toContain('explicame');
    expect(senales('me podes explicar que paso')).toContain('explicame');
    expect(senales('explicales que les comparto la carpeta')).toEqual([]);
    expect(senales('como te explico que vos manejes el arb')).toEqual([]);
    expect(senales('eso justamente explica por que los informes dicen otra cosa')).toEqual([]);
    expect(senales('quedo bien explicado en la hoja')).toEqual([]);
  });
  it('"sintetiza" en sus tipeos reales; "resumir" y "resumiendo" como parte de un pedido no', () => {
    for (const t of ['sintetiza', 'sinteteiza', 'sintetniza', 'sintientiez', 'sisntetniezame', 'sintteitzar', 'sintentiz']) expect(senales(t), t).toContain('corto');
    expect(senales('redactar y resumir mails')).toEqual([]);
    expect(senales('estoy resumiendo el proyecto')).toEqual([]);
    expect(senales('los sintomas de la maquina')).toEqual([]);
  });
  it('lo que Fak pega (<pasted_content>, una cita larga) no cuenta como palabras suyas', () => {
    expect(senales('<pasted_content id="a1">no entendi nada, explicame mejor, sintetiza</pasted_content> pasame esto a un mail')).toEqual([]);
    expect(senales('mira "el cliente dice que no entiende el plan de control y que se lo expliquen mejor" que opinas')).toEqual([]);
  });
});

describe('explicarGuard — el aviso', () => {
  it('no entendio o pide explicacion -> aviso de explicar, que nombra un skill que EXISTE', () => {
    const a = avisoDe(CASOS.no_entendi[0]);
    expect(a).toMatch(/\[EXPLICAR-MEJOR\]/); expect(a).toMatch(/skill `explicar-mejor`/); expect(a).toMatch(/cambia la FORMA/);
    expect(avisoDe(CASOS.explicame[0])).toBe(a);
    const skill = path.join(RAIZ, '.claude', 'skills', 'explicar-mejor', 'SKILL.md');
    expect(fs.existsSync(skill), 'el aviso manda a un skill que no esta').toBe(true);
    expect(fs.readFileSync(skill, 'utf8')).toMatch(/^---\nname: explicar-mejor\n/);
  });
  it('pide corto -> aviso corto; si ademas no entendio, gana el de explicar', () => {
    expect(avisoDe('sintetiza')).toMatch(/1 a 4 renglones/);
    expect(avisoDe('sintetiza')).not.toMatch(/cambia la FORMA/);
    expect(avisoDe('no enteindo sintetiza que hay que ahacer')).toMatch(/cambia la FORMA/);
  });
  it('VERDE: un mensaje comun, un aviso automatico y un subagente no reciben nada', () => {
    expect(avisoDe('corregi el amfe 173, ojo con la op 20')).toBeNull();
    expect(avisoDe('<task-notification>el agente dice: no entendi el pedido, explicame</task-notification>')).toBeNull();
    expect(atender(prompt('no entendi nada', { agent_id: 'a1' }))).toBeNull();
    expect(atender({ hook_event_name: 'PreToolUse', prompt: 'no entendi nada' })).toBeNull();
    expect(atender(null)).toBeNull();
  });
});

describe('explicar-prompt.sh — el hook de verdad (bash -> node)', () => {
  it('ROJO: "no te entendi un carajo" -> exit 0 y additionalContext con el aviso', () => {
    const r = correr(prompt('no te entendi un carajo, no te entendi literalmente nada.'));
    expect(r.status, r.stderr).toBe(0);
    const j = JSON.parse(r.stdout);
    expect(j.hookSpecificOutput.hookEventName).toBe('UserPromptSubmit');
    expect(j.hookSpecificOutput.additionalContext).toMatch(/explicar-mejor/);
  });
  it('VERDE: un pedido comun -> exit 0 y nada en la salida', () => {
    const r = correr(prompt('pasame el archivo de la bom entendes? asi lo reviso'));
    expect(r.status, r.stderr).toBe(0); expect(r.stdout).toBe(''); expect(r.stderr).toBe('');
  });
  it('JSON roto o vacio -> exit 0, sin ruido: nunca frena el turno', () => {
    for (const basura of ['', '{no es json', '[]']) { const r = correr(basura); expect(r.status).toBe(0); expect(r.stdout).toBe(''); }
  });
});
