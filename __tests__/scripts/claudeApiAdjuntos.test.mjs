/**
 * Tests de los PDF y las fotos en la puerta de la API (tanda 13, item 14): `bloqueAdjunto`, `contenidoConAdjuntos` y
 * `--adjunto` de `_apiTarea.mjs` con un PDF. SIN RED y sin pagar: el cliente es de mentira y se mira el cuerpo exacto
 * que saldria. En las dos direcciones: un PDF y una foto de verdad se arman; un .txt, un PDF falso, uno de mas de 600
 * paginas o un pedido de mas de 32 MB se frenan antes de mandar.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as A from '../../scripts/_lib/claudeApi.mjs';
import { armarMensaje, leerAdjuntos } from '../../scripts/_apiTarea.mjs';

let dir;
let apiDirPrevio;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudeapi-adjuntos-'));
  apiDirPrevio = process.env.BARACK_API_DIR;
  process.env.BARACK_API_DIR = dir; // el ledger del test cae en la carpeta temporal (escrituraSegura)
});
afterEach(() => {
  if (apiDirPrevio === undefined) delete process.env.BARACK_API_DIR; else process.env.BARACK_API_DIR = apiDirPrevio;
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
});

const PDF_2_PAGINAS = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >> endobj\n3 0 obj << /Type /Page >> endobj\n4 0 obj << /Type/Page >> endobj\n%%EOF\n', 'latin1');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
const leerDe = (mapa) => (ruta) => { if (!(ruta in mapa)) throw new Error(`no existe ${ruta}`); return mapa[ruta]; };

describe('PDF y fotos · el bloque que sale', () => {
  it('un PDF va como document en base64, con sus paginas contadas (las /Pages no cuentan)', () => {
    const a = A.bloqueAdjunto('manual.pdf', { leer: leerDe({ 'manual.pdf': PDF_2_PAGINAS }) });
    expect(a.bloque).toEqual({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: PDF_2_PAGINAS.toString('base64') } });
    expect(Buffer.from(a.bloque.source.data, 'base64').equals(PDF_2_PAGINAS)).toBe(true);
    expect(a.paginas).toBe(2);
  });
  it('una foto va como image con su tipo, y la extension en mayusculas tambien vale', () => {
    expect(A.bloqueAdjunto('hoja.PNG', { leer: leerDe({ 'hoja.PNG': PNG }) }).bloque.source.media_type).toBe('image/png');
    const j = A.bloqueAdjunto('foto.jpeg', { leer: leerDe({ 'foto.jpeg': JPG }) });
    expect(j.bloque.type).toBe('image');
    expect(j.bloque.source.media_type).toBe('image/jpeg');
    expect(j.paginas).toBeNull();
  });
  it('ROJO: un .txt, un .docx o un archivo sin extension no van como adjunto', () => {
    for (const r of ['notas.txt', 'informe.docx', 'sinextension']) {
      expect(() => A.bloqueAdjunto(r, { leer: () => Buffer.from('x') }), r).toThrow(/como PDF o foto/);
    }
  });
  it('ROJO: un .pdf que por dentro no es PDF, o una foto con otro contenido, no se manda', () => {
    expect(() => A.bloqueAdjunto('falso.pdf', { leer: () => Buffer.from('hola, no soy un pdf') })).toThrow(/por dentro no es application\/pdf/);
    expect(() => A.bloqueAdjunto('falsa.png', { leer: () => JPG })).toThrow(/por dentro no es image\/png/);
  });
  it('ROJO: un PDF de mas de 600 paginas se frena antes de mandar; 600 justas pasan', () => {
    const pdf = (n) => Buffer.from(`%PDF-1.7\n${'<< /Type /Page >>\n'.repeat(n)}`, 'latin1');
    expect(A.bloqueAdjunto('ok.pdf', { leer: () => pdf(600) }).paginas).toBe(600);
    expect(() => A.bloqueAdjunto('largo.pdf', { leer: () => pdf(601) })).toThrow(/601 paginas/);
  });
});

describe('PDF y fotos · el mensaje y el pedido', () => {
  it('los adjuntos van ADELANTE del texto, en el orden en que se pasan', () => {
    const c = A.contenidoConAdjuntos('Leé las escalas.', ['a.pdf', 'b.png'], { leer: leerDe({ 'a.pdf': PDF_2_PAGINAS, 'b.png': PNG }) });
    expect(c.map((b) => b.type)).toEqual(['document', 'image', 'text']);
    expect(c[2]).toEqual({ type: 'text', text: 'Leé las escalas.' });
  });
  it('ROJO: si todo junto pasa los 32 MB en base64 se frena (25 MB de PDF son 33 MB en base64)', () => {
    const gordo = Buffer.concat([Buffer.from('%PDF-1.4\n', 'latin1'), Buffer.alloc(25 * 1024 * 1024)]);
    expect(() => A.contenidoConAdjuntos('x', ['gordo.pdf'], { leer: () => gordo })).toThrow(/32 MB por pedido/);
  });
  it('armarParametros deja el contenido tal cual en el mensaje del usuario; los modelos y el fallback no cambian', () => {
    const usuario = A.contenidoConAdjuntos('Resumí.', ['a.pdf'], { leer: leerDe({ 'a.pdf': PDF_2_PAGINAS }) });
    const { params, betas } = A.armarParametros({ modelo: 'sonnet', usuario, effort: 'medium' });
    expect(params.messages).toEqual([{ role: 'user', content: usuario }]);
    expect(params.messages[0].content[0].type).toBe('document');
    expect(betas).toEqual([A.BETA_FALLBACK]);
  });
  it('llamar() con un cliente de mentira: el cuerpo lleva el PDF, y el gasto queda en el ledger como siempre', async () => {
    const registro = [];
    const cliente = { beta: { messages: { create: async (p) => { registro.push(p); return { id: 'msg_pdf', model: 'claude-sonnet-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 3000, output_tokens: 10 } }; } } } };
    const usuario = A.contenidoConAdjuntos('Resumí.', ['a.pdf'], { leer: leerDe({ 'a.pdf': PDF_2_PAGINAS }) });
    const r = await A.llamar(cliente, { modelo: 'sonnet', usuario, tarea: 'prueba-pdf', dirLedger: dir, ahora: new Date(2026, 9, 17) });
    expect(r.texto).toBe('ok');
    expect(registro[0].messages[0].content[0].source.media_type).toBe('application/pdf');
    const ledger = A.leerLedger('2026-10', dir);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ tarea: 'prueba-pdf', entrada: 3000, salida: 10 });
  });
});

describe('_apiTarea --adjunto con un PDF', () => {
  it('el PDF no se lee como texto: queda marcado como binario y el mensaje lo nombra; un .md sigue como texto', () => {
    fs.writeFileSync(path.join(dir, 'manual.pdf'), PDF_2_PAGINAS);
    fs.writeFileSync(path.join(dir, 'nota.md'), 'texto\n');
    const ad = leerAdjuntos(['manual.pdf', 'nota.md'], { raiz: dir });
    expect(ad[0]).toMatchObject({ ruta: 'manual.pdf', binario: true });
    expect(ad[0].texto).toBeUndefined();
    expect(ad[1]).toEqual({ ruta: 'nota.md', texto: 'texto\n' });
    const m = armarMensaje({ pedido: 'Revisá.', adjuntos: ad });
    expect(m).toMatch(/--- 1 PDF o foto\(s\) adjunto\(s\), arriba de este texto y en este orden: manual\.pdf ---/);
    expect(m).toMatch(/<archivo ruta="nota\.md">\ntexto\n\n<\/archivo>/);
    expect(m).not.toMatch(/%PDF/);
  });
  it('sin PDF ni foto, el mensaje sale igual que antes', () => {
    expect(armarMensaje({ pedido: 'x', adjuntos: [{ ruta: 'a.md', texto: 'y' }] })).toBe('x\n\n--- 1 archivo(s) adjunto(s) ---\n\n<archivo ruta="a.md">\ny\n</archivo>');
  });
});
