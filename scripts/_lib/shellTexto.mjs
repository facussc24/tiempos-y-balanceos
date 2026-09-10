/**
 * shellTexto.mjs — limpieza de texto de comandos Bash/PowerShell que comparten los guardianes.
 *
 * Nace el 10/09/2026 sacando `sinCuerposHeredoc` de guardianes.mjs (que la re-exporta) para que
 * cierreGuard.mjs la use sin importar el modulo entero de los 14 guardianes PreToolUse.
 * Lo que un comando ENTREGA se decide sobre la linea de comando, no sobre la prosa que lleva
 * adentro: el cuerpo de un heredoc y el mensaje de un `git commit -m "..."` son texto, no rutas.
 */

/** Port del awk de arb-cerrar-guard: quita los CUERPOS de heredoc, deja las lineas de comando. */
export function sinCuerposHeredoc(cmd) {
  const out = [];
  let fin = '';
  for (const l of String(cmd ?? '').split('\n')) {
    if (fin) { if (l === fin || l.trim().split(/\s+/)[0] === fin) fin = ''; continue; }
    const m = l.match(/<<-?\s*'?([A-Za-z_][A-Za-z0-9_]*)'?/);
    if (m) fin = m[1];
    out.push(l);
  }
  return out.join('\n');
}

/**
 * Quita los argumentos de mensaje y de archivo de mensaje de un `git commit`: `-m "..."`,
 * `-m '...'`, `--message=...`, `-F <ruta>`, `--file=<ruta>`. Un commit cuyo mensaje dice
 * "mover el informe al Escritorio" no entrega nada en el Escritorio (falso positivo del
 * cierre-guard, 05 y 10/09/2026).
 */
export function sinArgumentosDeCommit(cmd) {
  let c = String(cmd ?? '');
  if (!/\bgit\s+commit\b/.test(c)) return c;
  c = c.replace(/(\s)(-m|--message)(=|\s+)"(?:[^"\\]|\\.)*"/g, '$1');
  c = c.replace(/(\s)(-m|--message)(=|\s+)'[^']*'/g, '$1');
  c = c.replace(/(\s)(-m|--message)(=|\s+)\S+/g, '$1');
  c = c.replace(/(\s)(-F|--file)(=|\s+)"[^"]*"/g, '$1');
  c = c.replace(/(\s)(-F|--file)(=|\s+)'[^']*'/g, '$1');
  c = c.replace(/(\s)(-F|--file)(=|\s+)\S+/g, '$1');
  return c;
}

/** Las dos limpiezas juntas: lo que queda son lineas de comando con sus rutas reales. */
export function soloLineasDeComando(cmd) {
  return sinArgumentosDeCommit(sinCuerposHeredoc(cmd));
}
