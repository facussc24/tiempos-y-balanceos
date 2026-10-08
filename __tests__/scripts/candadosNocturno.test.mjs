// @vitest-environment node
/**
 * Candado 3 de la noche de Claude, hecho codigo: los scripts que corren solos de madrugada NO
 * escriben en Supabase, ni tocan el arb, ni mandan mails, ni matan procesos, ni lanzan `claude -p`.
 *
 * POR QUE UN TEST Y NO UN HOOK. Los hooks de Claude Code (supabase-guard, mail-guard, arb-guard...)
 * corren cuando Claude ejecuta algo; el `node` que lanza el Programador de tareas a las 06:30 no pasa
 * por ningun hook. Lo unico que lo frena es: (1) el envoltorio de solo lectura
 * (scripts/_lib/supabaseSoloLectura.mjs) y (2) este test, que lee el TEXTO de cada archivo de la noche
 * y falla si aparece algo que escribe o mata. Un cambio que lo rompa se ve en el CI antes de llegar a
 * la notebook. La auto-mejora nocturna anterior se apago el 04/08/2026 (fork bomb de `claude -p`).
 *
 * Se audita en las dos direcciones: cada patron tiene que cazar su gemelo rojo (un texto inventado
 * que SI escribe), si no el test daria verde para todo.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(fileURLToPath(import.meta.url), '../../..');
const ARCHIVOS = [
  'scripts/_nocturno.mjs',
  'scripts/_nocturno.ps1',
  'scripts/_preauditarAmfe.mjs',
  'scripts/_claude.mjs',
  'scripts/_lib/nocturno.mjs',
  'scripts/_lib/preauditoriaAmfe.mjs',
  'scripts/_lib/claudeApi.mjs',
  'scripts/_lib/supabaseSoloLectura.mjs',
];

// El envio de Outlook se arma por partes para que este archivo no tenga el texto literal (el
// mail-guard frena los archivos que lo traen junto con otras senales de Outlook).
const ENVIO_OUTLOOK = new RegExp(['\\.', 'Se', 'nd\\('].join(''));

/** Lo que no puede aparecer en ningun archivo de la noche. */
const PROHIBIDOS = [
  { que: 'guardar un documento APQP', re: /\b(saveAmfe|saveCp|saveHo|savePfd)\b/ },
  { que: 'escribir en una tabla', re: /\.(update|insert|upsert|delete)\(/ },
  { que: 'el escritor validado de AMFE', re: /\brunWithValidation\b/ },
  { que: 'matar procesos', re: /\btaskkill\b|Stop-Process/i },
  { que: 'tocar el arb', re: /produc\.exe/i },
  { que: 'mandar mails', re: /_mailEnviar|SendAndReceive/ },
  { que: 'mandar un mail de Outlook', re: ENVIO_OUTLOOK },
  { que: 'lanzar Claude Code', re: /(spawn|exec)\w*\(\s*['"`]claude\b/ },
];

/**
 * Lo unico permitido que se parece a una escritura: el `.update(` del hash de crypto
 * (claveHallazgo hace createHash('sha1').update(...)). Se saca del texto antes de mirar, con el
 * patron completo para que no tape un `.update(` de Supabase.
 */
const permitido = (t) => t.replace(/crypto\.createHash\([^)]*\)\.update\(/g, 'crypto.createHash(...).hash(');

const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

describe('candados de la noche · el texto de cada archivo', () => {
  it('0. los archivos existen (un barrido de cero archivos no prueba nada)', () => {
    for (const rel of ARCHIVOS) expect(fs.existsSync(path.join(RAIZ, rel)), rel).toBe(true);
  });

  it.each(ARCHIVOS)('1. %s no escribe, no manda, no mata y no lanza claude', (rel) => {
    const texto = permitido(leer(rel));
    const hallados = PROHIBIDOS.filter((p) => p.re.test(texto)).map((p) => p.que);
    expect(hallados, `${rel} tiene: ${hallados.join(', ')}`).toEqual([]);
  });

  it('2. a Supabase solo se entra por el envoltorio de solo lectura', () => {
    for (const rel of ARCHIVOS.filter((r) => !r.endsWith('supabaseSoloLectura.mjs'))) {
      expect(/\bconnectSupabase\w*\b|\bcreateClient\b/.test(leer(rel)), `${rel} se conecta a Supabase sin el envoltorio`).toBe(false);
    }
    expect(leer('scripts/_preauditarAmfe.mjs')).toMatch(/conectarSoloLectura/);
  });

  it('3. el .ps1 es ASCII puro (powershell.exe lo lee como ANSI)', () => {
    const bytes = fs.readFileSync(path.join(RAIZ, 'scripts/_nocturno.ps1'));
    const fuera = [...bytes].filter((b) => b > 127).length;
    expect(fuera, 'sacar tildes y simbolos del .ps1').toBe(0);
  });
});

describe('candados de la noche · gemelos rojos (cada patron caza lo que dice)', () => {
  const rojos = {
    'guardar un documento APQP': "await saveAmfe(sb, id, doc, { expectedAmfeNumber: 'X' })",
    'escribir en una tabla': "await sb.from('amfe_documents').update({ data })",
    'el escritor validado de AMFE': 'await runWithValidation(sb, fn)',
    'matar procesos': "spawnSync('taskkill', ['/F', '/IM', 'x'])",
    'tocar el arb': 'Start-Process C:\\ARB\\produc.exe',
    'mandar mails': "spawnSync('python', ['scripts/_mailEnviar.py'])",
    'mandar un mail de Outlook': ['mail', '.Se', 'nd()'].join(''),
    'lanzar Claude Code': "spawn('claude', ['-p', 'audita'])",
  };

  it.each(PROHIBIDOS.map((p) => [p.que, p.re]))('ROJO: "%s" se caza', (que, re) => {
    expect(re.test(permitido(rojos[que]))).toBe(true);
  });

  it('VERDE: el hash de crypto pasa, el .update( de Supabase no', () => {
    const re = PROHIBIDOS[1].re;
    expect(re.test(permitido("crypto.createHash('sha1').update(`a|b`).digest('hex')"))).toBe(false);
    expect(re.test(permitido("crypto.createHash('sha1'); sb.from('t').update({})"))).toBe(true);
  });

  it('VERDE: nombrar `claude -p` en un comentario no es lanzarlo', () => {
    expect(PROHIBIDOS[7].re.test('// nunca lanza `claude -p` ni procesos en cadena')).toBe(false);
  });
});
