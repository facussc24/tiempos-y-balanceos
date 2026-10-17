/**
 * revisorPedidoCierre.test.mjs — el paso «Revisor contra el pedido» de _cierreSesion.mjs (tanda 9, pieza 1):
 * avisa si hubo entregas sin revisor, calla si no hubo entregas, y NUNCA da 'falta' la primera semana.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { senalesDeLinea, relevarRevisorPedido, evaluarRevisorPedido, registroDeSesion } from '../../scripts/_lib/revisorPedido.mjs';

const asis = (content, extra = {}) => JSON.stringify({ type: 'assistant', message: { content }, ...extra });
const uso = (name, input) => ({ type: 'tool_use', name, input });

describe('senales del registro', () => {
  it('cuenta SendUserFile y un Write de un documento en exports como entrega', () => {
    expect(senalesDeLinea(asis([uso('SendUserFile', { files: ['C:\\x\\a.pptx'] })])).entregas).toEqual(['C:\\x\\a.pptx']);
    expect(senalesDeLinea(asis([uso('Write', { file_path: 'C:\\Dev\\BarackMercosul\\exports\\T\\informe.pdf' })])).entregas).toHaveLength(1);
  });
  it('NO cuenta un .mjs en exports, un .pptx fuera de exports ni lo que hace un subagente', () => {
    expect(senalesDeLinea(asis([uso('Write', { file_path: 'C:\\Dev\\BarackMercosul\\exports\\T\\gen.mjs' })])).entregas).toEqual([]);
    expect(senalesDeLinea(asis([uso('Write', { file_path: 'C:\\tmp\\a.pptx' })])).entregas).toEqual([]);
    expect(senalesDeLinea(asis([uso('SendUserFile', { files: ['a.pdf'] })], { isSidechain: true })).entregas).toEqual([]);
  });
  it('reconoce al revisor por su tipo o por su cuerpo pegado en un investigador', () => {
    expect(senalesDeLinea(asis([uso('Agent', { subagent_type: 'revisor-pedido', prompt: 'x' })])).revisor).toBe(true);
    expect(senalesDeLinea(asis([uso('Agent', { subagent_type: 'investigador', prompt: '# Revisor contra el pedido\n...' })])).revisor).toBe(true);
    expect(senalesDeLinea(asis([uso('Agent', { subagent_type: 'auditor', prompt: 'auditá' })])).revisor).toBe(false);
  });
});

describe('evaluarRevisorPedido', () => {
  it('AVISO: hubo entregas y el revisor no corrio (nunca falta)', () => {
    const r = evaluarRevisorPedido({ entregas: ['a.pptx'], revisor: false });
    expect(r.estado).toBe('aviso');
    expect(r.detalle).toMatch(/revisor-pedido no corrio/);
  });
  it('OK con entregas y revisor; NO-APLICA sin entregas; AVISO si no se pudo leer', () => {
    expect(evaluarRevisorPedido({ entregas: ['a.pptx'], revisor: true }).estado).toBe('ok');
    expect(evaluarRevisorPedido({ entregas: [], revisor: false }).estado).toBe('no-aplica');
    expect(evaluarRevisorPedido({ leido: false }).estado).toBe('aviso');
  });
  it('de punta a punta sobre un registro armado, y el registro se ubica por el id de la sesion', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'revped-'));
    const dir = path.join(home, '.claude', 'projects', 'C--Dev-BarackMercosul');
    fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, 'abcdef12.jsonl');
    fs.writeFileSync(p, [asis([uso('SendUserFile', { files: ['C:\\x\\a.pptx'] })]), asis([{ type: 'text', text: 'listo' }])].join('\n'));
    expect(registroDeSesion('abcdef12', { home })).toBe(p);
    expect(registroDeSesion('../malo', { home })).toBeNull();
    expect(evaluarRevisorPedido(relevarRevisorPedido(p)).estado).toBe('aviso');
    fs.appendFileSync(p, `\n${asis([uso('Agent', { subagent_type: 'revisor-pedido', prompt: 'x' })])}`);
    // despues del revisor siempre hay mas lineas (la respuesta, otro comando): la marca no se puede perder por eso.
    // Lo encontro la revision adversarial del 17/10 sobre un diff plantado (`revisor = s.revisor` en vez de `||=`).
    fs.appendFileSync(p, `\n${asis([uso('Bash', { command: 'ls' })])}\n${asis([{ type: 'text', text: 'listo' }])}`);
    expect(evaluarRevisorPedido(relevarRevisorPedido(p)).estado).toBe('ok');
  });
});
