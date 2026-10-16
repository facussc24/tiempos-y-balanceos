/**
 * compactacionRegistro.mjs — hooks PreCompact y PostCompact (via .claude/hooks/compactacion-registro.sh).
 * Anota cada compactacion en `.claude/state/compactaciones.jsonl` (gitignoreado), un renglon por evento:
 *   { fecha, evento, sesion, causa, tokens_ultimo_turno?, largo_resumen?, con_instrucciones? }
 *
 * Por que (tanda 1.3.3 del plan del sistema, 16/10/2026): hasta hoy las compactaciones se contaban leyendo los .jsonl a
 * mano (11 desde el 06/10, 9 por contexto lleno; informe casa_memoria_olvidos.md §4 bis). Desde la 2.1.29x Claude Code
 * compacta tambien una sesion quieta (`idleCompaction`); este registro dice cuantas pasan y por que, sin releer nada.
 *
 * Payload (visto con grep -a sobre el claude.exe 2.1.301, 16/10/2026): PreCompact trae `trigger` y
 * `custom_instructions`; PostCompact trae `trigger` y `compact_summary`; `trigger` es auto | manual | idle. Los tokens
 * no vienen en el payload: `tokens_ultimo_turno` sale del ultimo `usage` del transcript (lo que leyo el ultimo turno
 * antes de compactar), y si no se puede leer no va.
 *
 * Nunca frena la compactacion: sale con 0 siempre; lo que falla va a `.claude/state/compactaciones.errores.log`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ_DEL_SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TAIL_BYTES = 512 * 1024; // el ultimo turno esta al final del transcript; no se lee entero (puede pesar cientos de MB)

/** Lo que leyo el ultimo turno del modelo antes de compactar, del final del transcript. null si no se puede. */
export function tokensDelUltimoTurno(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return null;
  let fd;
  try {
    fd = fs.openSync(transcriptPath, 'r');
    const largo = fs.fstatSync(fd).size;
    const desde = Math.max(0, largo - TAIL_BYTES);
    const buf = Buffer.alloc(largo - desde);
    fs.readSync(fd, buf, 0, buf.length, desde);
    const lineas = buf.toString('utf8').split('\n').reverse();
    for (const l of lineas) {
      if (!l.includes('"usage"')) continue;
      try {
        const u = JSON.parse(l)?.message?.usage;
        if (!u) continue;
        const total = ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'].reduce((s, k) => s + (Number(u[k]) || 0), 0);
        if (total > 0) return total;
      } catch { /* renglon cortado por el corte del final: se sigue con el anterior */ }
    }
  } catch { /* sin transcript no hay tokens */ } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch { /* nada */ }
  }
  return null;
}

/** El renglon que se anota, a partir del payload del hook. */
export function renglonDe(payload, ahora = new Date()) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const r = {
    fecha: ahora.toISOString(),
    evento: typeof p.hook_event_name === 'string' ? p.hook_event_name : '?',
    sesion: typeof p.session_id === 'string' ? p.session_id : '?',
    causa: ['auto', 'manual', 'idle'].includes(p.trigger) ? p.trigger : (typeof p.trigger === 'string' ? p.trigger : '?'),
  };
  const tokens = tokensDelUltimoTurno(p.transcript_path);
  if (tokens !== null) r.tokens_ultimo_turno = tokens;
  if (typeof p.compact_summary === 'string') r.largo_resumen = p.compact_summary.length;
  if (p.hook_event_name === 'PreCompact') r.con_instrucciones = typeof p.custom_instructions === 'string' && p.custom_instructions.trim().length > 0;
  return r;
}

export function carpetaEstado(raiz) {
  return path.join(raiz, '.claude', 'state');
}

/** Lee el payload, anota el renglon y devuelve 0 pase lo que pase. */
export function correr(texto, { raiz = process.env.CLAUDE_PROJECT_DIR || RAIZ_DEL_SCRIPT, ahora = new Date() } = {}) {
  const dir = carpetaEstado(raiz);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const r = renglonDe(JSON.parse(String(texto || '{}')), ahora);
    fs.appendFileSync(path.join(dir, 'compactaciones.jsonl'), JSON.stringify(r) + '\n');
  } catch (e) {
    try { fs.appendFileSync(path.join(dir, 'compactaciones.errores.log'), `${ahora.toISOString()} ${String(e?.message ?? e).slice(0, 300)}\n`); } catch { /* sin log tampoco se frena */ }
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let texto = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { texto += c; });
  process.stdin.on('end', () => process.exit(correr(texto)));
  process.stdin.on('error', () => process.exit(0));
}
