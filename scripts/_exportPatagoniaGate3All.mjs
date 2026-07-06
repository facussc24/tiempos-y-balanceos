/**
 * Genera los 10 Gate 3 VW-ORIGINAL por pieza (inyección Patagonia), uno por molde,
 * modelando la prensa compartida con reservationPct.
 *
 * Uso:
 *   node scripts/_exportPatagoniaGate3All.mjs [outputDir]
 *   (default outputDir = ~/Documents/EXPORT_INYECCION_PATAGONIA/definitivo)
 *
 * No toca Supabase: construye el ProjectData de cada molde localmente
 * (scripts/_lib/patagoniaInjectionProjects.mjs) y llama al export en modo --data-file
 * --vw-original. Imprime un preview de capacidad vs demanda para verificar el ROJO.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { buildAll, OEE } from './_lib/patagoniaInjectionProjects.mjs';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const exportScript = join(scriptDir, '_exportProjectGate3VW.mjs');

const outDir = process.argv[2] || join(homedir(), 'Documents', 'EXPORT_INYECCION_PATAGONIA', 'definitivo');
mkdirSync(outDir, { recursive: true });
const tmp = join(tmpdir(), `patagonia_g3_${Date.now()}`);
mkdirSync(tmp, { recursive: true });

// Preview de capacidad = misma fórmula VW que core/gate3/calculations.ts.
// hoursPerShift viene de los turnos estándar (21,5 h netas / 3 = 7,1667 h), shiftsPerWeek = 15.
const SHIFTS_WEEK = 15;
const HOURS_SHIFT = 1290 / 3 / 60; // 7.1667 h  (21,5 h netas / 3 turnos)
const weeklyCap = (cycle, cav, reservation) =>
  SHIFTS_WEEK * HOURS_SHIFT * 3600 / cycle * OEE * cav * 1 * reservation;

const all = buildAll();
console.log(`\nGenerando ${all.length} Gate 3 VW-ORIGINAL por pieza`);
console.log(`Carpeta: ${outDir}`);
console.log(`OEE ${OEE * 100}%  ·  21,5 h netas/día  ·  reserva = parte del tiempo de máquina de la prensa\n`);
console.log('MOLDE                          PRENSA  RESERVA   DEMANDA/sem  CAP/sem  ESTADO');
console.log('─'.repeat(84));

const summary = [];
for (const m of all) {
  const demandWeek = m.golpes * m.cav * 5;
  const cap = Math.round(weeklyCap(m.cycle, m.cav, m.reservationPct));
  const pct = cap / demandWeek;
  const estado = cap >= demandWeek ? 'VERDE' : (pct >= 0.9 ? 'ÁMBAR' : 'ROJO');
  summary.push({ ...m, demandWeek, cap, pct, estado });
  console.log(
    `${m.name.padEnd(30)} ${m.machine.padEnd(6)} ${(m.reservationPct * 100).toFixed(2).padStart(6)}%  ${String(demandWeek).padStart(9)}  ${String(cap).padStart(7)}  ${estado} (${(pct * 100).toFixed(0)}%)`,
  );

  const jsonPath = join(tmp, `${m.key}.json`);
  writeFileSync(jsonPath, JSON.stringify(m.data));
  execSync(`node "${exportScript}" --data-file "${jsonPath}" --vw-original "${outDir}"`, { stdio: 'pipe' });
}

console.log('─'.repeat(84));
// Carga por prensa (suma de reservas = 100 %; carga real = 1 / (cap/demanda))
for (const machine of ['1200T', '750T']) {
  const rows = summary.filter((s) => s.machine === machine);
  const sumRes = rows.reduce((a, s) => a + s.reservationPct, 0);
  const load = 1 / (rows[0].pct); // cap/demanda es uniforme por prensa
  console.log(`  ${machine}: ${rows.length} moldes · Σreservas=${(sumRes * 100).toFixed(0)}% · carga=${(load * 100).toFixed(0)}% (cada pieza al ${(rows[0].pct * 100).toFixed(0)}% de su demanda)`);
}
console.log(`\n✔ ${all.length} archivos VW-original en: ${outDir}`);
