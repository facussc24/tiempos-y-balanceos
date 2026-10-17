// @vitest-environment node
/**
 * Lo que da 400 en los modelos 5.x no sale de la puerta (tanda 5 pieza 5, 17/10/2026; guia de migracion del skill
 * claude-api, `shared/model-migration.md`): ni `thinking`, ni `temperature`/`top_p`/`top_k`, ni `tool_choice`, ni un
 * prefill; el fallback del servidor solo en su forma 'default' con su cabecera y nunca en Haiku ni en un lote; un solo
 * `cache_control`. Y ningun prompt de la API pide el razonamiento como campo de salida (desde el 24/09/2026 ese
 * rechazo, `reasoning_extraction`, se cobra). Sin red: todo es armar el pedido o leer texto.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as A from '../../scripts/_lib/claudeApi.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROHIBIDOS = ['thinking', 'temperature', 'top_p', 'top_k', 'tool_choice', 'stop_sequences_prefill'];
const contarCache = (p) => JSON.stringify(p).split('"cache_control"').length - 1;

describe('claudeApi · migracion a los 5.x', () => {
  for (const modelo of ['opus', 'sonnet', 'haiku', 'fable']) {
    it(`${modelo}: el pedido no lleva nada que de 400, y a lo sumo un cache_control`, () => {
      const { params, betas } = A.armarParametros({
        modelo, system: 'system largo y estable', usuario: 'hola', effort: 'medium', cacheTtl: '1h', schema: { type: 'object' },
        ...(modelo === 'fable' ? { pedidoFable: 'Fak 17/10 10:00: "usa fable para esto"' } : {}),
      });
      for (const k of PROHIBIDOS) expect(params).not.toHaveProperty(k);
      expect(params.output_config.effort).toBe('medium');
      expect(contarCache(params)).toBe(1);
      if (modelo === 'haiku') {
        expect(params.fallbacks).toBeUndefined();
        expect(betas).toEqual([]);
      } else {
        expect(params.fallbacks).toBe('default');
        expect(betas).toEqual(['server-side-fallback-2026-07-01']);
      }
    });
  }

  it('un prefill (ultimo turno del asistente con solo texto) se frena antes de mandar', () => {
    expect(() => A.armarParametros({ modelo: 'opus', mensajes: [{ role: 'user', content: 'x' }, { role: 'assistant', content: '{"a":' }] })).toThrow(/prefill/);
    expect(() => A.armarParametros({ modelo: 'opus', mensajes: [{ role: 'user', content: 'x' }, { role: 'assistant', content: [{ type: 'text', text: '{' }] }] })).toThrow(/prefill/);
  });

  it('el turno que el agente reenvia despues de un pause_turn (con herramientas del servidor) NO es prefill', () => {
    const mensajes = [
      { role: 'user', content: [{ type: 'text', text: 'busca' }] },
      { role: 'assistant', content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'server_tool_use', id: 'srv_1', name: 'web_search', input: { query: 'x' } }] },
    ];
    expect(A.esPrefill(mensajes)).toBe(false);
    expect(() => A.armarParametros({ modelo: 'sonnet', mensajes })).not.toThrow();
  });

  it('un lote nunca lleva fallbacks (los Batches lo rechazan)', async () => {
    let cuerpo;
    const cliente = { messages: { batches: { create: async (c) => { cuerpo = c; return { id: 'b', processing_status: 'in_progress' }; } } } };
    await A.crearLote(cliente, [{ id: 'x1', modelo: 'opus', usuario: 'hola', effort: 'high' }]);
    expect(cuerpo.requests[0].params.fallbacks).toBeUndefined();
    for (const k of PROHIBIDOS) expect(cuerpo.requests[0].params).not.toHaveProperty(k);
  });
});

describe('prompts de la API · no piden el razonamiento como salida', () => {
  // Lo que se le manda a la API: la puerta, la noche y lo que corre de noche, el agente, y los pedidos escritos.
  const ARCHIVOS = [
    'scripts/_lib/claudeApi.mjs', 'scripts/_nocturno.mjs', 'scripts/_lib/nocturno.mjs', 'scripts/_preauditarAmfe.mjs',
    'scripts/_lib/preauditoriaAmfe.mjs', 'scripts/_propuestasSkills.mjs', 'scripts/_pruebaDisparoSkills.mjs',
    'scripts/_agente.mjs', 'scripts/_lib/agenteApi.mjs',
  ];
  const pedidos = fs.existsSync(path.join(RAIZ, 'docs/pedidos-api'))
    ? fs.readdirSync(path.join(RAIZ, 'docs/pedidos-api')).filter((f) => f.endsWith('.md')).map((f) => `docs/pedidos-api/${f}`)
    : [];
  // Pedirle al modelo que escriba su razonamiento en la respuesta: una etiqueta <thinking>, un scratchpad, un campo
  // `reasoning`/`razonamiento` en el esquema, "pensa paso a paso y mostralo".
  const RE_EXTRACCION = /<\/?thinking>|scratchpad|["'`]?(reasoning|razonamiento|chain_of_thought)["'`]?\s*:\s*\{|(mostr|escrib|devolv)[a-záéíóú]*\s+(tu|el|su)\s+razonamiento|think step by step|pens[aá] paso a paso/i;

  it('el patron reconoce los casos que se cobran (gemelo rojo)', () => {
    for (const malo of ['Antes de responder, pensá en un <thinking>', 'usá un scratchpad', 'reasoning: { type: "string" }', 'Mostrá tu razonamiento antes del JSON', 'Think step by step']) {
      expect(RE_EXTRACCION.test(malo), malo).toBe(true);
    }
    for (const bueno of ['por_que: { type: "string", description: "una frase" }', 'Si queda alguna duda razonable, se descarta', 'Nadie aprueba paso a paso']) {
      expect(RE_EXTRACCION.test(bueno), bueno).toBe(false);
    }
  });

  for (const rel of [...ARCHIVOS, ...pedidos]) {
    it(`${rel} no pide el razonamiento como salida`, () => {
      const texto = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
      // el comentario de la puerta que EXPLICA la regla nombra las palabras: se mira solo lo que no es comentario
      const sinComentarios = texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(sinComentarios.match(RE_EXTRACCION)?.[0] ?? null).toBeNull();
    });
  }
});
